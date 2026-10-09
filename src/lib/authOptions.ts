import { INTERFACE_STYLES } from '@/lib/interfaceStyle'
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { rateLimit } from '@/lib/rateLimit'
import { getSecretKey } from '@/lib/envValidator'
import { removeKick } from '@/lib/onlineTracker'

const AUTH_ERROR_MESSAGE = '用户名或密码错误 / Invalid username or password'

function recordAuthEvent(
  eventType: 'LOGIN' | 'REGISTER',
  userId: string,
  req?: { headers?: Record<string, string | string[] | undefined> },
) {
  const forwarded = req?.headers?.['x-real-ip'] || req?.headers?.['x-forwarded-for']
  const ipAddress = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',').at(-1)?.trim()
  const userAgent = req?.headers?.['user-agent']
  prisma.analyticsEvent.create({
    data: {
      id: crypto.randomUUID(),
      eventType,
      userId,
      metadata: JSON.stringify({ method: 'credentials' }),
      ipAddress: ipAddress || null,
      userAgent: typeof userAgent === 'string' ? userAgent : null,
    },
  }).catch(() => {})
}

async function simulatePasswordHash(): Promise<void> {
  await bcrypt.hash('dummy_password_for_timing', 10)
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        captchaInput: { label: 'Captcha', type: 'text' },
        captchaHash: { label: 'CaptchaHash', type: 'text' },
        captchaTimestamp: { label: 'CaptchaTimestamp', type: 'text' },
      },
      async authorize(credentials, req) {
        const ip = req?.headers?.['x-real-ip'] || req?.headers?.['x-forwarded-for'] || 'unknown'
        const rateLimitKey = `auth:${Array.isArray(ip) ? ip.at(-1) : ip.split(',').at(-1)?.trim()}`
        const rateLimitResult = await rateLimit(rateLimitKey)

        if (!rateLimitResult.success) {
          throw new Error('Too many login attempts. Please try again later.')
        }

        if (!credentials?.username || !credentials?.password) {
          throw new Error('Missing username or password')
        }

        if (
          !credentials.captchaInput ||
          !credentials.captchaHash ||
          !credentials.captchaTimestamp
        ) {
          throw new Error('验证码缺失 / Missing captcha')
        }

        const timeDiff = Date.now() - Number(credentials.captchaTimestamp)
        if (!Number.isFinite(timeDiff) || timeDiff < 0 || timeDiff > 5 * 60 * 1000) {
          throw new Error('验证码已过期 / Captcha expired')
        }

        const expectedHash = crypto
          .createHmac('sha256', getSecretKey())
          .update(`${credentials.captchaInput.toLowerCase()}:${credentials.captchaTimestamp}`)
          .digest('hex')

        if (!/^[a-f0-9]{64}$/.test(credentials.captchaHash) || !crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(credentials.captchaHash, 'hex'))) {
          throw new Error('验证码错误 / Invalid captcha')
        }

        const normalizedUsername = credentials.username.toLowerCase().trim()

        const user = await prisma.user.findUnique({
          where: { username: normalizedUsername },
        })

        if (!user) {
          await simulatePasswordHash()

          const hashedPassword = await bcrypt.hash(credentials.password, 10)
          const newUser = await prisma.user.create({
            data: {
              id: crypto.randomUUID(),
              username: normalizedUsername,
              password: hashedPassword,
              UserPreference: {
                create: {
                  interfaceStyle: INTERFACE_STYLES[crypto.randomInt(INTERFACE_STYLES.length)].id,
                  updatedAt: new Date(),
                },
              },
              updatedAt: new Date(),
            },
          })
          recordAuthEvent('REGISTER', newUser.id, req)
          return { id: newUser.id, name: newUser.username, isAdmin: newUser.isAdmin }
        }

        if (user.isBanned) {
          const banInfo = user.banReason
            ? `账户已被封禁: ${user.banReason}`
            : '账户已被封禁 / Account has been banned'
          throw new Error(banInfo)
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error(AUTH_ERROR_MESSAGE)
        }

        recordAuthEvent('LOGIN', user.id, req)
        return { id: user.id, name: user.username, isAdmin: user.isAdmin }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      if (session?.user) {
        // A browser may inspect its own session; authority comes from current DB state.
        const account = token.sub ? await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true, username: true, isAdmin: true, isBanned: true, banExpiresAt: true },
        }) : null
        const blocked = account?.isBanned && (!account.banExpiresAt || account.banExpiresAt > new Date())
        session.user = { id: account?.id ?? '', name: account?.username ?? null, isAdmin: !!account?.isAdmin && !blocked }
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin
        removeKick(user.id)
      }
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
}
