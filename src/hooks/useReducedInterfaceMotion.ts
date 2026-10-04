'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  media.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    media.removeEventListener('change', onChange)
  }
}

function getSnapshot() {
  return document.documentElement.dataset.motion === 'reduce'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// CSS motion settings also apply to animations driven by Motion's JS engine.
export function useReducedInterfaceMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
