'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { hasSharedNavigation } from './SharedNavigation'
import AppSidebar from './AppSidebar'
import MobileNavBar from './MobileNavBar'
import styles from './mobile-navigation.module.css'
import workbench from './desktop-workbench.module.css'
import DesktopWorkspaceHeader from './DesktopWorkspaceHeader'
import { getWorkspaceSection } from './workspace-navigation'
import { ReviewReminder } from '@/hooks/useReviewReminder'

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const sharedNavigation = hasSharedNavigation(pathname)
  const hasPageHeader = pathname === '/' || pathname === '/ai' || pathname === '/chat'
  return (
    <>
      <ReviewReminder />
      {!sharedNavigation && <><AppSidebar /><MobileNavBar /></>}
      <div className={`${styles.page} ${workbench.frame}`} data-workspace-section={getWorkspaceSection(pathname)} data-workspace-header={!hasPageHeader}>
        {!hasPageHeader && <DesktopWorkspaceHeader pathname={pathname} />}
        <div className={workbench.body}>{children}</div>
      </div>
    </>
  )
}
