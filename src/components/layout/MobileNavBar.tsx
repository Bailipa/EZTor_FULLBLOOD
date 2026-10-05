'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dialog } from 'radix-ui'
import { Home, PenTool, Sparkles, Settings2, Grid2X2, LockKeyhole, BookOpen, Trophy, MonitorDown, Coffee, MonitorPlay } from 'lucide-react'
import { useSession } from 'next-auth/react'
import styles from './mobile-navigation.module.css'
import { useKeyboardVisibility } from '@/components/layout/NativeKeyboardLayoutProvider'
import { DonationDialog } from '@/components/home/DonationModal'
import { useDanmakuStore } from '@/stores/danmakuStore'
import { FEATURE_UNLOCK_THRESHOLDS } from '@/features/gamification/constants'
import { FeatureLockedDialog } from '@/features/gamification/components/FeatureLockedDialog'
import { playFeedbackSound } from '@/lib/feedbackSounds'

const navItems = [
  { href: '/', label: '首页', icon: Home, requiresAuth: false, x: -140, y: 48 },
  { href: '/dictation', label: '复习', icon: PenTool, requiresAuth: true, x: -128, y: 132 },
  { href: '/history', label: '词库', icon: BookOpen, requiresAuth: false, x: -72, y: 184 },
  { href: '/leaderboard', label: '排行榜', icon: Trophy, requiresAuth: true, x: 72, y: 184 },
  { href: '/ai', label: '翻译与聊天', icon: Sparkles, requiresAuth: false, x: 128, y: 132 },
  { href: '/me', label: '设置', icon: Settings2, requiresAuth: false, x: 140, y: 48 },
]
const downloadTarget = navItems.length
const donationTarget = navItems.length + 1
const danmakuTarget = navItems.length + 2
const prefetchRoutes = process.env.NODE_ENV === 'production'

function dragTargetLabel(target: number) {
  if (target === downloadTarget) return '下载APP'
  if (target === donationTarget) return '打赏作者'
  if (target === danmakuTarget) return '弹幕复习'
  return navItems[target]?.label ?? ''
}

function matchesPage(href: string, pathname: string) {
  if (href === '/me') return pathname === '/me' || pathname.startsWith('/me/')
  if (href === '/ai') return pathname === '/ai' || pathname === '/chat'
  if (href === '/dictation') return pathname === '/dictation' || pathname === '/mistakes'
  if (href === '/history') return pathname === '/history' || pathname.startsWith('/history/') || pathname === '/public-vocabulary' || pathname.startsWith('/public-vocabulary/') || pathname === '/contributions'
  if (href === '/leaderboard') return pathname === '/leaderboard' || pathname.startsWith('/leaderboard/')
  if (href === '/public-vocabulary') return pathname === '/contributions' || pathname === '/public-vocabulary' || pathname.startsWith('/public-vocabulary/')
  return pathname === href
}

