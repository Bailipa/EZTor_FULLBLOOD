import { NextResponse } from 'next/server'
import { rateLimit, getClientKey } from '@/lib/rateLimit'
import { synthesizeSpeech } from '@/lib/tts'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const rateLimitKey = `tts:${getClientKey(req)}`
    const rl = await rateLimit(rateLimitKey)
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      )
    }

    const body = await req.json().catch(() => ({}))

    // Accept both project-native and OpenAI-compatible payload shapes.
    const input: string = body.input ?? body.text ?? ''
    const voice: string | undefined = body.voice
    const speed: number | undefined = body.speed

    if (input.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Input exceeds maximum length of 500 characters' },
        { status: 400 },
      )
    }

    const ttsResponse = await synthesizeSpeech({
      input,
      voice,
      speed,
      response_format: body.response_format,
      signal: req.signal,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-store',
    }

    const contentLength = ttsResponse.headers.get('Content-Length')
    if (contentLength) {
      headers['Content-Length'] = contentLength
    }

    return new Response(ttsResponse.body, { headers })
  } catch (err: unknown) {
    logger.error({ err }, '[TTS] Failed')
    return NextResponse.json({ success: false, error: 'TTS failed' }, { status: 500 })
  }
}
