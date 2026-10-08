import { NextResponse } from 'next/server'
import { isLeaderboardEnabled } from '@/lib/leaderboardAccess'

export async function GET() {
  const enabled = await isLeaderboardEnabled()
  return NextResponse.json({ success: true, data: { enabled } })
}
