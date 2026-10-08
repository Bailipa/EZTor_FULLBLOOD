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

export default function AppLayout({ children, workspaceHeader }: { children: ReactNode; workspaceHeader?: ReactNode }) {
  const pathname = usePathname()
  const sharedNavigation = hasSharedNavigation(pathname)
  const hasPageHeader = pathname === '/' || pathname === '/ai' || pathname === '/chat' || pathname === '/study'
  return (
    <>
      <ReviewReminder />
      {!sharedNavigation && <><AppSidebar /><MobileNavBar /></>}
      <div className={`${styles.page} ${workbench.frame}`} data-workspace-section={getWorkspaceSection(pathname)} data-radial-menu-page={pathname === '/ai' ? 'true' : undefined} data-workspace-header={!!workspaceHeader || pathname === '/study' || !hasPageHeader}>
        {workspaceHeader ? <header className={workbench.header}>{workspaceHeader}</header> : !hasPageHeader && <DesktopWorkspaceHeader />}
        <div className={workbench.body}>{children}</div>
      </div>
    </>
  )
}
