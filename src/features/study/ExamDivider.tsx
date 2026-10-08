'use client'

import { useRef } from 'react'
import styles from './exam.module.css'

export default function ExamDivider() {
  const drag = useRef<{ top: number; height: number } | null>(null)
  const share = useRef(48)
  function resize(node: HTMLDivElement, value: number) {
    const next = Math.round(Math.max(25, Math.min(70, value)))
    if (next === share.current) return
    share.current = next
    node.parentElement?.style.setProperty('--reading-share', `${share.current}%`)
    node.setAttribute('aria-valuenow', String(share.current))
  }
  return <div className={styles.divider} role="separator" tabIndex={0} aria-label="调整材料和答题区域大小" aria-orientation="horizontal" aria-valuemin={25} aria-valuemax={70} aria-valuenow={48}
    onPointerDown={(event) => {
      const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
      if (!bounds) return
      drag.current = { top: bounds.top, height: bounds.height }
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={(event) => { if (drag.current) resize(event.currentTarget, (event.clientY - drag.current.top) / drag.current.height * 100) }}
    onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
    onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); resize(event.currentTarget, share.current + (event.key === 'ArrowUp' ? -5 : 5)) } }}
  ><span /></div>
}