export default function MobileNavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const danmakuStatus = useDanmakuStore((state) => state.status)
  const countdownValue = useDanmakuStore((state) => state.countdownValue)
  const toggleDanmaku = useDanmakuStore((state) => state.toggle)
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const [combatPower, setCombatPower] = useState<number | null>(null)
  const [danmakuLockedOpen, setDanmakuLockedOpen] = useState(false)
  const danmakuLocked = status === 'authenticated' && combatPower !== null && combatPower < FEATURE_UNLOCK_THRESHOLDS.DANMAKU
  const keyboardVisible = useKeyboardVisibility()
  const [dragging, setDragging] = useState(false)
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const activeLinkRef = useRef<HTMLAnchorElement>(null)
  const downloadActionRef = useRef<HTMLAnchorElement>(null)
  const donationActionRef = useRef<HTMLButtonElement>(null)
  const danmakuActionRef = useRef<HTMLButtonElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const dragFrame = useRef(0)
  const latestPointer = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null)
  const highlightedRef = useRef<number | null>(null)
  const gesture = useRef<{ id: number; x: number; y: number; startX: number; startY: number; moved: boolean; wasOpen: boolean; target: HTMLButtonElement } | null>(null)
  const suppressClickUntil = useRef(0)
  const activeItem = navItems.find((item) => matchesPage(item.href, pathname))
  const ActiveIcon = activeItem?.icon ?? Grid2X2

  const setMenuOpen = useCallback((next: boolean) => {
    if (openRef.current !== next) playFeedbackSound(next ? 'menu-open' : 'menu-close')
    openRef.current = next
    setOpen(next)
  }, [])

  const changeOpen = useCallback((next: boolean) => {
    if (!next) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = 0
      latestPointer.current = null
      highlightedRef.current = null
      const current = gesture.current
      gesture.current = null
      if (current) suppressClickUntil.current = performance.now() + 500
      if (current?.target.hasPointerCapture(current.id)) current.target.releasePointerCapture(current.id)
      setDragging(false)
      setHighlighted(null)
    }
    setMenuOpen(next)
  }, [setMenuOpen])

  const destination = (index: number) => {
    const item = navItems[index]
    if (item.href === '/history' && status === 'unauthenticated') return '/public-vocabulary'
    return item.requiresAuth && status === 'unauthenticated' ? `/auth/signin?callbackUrl=${encodeURIComponent(item.href)}` : item.href
  }

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    gesture.current = { id: event.pointerId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, startX: event.clientX, startY: event.clientY, moved: false, wasOpen: open, target: event.currentTarget }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (cursorRef.current) cursorRef.current.style.transform = 'translate(0px, 0px)'
    highlightedRef.current = null
    setHighlighted(null)
    setDragging(true)
    setMenuOpen(true)
  }

  // Directional sectors are wider than the icons; returning to the hub cancels.
  const dragTarget = (x: number, y: number, clientX: number, clientY: number) => {
    const isInside = (element: HTMLElement | null) => {
      const rect = element?.getBoundingClientRect()
      return !!rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    }
    if (isInside(downloadActionRef.current)) return downloadTarget
    if (isInside(donationActionRef.current)) return donationTarget
    if (isInside(danmakuActionRef.current)) return danmakuTarget
    const topActionEdge = Math.min(160, Math.max(88, window.innerHeight * 0.18))
    if (clientY <= topActionEdge) {
      if (clientX <= window.innerWidth * 0.4) return downloadTarget
      if (clientX >= window.innerWidth * 0.6) return donationTarget
    }
    const utilityReach = Math.max(220, window.innerHeight * 0.55)
    if (y < -utilityReach) {
      const sideReach = window.innerWidth * 0.12
      if (x < -sideReach) return downloadTarget
      if (x > sideReach) return donationTarget
    }

    const distance = Math.hypot(x, y)
    if (distance < 38 || distance > 240 || y > -8) return null
    if (Math.abs(x) <= 38 && y <= -44 && y >= -150) return danmakuTarget
    let best: number | null = null
    let alignment = Math.cos(27 * Math.PI / 180)
    navItems.forEach((item, index) => {
      const itemX = window.innerWidth < 360 ? item.x * 0.84 : item.x
      const itemY = -item.y * (window.innerWidth < 360 ? 0.84 : 1)
      const score = (x * itemX + y * itemY) / (distance * Math.hypot(itemX, itemY))
      if (score > alignment) { alignment = score; best = index }
    })
    return best
  }

  const moveDrag = (event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>) => {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 8) current.moved = true
    latestPointer.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY }
    if (dragFrame.current) return
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = 0
      const pointer = latestPointer.current
      const active = gesture.current
      if (!pointer || !active || active.id !== pointer.pointerId) return
      const dx = pointer.clientX - active.x
      const dy = pointer.clientY - active.y
      const target = dragTarget(dx, dy, pointer.clientX, pointer.clientY)
      if (highlightedRef.current !== target) {
        highlightedRef.current = target
        setHighlighted(target)
        if (target !== null) playFeedbackSound('select')
        if (prefetchRoutes) {
          if (target === downloadTarget) router.prefetch('/download')
          else if (target !== null && target < navItems.length) router.prefetch(destination(target))
        }
      }
      // Only the cursor transform changes per frame; the menu subtree stays untouched.
      if (cursorRef.current) cursorRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    })
  }

  const finishDrag = (event: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>, cancelled = false) => {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    cancelAnimationFrame(dragFrame.current)
    dragFrame.current = 0
    latestPointer.current = null
    highlightedRef.current = null
    gesture.current = null
    suppressClickUntil.current = performance.now() + 500
    if (current.target.hasPointerCapture(current.id)) current.target.releasePointerCapture(current.id)
    setDragging(false)
    setHighlighted(null)
    const moved = current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 8
    const target = !cancelled && moved
      ? dragTarget(event.clientX - current.x, event.clientY - current.y, event.clientX, event.clientY)
      : null
    if (target !== null) {
      playFeedbackSound(target === donationTarget || target === danmakuTarget ? 'tap' : 'navigate')
      setMenuOpen(false)
      if (target === downloadTarget) router.push('/download')
      else if (target === donationTarget) donationActionRef.current?.click()
      else if (target === danmakuTarget) danmakuActionRef.current?.click()
      else router.push(destination(target))
    } else {
      setMenuOpen(!cancelled && !moved && !current.wasOpen)
      if (!cancelled && !moved && !current.wasOpen) activeLinkRef.current?.focus()
    }
  }

  const dragHandlers = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => finishDrag(event),
    onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => finishDrag(event, true),
    onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => finishDrag(event, true),
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail > 0 && performance.now() < suppressClickUntil.current) event.preventDefault()
    },
  }

  useEffect(() => { changeOpen(false) }, [pathname, changeOpen])
  useEffect(() => { if (keyboardVisible) changeOpen(false) }, [keyboardVisible, changeOpen])
  useEffect(() => () => { cancelAnimationFrame(dragFrame.current) }, [])

  useEffect(() => { setCombatPower(null) }, [status, session?.user?.id])

  useEffect(() => {
    if (!open || status !== 'authenticated') return
    const controller = new AbortController()
    fetch('/api/game/profile', { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => {
        if (!controller.signal.aborted && result?.success && typeof result.data?.combatPower === 'number') setCombatPower(result.data.combatPower)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [open, status, session?.user?.id])

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)')
    const update = () => { if (!mobile.matches) changeOpen(false) }
    const cancelGesture = () => changeOpen(false)
    window.addEventListener('blur', cancelGesture)
    window.addEventListener('orientationchange', cancelGesture)
    document.addEventListener('visibilitychange', cancelGesture)
    mobile.addEventListener('change', update)
    return () => {
      window.removeEventListener('blur', cancelGesture)
      window.removeEventListener('orientationchange', cancelGesture)
      document.removeEventListener('visibilitychange', cancelGesture)
      mobile.removeEventListener('change', update)
    }
  }, [changeOpen])

  return (
    <>
      <Dialog.Root open={open} onOpenChange={changeOpen} modal={false}>
      <Dialog.Trigger asChild>
        <button type="button" {...dragHandlers} className={styles.launcher} data-open={open} data-feedback-sound="none" hidden={keyboardVisible} aria-label={`${activeItem?.label ?? '当前页面'}，按住滑动或点击打开页面导航`}>
          <span className={styles.launcherLabel} aria-hidden>
            <ActiveIcon size={20} />
            <span>{activeItem?.label ?? '导航'}</span>
            <Grid2X2 size={13} className={styles.menuHint} />
          </span>
          <Grid2X2 size={22} aria-hidden className={styles.hubIcon} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        {open && <div className={styles.overlay} data-state="open" aria-hidden onPointerDown={() => changeOpen(false)} />}
        <Dialog.Content
          className={styles.fan}
          data-dragging={dragging}
          data-feedback-sound="none"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) changeOpen(false)
          }}
          onOpenAutoFocus={(event) => {
            if (gesture.current) { event.preventDefault(); return }
            if (activeLinkRef.current) {
              event.preventDefault()
              activeLinkRef.current.focus()
            }
          }}
        >
          <Dialog.Title className="sr-only">页面导航</Dialog.Title>
          <Dialog.Description className="sr-only">按住底部入口滑向页面链接、弹幕复习或顶部快捷入口，松手进入或切换；滑回底部入口取消。也可点击菜单项目。按 Escape 或点击空白处收起。</Dialog.Description>
          <span className={styles.gestureHint} aria-live="polite">{dragging ? (highlighted === null ? '滑向目标，松手进入或打开' : `松手${highlighted === danmakuTarget ? '切换' : highlighted < navItems.length ? '进入' : '打开'}${dragTargetLabel(highlighted)}`) : '选择页面'}</span>
          <span ref={cursorRef} className={styles.dragCursor} aria-hidden />
          <nav aria-label="手机主导航">
            <ul className={styles.items}>
              {navItems.map((item, index) => {
                const active = matchesPage(item.href, pathname)
                const locked = item.requiresAuth && status === 'unauthenticated'
                const Icon = item.icon
                return (
                  <li key={item.href} className={styles.item} style={{ '--x': `${item.x}px`, '--y': `${item.y}px` } as CSSProperties}>
                    <Link
                      ref={active || (!activeItem && index === 0) ? activeLinkRef : undefined}
                      href={destination(index)}
                      prefetch={false}
                      onPointerEnter={() => { if (prefetchRoutes) router.prefetch(destination(index)) }}
                      onFocus={() => { if (prefetchRoutes) router.prefetch(destination(index)) }}
                      aria-current={active ? 'page' : undefined}
                      aria-label={locked ? `${item.label}，需要登录` : item.label}
                      className={styles.destination}
                      data-highlighted={highlighted === index}
                      onClick={() => { playFeedbackSound('navigate'); changeOpen(false) }}
                    >
                      <Icon size={22} strokeWidth={1.7} aria-hidden />
                      <span>{item.label}{locked && <LockKeyhole size={10} aria-hidden />}</span>
                    </Link>
                  </li>
                )
              })}
              <li className={styles.item} style={{ '--x': '0px', '--y': '108px' } as CSSProperties}>
                <button
                  ref={danmakuActionRef}
                  type="button"
                  className={styles.destination}
                  data-highlighted={highlighted === danmakuTarget}
                  aria-pressed={!danmakuLocked && (danmakuStatus === 'active' || danmakuStatus === 'counting')}
                  aria-label={danmakuLocked ? '弹幕复习，未解锁' : danmakuStatus === 'counting' ? `弹幕倒计时 ${countdownValue}，点击取消` : danmakuStatus === 'active' ? '关闭弹幕复习' : danmakuStatus === 'empty' ? '先添加单词吧' : '开启弹幕复习'}
                  onClick={() => { playFeedbackSound('tap'); changeOpen(false); if (danmakuLocked) setDanmakuLockedOpen(true); else void toggleDanmaku() }}
                >
                  {danmakuLocked ? <LockKeyhole size={22} strokeWidth={1.7} aria-hidden /> : danmakuStatus === 'counting' ? <span className={styles.countdown} aria-hidden>{countdownValue}</span> : <MonitorPlay size={22} strokeWidth={1.7} aria-hidden />}
                  <span>{!danmakuLocked && danmakuStatus === 'empty' ? '先添加单词' : '弹幕复习'}</span>
                </button>
              </li>
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
      </Dialog.Root>
      <div className={styles.utilityActions} data-open={open} data-feedback-sound="none" aria-hidden={!open}>
        <Link ref={downloadActionRef} href="/download" className={styles.utilityAction} data-highlighted={highlighted === downloadTarget} onClick={() => { playFeedbackSound('navigate'); changeOpen(false) }}>
          <MonitorDown size={17} aria-hidden="true" />
          <span>下载APP</span>
        </Link>
        <DonationDialog contentClassName="z-[90]" onOpenChange={(nextOpen) => { if (nextOpen) changeOpen(false) }}>
          <button ref={donationActionRef} type="button" className={styles.utilityAction} data-highlighted={highlighted === donationTarget} aria-label="打赏作者" onClick={() => playFeedbackSound('tap')}>
            <Coffee size={17} aria-hidden="true" />
            <span>打赏作者</span>
          </button>
        </DonationDialog>
      </div>
      <FeatureLockedDialog open={danmakuLockedOpen} onOpenChange={setDanmakuLockedOpen} featureName="弹幕复习" requiredPower={FEATURE_UNLOCK_THRESHOLDS.DANMAKU} currentPower={combatPower ?? 0} />
    </>
  )
}
