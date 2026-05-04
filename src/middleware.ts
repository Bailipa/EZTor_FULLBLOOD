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
  const isApi = pathname.startsWith('/api/')

  if (isPathMatch(pathname, PUBLIC_PATHS)) {
    const res = NextResponse.next()
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res
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
      if (isApi) {
        return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
      }
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      const res = NextResponse.redirect(signInUrl)
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      return res
    }
  } else {
    const isAdminPath = isPathMatch(pathname, ADMIN_PATHS)
    if (isAdminPath && !token.isAdmin) {
      if (isApi) {
        return NextResponse.json({ success: false, error: '需要管理员权限' }, { status: 403 })
      }
      const res = NextResponse.redirect(new URL('/', request.url))
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      return res
    }
  }

  const res = NextResponse.next()
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
