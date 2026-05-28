import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { containsProfanity, filterProfanity, loadCustomProfanity } from '@/lib/profanityFilter'
import { checkMessageRisk } from '@/lib/riskDetection'
import { broadcastMessage, broadcastConfig } from '@/lib/chatSSE'
import { logger } from '@/lib/logger'

const MAX_CONTENT_LENGTH = 300
const RATE_LIMIT_SECONDS = 5

const lastMessageTime = new Map<string, number>()

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)

    const admin = isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin })

    const where = admin
      ? { isDeleted: false }
      : { isDeleted: false, isHidden: false }

    const messages = await prisma.chatMessage.findMany({
      where,
      include: {
        User: {
          select: {
            id: true,
            username: true,
            isAdmin: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = messages.length > limit
    const data = hasMore ? messages.slice(0, -1) : messages
    const nextCursor = hasMore ? data[data.length - 1].id : null

    return NextResponse.json({
      success: true,
      data: data.reverse(),
      pagination: { hasMore, nextCursor }
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to fetch messages: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const config = await prisma.chatConfig.findUnique({ where: { id: 'global' } })
    if (!config?.isEnabled || config.isCircuitBroken) {
      return NextResponse.json({ success: false, error: 'Chat is disabled' }, { status: 403 })
    }

    const chatBan = await prisma.chatBan.findUnique({ where: { userId } })
    const isShadowBanned = !!chatBan

    const now = Date.now()
    const lastTime = lastMessageTime.get(userId) || 0
    if (now - lastTime < RATE_LIMIT_SECONDS * 1000) {
      return NextResponse.json({
        success: false,
        error: `发送过于频繁，请${RATE_LIMIT_SECONDS}秒后再试`
      }, { status: 429 })
    }

    const { content } = await req.json()

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 })
    }

    const trimmedContent = content.trim()
    if (trimmedContent.length === 0) {
      return NextResponse.json({ success: false, error: 'Content cannot be empty' }, { status: 400 })
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({
        success: false,
        error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`
      }, { status: 400 })
    }

    await loadCustomProfanity()

    let finalContent = trimmedContent
    if (containsProfanity(trimmedContent)) {
      finalContent = filterProfanity(trimmedContent)
    }

    const admin = isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin })
    if (!admin) {
      const riskCheck = await checkMessageRisk(trimmedContent)
      if (riskCheck.isRisky) {
        await prisma.chatConfig.update({
          where: { id: 'global' },
          data: {
            isCircuitBroken: true,
            circuitBreakReason: riskCheck.reason || '检测到风险内容',
            circuitBreakAt: new Date()
          }
        })

        broadcastConfig({
          type: 'circuit_break',
          reason: riskCheck.reason || '检测到风险内容'
        })

        return NextResponse.json({
          success: false,
          error: 'Risk detected, chat has been circuit broken'
        }, { status: 403 })
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        userId,
        content: finalContent,
        isHidden: isShadowBanned,
      },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            isAdmin: true,
          }
        }
      }
    })

    lastMessageTime.set(userId, now)

    broadcastMessage(message)

    return NextResponse.json({
      success: true,
      data: message,
      isShadowBanned
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to send message: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
