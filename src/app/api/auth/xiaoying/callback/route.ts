import { NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { getClientKey, rateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { getRequiredEnvVar, getSecretKey } from '@/lib/envValidator'
import { exchangeCodeForToken, verifyXiaoYingIdToken, getUserInfo } from '@/lib/xiaoying-oidc'
import { consumeAttempt } from '@/lib/xiaoying-oidc-attempts'
import prisma from '@/lib/prisma'
import { removeKick } from '@/lib/onlineTracker'
import { loadCustomProfanity, containsProfanity } from '@/lib/profanityFilter'
import { NICKNAME_MAX_LENGTH } from '@/features/gamification/constants'

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60

function getErrorRedirect(error: string): NextResponse {
  const url = new URL('/auth/signin', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  url.searchParams.set('error', error)
  return NextResponse.redirect(url)
}

async function trySeedXiaoYingNickname(userId: string, rawNickname: string | undefined) {
  logger.info(`[XiaoyingOIDC] seed attempt: userId=${userId.slice(0, 8)}, rawNickname=${JSON.stringify(rawNickname)}`)
  if (!rawNickname) {
    logger.info(`[XiaoyingOIDC] seed skip: rawNickname is ${rawNickname === undefined ? 'undefined' : 'empty'}`)
    return
  }
  const trimmed = rawNickname.trim()
  if (!trimmed) {
    logger.info('[XiaoyingOIDC] seed skip: trimmed empty')
    return
  }
  if (trimmed.length > NICKNAME_MAX_LENGTH) {
    logger.info(`[XiaoyingOIDC] seed skip: too long (len=${trimmed.length})`)
    return
  }
  await loadCustomProfanity()
  if (containsProfanity(trimmed)) {
    logger.info('[XiaoyingOIDC] seed skip: profanity')
    return
  }
  const existing = await prisma.userGameProfile.findUnique({
    where: { userId },
    select: { nickname: true, nicknameChangedAt: true },
  })
  if (existing && (existing.nickname !== null || existing.nicknameChangedAt !== null)) {
    logger.info(`[XiaoyingOIDC] seed skip: existing nickname=${JSON.stringify(existing.nickname)}, nicknameChangedAt=${existing.nicknameChangedAt?.toISOString() ?? 'null'}`)
    return
  }
  try {
    await prisma.userGameProfile.upsert({
      where: { userId },
      update: { nickname: trimmed },
      create: {
        id: crypto.randomUUID(),
        userId,
        nickname: trimmed,
        dailyPowerDate: new Date().toISOString().slice(0, 10),
        updatedAt: new Date(),
      },
    })
    logger.info(`[XiaoyingOIDC] seed success: userId=${userId.slice(0, 8)}, nickname=${JSON.stringify(trimmed)}`)
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      logger.info(`[XiaoyingOIDC] seed skip: collision (userId=${userId.slice(0, 8)})`)
      return
    }
    throw err
  }
}

export async function GET(request: Request) {
  try {
    const rateLimitKey = `xiaoying:callback:${getClientKey(request)}`
    const rateLimitResult = await rateLimit(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, error: '请求过于频繁，请稍后再试' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error === 'access_denied') {
      logger.security('[XiaoyingOIDC] User denied authorization')
      return getErrorRedirect('access_denied')
    }

    if (!code || !state) {
      logger.security(`[XiaoyingOIDC] Missing code or state in callback (code=${!!code}, state=${!!state})`)
      return getErrorRedirect('invalid_request')
    }

    const attempt = await consumeAttempt(state)
    if (!attempt) {
      logger.security(`[XiaoyingOIDC] Invalid or expired state (state=${state.slice(0, 8)})`)
      return getErrorRedirect('invalid_state')
    }

    const clientId = getRequiredEnvVar('XIAOYING_OIDC_CLIENT_ID')
    const clientSecret = getRequiredEnvVar('XIAOYING_OIDC_CLIENT_SECRET')
    const appUrl = getRequiredEnvVar('NEXT_PUBLIC_APP_URL')
    const redirectUri = `${appUrl}/api/auth/xiaoying/callback`

    const tokenResponse = await exchangeCodeForToken(clientId, clientSecret, code, redirectUri, attempt.codeVerifier)

    const verified = await verifyXiaoYingIdToken(tokenResponse.id_token, attempt.nonce, clientId)

    const userInfo = await getUserInfo(tokenResponse.access_token)
    logger.info(`[XiaoyingOIDC] /userinfo parsed: sub=${userInfo.sub}, nickname=${JSON.stringify(userInfo.nickname)}, picture=${JSON.stringify(userInfo.picture)}, keys=${Object.keys(userInfo).join(',')}`)

    if (userInfo.sub !== verified.sub) {
      logger.security(`[XiaoyingOIDC] userinfo.sub mismatch (userinfo=${userInfo.sub}, id_token=${verified.sub})`)
      return getErrorRedirect('identity_mismatch')
    }

    const provider = 'xiaoying'
    const issuer = 'https://api.xiaoying.life/oidc'
    const subject = userInfo.sub

    let externalIdentity = await prisma.externalIdentity.findUnique({
      where: {
        provider_issuer_subject: {
          provider,
          issuer,
          subject,
        },
      },
    })

    let localUserId: string
    if (externalIdentity) {
      localUserId = externalIdentity.localUserId
      await trySeedXiaoYingNickname(localUserId, userInfo.nickname)
    } else {
      const baseUsername = `xiaoying_${subject.substring(0, 16)}`
      let username = baseUsername
      let suffix = 1
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}_${suffix}`
        suffix++
      }

      const hashedPassword = await bcrypt.hash(crypto.randomUUID(), 10)
      const newUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          username,
          password: hashedPassword,
          updatedAt: new Date(),
        },
      })

      externalIdentity = await prisma.externalIdentity.create({
        data: {
          provider,
          issuer,
          subject,
          localUserId: newUser.id,
        },
      })

      localUserId = newUser.id
      await trySeedXiaoYingNickname(localUserId, userInfo.nickname)
      logger.info({ localUserId, username }, '[XiaoyingOIDC] Created new local user')
    }

    removeKick(localUserId)

    const secret = getSecretKey()
    const token = {
      sub: localUserId,
      name: userInfo.nickname || `xiaoying_${subject.substring(0, 16)}`,
      isAdmin: false,
    }

    const encodedJwt = await encode({
      token,
      secret,
      maxAge: SESSION_MAX_AGE,
    })

    const cookieExpires = new Date()
    cookieExpires.setTime(cookieExpires.getTime() + SESSION_MAX_AGE * 1000)

    const redirectTo = attempt.redirectTo || '/'
    const res = NextResponse.redirect(new URL(redirectTo, appUrl))

    res.cookies.set(SESSION_COOKIE, encodedJwt, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      expires: cookieExpires,
    })

    logger.info({ localUserId, redirectTo }, '[XiaoyingOIDC] Login successful')
    return res
  } catch (err) {
    logger.security(`[XiaoyingOIDC] Callback error: ${err instanceof Error ? err.message : String(err)}`)
    return getErrorRedirect('oidc_error')
  }
}
