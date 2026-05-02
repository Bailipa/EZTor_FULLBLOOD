import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
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

  const body = await req.json()
  const { baseUrl, apiKey, model } = body || {}

  if (!baseUrl || !apiKey || !model) {
    return NextResponse.json(
      { success: false, error: 'Base URL, API Key, and Model are required' },
      { status: 400 },
    )
  }

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
