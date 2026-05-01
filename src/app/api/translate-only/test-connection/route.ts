import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { baseUrl, apiKey, model } = body || {}

  if (!baseUrl || !apiKey || !model) {
    return NextResponse.json({ success: false, error: 'Base URL, API Key, and Model are required' }, { status: 400 })
  }

  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    return NextResponse.json({ success: false, error: 'Base URL must start with http:// or https://' }, { status: 400 })
  }

  try {
    const normalizedUrl = baseUrl.replace(/\/+$/, '')
    const chatUrl = `${normalizedUrl}/chat/completions`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 50,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      let errorMessage = `HTTP ${response.status}`
      try {
        const errJson = JSON.parse(errorText)
        errorMessage = errJson?.error?.message || errJson?.error?.code || `HTTP ${response.status}`
      } catch {}
      return NextResponse.json({ success: false, error: errorMessage })
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ success: false, error: 'Empty response from API (model may need higher max_tokens or non-thinking mode)' })
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
