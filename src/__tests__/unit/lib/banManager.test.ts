/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkUserBan, checkIpBan, recordViolation } from '@/lib/banManager'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ipBan: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    securityViolation: {
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}))

const prisma = (await import('@/lib/prisma')).default

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkUserBan', () => {
  it('returns not banned when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    const result = await checkUserBan('nonexistent-id')
    expect(result).toEqual({ isBanned: false })
  })

  it('returns not banned when user exists but is not banned', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', isBanned: false })
    const result = await checkUserBan('user-1')
    expect(result).toEqual({ isBanned: false })
  })

  it('returns banned when user is permanently banned', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isBanned: true,
      banReason: 'Permanent ban',
      banExpiresAt: null,
    })
    const result = await checkUserBan('user-1')
    expect(result).toEqual({
      isBanned: true,
      reason: 'Permanent ban',
      expiresAt: undefined,
    })
  })

  it('returns banned when ban has not expired', async () => {
    const future = new Date(Date.now() + 3600000).toISOString()
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isBanned: true,
      banReason: 'Temp ban',
      banExpiresAt: future,
    })
    const result = await checkUserBan('user-1')
    expect(result.isBanned).toBe(true)
    expect(result.reason).toBe('Temp ban')
    expect(result.expiresAt).toBeInstanceOf(Date)
  })

  it('auto-unbans when ban has expired', async () => {
    const past = new Date(Date.now() - 3600000).toISOString()
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isBanned: true,
      banReason: 'Expired ban',
      banExpiresAt: past,
    })
    prisma.user.update.mockResolvedValue({})
    const result = await checkUserBan('user-1')
    expect(result).toEqual({ isBanned: false })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isBanned: false, banReason: null, banExpiresAt: null },
    })
  })

  it('uses default reason when banReason is null', async () => {
    const future = new Date(Date.now() + 3600000).toISOString()
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isBanned: true,
      banReason: null,
      banExpiresAt: future,
    })
    const result = await checkUserBan('user-1')
    expect(result.reason).toBe('Account banned')
  })
})

describe('checkIpBan', () => {
  it('returns not banned when IP is not in ban list', async () => {
    prisma.ipBan.findUnique.mockResolvedValue(null)
    const result = await checkIpBan('1.2.3.4')
    expect(result).toEqual({ isBanned: false })
  })

  it('returns banned for permanent IP ban', async () => {
    prisma.ipBan.findUnique.mockResolvedValue({
      ipAddress: '1.2.3.4',
      isPermanent: true,
      reason: 'Malicious activity',
    })
    const result = await checkIpBan('1.2.3.4')
    expect(result).toEqual({
      isBanned: true,
      reason: 'Malicious activity',
    })
  })

  it('returns banned for temporary IP ban that has not expired', async () => {
    const future = new Date(Date.now() + 3600000)
    prisma.ipBan.findUnique.mockResolvedValue({
      ipAddress: '1.2.3.4',
      isPermanent: false,
      reason: 'Temp IP ban',
      expiresAt: future,
    })
    const result = await checkIpBan('1.2.3.4')
    expect(result.isBanned).toBe(true)
    expect(result.reason).toBe('Temp IP ban')
    expect(result.expiresAt).toEqual(future)
  })

  it('auto-removes expired IP ban', async () => {
    const past = new Date(Date.now() - 3600000)
    prisma.ipBan.findUnique.mockResolvedValue({
      ipAddress: '1.2.3.4',
      isPermanent: false,
      reason: 'Expired IP ban',
      expiresAt: past,
    })
    prisma.ipBan.delete.mockResolvedValue({})
    const result = await checkIpBan('1.2.3.4')
    expect(result).toEqual({ isBanned: false })
    expect(prisma.ipBan.delete).toHaveBeenCalledWith({
      where: { ipAddress: '1.2.3.4' },
    })
  })

  it('gracefully handles prisma error and returns not banned', async () => {
    prisma.ipBan.findUnique.mockRejectedValue(new Error('DB error'))
    const result = await checkIpBan('1.2.3.4')
    expect(result).toEqual({ isBanned: false })
  })
})

describe('recordViolation', () => {
  it('records a violation and returns warning for first offense', async () => {
    prisma.securityViolation.create.mockResolvedValue({ id: 'v-1' })
    prisma.securityViolation.count.mockResolvedValue(1)

    const result = await recordViolation('user-1', 'injection', 'malicious input', '1.2.3.4')

    expect(result).toEqual({
      violationCount: 1,
      banApplied: false,
      banInfo: { type: 'warning', message: '警告：检测到可疑行为' },
    })
  })

  it('applies 1h temp ban at threshold 3', async () => {
    prisma.securityViolation.create.mockResolvedValue({ id: 'v-1' })
    prisma.securityViolation.count.mockResolvedValue(3)
    prisma.user.update.mockResolvedValue({})

    const result = await recordViolation('user-1', 'injection', 'input')

    expect(result.banApplied).toBe(true)
    expect(result.banInfo).toEqual({
      type: 'temp_ban',
      duration: 1,
      message: '账户已被临时封禁1小时',
    })
  })

  it('applies 24h temp ban at threshold 5', async () => {
    prisma.securityViolation.create.mockResolvedValue({ id: 'v-1' })
    prisma.securityViolation.count.mockResolvedValue(5)
    prisma.user.update.mockResolvedValue({})
    prisma.ipBan.upsert.mockResolvedValue({})

    const result = await recordViolation('user-1', 'injection', 'input', '1.2.3.4')

    expect(result.banApplied).toBe(true)
    expect(result.banInfo).toEqual({
      type: 'temp_ban',
      duration: 24,
      message: '账户已被临时封禁24小时',
    })
    expect(prisma.ipBan.upsert).toHaveBeenCalled()
  })

  it('applies permanent ban at threshold 10', async () => {
    prisma.securityViolation.create.mockResolvedValue({ id: 'v-1' })
    prisma.securityViolation.count.mockResolvedValue(10)
    prisma.user.update.mockResolvedValue({})
    prisma.ipBan.upsert.mockResolvedValue({})

    const result = await recordViolation('user-1', 'injection', 'input', '1.2.3.4')

    expect(result.banApplied).toBe(true)
    expect(result.banInfo).toEqual({
      type: 'permanent_ban',
      message: '账户已被永久封禁',
    })
    expect(prisma.ipBan.upsert).toHaveBeenCalled()
  })

  it('truncates input value to 500 characters', async () => {
    const longInput = 'x'.repeat(1000)
    prisma.securityViolation.create.mockResolvedValue({ id: 'v-1' })
    prisma.securityViolation.count.mockResolvedValue(0)

    await recordViolation('user-1', 'injection', longInput)

    expect(prisma.securityViolation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inputValue: 'x'.repeat(500),
        }),
      }),
    )
  })

  it('returns count 0 and no ban when violation creation fails', async () => {
    prisma.securityViolation.create.mockRejectedValue(new Error('DB error'))

    const result = await recordViolation('user-1', 'injection', 'input')

    expect(result).toEqual({ violationCount: 0, banApplied: false })
  })

  it('falls back to count=1 when count query fails', async () => {
    prisma.securityViolation.create.mockResolvedValue({ id: 'v-1' })
    prisma.securityViolation.count.mockRejectedValue(new Error('Count error'))

    const result = await recordViolation('user-1', 'injection', 'input')

    expect(result.violationCount).toBe(1)
    expect(result.banInfo).toBeDefined()
  })
})
