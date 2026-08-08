'use strict'

// 托盘 ↔ App 弹幕状态/调节同步：验证 preload 暴露的桥能双向收发。
//  - danmaku-state-changed：主进程 → 渲染端（弹幕开关反向同步）
//  - danmaku-settings-apply：主进程 → 渲染端（托盘调节下发 App 内 store）
//  - danmaku-settings-changed：渲染端 → 主进程（App 内改设置上报托盘勾选态）
const { app, BrowserWindow, ipcMain } = require('electron')
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

app.whenReady().then(async () => {
  let win = null
  let reported = null
  ipcMain.on('danmaku-settings-changed', (_e, key, value) => {
    reported = { key, value }
  })

  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    await win.loadFile(page)
    await new Promise((r) => setTimeout(r, 300))

    const hasBridge = await win.webContents.executeJavaScript(
      `typeof window.eztor !== 'undefined' &&
       typeof window.eztor.onDanmakuStateChanged === 'function' &&
       typeof window.eztor.onDanmakuSettingsApply === 'function' &&
       typeof window.eztor.reportDanmakuSetting === 'function'`,
    )
    check(hasBridge, `preload 暴露全部弹幕桥（实际 ${hasBridge}）`)

    await win.webContents.executeJavaScript(`(() => {
      window.__danmakuEvents = [];
      window.eztor.onDanmakuStateChanged((enabled) => window.__danmakuEvents.push(enabled));
      return true;
    })()`)
    win.webContents.send('danmaku-state-changed', true)
    await new Promise((r) => setTimeout(r, 500))
    const events = await win.webContents.executeJavaScript(`window.__danmakuEvents`)
    check(
      events.length === 1 && events[0] === true,
      `开关 on：收到 enabled=true（实际 ${JSON.stringify(events)}）`,
    )

    await win.webContents.executeJavaScript(`(() => {
      window.__settingsEvents = [];
      window.eztor.onDanmakuSettingsApply((p) => window.__settingsEvents.push(p));
      return true;
    })()`)
    win.webContents.send('danmaku-settings-apply', 'speed', 2)
    await new Promise((r) => setTimeout(r, 500))
    const settingsEvents = await win.webContents.executeJavaScript(`window.__settingsEvents`)
    check(
      settingsEvents.length === 1 && settingsEvents[0].key === 'speed' && settingsEvents[0].value === 2,
      `托盘调节下发：收到 speed=2（实际 ${JSON.stringify(settingsEvents)}）`,
    )

    await win.webContents.executeJavaScript(`window.eztor.reportDanmakuSetting('amount', 1.5); true`)
    await new Promise((r) => setTimeout(r, 300))
    check(
      reported && reported.key === 'amount' && reported.value === 1.5,
      `App 内设置上报：主进程收到 amount=1.5（实际 ${JSON.stringify(reported)}）`,
    )

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
