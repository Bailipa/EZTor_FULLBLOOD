import prisma from '@/lib/prisma'

export interface ZhEnLookupWord {
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
  matchType: 'exact' | 'contains'
}

export interface ZhEnLookupResult {
  query: string
  total: number
  hasMore: boolean
  words: ZhEnLookupWord[]
}

const ZH_EN_DEFAULT_LIMIT = 20
const ZH_EN_MAX_LIMIT = 50

/**
 * 纯词库中译英：按公共词库的中文释义反向匹配英文单词（不调用任何 AI）。
 * 一个中文对应多个英文（多义词）时自然返回多个候选。
 */
export async function lookupZhEn(
  text: string,
  limit = ZH_EN_DEFAULT_LIMIT,
): Promise<ZhEnLookupResult> {
  const cleaned = String(text ?? '')
    .replace(/[^\u4e00-\u9fff]/g, '')
    .trim()
  const originalQuery = String(text ?? '').trim()
  if (!cleaned) return { query: originalQuery, total: 0, hasMore: false, words: [] }

  const take = Math.min(Math.max(1, Math.floor(limit)), ZH_EN_MAX_LIMIT)
  const where = { translation: { contains: cleaned } }
  const [total, exactRows] = await Promise.all([
    prisma.publicWord.count({ where }),
    prisma.publicWord.findMany({
      where: { translation: cleaned },
      orderBy: [{ qualityScore: 'desc' }, { word: 'asc' }],
      take,
      select: { word: true, phonetic: true, pos: true, translation: true },
    }),
  ])
  const containsRows = exactRows.length < take
    ? await prisma.publicWord.findMany({
        where: { ...where, ...(exactRows.length ? { word: { notIn: exactRows.map((row) => row.word) } } : {}) },
        orderBy: [{ qualityScore: 'desc' }, { word: 'asc' }],
        take: take - exactRows.length,
        select: { word: true, phonetic: true, pos: true, translation: true },
      })
    : []
  const rows = [...exactRows, ...containsRows]

  return {
    query: originalQuery,
    total,
    hasMore: total > rows.length,
    words: rows.map((r) => ({
      word: r.word,
      phonetic: r.phonetic,
      pos: r.pos,
      translation: r.translation,
      matchType: r.translation === cleaned ? 'exact' : 'contains',
    })),
  }
}
