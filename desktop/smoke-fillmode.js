'use strict'

// 验证 fill-mode=both：弹幕在 delay 期间应处于 translateX(100vw)+opacity 0（屏幕外右侧、透明），
// 而不是旧 forwards 的"自然位置 left:0 + 不透明"（屏幕左边闪现）。
const { app, BrowserWindow, protocol } = require('electron')
const fs = require('fs')

const SCHEME = 'eztor-test'
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const fakeWords = [{ word: 'flashbug', translation: '测试' }]
let fail = 0
function check(cond, msg) {
  console.log((cond ? '✓' : '✗') + ' ' + msg)
  if (!cond) fail++
}

app.whenReady().then(async () => {
  const overlayHtml = fs.readFileSync('/Users/elee987/Downloads/web_compressed/public/danmaku-overlay.html', 'utf8')

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
  await win.loadURL(`${SCHEME}://overlay/danmaku-overlay.html`)

  // 轮询直到第一条弹幕出现
  let bullet = null
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100))
    bullet = await win.webContents.executeJavaScript(
      `document.getElementById('stage').children[0] ? { tx: getComputedStyle(document.getElementById('stage').children[0]).transform, op: getComputedStyle(document.getElementById('stage').children[0]).opacity } : null`)
    if (bullet) break
  }
  check(!!bullet, '弹幕已出现')

  console.log('  首条弹幕 delay 期样式:', JSON.stringify(bullet))

  if (bullet) {
    // 解析 matrix 的 translateX
    const m = /matrix\([^)]*\)/.exec(bullet.tx)
    const txMatch = bullet.tx.match(/matrix\(1, 0, 0, 1, ([\d.e-]+),/)
    const tx = txMatch ? parseFloat(txMatch[1]) : null
    const opacity = parseFloat(bullet.op)

    // delay 期应在屏幕外右侧(≈viewport宽度)且透明
    check(tx !== null && tx >= 1200, `delay 期 translateX=${tx}（应≈1280 屏幕外右侧）`)
    check(opacity === 0, `delay 期 opacity=${opacity}（应为 0 透明）`)
    // 关键断言：不应在屏幕左侧(left:0)且不透明 —— 即旧 bug 的表现
    check(!(tx < 100 && opacity === 1), '无"屏幕左边闪现"现象')
  }

  win.destroy()
  console.log(fail === 0 ? '\nFILL-MODE OK (both 生效)' : `\nFILL-MODE FAIL (${fail})`)
  app.exit(fail === 0 ? 0 : 1)
})
