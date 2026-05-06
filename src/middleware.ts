import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { validateCsrf } from '@/lib/csrf'
import {
  getClientIp,
  isAdmin,
  recordActivity,
  wasRecentlyActive,
  isOverLimit,
  getOnlineCount,
  getOnlineLimit,
  kickUser,
  isKicked,
} from '@/lib/onlineTracker'

const OPTIONAL_AUTH_PATHS = [
  '/',
  '/api/translate',
  '/api/public-translate',
  '/api/tts',
  '/api/donation',
  '/api/analytics',
]

const PUBLIC_PATHS = ['/auth/signin', '/api/auth', '/api/captcha', '/api/health']

const ADMIN_PATHS = [
  '/analytics',
  '/users',
  '/llm-config',
  '/public-words',
  '/translation-records',
  '/api/admin/users',
  '/api/llm-providers',
  '/api/public-words',
  '/api/translation-records',
  '/api/config',
]

function isPathMatch(pathname: string, paths: string[]): boolean {
  return paths.some((path) => {
    if (path === '/') return pathname === '/'
    return pathname === path || pathname.startsWith(path + '/')
  })
}

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

function baseHeaders(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  res.headers.set('X-Build-Id', process.env.NEXT_PUBLIC_BUILD_ID || 'dev')
  return res
}

const KICK_MESSAGE = '当前服务器资源紧张，监测到您五分钟没有操作，判定为挂机，如需使用请尝试重新登录'

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')
  const ip = getClientIp(request)

  // --- PUBLIC_PATHS: always pass through (but still track + set/clear cookie) ---
  if (isPathMatch(pathname, PUBLIC_PATHS)) {
    const res = NextResponse.next()
    baseHeaders(res)

    const wasActive = wasRecentlyActive(ip)
    recordActivity(ip)

    if (isOverLimit()) {
      if (!wasActive) {
        res.cookies.set('online_limit', String(getOnlineCount()), {
          path: '/',
          maxAge: 300,
          sameSite: 'lax',
        })
      }
    } else {
      res.cookies.delete('online_limit')
    }
    return res
  }

  // --- CSRF ---
  const csrfResult = validateCsrf(request)
  if (!csrfResult.valid) {
    return NextResponse.json(
      { success: false, error: '请求验证失败，请刷新页面重试' },
      { status: 403 },
    )
  }

  // --- Auth token ---
  const token = await getToken({ req: request })
  const userId = token?.sub
  const username = token?.name as string | undefined

  // --- Admin backdoor: always allow, always active, never kicked ---
  if (isAdmin(username)) {
    recordActivity(ip)
    const res = NextResponse.next()
    baseHeaders(res)
    res.cookies.delete('online_limit')
    return res
  }

  // --- Blacklist check: kicked user trying to come back ---
  if (userId && isKicked(userId)) {
    if (isApi) {
      const res = NextResponse.json({ success: false, error: KICK_MESSAGE }, { status: 401 })
      res.cookies.delete(SESSION_COOKIE)
      return res
    }
    const res = NextResponse.redirect(new URL('/auth/signin?kicked=1', request.url))
    res.cookies.delete(SESSION_COOKIE)
    return res
  }

  // --- Online limit check ---
  const wasActive = wasRecentlyActive(ip)
  recordActivity(ip)

  if (!wasActive && isOverLimit()) {
    if (userId) {
      // Authenticated user, new connection, over limit → kick
      kickUser(userId)
      if (isApi) {
        const res = NextResponse.json({ success: false, error: KICK_MESSAGE }, { status: 401 })
        res.cookies.delete(SESSION_COOKIE)
        return res
      }
      const res = NextResponse.redirect(new URL('/auth/signin?kicked=1', request.url))
      res.cookies.delete(SESSION_COOKIE)
      return res
    }

    // Unauthenticated, new connection, over limit
    const isOptional = isPathMatch(pathname, OPTIONAL_AUTH_PATHS)
    if (!isOptional) {
      // Not a guest-accessible path → redirect to homepage
      const res = NextResponse.redirect(new URL('/', request.url))
      res.cookies.set('online_limit', String(getOnlineCount()), {
        path: '/',
        maxAge: 300,
        sameSite: 'lax',
      })
      return res
    }
    // Guest-accessible path → allow with cookie
    const res = NextResponse.next()
    baseHeaders(res)
    res.cookies.set('online_limit', String(getOnlineCount()), {
      path: '/',
      maxAge: 300,
      sameSite: 'lax',
    })
    return res
  }

  // --- Normal flow: under limit or existing active user ---
  const res = NextResponse.next()
  baseHeaders(res)
  res.cookies.delete('online_limit')

  // --- Standard auth checks (existing logic) ---
  if (!token) {
    const isOptional = isPathMatch(pathname, OPTIONAL_AUTH_PATHS)
    if (!isOptional) {
      if (isApi) {
        return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
      }
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }
  } else {
    const isAdminPath = isPathMatch(pathname, ADMIN_PATHS)
    if (isAdminPath && !token.isAdmin) {
      if (isApi) {
        return NextResponse.json({ success: false, error: '需要管理员权限' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
