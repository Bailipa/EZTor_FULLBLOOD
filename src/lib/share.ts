'use client'

export interface SharePayload {
  title?: string
  text?: string
  url?: string
}

/** 安卓原生分享桥：WebView 里 addJavascriptInterface(new ShareBridge(), "AndroidShare") 注入 */
declare global {
  interface Window {
    AndroidShare?: {
      share: (text: string) => void
    }
  }
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
 * 调起原生分享面板（安卓 App 内）。返回是否已调起（调起即视为成功，由系统面板完成分享）。
 */
function nativeShare(text: string): boolean {
  if (typeof window !== 'undefined' && window.AndroidShare?.share) {
    window.AndroidShare.share(text)
    return true
  }
  return false
}

/**
 * 分享一段文本：优先安卓原生分享面板（微信/QQ 可选）→ 其次 Web Share API → 复制降级。
 * 返回 'shared' | 'copied' | 'cancelled' | 'failed'。
 * 适用于"分享密钥 / 分享链接"等纯文本场景。
 */
export async function shareText(
  text: string,
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (nativeShare(text)) return 'shared'

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (err) {
      if (isAbortError(err)) return 'cancelled'
      // 其余错误降级复制
    }
  }

  const ok = await copyToClipboard(text)
  return ok ? 'copied' : 'failed'
}

/**
 * 分享链接卡片：优先走系统分享面板（Web Share API 发 url/text），安卓 App 内走原生
 * 文本分享桥（text/plain 带 URL）。接收方拿到 URL 后抓取 /share/[userId] 的 OG 元数据
 * 自动渲染成卡片。返回 'shared' | 'copied' | 'cancelled' | 'failed'。
 * 在无 Web Share / 无 clipboard API 的环境下降级为兼容复制（execCommand 兜底）。
 */
export async function shareOrCopy(
  payload: SharePayload,
  copyFallback: string,
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = [payload.text, payload.url].filter(Boolean).join('\n')
  if (nativeShare(text)) return 'shared'

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
