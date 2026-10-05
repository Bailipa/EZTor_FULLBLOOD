'use client'

import { getWorkspaceSection, workspaceSections } from './workspace-navigation'
import styles from './desktop-workbench.module.css'

export default function DesktopWorkspaceHeader({ pathname }: { pathname: string }) {
  const section = getWorkspaceSection(pathname)
  const { label, icon: Icon } = workspaceSections[section]

  return (
    <header data-minimal-surface className={styles.header}>
      <div className={styles.headerTitle}><Icon size={18} strokeWidth={1.7} /><h1>{label}</h1></div>
    </header>
  )
}
