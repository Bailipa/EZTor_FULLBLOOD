import type { PrismaClient } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { StudyLevel } from '@/features/study/domain'
import { isCurrentPaper } from '@/features/study/paperAvailability'
import type { StudyMaterial, StudyMaterialCatalogue } from '@/features/study/materialTypes'
import resources from '../../../content/cet-local/index.json'

export async function studyMaterialSummary(db: PrismaClient = prisma): Promise<Pick<StudyMaterialCatalogue, 'totalSets'>> {
  const query = { where: { rightsStatus: 'APPROVED' }, select: { slug: true as const }, distinct: 'slug' as const }
  const [readings, exams] = await Promise.all([
    db.studyPassage.findMany(query),
    db.examPaper.findMany(query),
  ])
  const keys = new Set(resources.items.map((item) => item.key))
  for (const row of [...readings, ...exams]) {
    const key = row.slug.replace(/-(?:passage\d+(?:-q\d+-\d+)?|full|listening)$/, '')
    if (isCurrentPaper(key)) keys.add(key)
  }
  return { totalSets: keys.size }
}

export async function studyMaterials(db: PrismaClient = prisma): Promise<StudyMaterialCatalogue> {
  const select = { slug: true, version: true, level: true, title: true, sourceName: true, sourceUrl: true }
  const [readings, exams] = await Promise.all([
    db.studyPassage.findMany({ where: { rightsStatus: 'APPROVED' }, select, orderBy: { version: 'desc' }, distinct: ['slug'] }),
    db.examPaper.findMany({ where: { rightsStatus: 'APPROVED' }, select: { ...select, kind: true }, orderBy: { version: 'desc' }, distinct: ['slug'] }),
  ])
  const sets = new Map<string, StudyMaterial>()
  for (const item of resources.items) {
    sets.set(item.key, { key: item.key, title: item.title, level: item.level as StudyLevel,
      resources: item.resources.map(({ id, category, name, url }) => ({ id, category, name, url })),
      sources: [{ name: resources.sourceName, url: null }],
      readingPassages: 0, listening: false, full: false })
  }
  for (const row of [...readings, ...exams]) {
    const key = row.slug.replace(/-(?:passage\d+(?:-q\d+-\d+)?|full|listening)$/, '')
    if (!isCurrentPaper(key)) continue
    let item = sets.get(key)
    if (!item) {
      const identity = key.match(/^cet[46]-(\d{4})-(\d{2})-set(\d+)$/)
      item = { key, level: row.level as StudyLevel, title: identity ? `${identity[1]}年${Number(identity[2])}月 · 第${identity[3]}套` : row.title,
        sources: [], readingPassages: 0, listening: false, full: false }
      sets.set(key, item)
    }
    if (!item.sources.some((source) => source.url === row.sourceUrl)) item.sources.push({ name: row.sourceName, url: row.sourceUrl })
    if ('kind' in row) {
      item.full ||= row.kind === 'FULL'
      item.listening ||= row.kind === 'FULL' || row.kind === 'LISTENING'
    } else item.readingPassages += 1
  }
  const items = [...sets.values()].sort((a, b) => b.key.localeCompare(a.key))
  return { totalSets: items.length, items }
}
