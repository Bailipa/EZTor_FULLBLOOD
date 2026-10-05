/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { POST } from '../import/route'
import prisma from '@/lib/prisma'
// Test-only export from the mocked Prisma module.
import * as prismaModule from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { sanitizeInput } from '@/lib/security'

const fixture = vi.hoisted(() => ({ share: null as any, receipt: null as any, words: {} as Record<string, any>, links: [] as string[] }))

// Mock dependencies
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  sanitizeInput: vi.fn((input: string) => input),
}))

vi.mock('@/lib/prisma', () => {
  const apply = (record: any, data: any) => {
    for (const [key, value] of Object.entries(data)) {
      record[key] = value && typeof value === 'object' && 'increment' in value
        ? (record[key] || 0) + (value as any).increment
        : value && typeof value === 'object' && 'decrement' in value
          ? (record[key] || 0) - (value as any).decrement : value
    }
    return { ...record }
  }
  const mockPrisma: any = {
    publicWord: { findUnique: vi.fn(), create: vi.fn(), createMany: vi.fn() },
    sharedVocabulary: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    sharedVocabularyImport: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    reviewGroup: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    word: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
    reviewGroupWord: { create: vi.fn(), createMany: vi.fn(), findUnique: vi.fn() },
    $queryRaw: vi.fn(), $executeRaw: vi.fn(), $transaction: vi.fn(),
  }
  // Install a small stateful mock so committed receipts/counters survive later calls,
  // while rejected transactions restore their own batch snapshot.
  const reset = () => {
    fixture.share = null; fixture.receipt = null; fixture.words = {}; fixture.links = []
    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.sharedVocabulary.findUniqueOrThrow.mockImplementation(async () => {
      fixture.share ??= { ...await mockPrisma.sharedVocabulary.findUnique() }
      return { ...fixture.share }
    })
    mockPrisma.sharedVocabulary.update.mockImplementation(async ({ data }: any) => apply(fixture.share, data))
    mockPrisma.sharedVocabularyImport.findUnique.mockImplementation(async () => fixture.receipt && { ...fixture.receipt })
    mockPrisma.sharedVocabularyImport.findUniqueOrThrow.mockImplementation(async () => {
      if (!fixture.receipt) throw new Error('Missing receipt')
      return { ...fixture.receipt }
    })
    mockPrisma.sharedVocabularyImport.findMany.mockResolvedValue([])
    mockPrisma.sharedVocabularyImport.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.sharedVocabularyImport.create.mockImplementation(async ({ data }: any) => {
      fixture.receipt = { processedCount: 0, wordsSkipped: 0, ...data }
      return { ...fixture.receipt }
    })
    mockPrisma.sharedVocabularyImport.update.mockImplementation(async ({ data, select }: any) => {
      const receipt = apply(fixture.receipt, data)
      return select ? Object.fromEntries(Object.keys(select).map((key) => [key, receipt[key]])) : receipt
    })
    mockPrisma.reviewGroup.count.mockResolvedValue(0)
    mockPrisma.reviewGroup.create.mockImplementation(async ({ data }: any) => ({ ...data, id: 'new-group-1' }))
    mockPrisma.reviewGroup.findFirst.mockImplementation(async ({ where }: any) => {
      const group = where.id === 'new-group-1'
        ? { id: where.id, name: 'Test Group', userId: 'test-user-123' }
        : await mockPrisma.reviewGroup.findUnique({ where: { id: where.id } })
      return group?.userId === where.userId ? group : null
    })
    mockPrisma.publicWord.findUnique.mockResolvedValue({ id: 'public-word-1' })
    mockPrisma.word.findUnique.mockImplementation(async ({ where }: any) => fixture.words[where.word_userId.word] ?? null)
    mockPrisma.word.createMany.mockImplementation(async ({ data }: any) => {
      let count = 0
      for (const word of data) if (!fixture.words[word.word]) { fixture.words[word.word] = { ...word }; count++ }
      return { count }
    })
    mockPrisma.word.findUniqueOrThrow.mockImplementation(async ({ where }: any) => fixture.words[where.word_userId.word])
    mockPrisma.reviewGroupWord.createMany.mockImplementation(async ({ data }: any) => {
      const existing = await mockPrisma.reviewGroupWord.findUnique()
      let count = 0
      for (const link of data) {
        const key = link.reviewGroupId + ':' + link.wordId
        if (!existing && !fixture.links.includes(key)) { fixture.links.push(key); count++ }
      }
      return { count }
    })
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const snapshot = structuredClone(fixture)
      try { return await fn(mockPrisma) }
      catch (error) { Object.assign(fixture, snapshot); throw error }
    })
  }
  return { default: mockPrisma, resetImportFixture: reset }
})

