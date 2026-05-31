'use client'

import { ReactNode } from 'react'
import AppSidebar from './AppSidebar'
import MobileNavBar from './MobileNavBar'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppSidebar />
      <MobileNavBar />
      <div className="xl:ml-[240px] pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] xl:pb-0">
        {children}
      </div>
    </>
  )
}
