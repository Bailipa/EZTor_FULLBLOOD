import { readJsonBody, RequestBodyError } from '@/lib/requestBody'
import { modelSettingsError } from '@/lib/modelTransport'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { rateLimit } from '@/lib/rateLimit'
import { secureModelFetch } from '@/lib/modelTransport'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await rateLimit(`custom-key-test:${session.user.id}`, { maxRequests: 5, windowMs: 60_000 })).success) return NextResponse.json({ success: false, error: '请求过于频繁' }, { status: 429 })
  let body: Record<string, unknown>
  try { body = await readJsonBody(req, 16 * 1024) }
  catch (error) { return NextResponse.json({ success: false, error: error instanceof RequestBodyError ? error.message : '请求体无效' }, { status: error instanceof RequestBodyError ? error.status : 400 }) }
  const { baseUrl, apiKey, model } = body || {}

  const invalid = modelSettingsError(body)
  if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 })
  try {
    const normalizedUrl = String(baseUrl).replace(/\/+$/, '')
    const chatUrl = `${normalizedUrl}/chat/completions`

    const response = await secureModelFetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      await response.body?.cancel()
      return NextResponse.json({ success: false, error: `连接失败 (HTTP ${response.status})` })
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ success: false, error: 'Empty response from API' })
    }

    return NextResponse.json({ success: true, message: '连接成功' })
  } catch (error: unknown) {
    const err = error as Error
    if (err.name === 'AbortError') {
      return NextResponse.json({ success: false, error: '连接超时，请检查 API 地址是否正确' })
    }
    return NextResponse.json({ success: false, error: '无法连接到 API 服务器' })
  }
}