describe('Share Import API', () => {
  const mockUserId = 'test-user-123'
  const validShareCode = 'ABC-234-XYZ'

  const mockSession = {
    user: {
      id: mockUserId,
      username: 'testuser',
    },
  }

  const mockShare: any = {
    id: 'share-1',
    code: validShareCode,
    name: 'Test Share',
    description: null,
    userId: mockUserId,
    shareType: 'REVIEW_GROUP',
    reviewGroupId: 'group-1',
    isActive: true,
    usedCount: 0,
    maxUses: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    wordCount: 1,
    importedCount: 0,
    viewCount: 0,
    version: 1,
    ReviewGroup: {
      ReviewGroupWord: [
        {
          Word: {
            word: 'test',
            phonetic: '/test/',
            pos: 'n.',
            translation: '测试',
            example: 'This is a test',
            exampleTranslation: '这是一个测试',
          },
        },
      ],
    },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(sanitizeInput).mockImplementation((input) => input)
    ;(prismaModule as unknown as { resetImportFixture: () => void }).resetImportFixture()
    vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Authentication & Authorization', () => {
    it('should reject unauthenticated requests', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('未授权访问')
    })

    it('should reject requests without user id', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: null },
      } as any)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid share code format', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'invalid-code',
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('INVALID_FORMAT')
    })

    it('should normalize lowercase share code to uppercase', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
      vi.mocked(prisma.sharedVocabulary.updateMany).mockResolvedValue({ count: 1 })
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      } as any)
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' } as any)
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({} as any)
      vi.mocked(prisma.word.findMany).mockResolvedValue([])

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'abc-234-xyz',
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.sharedVocabulary.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'ABC-234-XYZ' },
        }),
      )
    })

    it('should reject empty custom name', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: '',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should reject missing custom name', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('Share Code Validation', () => {
    it('should reject non-existent share code', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(null)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('INVALID_CODE')
    })

    it('should reject inactive share', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        isActive: false,
      })

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toBe('INACTIVE_SHARE')
    })

    it('should reject expired share code', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        expiresAt: new Date('2020-01-01'),
      })

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(410)
      expect(data.success).toBe(false)
      expect(data.error).toBe('EXPIRED_CODE')
    })

    it('should reject when max uses reached', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        maxUses: 5,
        usedCount: 5,
      })

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toBe('MAX_USES_REACHED')
    })

    it('should reject when the locked share has reached maxUses after the initial read', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        maxUses: 5,
        usedCount: 4,
      })
      vi.mocked(prisma.sharedVocabulary.findUniqueOrThrow).mockResolvedValue({ ...mockShare, maxUses: 5, usedCount: 5 } as any)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error).toBe('MAX_USES_REACHED')
      expect(prisma.sharedVocabulary.update).not.toHaveBeenCalled()
      expect(vi.mocked(prisma.$queryRaw).mock.calls.some((call) => (call[0] as unknown as string[]).join('?').includes('\"SharedVocabulary\"'))).toBe(true)
    })
  })

  describe('Duplicate Import Prevention', () => {
    it('should reject duplicate import', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue({
        id: 'import-1',
        sharedId: mockShare.id,
        importerId: mockUserId,
        targetGroupId: 'existing-group-1',
        status: 'COMPLETED',
      } as any)
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue({
        id: 'existing-group-1',
        name: 'Existing Group',
        userId: mockUserId,
      } as any)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.success).toBe(false)
      expect(data.error).toBe('ALREADY_IMPORTED')
    })

    it('should allow re-import when target group was deleted', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      } as any)
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' } as any)
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({} as any)
      vi.mocked(prisma.word.findMany).mockResolvedValue([])

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.sharedVocabularyImport.delete).not.toHaveBeenCalled()
      expect(fixture.receipt.status).toBe('COMPLETED')
    })
  })

  describe('Target Group Management', () => {
    it('should create new group when createNewGroup is true', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      } as any)
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' } as any)
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({} as any)
      vi.mocked(prisma.word.findMany).mockResolvedValue([])

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
          createNewGroup: true,
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.reviewGroup.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          name: 'Test Group',
          userId: mockUserId,
          updatedAt: expect.any(Date),
        },
      })
    })

    it('should reject when user already owns 3 non-system groups', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
      vi.mocked(prisma.reviewGroup.count).mockResolvedValue(3)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
          createNewGroup: true,
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('GROUP_LIMIT_REACHED')
      expect(prisma.reviewGroup.create).not.toHaveBeenCalled()
    })

    it('should use existing group when targetGroupId is provided', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue({
        id: 'existing-group-1',
        name: 'Existing Group',
        userId: mockUserId,
      } as any)
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' } as any)
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({} as any)
      vi.mocked(prisma.word.findMany).mockResolvedValue([])

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          targetGroupId: 'existing-group-1',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.reviewGroup.findFirst).toHaveBeenCalledWith({
        where: { id: 'existing-group-1', userId: mockUserId },
      })
    })

    it('should reject when target group does not exist', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue(null)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          targetGroupId: 'non-existent-group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it('should reject when target group belongs to another user', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue({
        id: 'other-group-1',
        name: 'Other Group',
        userId: 'other-user-456',
      } as any)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          targetGroupId: 'other-group-1',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it('should reject when neither targetGroupId nor createNewGroup is provided', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          createNewGroup: false,
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('Import Process', () => {
    beforeEach(() => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare as any)
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      } as any)
      vi.mocked(prisma.publicWord.create).mockResolvedValue({ id: 'public-word-1' } as any)
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' } as any)
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({} as any)
      vi.mocked(prisma.reviewGroupWord.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.word.findMany).mockResolvedValue([])
    })

    it('should successfully import words', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('wordsImported')
      expect(data.data).toHaveProperty('wordsSkipped')
      expect(data.data).toHaveProperty('groupId')
      expect(data.data).toHaveProperty('groupName')
    })

    it('should skip existing words but still link them to the target group when skipExisting is true', async () => {
      vi.mocked(prisma.word.findUnique).mockResolvedValue({
        id: 'existing-word-1',
        word: 'test',
      } as any)
      vi.mocked(prisma.reviewGroupWord.findUnique).mockResolvedValue(null)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
          skipExisting: true,
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.wordsSkipped).toBe(1)
      expect(prisma.reviewGroupWord.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ reviewGroupId: 'new-group-1', wordId: 'existing-word-1' })],
        skipDuplicates: true,
      })
    })

    it('should not create ReviewGroupWord when word already exists in target group', async () => {
      vi.mocked(prisma.word.findUnique).mockResolvedValue({
        id: 'existing-word-1',
        word: 'test',
      } as any)
      vi.mocked(prisma.reviewGroupWord.findUnique).mockResolvedValue({
        id: 'existing-link-1',
        reviewGroupId: 'new-group-1',
        wordId: 'existing-word-1',
      } as any)

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
          skipExisting: true,
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.wordsSkipped).toBe(1)
      expect(fixture.links).toHaveLength(0)
      expect(prisma.reviewGroupWord.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }))
    })

    it('should update share usage count after successful import', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      await POST(req)

      expect(prisma.sharedVocabulary.update).toHaveBeenCalledWith({
        where: { id: mockShare.id },
        data: {
          importedCount: { increment: 1 },
        },
      })
      expect(fixture.share.usedCount).toBe(1)
      expect(fixture.share.importedCount).toBe(1)
    })

    it('should reserve a receipt before importing words and mark it completed', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      await POST(req)

      expect(prisma.sharedVocabularyImport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sharedId: mockShare.id,
          importerId: mockUserId,
          targetGroupId: 'new-group-1',
          status: 'RUNNING',
          useReserved: true,
        }),
      })
      expect(fixture.receipt).toMatchObject({ status: 'COMPLETED', wordsImported: 1, processedCount: 1 })
    })
  })

  describe('Persistent receipt recovery', () => {
    it('commits only complete batches, releases the failed reservation and resumes exactly once', async () => {
      const source = Array.from({ length: 52 }, (_, index) => ({
        Word: { ...mockShare.ReviewGroup.ReviewGroupWord[0].Word, word: `word-${index}` },
      }))
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare, maxUses: 1, ReviewGroup: { ReviewGroupWord: source },
      } as any)
      const createWords = vi.mocked(prisma.word.createMany).getMockImplementation()!
      vi.mocked(prisma.word.createMany).mockImplementation(((args: any) => {
        if (args.data[0].word === 'word-51') throw new Error('Second batch failure')
        return createWords(args)
      }) as typeof createWords)
      const request = () => new Request('http://localhost/api/share/import', {
        method: 'POST', body: JSON.stringify({ code: validShareCode, customName: 'Test Group' }),
      })
      const failed = await (await POST(request())).json()
      expect(failed.success).toBe(false)
      expect(failed.data).toEqual({ wordsImported: 50, wordsSkipped: 0, processedCount: 50 })
      expect(fixture.receipt).toMatchObject({ status: 'FAILED', processedCount: 50, useReserved: false })
      expect(fixture.share).toMatchObject({ usedCount: 0, importedCount: 50 })
      expect(Object.keys(fixture.words)).toHaveLength(50)
      expect(fixture.links).toHaveLength(50)
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30000 })
      const sql = vi.mocked(prisma.$queryRaw).mock.calls.map((call) => (call[0] as unknown as string[]).join('?'))
      expect(sql.some((query) => query.includes('"SharedVocabulary"') && query.includes('FOR UPDATE'))).toBe(true)
      expect(sql.some((query) => query.includes('"SharedVocabularyImport"') && query.includes('FOR UPDATE'))).toBe(true)

      vi.mocked(prisma.word.createMany).mockImplementation(createWords)
      const recovered = await (await POST(request())).json()
      expect(recovered.success).toBe(true)
      expect(recovered.data.wordsImported).toBe(52)
      expect(fixture.receipt).toMatchObject({ status: 'COMPLETED', processedCount: 52, wordsImported: 52, useReserved: false })
      expect(fixture.share).toMatchObject({ usedCount: 1, importedCount: 52 })
      expect(Object.keys(fixture.words)).toHaveLength(52)
      expect(fixture.links).toHaveLength(52)
      expect(prisma.sharedVocabularyImport.create).toHaveBeenCalledTimes(1)
      expect((await (await POST(request())).json()).error).toBe('ALREADY_IMPORTED')
      expect(fixture.share.usedCount).toBe(1)
    })

    it('rejects an active same-account lease without reserving another use or creating a group', async () => {
      fixture.receipt = { id: 'running-import', status: 'RUNNING', leaseToken: 'other-request',
        leaseExpiresAt: new Date(Date.now() + 120000), useReserved: true, targetGroupId: 'new-group-1' }
      const response = await POST(new Request('http://localhost/api/share/import', {
        method: 'POST', body: JSON.stringify({ code: validShareCode, customName: 'Test Group' }),
      }))
      expect(response.status).toBe(409)
      expect((await response.json()).error).toBe('IMPORT_IN_PROGRESS')
      expect(prisma.sharedVocabulary.update).not.toHaveBeenCalled()
      expect(prisma.sharedVocabularyImport.create).not.toHaveBeenCalled()
      expect(prisma.reviewGroup.create).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling & Transaction Rollback', () => {
    beforeEach(() => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare)
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      } as any)
    })

    it('should handle Prisma relation query errors gracefully', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockRejectedValue(
        new Error('Prisma client could not find relation reviewGroup'),
      )

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })

    it('should rollback on transaction failure', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Database error during transaction'),
      )

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)

      // Should handle error gracefully
      expect(response.status).toBe(500)
      expect(fixture.receipt).toBeNull()
      expect(Object.keys(fixture.words)).toHaveLength(0)
      expect(prisma.sharedVocabulary.update).not.toHaveBeenCalled()
    })

    it('should handle unique constraint errors', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed',
      })

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('IMPORT_FAILED')
    })

    it('should handle record not found errors', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue({
        code: 'P2025',
        message: 'Record not found',
      })

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('IMPORT_FAILED')
    })

    it('should handle transaction errors gracefully', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Transaction failed'))

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('IMPORT_FAILED')
    })
  })
})
