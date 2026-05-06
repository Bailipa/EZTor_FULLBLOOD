import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { rateLimit } from '@/lib/rateLimit'
import { getSecretKey } from '@/lib/envValidator'
import { removeKick } from '@/lib/onlineTracker'

const AUTH_ERROR_MESSAGE = '用户名或密码错误 / Invalid username or password'

async function simulatePasswordHash(): Promise<void> {
  await bcrypt.hash('dummy_password_for_timing', 10)
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
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
        const ip = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || 'unknown'
        const rateLimitKey = `auth:${ip}`
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

        const timeDiff = Date.now() - parseInt(credentials.captchaTimestamp)
        if (timeDiff > 5 * 60 * 1000) {
          throw new Error('验证码已过期 / Captcha expired')
        }

        const expectedHash = crypto
          .createHmac('sha256', getSecretKey())
          .update(`${credentials.captchaInput.toLowerCase()}:${credentials.captchaTimestamp}`)
          .digest('hex')

        if (expectedHash !== credentials.captchaHash) {
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
              updatedAt: new Date(),
            },
          })
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
        session.user.id = token.sub as string
        session.user.isAdmin = token.isAdmin as boolean
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

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
