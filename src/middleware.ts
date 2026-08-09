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
  '/translate',
  '/me',
  '/api/translate',
  '/api/public-translate',
  '/api/tts',
  '/api/donation',
  '/api/analytics',
  '/api/flashcard/public',
  // 弹幕：未登录降级公共词池（游客/系统托盘/快捷键开弹幕），登录才走私人词库
  '/api/danmaku',
]

const PUBLIC_PATHS = ['/site-config.json', '/auth/signin', '/api/auth', '/api/captcha', '/api/health', '/api/auth/xiaoying', '/flywheel-preview.html', '/share', '/api/share-profile', '/download', '/manifest.webmanifest', '/danmaku-overlay.html', '/api/download/unlock', '/api/version', '/api/debug', '/updates']

const ADMIN_PATHS = [
  '/analytics',
  '/admin',
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

  // DEBUG: 临时调试日志
  if (pathname.includes('/api/flashcard/save-and-categorize') || pathname === '/dictation') {
    const cookieHeader = request.headers.get('cookie') || ''
    const hasSessionCookie = cookieHeader.includes('next-auth.session-token') || cookieHeader.includes('__Secure-next-auth.session-token')
    console.log('[DEBUG-AUTH]', JSON.stringify({
      pathname,
      isApi,
      hasSessionCookie,
      cookieSnippet: cookieHeader.substring(0, 300),
      nextauthSecretSet: !!process.env.NEXTAUTH_SECRET,
      nextauthUrl: process.env.NEXTAUTH_URL,
    }))
  }

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

  // --- 下载门禁：/downloads/* 需携带解锁 cookie（密码 bailipa6）---
  if (pathname.startsWith('/downloads/')) {
    const dlPass = request.cookies.get('dl_pass')?.value
    const expected = Buffer.from(process.env.DOWNLOAD_PASSWORD || 'bailipa6').toString('base64')
    if (dlPass !== expected) {
      // 返回 403 而非 307 重定向：重定向会把 /download 的 HTML 页面喂给浏览器，
      // Safari 等浏览器会把它保存成"空包"（.dmg/.exe 里装的是 HTML）并提示
      // "file wasn't available on this site"。403 让浏览器明确拒绝，不产生空文件。
      return new NextResponse('未解锁下载，请先在 /download 输入密码', { status: 403 })
    }
    const res = NextResponse.next()
    baseHeaders(res)
    // 强制附件下载：Safari 对 .dmg + application/octet-stream + nosniff 会按"内联打开"
    // 处理导致下载失败；加 attachment 头让所有浏览器可靠触发下载。
    const filename = decodeURIComponent(pathname.split('/').pop() || 'download')
    res.headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    return res
  }

  // --- Mobile guest → preview redirect ---
  if (pathname === '/') {
    const skip = request.nextUrl.searchParams.has('skip-preview')
    if (!skip) {
      const ua = request.headers.get('user-agent')?.toLowerCase() || ''
      const isMobile = /mobile|android|iphone|ipad|webos|blackberry|iemobile|opera mini/i.test(ua)
      if (isMobile) {
        const token = await getToken({ req: request })
        if (!token) {
          return NextResponse.redirect(new URL('/flywheel-preview.html', request.url))
        }
      }
    }
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

  // DEBUG: 临时调试日志 - 记录所有认证失败的情况
  if (!token && !isPathMatch(pathname, PUBLIC_PATHS) && !isPathMatch(pathname, OPTIONAL_AUTH_PATHS)) {
    const cookieHeader = request.headers.get('cookie') || ''
    console.log('[DEBUG-AUTH-FAIL]', JSON.stringify({
      pathname,
      isApi,
      hasCookie: !!cookieHeader,
      cookieLength: cookieHeader.length,
      hasSessionToken: cookieHeader.includes('session-token'),
      hasSecureSessionToken: cookieHeader.includes('__Secure-next-auth.session-token'),
      nextauthSecret: process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING',
      nextauthUrl: process.env.NEXTAUTH_URL,
      timestamp: new Date().toISOString()
    }))
  }

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
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('kicked', '1')
    signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search)
    const res = NextResponse.redirect(signInUrl)
    res.cookies.delete(SESSION_COOKIE)
    return res
  }

  // --- Online limit check ---
  const wasActive = wasRecentlyActive(ip)
  recordActivity(ip)

  if (!wasActive && isOverLimit()) {
    if (userId) {
      // Authenticated user, new connection, over limit → allow (don't kick logged-in users)
      const res = NextResponse.next()
      baseHeaders(res)
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
      signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search)
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public|xiaoying-icon\\.svg|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$|.*\\.mp3$|.*\\.wav$|.*\\.woff2?$).*)'],
}
