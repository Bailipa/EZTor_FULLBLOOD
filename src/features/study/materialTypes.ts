import type { StudyLevel } from './domain'
export type StudyResource = {
  id: string; category: string; name: string; url: string
}
export type StudyMaterial = {
  key: string; level: StudyLevel; title: string
  sources: { name: string; url: string | null }[]
  readingPassages: number; listening: boolean; full: boolean
  resources?: StudyResource[]
}
export type StudyMaterialCatalogue = { totalSets: number; items: StudyMaterial[] }
