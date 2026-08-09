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
      /** 分享图片+文本：base64Image 可为 data:image/png;base64,... 或纯 base64 */
      shareWithImage?: (text: string, base64Image: string) => void
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

/** 把 dataURL（如 data:image/png;base64,...）转成 File 对象 */
function dataUrlToFile(dataUrl: string, filename: string, mime = 'image/png'): File | null {
  try {
    const comma = dataUrl.indexOf(',')
    const base64 = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new File([bytes], filename, { type: mime })
  } catch {
    return null
  }
}

/**
 * 分享图片 + 文本（外联图文卡片）：
 * 安卓 App 内走原生桥（ACTION_SEND + EXTRA_STREAM）→ 网页端 navigator.share({files,text}) → 复制降级。
 * imageDataUrl 可选：不传则退化为纯文本分享。
 */
export async function shareImageAndText(
  text: string,
  imageDataUrl?: string | null,
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  // 安卓原生桥：优先带图分享
  if (typeof window !== 'undefined' && window.AndroidShare) {
    if (imageDataUrl && window.AndroidShare.shareWithImage) {
      window.AndroidShare.shareWithImage(text, imageDataUrl)
      return 'shared'
    }
    if (window.AndroidShare.share) {
      window.AndroidShare.share(text)
      return 'shared'
    }
  }

  // 网页端：navigator.share 支持 files（Chrome Android / Safari）
  if (typeof navigator !== 'undefined' && navigator.share) {
    if (imageDataUrl) {
      const file = dataUrlToFile(imageDataUrl, `eztor-share-${Date.now()}.png`)
      if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'EZTor 学习战报', text })
          return 'shared'
        } catch (err) {
          if (isAbortError(err)) return 'cancelled'
          // 文件分享失败（部分浏览器不支持）→ 降级纯文本
        }
      }
    }
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
 * 分享链接/图片：优先系统分享面板（Web Share API），安卓 App 内走原生分享桥。
 * imageDataUrl 可选：提供时尝试分享图文（图片文件 + 链接文字），微信/QQ 收到图片。
 * 无 Web Share / 无 clipboard API 时降级为兼容复制（execCommand 兜底）。
 */
export async function shareOrCopy(
  payload: SharePayload,
  copyFallback: string,
  imageDataUrl?: string | null,
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = [payload.text, payload.url].filter(Boolean).join('\n')
  if (imageDataUrl) {
    return shareImageAndText(text, imageDataUrl)
  }
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
