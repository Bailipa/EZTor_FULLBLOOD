import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { recordPublicWordCreation } from '@/lib/contributionLedger'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { isValidShareCode } from '@/lib/share/codeGenerator'
import { sanitizeInput } from '@/lib/security'
import { createCustomGroupInTransaction, lockGroupOwner, GroupLimitError } from '@/lib/reviewGroups'
import { logger } from '@/lib/logger'

interface WordData {
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
  example: string | null
  exampleTranslation: string | null
}

class ImportError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message) }
}

// The existing client reads newline-delimited JSON; the terminal result is authoritative.
function respond(result: Record<string, unknown>, status = 200) {
  if (process.env.NODE_ENV === 'test' || status === 401) return NextResponse.json(result, { status })
  return new Response(JSON.stringify(result) + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

const leaseDuration = 120_000

export async function POST(req: Request) {
  let receiptId: string | undefined
  const leaseToken = randomUUID()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return respond({ success: false, error: '未授权访问' }, 401)
    const userId = session.user.id
    const body = await req.json()
    const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : ''
    if (!isValidShareCode(code)) throw new ImportError('INVALID_FORMAT', '密钥格式无效')
    const customName = typeof body.customName === 'string' ? sanitizeInput(body.customName.trim(), 100) : ''
    const targetGroupId = typeof body.targetGroupId === 'string' ? body.targetGroupId : undefined
    const createNewGroup = body.createNewGroup !== false
    // Both flag values preserve existing definitions and statistics; the flag is retained for receipt compatibility.
    const skipExisting = body.skipExisting !== false

    // Freeze the source once. Retries use the receipt snapshot rather than a moving group.
    const share = await prisma.sharedVocabulary.findUnique({
      where: { code },
      include: { ReviewGroup: { include: { ReviewGroupWord: { orderBy: { id: 'asc' }, include: { Word: { include: { publicWord: true } } } } } } },
    })
    if (!share) throw new ImportError('INVALID_CODE', '密钥不存在', 404)
    const source: WordData[] = share.ReviewGroup.ReviewGroupWord.map(({ Word: word }) => ({
      word: word.word.toLowerCase().trim(),
      translation: word.translation ?? word.publicWord?.translation ?? '',
      phonetic: word.phonetic ?? word.publicWord?.phonetic ?? null,
      pos: word.pos ?? word.publicWord?.pos ?? null,
      example: word.example ?? word.publicWord?.example ?? null,
      exampleTranslation: word.exampleTranslation ?? word.publicWord?.exampleTranslation ?? null,
    }))

    // Reclaim expired leases in a separate committed transaction, even if this request
    // subsequently fails validation (for example, a revoked or expired share).
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SharedVocabulary" WHERE id = ${share.id} FOR UPDATE`
      const expired = await tx.sharedVocabularyImport.findMany({ where: {
        sharedId: share.id, status: 'RUNNING', leaseExpiresAt: { lte: new Date() },
      } })
      const reservations = expired.filter((item) => item.useReserved).length
      if (expired.length) {
        await tx.sharedVocabularyImport.updateMany({ where: { id: { in: expired.map((item) => item.id) } },
          data: { status: 'FAILED', useReserved: false, leaseToken: null, leaseExpiresAt: null, updatedAt: new Date() } })
        if (reservations) {
          await tx.sharedVocabulary.update({ where: { id: share.id }, data: { usedCount: { decrement: reservations } } })
        }
      }
    })

    const receipt = await prisma.$transaction(async (tx) => {
      await lockGroupOwner(tx, userId)
      // Serialize reservations across importers as well as duplicate imports by this user.
      await tx.$queryRaw`SELECT id FROM "SharedVocabulary" WHERE id = ${share.id} FOR UPDATE`
      const currentShare = await tx.sharedVocabulary.findUniqueOrThrow({ where: { id: share.id } })
      const existing = await tx.sharedVocabularyImport.findUnique({
        where: { sharedId_importerId: { sharedId: share.id, importerId: userId } },
      })
      if (existing?.status === 'COMPLETED') throw new ImportError('ALREADY_IMPORTED', '您已导入过该词库，无需重复导入', 409)
      if (existing?.status === 'RUNNING' && existing.leaseExpiresAt && existing.leaseExpiresAt > new Date()) {
        throw new ImportError('IMPORT_IN_PROGRESS', '该词库正在导入，请稍后重试', 409)
      }
      if (!currentShare.isActive) throw new ImportError('INACTIVE_SHARE', '该分享已被撤销', 403)
      if (currentShare.expiresAt && currentShare.expiresAt <= new Date()) throw new ImportError('EXPIRED_CODE', '该密钥已过期', 410)
      let groupId = existing?.targetGroupId ?? targetGroupId
      if (groupId) {
        const group = await tx.reviewGroup.findFirst({ where: { id: groupId, userId } })
        if (!group) throw new ImportError('INVALID_GROUP', '目标分组不存在或不属于当前用户', 404)
      } else {
        if (!createNewGroup || !customName) throw new ImportError('INVALID_GROUP', '请选择目标词库或输入新词库名称')
        groupId = (await createCustomGroupInTransaction(tx, userId, customName)).id
      }
      if (!existing?.useReserved) {
        if (currentShare.maxUses !== null && currentShare.usedCount >= currentShare.maxUses) {
          throw new ImportError('MAX_USES_REACHED', '使用次数已达上限', 429)
        }
        await tx.sharedVocabulary.update({ where: { id: share.id }, data: { usedCount: { increment: 1 } } })
      }
      const lease = { status: 'RUNNING', leaseToken, leaseExpiresAt: new Date(Date.now() + leaseDuration), useReserved: true, updatedAt: new Date() }
      if (existing) return tx.sharedVocabularyImport.update({ where: { id: existing.id }, data: lease })
      return tx.sharedVocabularyImport.create({
        data: { ...lease, id: randomUUID(), sharedId: share.id, importerId: userId, targetGroupId: groupId,
          wordsImported: 0, wordsSkipped: 0, skipExisting, payload: source as unknown as Prisma.InputJsonValue },
      })
    })
    receiptId = receipt.id
    const words = receipt.payload as unknown as WordData[]
    if (!Array.isArray(words)) throw new Error('Import snapshot is missing')

    for (let offset = receipt.processedCount; offset < words.length; offset += 50) {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "SharedVocabulary" WHERE id = ${share.id} FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM "SharedVocabularyImport" WHERE id = ${receipt.id} FOR UPDATE`
        const current = await tx.sharedVocabularyImport.findUniqueOrThrow({ where: { id: receipt.id } })
        if (current.leaseToken !== leaseToken || current.status !== 'RUNNING') throw new ImportError('IMPORT_IN_PROGRESS', '导入已由另一请求接管', 409)
        if (current.processedCount !== offset) throw new Error('Import cursor changed')
        const group = await tx.reviewGroup.findFirst({ where: { id: receipt.targetGroupId, userId } })
        if (!group) throw new ImportError('INVALID_GROUP', '目标词库已被删除', 404)
        let imported = 0
        let skipped = 0
        const batch = words.slice(offset, offset + 50)
        for (const data of batch) {
          if (!data.word) throw new ImportError('INVALID_WORD', '源词库包含空单词')
          let word = await tx.word.findUnique({ where: { word_userId: { word: data.word, userId } } })
          if (!word) {
            let publicWord = await tx.publicWord.findUnique({ where: { word: data.word } })
            if (!publicWord && data.translation.trim()) {
              // ON CONFLICT remains usable inside a PostgreSQL transaction.
              const created = await tx.publicWord.createMany({ data: [{ ...data, id: randomUUID(), updatedAt: new Date() }], skipDuplicates: true })
              publicWord = await tx.publicWord.findUnique({ where: { word: data.word } })
              if (created.count && publicWord) await recordPublicWordCreation(tx, { word: data.word, publicWordId: publicWord.id, source: 'SHARE_IMPORT' })
            }
            const created = await tx.word.createMany({
              data: [{ id: randomUUID(), word: data.word, userId, sourceType: publicWord ? 'PUBLIC' : 'USER', publicWordId: publicWord?.id,
                ...(publicWord ? {} : { translation: data.translation, phonetic: data.phonetic, pos: data.pos, example: data.example, exampleTranslation: data.exampleTranslation }), updatedAt: new Date() }],
              skipDuplicates: true,
            })
            word = await tx.word.findUniqueOrThrow({ where: { word_userId: { word: data.word, userId } } })
            imported += created.count
            skipped += 1 - created.count
          } else {
            // Existing definitions and practice statistics are always preserved.
            skipped++
          }
          await tx.reviewGroupWord.createMany({ data: [{ id: randomUUID(), reviewGroupId: receipt.targetGroupId, wordId: word.id }], skipDuplicates: true })
        }
        await tx.sharedVocabularyImport.update({ where: { id: receipt.id }, data: {
          processedCount: offset + batch.length, wordsImported: { increment: imported }, wordsSkipped: { increment: skipped },
          leaseExpiresAt: new Date(Date.now() + leaseDuration), updatedAt: new Date(),
        } })
        await tx.sharedVocabulary.update({ where: { id: share.id }, data: { importedCount: { increment: imported } } })
      }, { timeout: 30_000 })
    }
    const completed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SharedVocabulary" WHERE id = ${share.id} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM "SharedVocabularyImport" WHERE id = ${receipt.id} FOR UPDATE`
      const current = await tx.sharedVocabularyImport.findUniqueOrThrow({ where: { id: receipt.id } })
      if (current.leaseToken !== leaseToken || current.status !== 'RUNNING') throw new ImportError('IMPORT_IN_PROGRESS', '导入已由另一请求接管', 409)
      const group = await tx.reviewGroup.findFirst({ where: { id: receipt.targetGroupId, userId } })
      if (!group) throw new ImportError('INVALID_GROUP', '目标词库已被删除', 404)
      const settled = await tx.sharedVocabularyImport.update({ where: { id: receipt.id }, data: { status: 'COMPLETED', leaseToken: null, leaseExpiresAt: null, useReserved: false, payload: Prisma.DbNull, updatedAt: new Date() } })
      return { ...settled, groupName: group.name }
    })
    return respond({ success: true, data: { wordsImported: completed.wordsImported, wordsSkipped: completed.wordsSkipped,
      groupId: completed.targetGroupId, groupName: completed.groupName, shareName: share.name, newWords: [] } })
  } catch (err) {
    let progress: { wordsImported: number; wordsSkipped: number; processedCount: number } | undefined
    if (receiptId) {
      try {
        progress = await prisma.$transaction(async (tx) => {
          const owner = await tx.sharedVocabularyImport.findUnique({ where: { id: receiptId }, select: { sharedId: true } })
          if (!owner) return undefined
          await tx.$queryRaw`SELECT id FROM "SharedVocabulary" WHERE id = ${owner.sharedId} FOR UPDATE`
          await tx.$queryRaw`SELECT id FROM "SharedVocabularyImport" WHERE id = ${receiptId} FOR UPDATE`
          const current = await tx.sharedVocabularyImport.findUnique({ where: { id: receiptId } })
          if (!current || current.leaseToken !== leaseToken || current.status !== 'RUNNING') return undefined
          if (current.useReserved) await tx.sharedVocabulary.update({ where: { id: current.sharedId }, data: { usedCount: { decrement: 1 } } })
          return tx.sharedVocabularyImport.update({ where: { id: current.id }, data: { status: 'FAILED', useReserved: false, leaseToken: null, leaseExpiresAt: null, updatedAt: new Date() },
            select: { wordsImported: true, wordsSkipped: true, processedCount: true } })
        })
      } catch (settlementError) {
        logger.error({ err: settlementError, receiptId }, '[ShareImport] Failed to release reservation; retry can reclaim expired lease')
      }
    }
    logger.error({ err, receiptId }, '[ShareImport] Import failed')
    return respond({ success: false, error: err instanceof ImportError ? err.code : err instanceof GroupLimitError ? 'GROUP_LIMIT_REACHED' : 'IMPORT_FAILED',
      message: err instanceof ImportError || err instanceof GroupLimitError ? err.message : '导入失败，请重试以继续已保存的进度',
      ...(progress ? { data: progress, suggestion: `已保存 ${progress.wordsImported} 个新词；使用同一密钥重试可继续，已释放本次使用预约` } : {}) }, err instanceof ImportError ? err.status : err instanceof GroupLimitError ? 400 : 500)
  }
}
