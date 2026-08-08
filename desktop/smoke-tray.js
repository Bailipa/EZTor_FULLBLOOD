'use strict'

// 托盘 ↔ App 弹幕状态同步：验证 preload 暴露的 onDanmakuStateChanged 桥
// 能收到主进程发来的 danmaku-state-changed 事件（反向同步的基础）。
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

let fail = 0
function check(cond, msg) {
  console.log((cond ? '✓' : '✗') + ' ' + msg)
  if (!cond) fail++
}

const page = path.join(os.tmpdir(), 'eztor-tray-test.html')
fs.writeFileSync(page, '<html><body>tray bridge test</body></html>')
console.log('page: ' + page + ' exists=' + fs.existsSync(page))

app.whenReady().then(async () => {
  let win = null
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    console.log('window created')
    await win.loadFile(page)
    console.log('page loaded')
    await new Promise((r) => setTimeout(r, 300))
    console.log('waited 300ms')

    const hasBridge = await win.webContents.executeJavaScript(
      `typeof window.eztor !== 'undefined' && typeof window.eztor.onDanmakuStateChanged === 'function'`,
    )
    check(hasBridge, `preload 暴露 onDanmakuStateChanged（实际 ${hasBridge}）`)

    await win.webContents.executeJavaScript(`(() => {
      window.__danmakuEvents = [];
      window.__unsub = window.eztor.onDanmakuStateChanged((enabled) => window.__danmakuEvents.push(enabled));
      return true;
    })()`)
    win.webContents.send('danmaku-state-changed', true)
    await new Promise((r) => setTimeout(r, 500))
    const events = await win.webContents.executeJavaScript(`window.__danmakuEvents`)
    check(
      events.length === 1 && events[0] === true,
      `反向同步 on：收到 enabled=true（实际 ${JSON.stringify(events)}）`,
    )

    await win.webContents.executeJavaScript(`window.__danmakuEvents = []; true`)
    win.webContents.send('danmaku-state-changed', false)
    await new Promise((r) => setTimeout(r, 500))
    const events2 = await win.webContents.executeJavaScript(`window.__danmakuEvents`)
    check(
      events2.length === 1 && events2[0] === false,
      `反向同步 off：收到 enabled=false（实际 ${JSON.stringify(events2)}）`,
    )
    await win.webContents.executeJavaScript(`window.__unsub(); true`)

    win.destroy()
    win = null
  } catch (e) {
    console.log('✗ 异常: ' + e.message)
    fail++
  }
  try {
    fs.unlinkSync(page)
  } catch (e) {}
  console.log(fail === 0 ? '\nTRAY SYNC OK' : `\nTRAY SYNC FAIL (${fail})`)
  app.exit(fail === 0 ? 0 : 1)
})
