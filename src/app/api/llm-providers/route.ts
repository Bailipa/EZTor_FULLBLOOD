import { readJsonBody, RequestBodyError } from '@/lib/requestBody'
import { modelSettingsError } from '@/lib/modelTransport'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { listLlmProviders, maskApiKey } from '@/lib/llmPool'

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 })
}

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id)
    return {
      ok: false as const,
      res: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin)
    return {
      ok: false as const,
      res: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
    }

  return { ok: true as const, session }
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.res

  const providers = await listLlmProviders()
  return NextResponse.json({
    success: true,
    data: providers.map((p) => ({
      ...p,
      apiKey: maskApiKey(p.apiKey),
    })),
  })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.res

  let body: Record<string, unknown>
  try { body = await readJsonBody(req, 16 * 1024) }
  catch (error) { return NextResponse.json({ success: false, error: error instanceof RequestBodyError ? error.message : '请求体无效' }, { status: error instanceof RequestBodyError ? error.status : 400 }) }
  for (const key of ['apiKey', 'baseUrl', 'model']) {
    if (body[key] !== undefined && typeof body[key] !== 'string') return badRequest('模型配置格式无效')
  }
  if (body.priority !== undefined && !Number.isInteger(body.priority)) return badRequest('优先级无效')
  if (body.quotaRemaining !== undefined && body.quotaRemaining !== null && body.quotaRemaining !== '' && (typeof body.quotaRemaining !== 'number' || !Number.isInteger(body.quotaRemaining))) return badRequest('配额无效')
  const name = String(body.name || '').trim()
  const apiKey = String(body.apiKey || '').trim()
  const baseUrl = String(body.baseUrl || 'https://api.openai.com/v1').trim()
  const model = String(body.model || 'gpt-4o-mini').trim()
  const priority = Number.isFinite(body.priority) ? Number(body.priority) : 0
  const isActive = body.isActive !== false
  const quotaRemaining =
    body.quotaRemaining === null || body.quotaRemaining === undefined || body.quotaRemaining === ''
      ? null
      : Number(body.quotaRemaining)

  const invalid = modelSettingsError({ baseUrl, apiKey, model })
  if (invalid) return badRequest(invalid)
  if (typeof body.name !== 'string' || !name || name.length > 100) return badRequest('name is invalid')
  if (!Number.isInteger(priority) || (quotaRemaining !== null && (!Number.isInteger(quotaRemaining) || quotaRemaining < 0))) return badRequest('配额或优先级无效')
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') return badRequest('启用状态无效')
  if (!apiKey) return badRequest('apiKey is required')

  const now = new Date()
  const id = crypto.randomUUID()

  try {
    await prisma.llmApiProvider.create({
      data: {
        id,
        name,
        apiKey,
        baseUrl,
        model,
        priority,
        isActive,
        quotaRemaining,
        quotaUsed: 0,
        createdAt: now,
        updatedAt: now,
      },
    })
  } catch (err: unknown) {
    const message = String(err instanceof Error ? err.message : String(err))
    if (message.includes('Unique constraint') && message.includes('name')) {
      return badRequest(`LLM 提供商 "${name}" 已存在`)
    }
    return NextResponse.json({ success: false, error: '模型配置操作失败' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.res

  let body: Record<string, unknown>
  try { body = await readJsonBody(req, 16 * 1024) }
  catch (error) { return NextResponse.json({ success: false, error: error instanceof RequestBodyError ? error.message : '请求体无效' }, { status: error instanceof RequestBodyError ? error.status : 400 }) }
  const id = String(body.id || '').trim()
  if (!id) return badRequest('id is required')

  const invalid = modelSettingsError(body, false)
  if (invalid) return badRequest(invalid)
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100)) return badRequest('名称无效')
  if (body.priority !== undefined && !Number.isInteger(body.priority)) return badRequest('优先级无效')
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') return badRequest('启用状态无效')
  if (body.quotaRemaining !== undefined && body.quotaRemaining !== null && body.quotaRemaining !== '' && (!Number.isInteger(body.quotaRemaining) || Number(body.quotaRemaining) < 0)) return badRequest('配额无效')
  const fields: Record<string, unknown> = {}
  for (const key of ['name', 'apiKey', 'baseUrl', 'model']) {
    if (body[key] !== undefined) fields[key] = String(body[key]).trim()
  }
  if (body.priority !== undefined) fields.priority = Number(body.priority) || 0
  if (body.isActive !== undefined) fields.isActive = Boolean(body.isActive)
  if (body.quotaRemaining !== undefined) {
    fields.quotaRemaining =
      body.quotaRemaining === null || body.quotaRemaining === ''
        ? null
        : Number(body.quotaRemaining)
  }

  if (Object.keys(fields).length === 0) return badRequest('no fields to update')

  fields.updatedAt = new Date()

  try {
    await prisma.llmApiProvider.update({
      where: { id },
      data: fields,
    })
  } catch (err: unknown) {
    const message = String(err instanceof Error ? err.message : String(err))
    if (message.includes('Unique constraint') && message.includes('name')) {
      return badRequest(`LLM 提供商 "${fields.name}" 已存在`)
    }
    return NextResponse.json({ success: false, error: '模型配置操作失败' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return admin.res

  const { searchParams } = new URL(req.url)
  const id = String(searchParams.get('id') || '').trim()
  if (!id) return badRequest('id is required')

  try {
    await prisma.llmApiProvider.delete({
      where: { id },
    })
  } catch {
    return NextResponse.json({ success: false, error: '模型配置操作失败' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
