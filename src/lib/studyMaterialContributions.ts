import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import prisma from '@/lib/prisma'

export const MATERIAL_MAX_BYTES = 10 * 1024 * 1024
const STORAGE_DIR = process.env.STUDY_MATERIAL_STORAGE_DIR || path.join(process.cwd(), 'private', 'study-material-contributions')
const ENTITY_TYPE = 'StudyMaterialSubmission'

export type MaterialSubmission = {
  id: string
  name: string
  yearSet: string
  level: string
  sourceUrl: string
  description: string
  answers: string
  files: { id: string; name: string; size: number; type: string }[]
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewNote?: string
  createdAt: Date
}

export function parseMaterialSubmission(row: { id: string; newValue: string | null; createdAt: Date }): MaterialSubmission | null {
  try { return JSON.parse(row.newValue || '') as MaterialSubmission } catch { return null }
}

export async function saveMaterialFile(id: string, bytes: Uint8Array) {
  await mkdir(STORAGE_DIR, { recursive: true, mode: 0o700 })
  await writeFile(path.join(STORAGE_DIR, `${id}.blob`), bytes, { flag: 'wx', mode: 0o600 })
}

export async function readMaterialFile(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  try { return await readFile(path.join(STORAGE_DIR, `${id}.blob`)) } catch { return null }
}

export async function removeMaterialFiles(ids: string[]) {
  await Promise.all(ids.map((id) => /^[0-9a-f-]{36}$/i.test(id) ? rm(path.join(STORAGE_DIR, `${id}.blob`), { force: true }) : Promise.resolve()))
}

export async function listMaterialSubmissions(userId?: string) {
  const rows = await prisma.auditLog.findMany({
    where: { entityType: ENTITY_TYPE, action: 'STUDY_MATERIAL_SUBMITTED', ...(userId ? { userId } : {}) }, orderBy: { createdAt: 'desc' }, take: 100,
  })
  return rows.map((row) => parseMaterialSubmission(row)).filter((row): row is MaterialSubmission => Boolean(row))
}

export class MaterialReviewConflict extends Error {}

export async function addMaterialStatusAudit(userId: string, rowId: string, expectedValue: string, before: MaterialSubmission, after: MaterialSubmission, req: Request) {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.auditLog.updateMany({
      where: { id: rowId, entityType: ENTITY_TYPE, action: 'STUDY_MATERIAL_SUBMITTED', newValue: expectedValue },
      data: { newValue: JSON.stringify(after) },
    })
    if (updated.count !== 1) throw new MaterialReviewConflict('Submission has already been reviewed')
    await tx.auditLog.create({ data: {
      userId, action: `STUDY_MATERIAL_${after.status}`, entityType: ENTITY_TYPE, entityId: after.id,
      oldValue: JSON.stringify({ status: before.status, reviewNote: before.reviewNote }),
      newValue: JSON.stringify({ status: after.status, reviewNote: after.reviewNote }),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || null,
      userAgent: req.headers.get('user-agent') || null,
    } })
  })
}

export function newMaterialFileId() { return randomUUID() }
