import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { aiAssistantService, trimHistory } from '@/services/AiAssistantService'
import { startAiRequestLog, finishAiRequestLog, type AiRequestStatus } from '@/services/AiRequestLogService'
import { accessiblePaperWhere } from '@/services/study/ExamAccessService'
import { rateLimit } from '@/lib/rateLimit'
import { getClientIp } from '@/lib/onlineTracker'
import { sanitizeInput, validateInput, MAX_INPUT_LENGTH } from '@/lib/security'
import { detectPromptInjection } from '@/lib/injectionDetector'
import { API_QUOTA_EXHAUSTED_MESSAGE } from '@/lib/llmPool'
import { logger } from '@/lib/logger'
import { readJsonBody, RequestBodyError } from '@/lib/requestBody'
import { parseChatMessages } from '@/lib/aiInput'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ success: false, error: '未登录' }, { status: 401 })
  const userId = session.user.id
  const [user, ipBan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isAiFree: true, isBanned: true, banExpiresAt: true } }),
    prisma.ipBan.findUnique({ where: { ipAddress: getClientIp(req) }, select: { isPermanent: true, expiresAt: true } }),
  ])
  if (!user) return Response.json({ success: false, error: '登录状态已失效' }, { status: 401 })

  const rateLimitResult = await rateLimit(`ai-ask:${userId}`, { maxRequests: 10, windowMs: 60 * 1000 })
  if (!rateLimitResult.success) return Response.json({ success: false, error: '请求过于频繁，请稍后再试' }, { status: 429, headers: { 'Retry-After': '60' } })

  let body: {
    messages?: unknown
    readingCoach?: unknown
    examReview?: { attemptId?: unknown; selection?: unknown; question?: unknown }
  }
  try {
    const parsed = await readJsonBody(req)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new RequestBodyError('请求体无效', 400)
    body = parsed
  } catch (error) {
    return Response.json({ success: false, error: error instanceof RequestBodyError ? error.message : '请求体无效' }, { status: error instanceof RequestBodyError ? error.status : 400 })
  }
  const rawMessages = Array.isArray(body?.messages) ? body.messages : []
  const review = body?.examReview
  const legacyQuestion = body?.readingCoach && typeof body.readingCoach === 'object' && 'question' in body.readingCoach
    ? (body.readingCoach as { question?: unknown }).question : undefined
  const lastUser = [...rawMessages].reverse().find((m) => m?.role === 'user' && typeof m.content === 'string')
  const question = typeof review?.question === 'string' ? review.question
    : typeof legacyQuestion === 'string' ? legacyQuestion : String(lastUser?.content ?? '')
  const selection = typeof review?.selection === 'string' ? review.selection : ''
  // Log before validation/injection checks so rejected input remains attributable.
  // Never persist an assembled context or the assistant's reply.
  let requestLog: Awaited<ReturnType<typeof startAiRequestLog>>
  try {
    requestLog = await startAiRequestLog(userId, `${question.slice(0, MAX_INPUT_LENGTH)}${selection ? `\n选中文字：${selection.slice(0, 2000)}` : ''}`, user.isAiFree)
  } catch (err) {
    logger.error({ err, userId }, 'AI_ASK request logging failed')
    return Response.json({ success: false, error: '服务暂时不可用，请稍后再试' }, { status: 503 })
  }
  let finishing: Promise<void> | undefined
  const finish = (status: Exclude<AiRequestStatus, 'STARTED'>, turns = 0) => {
    finishing ??= finishAiRequestLog(requestLog, status, turns).catch((err) => {
      logger.error({ err, userId, requestId: requestLog.requestId }, 'AI_ASK status logging failed')
    })
    return finishing
  }
  const reject = async (error: string, status = 400) => {
    await finish('BLOCKED')
    return Response.json({ success: false, error }, { status })
  }
  const now = new Date()
  const userBlocked = user.isBanned && (!user.banExpiresAt || user.banExpiresAt > now)
  const ipBlocked = ipBan && (ipBan.isPermanent || !ipBan.expiresAt || ipBan.expiresAt > now)
  if (userBlocked || ipBlocked) return reject('当前账号或网络已被限制使用', 403)
  if (body?.readingCoach !== undefined) return reject('阅读询问已调整，请刷新页面后重试')

  try {
    if (review !== undefined) {
      if (!review || typeof review.attemptId !== 'string' || !review.attemptId.trim() || review.attemptId.length > 200 || typeof review.question !== 'string' || !review.question.trim() || review.question.length > 500 || (review.selection !== undefined && (typeof review.selection !== 'string' || review.selection.length > 2000))) {
        return reject('复盘提问内容无效')
      }
      const access = await accessiblePaperWhere(prisma, userId)
      const attempt = await prisma.examAttempt.findFirst({
        where: { id: review.attemptId, userId, status: 'COMPLETE', paper: { rightsStatus: 'APPROVED', ...access } },
        include: { paper: true },
      })
      if (!attempt) return reject('完成练习后才可使用相关 AI 服务', 403)
    } else if (!parseChatMessages(body.messages)) {
      return reject('消息格式或长度无效')
    }
    if (!validateInput(question, review ? 500 : MAX_INPUT_LENGTH).valid) return reject('消息内容无效')

    const messages = review ? [{ role: 'user', content: review.question }] : rawMessages
    const sanitizedMessages = messages.map((m) => {
      const role = (m as { role?: string })?.role
      const content = String((m as { content?: unknown })?.content ?? '')
      if (role === 'user') {
        const v = validateInput(content, MAX_INPUT_LENGTH)
        return { role, content: v.valid ? v.sanitized : '' }
      }
      return { role, content: sanitizeInput(content, MAX_INPUT_LENGTH) }
    })
    for (const m of sanitizedMessages) {
      if (m.role === 'user' && m.content && detectPromptInjection(m.content).isInjection) return reject('检测到无效请求，请正常提问')
    }
    if (selection && detectPromptInjection(selection).isInjection) return reject('检测到无效请求，请正常提问')
    const validMessages = sanitizedMessages.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim()) as { role: 'user' | 'assistant'; content: string }[]
    if (!validMessages.length || !question.trim()) return reject('消息内容无效')
    const history = review
      ? [{ role: 'user' as const, content: JSON.stringify({ question: sanitizeInput(question, 500), ...(selection ? { selection: sanitizeInput(selection, 2000) } : {}) }) }]
      : trimHistory(validMessages)
    const customGroupCount = await prisma.reviewGroup.count({ where: { userId, isSystem: false } })
    const controller = new AbortController()
    const onAbort = () => { controller.abort(); void finish('ABORTED') }
    if (req.signal.aborted) onAbort()
    req.signal.addEventListener('abort', onAbort, { once: true })

    const stream = new ReadableStream({
      async start(streamController) {
        const push = (event: string, data: unknown) => {
          try { streamController.enqueue(encoder.encode(sse(event, data))) } catch { /* client disconnected */ }
        }
        try {
          if (controller.signal.aborted) { await finish('ABORTED'); return }
          push('status', { text: '已收到问题，正在准备解答…' })
          const outcome = await aiAssistantService.ask(userId, history, {
            customGroupCount,
            examReview: !!review,
            onReset: () => { push('text', { text: '', delta: false }); push('status', { text: '连接中断，正在切换可用模型…' }) },
            signal: controller.signal,
            onText: (delta: string) => { push('text', { text: delta, delta: true }) },
          })
          for (const r of outcome.searchResults) push('search_result', r)
          for (const p of outcome.proposals) push('proposal', p)
          await finish(controller.signal.aborted ? 'ABORTED' : 'SUCCESS', outcome.turns)
          push('text', { text: outcome.text, delta: false, turns: outcome.turns })
          push('done', { success: true })
        } catch (err: unknown) {
          await finish(controller.signal.aborted ? 'ABORTED' : 'FAILED')
          const msg = err instanceof Error ? err.message : String(err)
          logger.error({ err, userId }, 'AI_ASK failed')
          const isQuota = msg.includes('额度用尽') || msg.includes(API_QUOTA_EXHAUSTED_MESSAGE)
          push('error', { error: isQuota ? '当前服务繁忙，请稍后再试' : 'AI 服务暂时不可用，请稍后再试' })
          push('done', { success: false })
        } finally {
          req.signal.removeEventListener('abort', onAbort)
          try { streamController.close() } catch { /* client disconnected */ }
        }
      },
      async cancel() { onAbort(); await finish('ABORTED') },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } })
  } catch (err) {
    await finish(req.signal.aborted ? 'ABORTED' : 'FAILED')
    logger.error({ err, userId }, 'AI_ASK preparation failed')
    return Response.json({ success: false, error: 'AI 服务暂时不可用，请稍后再试' }, { status: 503 })
  }
}
