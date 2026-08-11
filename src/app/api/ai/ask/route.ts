import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { aiAssistantService, trimHistory } from '@/services/AiAssistantService'
import { AI_ASK_COST } from '@/features/gamification/constants'
import { gameService } from '@/features/gamification/services/GameService'
import { rateLimit, getClientKey } from '@/lib/rateLimit'
import { sanitizeInput, validateInput, MAX_INPUT_LENGTH } from '@/lib/security'
import { detectPromptInjection } from '@/lib/injectionDetector'
import { API_QUOTA_EXHAUSTED_MESSAGE } from '@/lib/llmPool'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ success: false, error: '未登录' }), { status: 401 })
  }
  const userId = session.user.id

  const rateLimitResult = await rateLimit(`ai-ask:${getClientKey(req, userId)}`, {
    maxRequests: 10,
    windowMs: 60 * 1000,
  })
  if (!rateLimitResult.success) {
    return new Response(JSON.stringify({ success: false, error: '请求过于频繁，请稍后再试' }), {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  }

  let body: { messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ success: false, error: '请求体无效' }), { status: 400 })
  }

  const rawMessages = Array.isArray(body?.messages) ? body.messages : []
  if (rawMessages.length === 0) {
    return new Response(JSON.stringify({ success: false, error: '消息不能为空' }), { status: 400 })
  }

  // 输入净化 + 注入检测（只校验用户消息，命中直接拦截、不扣学力）
  const sanitizedMessages = rawMessages.map((m) => {
    const role = (m as { role?: string })?.role
    const content = String((m as { content?: unknown })?.content ?? '')
    if (role === 'user') {
      const v = validateInput(content, MAX_INPUT_LENGTH)
      return { role, content: v.valid ? v.sanitized : '' }
    }
    return { role, content: sanitizeInput(content, MAX_INPUT_LENGTH) }
  })
  for (const m of sanitizedMessages) {
    if (m.role === 'user' && m.content) {
      const injection = detectPromptInjection(m.content)
      if (injection.isInjection) {
        return new Response(JSON.stringify({ success: false, error: '检测到无效请求，请正常提问' }), { status: 400 })
      }
    }
  }
  const validMessages = sanitizedMessages.filter((m) => m.role && m.content !== undefined) as {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
  }[]
  if (validMessages.length === 0) {
    return new Response(JSON.stringify({ success: false, error: '消息内容无效' }), { status: 400 })
  }
  const history = trimHistory(validMessages)

  // 免费标记
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAiFree: true } })
  const isAiFree = user?.isAiFree ?? false

  // 扣学力（免费用户跳过）
  let deducted = false
  if (!isAiFree) {
    const spend = await gameService.spendPower(userId, AI_ASK_COST)
    if (!spend.success) {
      return new Response(
        JSON.stringify({ success: false, error: `学力不足，AI 询问需要 ${AI_ASK_COST} 学力（当前 ${spend.balance}）` }),
        { status: 402 },
      )
    }
    deducted = true
  }

  // 当前自定义词库数
  const customGroupCount = await prisma.reviewGroup.count({ where: { userId, isSystem: false } })

  const controller = new AbortController()
  const clientSignal = req.signal
  if (clientSignal.aborted) controller.abort()
  clientSignal.addEventListener('abort', () => controller.abort())

  const stream = new ReadableStream({
    async start(streamController) {
      const push = (event: string, data: unknown) => {
        try {
          streamController.enqueue(encoder.encode(sse(event, data)))
        } catch {
          // ignore
        }
      }

      try {
        const outcome = await aiAssistantService.ask(userId, history, {
          isAiFree,
          customGroupCount,
          signal: controller.signal,
        })

        for (const r of outcome.searchResults) {
          push('search_result', r)
        }
        for (const p of outcome.proposals) {
          push('proposal', p)
        }        push('text', { text: outcome.text, deducted, isAiFree, turns: outcome.turns })

        // 审计
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'AI_ASK',
            entityType: 'AI_ASK',
            newValue: JSON.stringify({ messages: history.length, turns: outcome.turns, deducted, isAiFree }),
          },
        })

        push('done', { success: true })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ err, userId }, 'AI_ASK failed')
        if (deducted) {
          await gameService.refundPower(userId, AI_ASK_COST).catch(() => {})
          deducted = false
        }
        const isQuota = msg.includes('额度用尽') || msg.includes(API_QUOTA_EXHAUSTED_MESSAGE)
        push('error', { error: isQuota ? 'AI 额度暂时用尽，已退回学力，请稍后再试' : 'AI 服务暂时不可用，已退回学力，请稍后再试' })
        push('done', { success: false })
      } finally {
        try {
          streamController.close()
        } catch {
          // ignore
        }
      }
    },
    cancel() {
      controller.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
