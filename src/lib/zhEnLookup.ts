import prisma from '@/lib/prisma'

export interface ZhEnLookupWord {
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
}

export interface ZhEnLookupResult {
  query: string
  total: number
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
  if (!cleaned) return { query: String(text ?? '').trim(), total: 0, words: [] }

  const take = Math.min(Math.max(1, Math.floor(limit)), ZH_EN_MAX_LIMIT)
  const rows = await prisma.publicWord.findMany({
    where: { translation: { contains: cleaned } },
    orderBy: [{ qualityScore: 'desc' }, { word: 'asc' }],
    take,
    select: { word: true, phonetic: true, pos: true, translation: true },
  })

  return {
    query: cleaned,
    total: rows.length,
    words: rows.map((r) => ({
      word: r.word,
      phonetic: r.phonetic,
      pos: r.pos,
      translation: r.translation,
    })),
  }
}
