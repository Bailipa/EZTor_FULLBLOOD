// Compatibility catalogue for papers imported before independent resource publishing.
import resources from '../../../content/cet-local/index.json'
import figures from '../../../content/cet-local/writing-figures.json'
import originals from '../../../content/cet-original/index.json'
import { examPaperKey } from './ExamAccessService'

export const legacyResourceKeys = new Map<string, Set<string>>()
for (const item of resources.items) for (const resource of item.resources) {
  if (!resource.url.endsWith('.m4a')) continue
  const keys = legacyResourceKeys.get(resource.url) ?? new Set<string>()
  keys.add(item.key); legacyResourceKeys.set(resource.url, keys)
}
for (const [key, figure] of Object.entries(figures)) legacyResourceKeys.set(figure.url, new Set([key]))
for (const paper of originals.papers) for (const url of paper.audio) {
  const keys = legacyResourceKeys.get(url) ?? new Set<string>()
  keys.add(examPaperKey(paper.slug)); legacyResourceKeys.set(url, keys)
}

