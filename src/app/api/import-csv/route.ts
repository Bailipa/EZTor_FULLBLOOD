import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { handleApiError, createErrorResponse } from '@/lib/apiErrorHandler'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'

function readCount(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value.trim()))) {
    throw new Error('练习次数必须是非负整数')
  }
  const count = Number(value)
  if (!Number.isInteger(count) || count < 0 || count > 2147483647) {
    throw new Error('练习次数超出有效范围')
  }
  return count
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return createErrorResponse('未授权访问', 401)
    const { results } = await req.json()
    if (!Array.isArray(results) || results.length === 0) return createErrorResponse('未提供有效数据', 400)

    let savedCount = 0
    const failures: { row: number; csvRow?: number; error: string }[] = []
    for (const [index, item] of results.entries()) {
      try {
        if (!item || typeof item.word !== 'string' || !item.word.trim()) throw new Error('单词不能为空')
        const normalizedWord = item.word.toLowerCase().trim()
        const correctCount = readCount(item.correctCount) ?? 0
        const incorrectCount = readCount(item.incorrectCount) ?? 0
        if (correctCount + incorrectCount > 2147483647) throw new Error('练习总次数超出有效范围')
        const wordData = {
          word: normalizedWord,
          phonetic: item.phonetic || null,
          pos: item.pos || null,
          translation: item.translation || '',
          example: item.example || null,
          exampleTranslation: item.exampleTranslation || null,
          updatedAt: new Date(),
        }
        // CSV counters initialize new words only. Existing practice and SRS stay intact,
        // including when another request creates this word before the upsert executes.
        await prisma.word.upsert({
          where: { word_userId: { word: normalizedWord, userId: session.user.id } },
          update: wordData,
          create: { ...wordData, userId: session.user.id,
            correctCount, incorrectCount, totalAttempts: correctCount + incorrectCount },
        })
        savedCount++
      } catch (err) {
        logger.error({ err, row: index + 1 }, '[Import] Failed to save row')
        failures.push({ row: index + 1, ...(Number.isInteger(item?.csvRow) && item.csvRow >= 2 ? { csvRow: item.csvRow } : {}), error: err instanceof Error && err.message.startsWith('练习') ? err.message : '该行数据无效或保存失败' })
      }
    }
    return NextResponse.json({
      success: failures.length === 0,
      savedCount,
      failedCount: failures.length,
      failures,
      ...(failures.length ? { error: `已保存 ${savedCount} 行，${failures.length} 行失败` } : {}),
    })
  } catch (err: unknown) {
    return handleApiError(err, 'import-csv')
  }
}
