import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { reviewGroup: { findMany: vi.fn() } } }))

const groups = [
  { id: 'custom-a', name: '自定义词库', userId: 'account-a', isSystem: false },
  { id: 'unknown-a', name: '_unknown_words', userId: 'account-a', isSystem: true },
  { id: 'known-a', name: '_known_words', userId: 'account-a', isSystem: true },
  { id: 'unknown-b', name: '_unknown_words', userId: 'account-b', isSystem: true },
]
type FindManyArgs = Parameters<typeof prisma.reviewGroup.findMany>[0]

beforeEach(() => {
  vi.mocked(prisma.reviewGroup.findMany).mockClear()
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'account-a' } } as never)
  vi.mocked(prisma.reviewGroup.findMany).mockImplementation(((args: FindManyArgs | undefined) => {
    const filter = args?.where as { userId: string; isSystem?: boolean; OR?: { isSystem: boolean; name?: string }[] }
    return groups.filter(group => group.userId === filter.userId && (
      filter.OR ? filter.OR.some(condition => group.isSystem === condition.isSystem && (!condition.name || group.name === condition.name))
        : group.isSystem === filter.isSystem
    )) as never
  }) as unknown as typeof prisma.reviewGroup.findMany)
})

describe('review group reads for dictation', () => {
  it('keeps the default endpoint limited to custom groups', async () => {
    const response = await GET(new Request('http://localhost/api/review-groups'))
    const body = await response.json()

    expect(body.data.map((group: { id: string }) => group.id)).toEqual(['custom-a'])
    expect(prisma.reviewGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'account-a', isSystem: false } }))
  })

  it('includes only the current user’s unknown words system group for explicit dictation purpose', async () => {
    const response = await GET(new Request('http://localhost/api/review-groups?purpose=dictation'))
    const body = await response.json()

    expect(body.data.map((group: { id: string }) => group.id)).toEqual(['custom-a', 'unknown-a'])
    expect(prisma.reviewGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'account-a', OR: [{ isSystem: false }, { isSystem: true, name: '_unknown_words' }] },
    }))
  })

  it('does not query groups for unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/api/review-groups?purpose=dictation'))

    expect(response.status).toBe(401)
    expect(prisma.reviewGroup.findMany).not.toHaveBeenCalled()
  })
})
