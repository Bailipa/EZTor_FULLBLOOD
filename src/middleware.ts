import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { validateCsrf } from '@/lib/csrf'

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

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPathMatch(pathname, PUBLIC_PATHS)) {
    return NextResponse.next()
  }

  const csrfResult = validateCsrf(request)
  if (!csrfResult.valid) {
    console.warn(`[CSRF] Blocked request to ${pathname}: ${csrfResult.reason}`)
    return NextResponse.json(
      { success: false, error: '请求验证失败，请刷新页面重试' },
      { status: 403 },
    )
  }

  const token = await getToken({ req: request })

  if (!token) {
    const isOptionalAuth = isPathMatch(pathname, OPTIONAL_AUTH_PATHS)
    if (!isOptionalAuth) {
      // fetch() 跟随 307 会保留 POST，重定向到 /auth/signin 会导致 405
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
      }
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }
  } else {
    const isAdminPath = isPathMatch(pathname, ADMIN_PATHS)
    if (isAdminPath && !token.isAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, error: '需要管理员权限' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
