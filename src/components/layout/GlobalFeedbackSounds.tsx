'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  getFeedbackSoundRevision,
  playFeedbackSound,
  setFeedbackSoundEnabled,
  unlockFeedbackAudio,
  type FeedbackSound,
} from '@/lib/feedbackSounds'

const controlSelector = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="option"], input[type="button"], input[type="submit"]'

function isAvailable(control: Element): boolean {
  return !control.closest('[data-feedback-sound="none"], [inert], [aria-disabled="true"], [aria-busy="true"]') &&
    !control.matches(':disabled, [data-disabled]')
}

export function GlobalFeedbackSounds() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  useEffect(() => {
    setFeedbackSoundEnabled(status === 'unauthenticated')
    if (status !== 'authenticated') return
    const controller = new AbortController()
    fetch('/api/preferences', { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (!controller.signal.aborted && data.success) setFeedbackSoundEnabled(data.data?.soundEffectsEnabled !== false)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [status, userId])

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined
    const queue = (sound: FeedbackSound, valid: () => boolean = () => true) => {
      unlockFeedbackAudio()
      const revision = getFeedbackSoundRevision()
      clearTimeout(pending)
      pending = setTimeout(() => {
        if (revision === getFeedbackSoundRevision() && valid()) playFeedbackSound(sound)
      }, 35)
    }
    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const control = event.target instanceof Element ? event.target.closest(controlSelector) : null
      if (!control || !isAvailable(control)) return
      if (control.matches('[aria-current="page"], [aria-selected="true"], [role="radio"][aria-checked="true"]')) return
      const role = control.getAttribute('role')
      if (control instanceof HTMLAnchorElement) {
        if (control.href === window.location.href || control.getAttribute('href') === '#') return
        // Next Link prevents the browser default while still navigating successfully.
        queue('navigate')
      } else if (['tab', 'switch', 'checkbox', 'radio', 'option'].includes(role ?? '')) {
        queue('select', () => !event.defaultPrevented)
      } else {
        const submits = (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) && control.type === 'submit' && control.form
        if (!submits) queue('tap', () => !event.defaultPrevented)
      }
    }
    const onChange = (event: Event) => {
      if (!event.isTrusted || !(event.target instanceof Element) || !isAvailable(event.target)) return
      if (event.target.matches('select, input[type="checkbox"], input[type="radio"]')) queue('select')
    }
    const onSubmit = (event: SubmitEvent) => {
      if (event.isTrusted && event.target instanceof HTMLFormElement && isAvailable(event.target)) queue('submit')
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.isTrusted || event.repeat || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
      const control = event.target instanceof Element ? event.target.closest('[role="tab"]') : null
      const list = control?.closest('[role="tablist"]')
      if (!control || !list || !isAvailable(control)) return
      const selected = list.querySelector('[aria-selected="true"]')
      queue('select', () => list.querySelector('[aria-selected="true"]') !== selected)
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('change', onChange, true)
    document.addEventListener('submit', onSubmit, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      clearTimeout(pending)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('change', onChange, true)
      document.removeEventListener('submit', onSubmit, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  return null
}
