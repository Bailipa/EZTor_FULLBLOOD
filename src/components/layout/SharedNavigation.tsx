'use client'

import { usePathname } from 'next/navigation'
import AppSidebar from './AppSidebar'
import MobileNavBar from './MobileNavBar'

const sharedRoutes = new Set([
  '/', '/ai', '/dictation', '/mistakes', '/history', '/leaderboard',
  '/public-vocabulary', '/contributions', '/me', '/download', '/chat',
])

export function hasSharedNavigation(pathname: string) {
  return sharedRoutes.has(pathname) || pathname.startsWith('/me/') || pathname.startsWith('/history/')
}

// The root layout keeps these instances mounted while only the page content changes.
export default function SharedNavigation() {
  const pathname = usePathname()
  if (!hasSharedNavigation(pathname)) return null
  return <><AppSidebar /><MobileNavBar /></>
}
