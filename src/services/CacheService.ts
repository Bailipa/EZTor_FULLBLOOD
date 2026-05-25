import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { checkAndSyncOnQuery } from '@/lib/wordSync'
import { logger } from '@/lib/logger'
import { safeQueryRaw } from '@/lib/safeQueryRaw'
import type { Session } from 'next-auth'
import type { TranslationResult } from '@/services/TranslationService'

export interface CachedWord {
  word: string
  phonetic: string
  pos: string
  translation: string
  example: string
  exampleTranslation: string
  fromCache: boolean
}

export class CacheService {
  private readonly session: Session | null
  private readonly inputWordMap: Map<string, string>

  constructor(session: Session | null, words: string[]) {
    this.session = session
    this.inputWordMap = new Map<string, string>()
    words.forEach((word) => {
      this.inputWordMap.set(word.toLowerCase(), word)
    })
  }

  async getCachedWords(
    normalizedWords: string[],
  ): Promise<{ cachedWords: Record<string, unknown>[]; cachedWordStrings: string[] }> {
    // 查找数据库中已经存在的单词
    const cachedWords = await safeQueryRaw('cacheService', () => prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`
          SELECT
            w.id,
            w.word,
            w."userId",
            w."correctCount",
            w."incorrectCount",
            w."createdAt",
            w."updatedAt",
            w."sourceType",
            w."publicWordId",
            COALESCE(NULLIF(TRIM(w.phonetic), ''), pw.phonetic, '') AS phonetic,
            COALESCE(NULLIF(TRIM(w.pos), ''), pw.pos, '') AS pos,
            COALESCE(NULLIF(TRIM(w.translation), ''), pw.translation, '') AS translation,
            COALESCE(NULLIF(TRIM(w.example), ''), pw.example, '') AS example,
            COALESCE(NULLIF(TRIM(w."exampleTranslation"), ''), pw."exampleTranslation", '') AS "exampleTranslation"
          FROM "Word" w
          LEFT JOIN "PublicWord" pw ON pw.id = w."publicWordId"
          WHERE w."userId" = ${this.session!.user.id}
            AND lower(w.word) IN (${Prisma.join(normalizedWords)})
      `,
    ), [] as Record<string, unknown>[])

