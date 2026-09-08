import { NextRequest, NextResponse } from 'next/server'
import { lookupZhEn } from '@/lib/zhEnLookup'
import { rateLimit, getClientKey } from '@/lib/rateLimit'
import { validateInput } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_WORDS = 20

// 中译英是纯公共词库查询，guest 也可用（按 IP 限流）；只有"加入词库/AI询问"才需要登录
export async function POST(req: NextRequest) {
  const rateLimitResult = await rateLimit(`zh-to-en:${getClientKey(req)}`, {
    maxRequests: 30,
    windowMs: 60 * 1000,
  })
  if (!rateLimitResult.success) {
    return NextResponse.json({ success: false, error: '请求过于频繁，请稍后再试' }, { status: 429 })
  }

  let body: { words?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体无效' }, { status: 400 })
  }

  const rawWords = Array.isArray(body?.words) ? body.words : []
  const words = rawWords
    .map((w) => String(w).trim())
    .filter(Boolean)
    .slice(0, MAX_WORDS)
  if (words.length === 0) {
    return NextResponse.json({ success: false, error: '请输入中文词或词组' }, { status: 400 })
  }

  const results = []
  for (const w of words) {
    const v = validateInput(w, 100)
    if (!v.valid) {
      return NextResponse.json({ success: false, error: '输入不合法' }, { status: 400 })
    }
    results.push(await lookupZhEn(w))
  }

  return NextResponse.json({ success: true, data: results })
}
