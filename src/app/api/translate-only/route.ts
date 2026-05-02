import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { validateTranslateInput } from '@/lib/security'
import { rateLimit, getClientKey } from '@/lib/rateLimit'
import { detectPromptInjection } from '@/lib/injectionDetector'
import { checkUserBan, checkIpBan } from '@/lib/banManager'
import { DEFAULT_TRANSLATE_ONLY_PROMPT, OPTIMIZATION_PROMPT, COMBINED_OPTIMIZE_TRANSLATE_PROMPT } from '@/lib/translatePrompts'
import { API_QUOTA_EXHAUSTED_MESSAGE, getProviderCandidates, withLlmFailover } from '@/lib/llmPool'
import { checkAndEnforceLimit, incrementUsage, DAILY_LIMIT } from '@/lib/translateOnlyUsage'
import { logger } from '@/lib/logger'
import { fetchInsecure } from '@/lib/fetchInsecure'

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] ||
         req.headers.get('x-real-ip') ||
         'unknown';
}

async function directLlmCall(
  config: { baseUrl: string; apiKey: string; model: string },
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const normalizedUrl = config.baseUrl.replace(/\/+$/, '')
  const chatUrl = `${normalizedUrl}/chat/completions`

  const response = await fetchInsecure(chatUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
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
    const errorText = await response.text().catch(() => 'Unknown error')
    let errorMessage = `翻译失败 (HTTP ${response.status})`
    try {
      const errJson = JSON.parse(errorText)
      errorMessage = errJson?.error?.message || errJson?.error?.code || errorMessage
    } catch (error) {
      logger.error({ err: error }, 'Failed to parse error response from custom API');
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content?.trim() || ''
  if (!content) throw new Error('Empty translation result')
  return content
}

async function systemPoolCompletion(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
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
    1
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
        { status: 403 }
      )
    }

    const ipBanStatus = await checkIpBan(clientIp)
    if (ipBanStatus.isBanned) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const rateLimitKey = getClientKey(req, userId)
    const rateLimitResult = await rateLimit(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await req.json()
    const rawInput = (body?.input || '').trim()
    const deviceId: string | undefined = body?.deviceId
    const optimize: boolean = body?.optimize === true

    if (!rawInput) {
      return NextResponse.json({ success: false, error: 'Input is required' }, { status: 400 })
    }

    const validation = validateTranslateInput(rawInput)
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.reason || 'Invalid input' }, { status: 400 })
    }

    let input = validation.sanitized || rawInput
    detectPromptInjection(input)

    const translateSystemPrompt = (await prisma.apiConfig.findUnique({ where: { id: 'global' } }))?.systemPrompt || DEFAULT_TRANSLATE_ONLY_PROMPT

    const customKey = await prisma.customApiKey.findUnique({ where: { userId } })
    if (customKey) {
      let optimizedInput: string | undefined
      let textToTranslate = input

      if (optimize) {
        optimizedInput = await directLlmCall(customKey, OPTIMIZATION_PROMPT, input)
        textToTranslate = optimizedInput
      }

      const translation = await directLlmCall(customKey, translateSystemPrompt, textToTranslate)

      return NextResponse.json({
        success: true,
        data: { translation, optimizedInput, mode: 'custom' },
      })
    }

    const limitCheck = await checkAndEnforceLimit(userId, isAdmin, deviceId)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'DAILY_LIMIT_EXCEEDED', message: '每日免费翻译次数已用完', limit: DAILY_LIMIT },
        { status: 429 }
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

    await incrementUsage(userId, isAdmin, deviceId)

    const updatedUsage = await checkAndEnforceLimit(userId, isAdmin, deviceId)

    return NextResponse.json({
      success: true,
      data: { translation, optimizedInput },
      usage: { used: updatedUsage.used, limit: DAILY_LIMIT, remaining: updatedUsage.remaining },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'Translate-only failed');
    if (String(message) === API_QUOTA_EXHAUSTED_MESSAGE) {
      return NextResponse.json({ success: false, error: API_QUOTA_EXHAUSTED_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: 'Translation service failed' }, { status: 500 });
  }
}
