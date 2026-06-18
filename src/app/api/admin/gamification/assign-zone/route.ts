import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

const MAX_USER_IDS_PER_REQUEST = 100

type AssignSource = 'inline' | 'bulk' | 'zone-add' | 'find-user'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!admin?.isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as
    | { userIds?: unknown; zoneId?: unknown; source?: unknown }
    | null

  if (!body || !Array.isArray(body.userIds)) {
    return NextResponse.json({ success: false, error: '缺少 userIds 数组' }, { status: 400 })
  }

  const userIds = body.userIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (userIds.length === 0) {
    return NextResponse.json({ success: false, error: 'userIds 不能为空' }, { status: 400 })
  }
  if (userIds.length > MAX_USER_IDS_PER_REQUEST) {
    return NextResponse.json(
      { success: false, error: `单次最多处理 ${MAX_USER_IDS_PER_REQUEST} 个用户` },
      { status: 400 },
    )
  }

  const deduped = Array.from(new Set(userIds))

  let zoneId: string | null
  if (body.zoneId === null || body.zoneId === '' || body.zoneId === undefined) {
    zoneId = null
  } else if (typeof body.zoneId === 'string') {
    zoneId = body.zoneId
  } else {
    return NextResponse.json({ success: false, error: 'zoneId 格式错误' }, { status: 400 })
  }

  if (zoneId !== null) {
    const targetZone = await prisma.warZone.findUnique({
      where: { id: zoneId },
      select: { id: true, isActive: true },
    })
    if (!targetZone) {
      return NextResponse.json({ success: false, error: '目标学区不存在' }, { status: 400 })
    }
    if (!targetZone.isActive) {
      return NextResponse.json({ success: false, error: '目标学区已停用，无法指派' }, { status: 400 })
    }
  }

  const source: AssignSource =
    body.source === 'inline' ||
    body.source === 'bulk' ||
    body.source === 'zone-add' ||
    body.source === 'find-user'
      ? body.source
      : 'inline'

  const results: Array<{
    userId: string
    ok: boolean
    noop?: boolean
    error?: string
  }> = []

  for (const userId of deduped) {
    try {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })
      if (!targetUser) {
        results.push({ userId, ok: false, error: '用户不存在' })
        continue
      }

      let profile = await prisma.userGameProfile.findUnique({
        where: { userId },
        select: { id: true, zoneId: true },
      })

      if (!profile) {
        profile = await prisma.userGameProfile.create({
          data: {
            userId,
            updatedAt: new Date(),
          },
          select: { id: true, zoneId: true },
        })
      }

      const fromZoneId = profile.zoneId ?? null
      const toZoneId = zoneId

      if (fromZoneId === toZoneId) {
        results.push({ userId, ok: true, noop: true })
        continue
      }

      const ops = []

      if (fromZoneId) {
        ops.push(
          prisma.warZone.update({
            where: { id: fromZoneId },
            data: { memberCount: { decrement: 1 } },
          }),
        )
      }

      if (toZoneId) {
        ops.push(
          prisma.warZone.update({
            where: { id: toZoneId },
            data: { memberCount: { increment: 1 } },
          }),
        )
      }

      ops.push(
        prisma.userGameProfile.update({
          where: { id: profile.id },
          data: { zoneId: toZoneId },
        }),
      )

      ops.push(
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'ADMIN_ASSIGN_ZONE',
            entityType: 'User',
            entityId: userId,
            oldValue: JSON.stringify({ zoneId: fromZoneId }),
            newValue: JSON.stringify({ zoneId: toZoneId, source }),
          },
        }),
      )

      await prisma.$transaction(ops)
      results.push({ userId, ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ userId, ok: false, error: msg })
    }
  }

  const summary = {
    ok: results.filter((r) => r.ok && !r.noop).length,
    noop: results.filter((r) => r.noop).length,
    failed: results.filter((r) => !r.ok).length,
  }

  return NextResponse.json({ success: true, results, summary })
}
