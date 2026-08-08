'use strict'

// 弹幕调节功能测试：验证 localStorage 设置（speed/amount/opacity/size）被 overlay 读取并生效，
// 且设置变更通过 storage 事件 + 500ms 防抖即时补拉（无需等 12s 轮询）。
// 复用 smoke-overlay 的特权协议方案：拦截 /api/danmaku 记录请求的 limit 参数。
const { app, BrowserWindow, protocol } = require('electron')
const fs = require('fs')
const path = require('path')

const SCHEME = 'eztor-settings-test'
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const fakeWords = Array.from({ length: 8 }, (_, i) => ({ word: 'test' + i, translation: '测试弹幕' + i }))
let lastLimit = 0
const requestLog = []
function servedWords(limit) {
  // 真实服务器按 limit 返回；mock 必须尊重 limit，否则会每次塞满 8 条掩盖逻辑
  return fakeWords.slice(0, Math.max(1, Math.min(8, limit)))
}
let fail = 0
function check(cond, msg) {
  console.log((cond ? '✓' : '✗') + ' ' + msg)
  if (!cond) fail++
}

// 读取最新一条弹幕的视觉属性（背景 alpha / en 字号 / WAAPI playbackRate）
function bulletStyle(win) {
  return win.webContents.executeJavaScript(`(() => {
    const els = document.getElementById('stage').children
    if (!els.length) return null
    const el = els[els.length - 1]
    const bg = getComputedStyle(el).backgroundColor
    const bm = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/)
    const alpha = bm ? Number(bm[4] === undefined ? 1 : bm[4]) : null
    const en = el.querySelector('.en')
    const enSize = en ? parseFloat(getComputedStyle(en).fontSize) : null
    return { alpha, enSize, rate: el._fly ? el._fly.playbackRate : null }
  })()`)
}

