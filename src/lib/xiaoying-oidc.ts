import { createRemoteJWKSet, jwtVerify } from 'jose'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

const XIAOYING_ISSUER = 'https://api.xiaoying.life/oidc'

const jwksUrl = new URL(`${XIAOYING_ISSUER}/jwks`)
const jwks = createRemoteJWKSet(jwksUrl)

export interface OidcTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  id_token: string
}

export interface XiaoYingUserInfo {
  sub: string
  nickname?: string
  picture?: string
}

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  nonce: string,
  codeChallenge: string,
): URL {
  const url = new URL(`${XIAOYING_ISSUER}/auth`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'openid profile')
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url
}

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OidcTokenResponse> {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${XIAOYING_ISSUER}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    logger.security(`token exchange failed: status=${res.status}, body=${text.slice(0, 200)}`)
    throw new Error(`Token exchange failed: ${res.status}`)
  }

  const data = await res.json()
  return data as OidcTokenResponse
}

export async function verifyXiaoYingIdToken(
  idToken: string,
  nonce: string,
  clientId: string,
): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: XIAOYING_ISSUER,
    audience: clientId,
  })

  if (!payload.sub) {
    throw new Error('id_token missing sub')
  }

  if ((payload as { nonce?: string }).nonce !== nonce) {
    throw new Error('nonce mismatch')
  }

  return { sub: payload.sub as string }
}

export async function getUserInfo(accessToken: string): Promise<XiaoYingUserInfo> {
  const res = await fetch(`${XIAOYING_ISSUER}/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    logger.security(`userinfo fetch failed: status=${res.status}, body=${text.slice(0, 200)}`)
    throw new Error(`Userinfo fetch failed: ${res.status}`)
  }

  const data = await res.json()
  logger.info(`[XiaoyingOIDC] /userinfo raw response: ${JSON.stringify(data)}`)
  return data as XiaoYingUserInfo
}
