'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { hasSharedNavigation } from './SharedNavigation'
import AppSidebar from './AppSidebar'
import MobileNavBar from './MobileNavBar'
import styles from './mobile-navigation.module.css'
import { ReviewReminder } from '@/hooks/useReviewReminder'

export default function AppLayout({ children }: { children: ReactNode }) {
  const sharedNavigation = hasSharedNavigation(usePathname())
  return (
    <>
      <ReviewReminder />
      {!sharedNavigation && <><AppSidebar /><MobileNavBar /></>}
      <div className={`md:ml-[72px] xl:ml-[208px] ${styles.page}`}>
        {children}
      </div>
    </>
  )
}
