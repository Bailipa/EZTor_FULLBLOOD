'use client'

export interface SharePayload {
  title?: string
  text?: string
  url?: string
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  const selection = document.getSelection()
  const prevRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  textarea.remove()
  if (prevRange && selection) {
    selection.removeAllRanges()
    selection.addRange(prevRange)
  }
  return ok
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy copy
    }
  }
  return legacyCopy(text)
}

/**
 * 优先走系统分享面板（Web Share API）。返回 'shared' | 'copied' | 'cancelled' | 'failed'。
 * 在 Android 内置浏览器等无 Web Share / 无 clipboard API 的环境下，
 * 自动降级为兼容复制（execCommand 兜底），保证"外联分享"可用。
 */
export async function shareOrCopy(
  payload: SharePayload,
  copyFallback: string,
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    const canShare =
      typeof navigator.canShare !== 'function' || navigator.canShare(payload as SharePayload)
    if (canShare) {
      try {
        await navigator.share(payload as SharePayload)
        return 'shared'
      } catch (err) {
        if (isAbortError(err)) return 'cancelled'
        // 系统分享面板抛错（如 Android 某些浏览器），降级复制
      }
    }
  }

  const ok = await copyToClipboard(copyFallback)
  return ok ? 'copied' : 'failed'
}
