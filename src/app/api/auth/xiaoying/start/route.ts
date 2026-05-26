import { NextResponse } from 'next/server'
import { getClientKey, rateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { getRequiredEnvVar } from '@/lib/envValidator'
import { generateState, generateNonce, generateCodeVerifier, generateCodeChallenge, buildAuthorizationUrl } from '@/lib/xiaoying-oidc'
import { createAttempt } from '@/lib/xiaoying-oidc-attempts'

export async function GET(request: Request) {
  const rateLimitKey = `xiaoying:start:${getClientKey(request)}`
  const rateLimitResult = await rateLimit(rateLimitKey)
  if (!rateLimitResult.success) {
    return NextResponse.json({ success: false, error: '请求过于频繁，请稍后再试' }, { status: 429 })
  }

  const clientId = getRequiredEnvVar('XIAOYING_OIDC_CLIENT_ID')
  const appUrl = getRequiredEnvVar('NEXT_PUBLIC_APP_URL')
  const redirectUri = `${appUrl}/api/auth/xiaoying/callback`

  const state = generateState()
  const nonce = generateNonce()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const redirectTo = new URL(request.url).searchParams.get('redirectTo') || '/'

  await createAttempt(state, nonce, codeVerifier, redirectTo)

  const authUrl = buildAuthorizationUrl(clientId, redirectUri, state, nonce, codeChallenge)

  logger.info({ state: state.slice(0, 8), redirectTo }, '[XiaoyingOIDC] Starting login')

  return NextResponse.redirect(authUrl)
}