    const cachedWordStrings = cachedWords.map((cw) => String(cw['word']).toLowerCase())
    return { cachedWords, cachedWordStrings }
  }

  async updateIncompleteCachedWords(
    cachedWords: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    // Mirroring mode: private words read definitions via PublicWord reference.
    return cachedWords
  }

  async getPublicCachedWords(
    missingFromUserWords: string[],
  ): Promise<{ publicCachedWords: Record<string, unknown>[]; publicCachedWordStrings: string[] }> {
    let publicCachedWords: Record<string, unknown>[] = []
    if (missingFromUserWords.length > 0) {
      publicCachedWords = await prisma.publicWord.findMany({
        where: {
          word: {
            in: missingFromUserWords,
          },
        },
      })
    }

    const publicCachedWordStrings = publicCachedWords.map((w) => w['word'] as string)
    return { publicCachedWords, publicCachedWordStrings }
  }

  async copyPublicWordsToUserDb(
    publicCachedWords: Record<string, unknown>[],
    targetGroupId?: string,
  ): Promise<void> {
    if (publicCachedWords.length > 0) {
      try {
        const newlyCreatedWords = await Promise.all(
          publicCachedWords.map((w) =>
            prisma.word
              .upsert({
                where: {
                  word_userId: {
                    word: w['word'] as string,
                    userId: this.session!.user.id,
                  },
                },
                update: {
                  publicWordId: w['id'] as string,
                  updatedAt: new Date(),
                },
                create: {
                  id: randomUUID(),
                  word: w['word'] as string,
                  translation: null,
                  phonetic: null,
                  pos: null,
                  example: null,
                  exampleTranslation: null,
                  userId: this.session!.user.id,
                  sourceType: 'PUBLIC',
                  publicWordId: w['id'] as string,
                  updatedAt: new Date(),
                },
              })
              .catch(() => null),
          ),
        )

        // 如果指定了目标分组，将这些从公共库复制来的词加入分组
        if (targetGroupId) {
          const groupWordData = newlyCreatedWords.filter(Boolean).map((w) => ({
            id: randomUUID(),
            reviewGroupId: targetGroupId!,
            wordId: (w as { id: string }).id,
          }))
          if (groupWordData.length > 0) {
            try {
              await prisma.reviewGroupWord.createMany({
                data: groupWordData,
                skipDuplicates: true,
              })
            } catch (err: unknown) {
              logger.error({ err }, 'Failed to batch add to group')
            }
          }
        }
      } catch (e) {
        logger.error({ err: e }, 'Failed to copy public words to user db')
      }
    }
  }

  async updateCacheTimestamps(cachedWordStrings: string[], targetGroupId?: string): Promise<void> {
    if (cachedWordStrings.length > 0) {
      try {
        await prisma.word.updateMany({
          where: {
            userId: this.session!.user.id,
            word: { in: cachedWordStrings },
          },
          data: { updatedAt: new Date() },
        })

        // 如果指定了目标分组，将这些已在私有库的词加入分组
        if (targetGroupId) {
          try {
            const wordRecords = await prisma.word.findMany({
              where: {
                word: { in: cachedWordStrings },
                userId: this.session!.user.id,
              },
            })
            if (wordRecords.length > 0) {
              await prisma.reviewGroupWord.createMany({
                data: wordRecords.map((w) => ({
                  id: randomUUID(),
                  reviewGroupId: targetGroupId!,
                  wordId: w.id,
                })),
                skipDuplicates: true,
              })
            }
          } catch (err: unknown) {
            logger.error({ err }, 'Failed to batch add cached words to group')
          }
        }
      } catch (updateErr) {
        logger.error({ err: updateErr }, 'Failed to update cache timestamps or add to group')
      }
    }
  }

  async autoSync(
    cachedWordStrings: string[],
    formattedCachedResults: CachedWord[],
  ): Promise<CachedWord[]> {
    if (cachedWordStrings.length > 0) {
      try {
        const syncUpdates = await checkAndSyncOnQuery(this.session!.user.id, cachedWordStrings)

        for (const [wordKey, updatedData] of syncUpdates) {
          const existingIndex = formattedCachedResults.findIndex(
            (r) => r.word.toLowerCase() === wordKey,
          )
          if (existingIndex !== -1) {
            formattedCachedResults[existingIndex] = {
              ...formattedCachedResults[existingIndex],
              ...(updatedData as Record<string, unknown>),
              fromCache: true,
            }
          }
        }
      } catch (syncErr) {
        logger.error({ err: syncErr }, '[Translate] Auto-sync error')
      }
    }
    return formattedCachedResults
  }

  formatCachedResults(
    cachedWords: Record<string, unknown>[],
    publicCachedWords: Record<string, unknown>[],
    specialResults: TranslationResult[],
  ): CachedWord[] {
    return [
      ...cachedWords.map((cw) => {
        const cwWord = cw['word'] as string
        return {
          word: this.inputWordMap.get(cwWord.toLowerCase()) || cwWord,
          phonetic: (cw['phonetic'] as string) || '',
          pos: (cw['pos'] as string) || '',
          translation: cw['translation'] as string,
          example: (cw['example'] as string) || '',
          exampleTranslation: (cw['exampleTranslation'] as string) || '',
          fromCache: true,
        }
      }),
      ...publicCachedWords.map((pw) => {
        const pwWord = pw['word'] as string
        return {
          word: this.inputWordMap.get(pwWord.toLowerCase()) || pwWord,
          phonetic: (pw['phonetic'] as string) || '',
          pos: (pw['pos'] as string) || '',
          translation: pw['translation'] as string,
          example: (pw['example'] as string) || '',
          exampleTranslation: (pw['exampleTranslation'] as string) || '',
          fromCache: true,
        }
      }),
      ...specialResults.map((result) => ({
        word: this.inputWordMap.get(result.word.toLowerCase()) || result.word,
        phonetic: result.phonetic || '',
        pos: result.pos || '',
        translation: result.translation,
        example: result.example || '',
        exampleTranslation: result.exampleTranslation || '',
        fromCache: false,
      })),
    ]
  }

  orderResultsByInput(words: string[], formattedCachedResults: CachedWord[]): CachedWord[] {
    const orderedCachedResults: CachedWord[] = []
    const resultMap = new Map<string, CachedWord>()
    formattedCachedResults.forEach((result) => {
      resultMap.set(result.word.toLowerCase(), result)
    })

    // 按照原始输入顺序遍历，从map中取出对应的结果
    words.forEach((word) => {
      const normalizedWord = word.toLowerCase()
      if (resultMap.has(normalizedWord)) {
        orderedCachedResults.push(resultMap.get(normalizedWord)!)
        resultMap.delete(normalizedWord)
      }
    })

    // 处理剩下的结果（如果有的话）
    resultMap.forEach((result) => {
      orderedCachedResults.push(result)
    })

    return orderedCachedResults
  }
}
