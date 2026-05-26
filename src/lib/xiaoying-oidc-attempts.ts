import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const TTL_MS = 10 * 60 * 1000

export async function createAttempt(
  state: string,
  nonce: string,
  codeVerifier: string,
  redirectTo: string,
): Promise<void> {
  await prisma.oidcAttempt.create({
    data: { state, nonce, codeVerifier, redirectTo },
  })
}

export async function consumeAttempt(state: string): Promise<{
  state: string
  nonce: string
  codeVerifier: string
  redirectTo: string
  createdAt: number
} | null> {
  const cutoff = new Date(Date.now() - TTL_MS)

  await prisma.oidcAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  const attempt = await prisma.oidcAttempt.findUnique({
    where: { state },
  })
  if (!attempt) return null

  await prisma.oidcAttempt.delete({ where: { state } })

  if (attempt.createdAt.getTime() < cutoff.getTime()) return null

  return {
    ...attempt,
    createdAt: attempt.createdAt.getTime(),
  }
}

export async function getAttemptCount(): Promise<number> {
  return prisma.oidcAttempt.count()
}
