import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { isLeaderboardEnabled } from '@/lib/leaderboardAccess'

export default async function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  await connection()
  if (!(await isLeaderboardEnabled())) redirect('/')

  return children
}
