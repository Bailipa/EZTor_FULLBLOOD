import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'
import { checkCsrfHeader } from '@/lib/csrf'
import { rateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { StudyInputError } from '@/features/study/domain'

export async function studyApi(req: Request, action: (userId: string) => Promise<unknown>, admin = false) {
  try {
    const mutation = !['GET', 'HEAD'].includes(req.method)
    if (mutation && !checkCsrfHeader(req).valid) throw new StudyInputError('请求验证失败，请刷新后重试', 403)
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new StudyInputError('登录后保存你的备考档案', 401)
    const userId = session.user.id
    const account = req.headers.get('x-study-account')
    if (account && account !== userId) throw new StudyInputError('账号已切换，请刷新后重试', 409)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, isBanned: true, banExpiresAt: true } })
    if (!user) throw new StudyInputError('请重新登录', 401)
    if (user.isBanned && (!user.banExpiresAt || user.banExpiresAt > new Date())) throw new StudyInputError('当前账号无法使用备考功能', 403)
    if (admin && !user.isAdmin) throw new StudyInputError('需要管理员权限', 403)
    const limit = await rateLimit(`study:${mutation ? 'write' : 'read'}:${userId}`, { maxRequests: 120, windowMs: 60000 })
    if (!limit.success) throw new StudyInputError('操作较频繁，请稍后再试', 429)
    const data = await action(userId)
    return NextResponse.json({ success: true, data, accountId: userId }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (!(error instanceof StudyInputError)) logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Study request failed')
    return NextResponse.json({ success: false, error: error instanceof StudyInputError ? error.message : '学习记录暂未保存，请重试' }, {
      status: error instanceof StudyInputError ? error.status : 500, headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}

export async function studyBody(req: Request, maxBytes = 10000): Promise<Record<string, unknown>> {
  const announced = req.headers.get('content-length')
  if (announced && Number(announced) > maxBytes) throw new StudyInputError('提交内容过大', 413)
  // Bound actual bytes, including chunked bodies; do not buffer an arbitrarily large content import.
  const reader = req.body?.getReader()
  if (!reader) throw new StudyInputError('提交内容无效')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.length
      if (length > maxBytes) { await reader.cancel(); throw new StudyInputError('提交内容过大', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let value: unknown
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new StudyInputError('提交内容不是有效JSON') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StudyInputError('提交内容无效')
  return value as Record<string, unknown>
}
