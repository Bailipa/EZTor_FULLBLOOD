import { readJsonBody, RequestBodyError } from '@/lib/requestBody'
import { modelSettingsError } from '@/lib/modelTransport'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const record = await prisma.customApiKey.findUnique({
    where: { userId: session.user.id },
    select: { model: true, baseUrl: true },
  })

  return NextResponse.json({
    success: true,
    data: record
      ? { configured: true, model: record.model, baseUrl: record.baseUrl }
      : { configured: false },
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try { body = await readJsonBody(req, 16 * 1024) }
  catch (error) { return NextResponse.json({ success: false, error: error instanceof RequestBodyError ? error.message : '请求体无效' }, { status: error instanceof RequestBodyError ? error.status : 400 }) }
  const { baseUrl, apiKey, model } = body as { baseUrl: string; apiKey: string; model: string }

  const invalid = modelSettingsError(body)
  if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 })
  await prisma.customApiKey.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, baseUrl, apiKey, model },
    update: { baseUrl, apiKey, model },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.customApiKey.deleteMany({ where: { userId: session.user.id } })

  return NextResponse.json({ success: true })
}
