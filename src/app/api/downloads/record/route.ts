import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { classifyDownload } from '@/lib/downloadClassify'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// 从请求头提取客户端 IP（与 middleware 保持一致）
function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  )
}

// 下载记录：仅记录合法安装包文件名，避免垃圾数据
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { fileName?: string } | null
    const fileName = body?.fileName
    if (!fileName) {
      return NextResponse.json({ success: false, error: 'fileName required' }, { status: 400 })
    }

    const classification = classifyDownload(fileName)
    if (!classification) {
      return NextResponse.json({ success: false, error: 'Not an installer file' }, { status: 400 })
    }

    await prisma.downloadRecord.create({
      data: {
        id: randomUUID(),
        platform: classification.platform,
        fileName,
        version: classification.version,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent'),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'Download record error')
    return NextResponse.json({ success: false, error: 'Failed to record download' }, { status: 500 })
  }
}
