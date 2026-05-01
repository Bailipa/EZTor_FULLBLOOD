import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getUsage } from '@/lib/translateOnlyUsage'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = !!session.user.isAdmin
  const data = await getUsage(session.user.id, isAdmin)

  return NextResponse.json({ success: true, data })
}
