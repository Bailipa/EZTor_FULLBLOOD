import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getServerSession } from 'next-auth/next'
import prisma from '@/lib/prisma'
import { POST } from '@/app/api/study/material-submissions/route'
import { PATCH } from '@/app/api/admin/study/material-submissions/route'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }))
vi.mock('@/lib/csrf', () => ({ checkCsrfHeader: () => ({ valid: true }) }))
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(async () => ({ success: true })) }))
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), readFile: vi.fn(), rm: vi.fn(), writeFile: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: {
  auditLog: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
} }))

const pending = {
  id: 'submission-1', name: 'Sample CET paper', yearSet: '2026-06 A', level: 'CET-4',
  sourceUrl: 'https://example.com/source', description: '', answers: '', files: [],
  status: 'PENDING', createdAt: new Date().toISOString(),
}

function formRequest(fields: Record<string, string>, file?: { name: string; content: string }, account = 'account-a') {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  if (file) form.append('files', new File([file.content], file.name, { type: 'text/plain' }))
  return new Request('http://localhost/api/study/material-submissions', { method: 'POST', headers: { origin: 'http://localhost', 'x-study-account': account }, body: form })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'account-a' } } as never)
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
  vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({ id: 'audit-row-1', entityType: 'StudyMaterialSubmission', entityId: pending.id, action: 'STUDY_MATERIAL_SUBMITTED', newValue: JSON.stringify(pending), createdAt: new Date() } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true } as never)
  vi.mocked(prisma.auditLog.updateMany).mockResolvedValue({ count: 1 } as never)
  vi.mocked(prisma.$transaction).mockImplementation((async (operation: unknown) => {
    if (typeof operation === 'function') return operation({ auditLog: { updateMany: prisma.auditLog.updateMany, create: prisma.auditLog.create } })
    return Promise.all(operation as Promise<unknown>[])
  }) as never)
})

describe('study material contribution API', () => {
  const validFields = { name: 'Sample CET paper', yearSet: '2026-06 A', level: 'CET-4', sourceUrl: 'https://example.com/source' }

  it('rejects anonymous submissions', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const response = await POST(formRequest(validFields, { name: 'paper.txt', content: 'plain text' }))
    expect(response.status).toBe(401)
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('rejects a mismatched account scope', async () => {
    const response = await POST(formRequest(validFields, { name: 'paper.txt', content: 'plain text' }, 'account-b'))
    expect(response.status).toBe(409)
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('rejects admin review requests from non-admins', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false } as never)
    const response = await PATCH(new Request('http://localhost/api/admin/study/material-submissions', {
      method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ id: pending.id, status: 'APPROVED', reviewNote: '核验通过' }),
    }))
    expect(response.status).toBe(403)
    expect(prisma.auditLog.findFirst).not.toHaveBeenCalled()
  })

  it('rejects missing source and file content that does not match its extension', async () => {
    const missingSource = await POST(formRequest({ ...validFields, sourceUrl: '' }, { name: 'paper.txt', content: 'plain text' }))
    const invalidFile = await POST(formRequest(validFields, { name: 'paper.pdf', content: 'plain text' }))
    expect(missingSource.status).toBe(400)
    expect(invalidFile.status).toBe(400)
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('accepts a valid TXT submission and records it pending review', async () => {
    const response = await POST(formRequest(validFields, { name: 'paper.txt', content: 'sample paper and answer key' }))
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ status: 'PENDING' })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'STUDY_MATERIAL_SUBMITTED' }) }))
  })

  it('returns 409 for a concurrent review and writes no second audit row', async () => {
    vi.mocked(prisma.auditLog.updateMany).mockResolvedValue({ count: 0 } as never)
    const response = await PATCH(new Request('http://localhost/api/admin/study/material-submissions', {
      method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ id: pending.id, status: 'APPROVED', reviewNote: '核验通过' }),
    }))
    expect(response.status).toBe(409)
    expect(prisma.auditLog.updateMany).toHaveBeenCalledOnce()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })
})
