'use strict'

// 用自定义特权协议托管 overlay 页面与 /api/danmaku，完整测试弹幕渲染逻辑
// （数据流 + spawnBullet + CSS 动画），无需登录。
const { app, BrowserWindow, protocol } = require('electron')
const fs = require('fs')
const path = require('path')

const SCHEME = 'eztor-test'
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const fakeWords = Array.from({ length: 6 }, (_, i) => ({ word: 'test' + i, translation: '测试弹幕' + i }))
let fail = 0
function check(cond, msg) {
  console.log((cond ? '✓' : '✗') + ' ' + msg)
  if (!cond) fail++
}

app.whenReady().then(async () => {
  const overlayHtml = fs.readFileSync(
    '/Users/elee987/Downloads/web_compressed/public/danmaku-overlay.html', 'utf8')

  protocol.handle(SCHEME, (req) => {
    const u = new URL(req.url)
    if (u.pathname === '/api/danmaku') {
      return new Response(JSON.stringify({ success: true, data: fakeWords }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(overlayHtml, { headers: { 'Content-Type': 'text/html' } })
  })

  const win = new BrowserWindow({ show: false, width: 1280, height: 800 })
  win.webContents.on('console-message', (_e, _l, msg) => console.log('  [page]', msg))
  await win.loadURL(`${SCHEME}://overlay/danmaku-overlay.html`)
  await new Promise((r) => setTimeout(r, 4000))

  const state = await win.webContents.executeJavaScript(`(() => {
    const stage = document.getElementById('stage')
    const els = stage ? stage.children : []
    return { count: els.length, texts: Array.from(els).map(e => e.textContent).slice(0, 8) }
  })()`)
  console.log('  overlay 状态:', JSON.stringify(state))

  check(state.count >= 3, `渲染出 >=3 条弹幕（实际 ${state.count}）`)
  check(state.texts.some((t) => t.includes('测试弹幕')), '弹幕含翻译文本')

  win.destroy()
  console.log(fail === 0 ? '\nOVERLAY RENDER OK' : `\nOVERLAY RENDER FAIL (${fail})`)
  app.exit(fail === 0 ? 0 : 1)
})