app.whenReady().then(async () => {
  const overlayHtml = fs.readFileSync(
    '/Users/elee987/Downloads/web_compressed/public/danmaku-overlay.html', 'utf8')

  protocol.handle(SCHEME, (req) => {
    const u = new URL(req.url)
    if (u.pathname === '/api/danmaku') {
      lastLimit = Number(u.searchParams.get('limit'))
      requestLog.push(Date.now())
      return new Response(JSON.stringify({ success: true, data: servedWords(lastLimit) }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(overlayHtml, { headers: { 'Content-Type': 'text/html' } })
  })

  const win = new BrowserWindow({ show: false, width: 1280, height: 800 })
  await win.loadURL(`${SCHEME}://overlay/danmaku-overlay.html`)

  // 等首屏拉取（limit 默认 3）渲染出弹幕
  await new Promise((r) => setTimeout(r, 2500))
  check(lastLimit === 3, `默认单词量：limit=3（实际 ${lastLimit}）`)

  let s = await bulletStyle(win)
  check(s && Math.abs(s.alpha - 0.8) < 0.05, `默认背景透明度：alpha ≈ 0.80（实际 ${s && s.alpha}）`)
  check(s && Math.abs(s.enSize - 18) < 1, `默认字号：en ≈ 18px（实际 ${s && s.enSize}）`)

  // 模拟 App 内设置：速度 2x、单词量 2x、背景全透明、字号 2x → storage 事件实时同步
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings',
      JSON.stringify({ state: { speed: 2, amount: 2, opacity: 0, size: 2 }, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vocab_danmaku_settings', newValue: localStorage.getItem('vocab_danmaku_settings'),
    }))
    return true
  })()`)

  // 500ms 防抖后应立即补拉一批新弹幕（不用等 12s 轮询）→ 验证"更实时"
  await new Promise((r) => setTimeout(r, 1800))
  check(lastLimit === 6, `设置变更即时补拉：limit=6（实际 ${lastLimit}）`)

  s = await bulletStyle(win)
  check(s && s.alpha < 0.05, `调节后背景透明度：alpha ≈ 0（实际 ${s && s.alpha}）`)
  check(s && Math.abs(s.enSize - 36) < 1.5, `调节后字号：en ≈ 36px（实际 ${s && s.enSize}）`)
  check(s && s.rate === 2, `调节后速度：新弹幕 playbackRate=2（实际 ${s && s.rate}）`)

  // "立竿见影"：把速度改成 0.5，storage 事件应立即作用于已在飘的弹幕（无需等补拉）
  // 同时记录在途弹幕的轨道占用截止时间，验证调速后被按 旧速/新速=4 放大（防同轨追尾）
  const busyProbe = await win.webContents.executeJavaScript(`(() => {
    const el = document.getElementById('stage').lastElementChild
    window.__busyProbe = el
    return el ? el._busyUntil : 0
  })()`)
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings',
      JSON.stringify({ state: { speed: 0.5, amount: 2, opacity: 0, size: 2 }, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vocab_danmaku_settings', newValue: localStorage.getItem('vocab_danmaku_settings'),
    }))
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 300))
  const rateAfter = await win.webContents.executeJavaScript(`(() => {
    const els = document.getElementById('stage').children
    return els.length ? els[els.length - 1]._fly.playbackRate : null
  })()`)
  check(rateAfter === 0.5, `速度改动即时作用于在途弹幕：playbackRate=0.5（实际 ${rateAfter}）`)
  const busyAfter = await win.webContents.executeJavaScript(`(() => {
    const el = window.__busyProbe
    return el && el.isConnected ? el._busyUntil : -1
  })()`)
  check(
    busyProbe > 0 && busyAfter > busyProbe,
    `调速后轨道占用按新速度放大：${busyProbe} → ${busyAfter}（防同轨追尾）`,
  )

  // 恢复 speed=2，避免影响后续断言
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings',
      JSON.stringify({ state: { speed: 2, amount: 2, opacity: 0, size: 2 }, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vocab_danmaku_settings', newValue: localStorage.getItem('vocab_danmaku_settings'),
    }))
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 300))

  // 单词量调小 → 立竿见影移除在途弹幕（amount 下限 0.5，即减半）
  const countBefore = await win.webContents.executeJavaScript(
    `document.getElementById('stage').children.length`,
  )
  const lastWordBefore = await win.webContents.executeJavaScript(
    `document.getElementById('stage').lastElementChild.querySelector('.en').textContent`,
  )
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings',
      JSON.stringify({ state: { speed: 2, amount: 0.5, opacity: 0, size: 2 }, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vocab_danmaku_settings', newValue: localStorage.getItem('vocab_danmaku_settings'),
    }))
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 150)) // 测 applyAmount 的即时移除（防抖补拉尚未回流）
  const countAfter = await win.webContents.executeJavaScript(
    `document.getElementById('stage').children.length`,
  )
  check(
    countAfter <= countBefore * 0.5 && countAfter > 0,
    `单词量调小立即按变化比例移除：${countBefore} → ${countAfter}（期望 ≤${(countBefore * 0.5).toFixed(0)}）`,
  )
  // 保留最新：删的是最旧的在途弹幕，最新加入的那条必须还在（屏幕不空）
  const lastWordAfter = await win.webContents.executeJavaScript(
    `document.getElementById('stage').lastElementChild.querySelector('.en').textContent`,
  )
  check(lastWordAfter === lastWordBefore, `调小保留最新弹幕「${lastWordBefore}」，不删刚加入的`)

  // 回归：纯速度改动（单词量不变）不得再移除在途弹幕。
  // 旧逻辑 applyAmount 无条件执行，单词量<1 时会把已缩小的数量再删一轮，
  // 与 danmaku.tsx「只在 amount 变化时移除」的行为互相矛盾。
  const countAtHalf = await win.webContents.executeJavaScript(
    `document.getElementById('stage').children.length`,
  )
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings',
      JSON.stringify({ state: { speed: 1.5, amount: 0.5, opacity: 0, size: 2 }, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vocab_danmaku_settings', newValue: localStorage.getItem('vocab_danmaku_settings'),
    }))
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 150)) // 防抖补拉(500ms)前测量：只应调速不应删
  const countAfterSpeed = await win.webContents.executeJavaScript(
    `document.getElementById('stage').children.length`,
  )
  check(
    countAfterSpeed === countAtHalf,
    `纯速度改动不移除在途弹幕：${countAtHalf} → ${countAfterSpeed}`,
  )

  // 回归：速度调小数量不增加。
  // 先单独把单词量拉到 1（触发一次补拉），再只改速度 —— 速度改动不应再触发补拉，
  // 且轮询间隔随速度自适应（speed 0.5 → 24s；speed 2 → 6s）。
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings',
      JSON.stringify({ state: { speed: 2, amount: 1, opacity: 0, size: 2 }, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vocab_danmaku_settings', newValue: localStorage.getItem('vocab_danmaku_settings'),
    }))
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 700)) // 等 amountUp 补拉完成

  // 速度 2 → 0.5：间隔应拉到 24s，13s 内不应有任何轮询/补拉请求
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings',
      JSON.stringify({ state: { speed: 0.5, amount: 1, opacity: 0, size: 2 }, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vocab_danmaku_settings', newValue: localStorage.getItem('vocab_danmaku_settings'),
    }))
    return true
  })()`)
  requestLog.length = 0
  await new Promise((r) => setTimeout(r, 13000))
  check(
    requestLog.length === 0,
    `低速不增加数量：speed 0.5 时 13s 内无请求（轮询 24s，实际 ${requestLog.length}）`,
  )

  // 速度 0.5 → 2：间隔应缩短到 6s，7s 内应有轮询
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings',
      JSON.stringify({ state: { speed: 2, amount: 1, opacity: 0, size: 2 }, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vocab_danmaku_settings', newValue: localStorage.getItem('vocab_danmaku_settings'),
    }))
    return true
  })()`)
  requestLog.length = 0
  await new Promise((r) => setTimeout(r, 7000))
  check(requestLog.length >= 1, `高速轮询加快：speed 2 时 7s 内已轮询（间隔 6s，实际 ${requestLog.length}）`)

  // 恢复 amount=2，供后续损坏数据断言（limit 期望 6）
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings',
      JSON.stringify({ state: { speed: 2, amount: 2, opacity: 0, size: 2 }, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vocab_danmaku_settings', newValue: localStorage.getItem('vocab_danmaku_settings'),
    }))
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 400))

  // 损坏数据兜底：写入非法值后沿用上次有效设置，不应抛错也不应清空
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('vocab_danmaku_settings', '{bad json')
    window.dispatchEvent(new StorageEvent('storage', { key: 'vocab_danmaku_settings' }))
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 1800))
  check(lastLimit === 6, `损坏数据沿用上次有效设置：limit=6（实际 ${lastLimit}）`)

  win.destroy()
  console.log(fail === 0 ? '\nOVERLAY SETTINGS OK' : `\nOVERLAY SETTINGS FAIL (${fail})`)
  app.exit(fail === 0 ? 0 : 1)
})
