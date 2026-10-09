import { readJsonBody, RequestBodyError } from '@/lib/requestBody'
import { getClientIp } from '@/lib/onlineTracker'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { validateTranslateInput } from '@/lib/security'
import { rateLimit, getClientKey } from '@/lib/rateLimit'
import { detectPromptInjection } from '@/lib/injectionDetector'
import { checkUserBan, checkIpBan } from '@/lib/banManager'
import {
  DEFAULT_TRANSLATE_ONLY_PROMPT,
  OPTIMIZATION_PROMPT,
  COMBINED_OPTIMIZE_TRANSLATE_PROMPT,
} from '@/lib/translatePrompts'
import { API_QUOTA_EXHAUSTED_MESSAGE, getProviderCandidates, withLlmFailover } from '@/lib/llmPool'
import { checkAndEnforceLimit, reserveTranslateUsage, DAILY_LIMIT } from '@/lib/translateOnlyUsage'
import { logger } from '@/lib/logger'
import { secureModelFetch } from '@/lib/modelTransport'

async function directLlmCall(
  config: { baseUrl: string; apiKey: string; model: string },
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
): Promise<string> {
  const normalizedUrl = config.baseUrl.replace(/\/+$/, '')
  const chatUrl = `${normalizedUrl}/chat/completions`

  const response = await secureModelFetch(chatUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    }),
  })

  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`翻译服务暂时不可用 (HTTP ${response.status})`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content?.trim() || ''
  if (!content) throw new Error('Empty translation result')
  return content
}

async function systemPoolCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  const apiConfig = await prisma.apiConfig.findUnique({ where: { id: 'global' } })

  const legacyApiKey = apiConfig?.apiKey || process.env.LLM_API_KEY
  const legacyBaseUrl = apiConfig?.baseUrl || process.env.LLM_API_URL
  const legacyModel = apiConfig?.model || process.env.LLM_MODEL || 'gpt-4o-mini'

  const candidates = await getProviderCandidates({
    apiKey: legacyApiKey,
    baseUrl: legacyBaseUrl,
    model: legacyModel,
  })

  if (candidates.length === 0) {
    throw new Error(API_QUOTA_EXHAUSTED_MESSAGE)
  }

  const completion = await withLlmFailover(
    candidates,
    (client, model) =>
      client.chat.completions.create({
        model: model || 'gpt-4o-mini',
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    1,
  )

  const content = completion.choices?.[0]?.message?.content?.trim() || ''
  if (!content) throw new Error('Empty translation result')
  return content
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const isAdmin = !!session.user.isAdmin
    const clientIp = getClientIp(req)

    const userBanStatus = await checkUserBan(userId)
    if (userBanStatus.isBanned) {
      return NextResponse.json(
        { success: false, error: userBanStatus.reason || 'Account banned' },
        { status: 403 },
      )
    }

    const ipBanStatus = await checkIpBan(clientIp)
    if (ipBanStatus.isBanned) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const rateLimitKey = getClientKey(req, userId)
    const rateLimitResult = await rateLimit(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      )
    }

    const body = await readJsonBody(req)
    if (typeof body.input !== 'string' || (body.deviceId !== undefined && (typeof body.deviceId !== 'string' || body.deviceId.length > 200))) return NextResponse.json({ success: false, error: '输入格式无效' }, { status: 400 })
    const rawInput = body.input.trim()
    const deviceId = body.deviceId as string | undefined
    const optimize: boolean = body?.optimize === true

    if (!rawInput) {
      return NextResponse.json({ success: false, error: 'Input is required' }, { status: 400 })
    }

    const validation = validateTranslateInput(rawInput)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.reason || 'Invalid input' },
        { status: 400 },
      )
    }

    let input = validation.sanitized || rawInput
    detectPromptInjection(input)

    // 文本翻译与结构化词典任务各用自己的提示词，避免共享配置改变输出格式。
    const translateSystemPrompt = DEFAULT_TRANSLATE_ONLY_PROMPT

    const customKey = await prisma.customApiKey.findUnique({ where: { userId } })
    if (customKey) {
      let optimizedInput: string | undefined
      let textToTranslate = input

      if (optimize) {
        optimizedInput = await directLlmCall(customKey, OPTIMIZATION_PROMPT, input, req.signal)
        textToTranslate = optimizedInput
      }

      const translation = await directLlmCall(customKey, translateSystemPrompt, textToTranslate, req.signal)

      return NextResponse.json({
        success: true,
        data: { translation, optimizedInput, mode: 'custom' },
      })
    }

    const reserved = await reserveTranslateUsage(userId, isAdmin, deviceId)
    if (!reserved) {
      return NextResponse.json(
        {
          success: false,
          error: 'DAILY_LIMIT_EXCEEDED',
          message: '当前暂时无法继续翻译，请稍后再试',
          limit: DAILY_LIMIT,
        },
        { status: 429 },
      )
    }

    let optimizedInput: string | undefined
    let translation: string

    if (optimize) {
      translation = await systemPoolCompletion(COMBINED_OPTIMIZE_TRANSLATE_PROMPT, input)
      optimizedInput = undefined
    } else {
      translation = await systemPoolCompletion(translateSystemPrompt, input)
    }

    const updatedUsage = await checkAndEnforceLimit(userId, isAdmin, deviceId)

    return NextResponse.json({
      success: true,
      data: { translation, optimizedInput },
      usage: { used: updatedUsage.used, limit: DAILY_LIMIT, remaining: updatedUsage.remaining },
    })
  } catch (err: unknown) {
    if (err instanceof RequestBodyError) return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ err }, 'Translate-only failed')
    if (String(message) === API_QUOTA_EXHAUSTED_MESSAGE) {
      return NextResponse.json(
        { success: false, error: API_QUOTA_EXHAUSTED_MESSAGE },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { success: false, error: 'Translation service failed' },
      { status: 500 },
    )
  }
}
