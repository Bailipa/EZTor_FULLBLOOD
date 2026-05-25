const OIDC_ENABLED = process.env.NEXT_PUBLIC_XIAOYING_OIDC_ENABLED === 'true'

const WEBVIEW_KEYWORDS = ['xiaoying', '小应']

export function isXiaoYingWebView(): boolean {
  if (typeof navigator === 'undefined') return OIDC_ENABLED
  const ua = navigator.userAgent.toLowerCase()
  return OIDC_ENABLED || WEBVIEW_KEYWORDS.some((kw) => ua.includes(kw))
}
