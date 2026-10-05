import Link from 'next/link'
import { BookOpenCheck, PenTool } from 'lucide-react'

type ReviewPanel = 'dictation' | 'mistakes'

export function ReviewNavigation({ active, onSelect, updated = false }: { active: ReviewPanel; onSelect?: (panel: ReviewPanel) => void; updated?: boolean }) {
  const items = [
    { id: 'dictation', href: '/dictation', title: '默写练习', description: '从生词本开始练习', icon: PenTool },
    { id: 'mistakes', href: '/mistakes', title: '错词本', description: '回顾错词，针对性巩固', icon: BookOpenCheck },
  ] as const

  return (
    <nav data-workspace-review-nav aria-label="复习方式" className="grid grid-cols-2 gap-3">
      {items.map(({ id, href, title, description, icon: Icon }) => {
        const className = `flex min-w-0 items-start gap-3 rounded-xl border-2 p-3 sm:p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${active === id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'}`
        const content = <>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
          <span className="min-w-0">
            <span className="block text-base font-semibold">{title}{id === 'mistakes' && updated && <span className="ml-2 text-xs font-normal text-muted-foreground">已更新</span>}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
          </span>
        </>
        return onSelect
          ? <button key={id} type="button" aria-pressed={active === id} className={className} onClick={() => onSelect(id)}>{content}</button>
          : <Link key={id} href={href} aria-current={active === id ? 'true' : undefined} className={className}>{content}</Link>
      })}
    </nav>
  )
}
