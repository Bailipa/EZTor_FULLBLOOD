import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function parseRange(range: string): Date {
  const now = new Date()
  switch (range) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case '7d':
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    })
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || '7d'
    const startDate = parseRange(range)

    // 按平台统计
    const byPlatformRaw = await prisma.downloadRecord.groupBy({
      by: ['platform'],
      where: { createdAt: { gte: startDate } },
      _count: { _all: true },
      orderBy: { _count: { platform: 'desc' } },
    })

    // 按文件名统计
    const byFileRaw = await prisma.downloadRecord.groupBy({
      by: ['fileName', 'platform', 'version'],
      where: { createdAt: { gte: startDate } },
      _count: { _all: true },
      orderBy: { _count: { fileName: 'desc' } },
      take: 50,
    })

    // 每日趋势
    const dailyRaw = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(*)::int as count
      FROM "DownloadRecord"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `

    // 最近记录
    const recent = await prisma.downloadRecord.findMany({
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, platform: true, fileName: true, version: true, ipAddress: true, createdAt: true },
    })

    const safeDaily = Array.isArray(dailyRaw) ? dailyRaw : []
    const dailyTrend = safeDaily.map((row) => ({
      date: new Date(row.date).toISOString().split('T')[0],
      count: Number(row.count),
    }))

    return NextResponse.json(
      {
        success: true,
        data: {
          range,
          total: byPlatformRaw.reduce((sum, p) => sum + p._count._all, 0),
          byPlatform: byPlatformRaw.map((p) => ({ platform: p.platform, count: p._count._all })),
          byFile: byFileRaw.map((f) => ({
            fileName: f.fileName,
            platform: f.platform,
            version: f.version,
            count: f._count._all,
          })),
          dailyTrend,
          recent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        },
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    )
  } catch (error) {
    logger.error({ err: error }, 'Download stats error')
    return NextResponse.json({ success: false, error: 'Failed to fetch download stats' }, { status: 500 })
  }
}
