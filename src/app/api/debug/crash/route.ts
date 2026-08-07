import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/debug/crash
 * 客户端原生崩溃上报（调试用）：记录堆栈到日志。
 * 非关键接口，请求体过大或非法时静默忽略。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const source = typeof body?.source === 'string' ? body.source : 'unknown'
    const trace = typeof body?.trace === 'string' ? body.trace.slice(0, 4000) : ''
    if (trace) {
      logger.error({ source, trace }, '[CrashReport] Client crash')
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
