'use strict'

// 托盘常驻调节面板：验证 tray-popup.html + tray-popup-preload.js 桥能
// 渲染控制项、点击下发调节、invoke 读取状态、订阅主进程广播。
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let fail = 0
function check(cond, msg) {
  console.log((cond ? '✓' : '✗') + ' ' + msg)
  if (!cond) fail++
}

let applied = null
let overlayState = { overlayVisible: false, settings: { speed: 1, amount: 1, opacity: 80, size: 1 } }

app.whenReady().then(async () => {
  ipcMain.handle('get-danmaku-state', () => ({ ...overlayState, settings: { ...overlayState.settings } }))
  ipcMain.on('danmaku-settings-apply', (_e, key, value) => {
    applied = { key, value }
  })
  ipcMain.on('set-overlay', (_e, enabled) => {
    overlayState.overlayVisible = enabled
  })

  let win = null
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'tray-popup-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    await win.loadFile(path.join(__dirname, 'tray-popup.html'))
    await new Promise((r) => setTimeout(r, 400))

    const hasBridge = await win.webContents.executeJavaScript(
      `typeof window.trayPopup !== 'undefined' &&
       typeof window.trayPopup.getState === 'function' &&
       typeof window.trayPopup.setOverlay === 'function' &&
       typeof window.trayPopup.applySetting === 'function' &&
       typeof window.trayPopup.onChanged === 'function'`,
    )
    check(hasBridge, `preload 暴露 trayPopup 桥（实际 ${hasBridge}）`)

    // 渲染出控制项：开关 + 4 组调节按钮
    const ui = await win.webContents.executeJavaScript(`(() => ({
      overlay: !!document.getElementById('overlay'),
      groupCount: document.querySelectorAll('#groups .group').length,
      buttonCount: document.querySelectorAll('.seg button').length,
      activeSpeed: document.querySelector('.seg button[data-key="speed"].active')?.textContent || null,
    }))()`)
    check(ui.overlay && ui.groupCount === 4 && ui.buttonCount === 17,
      `渲染控制项：开关=${ui.overlay} 组数=${ui.groupCount} 按钮=${ui.buttonCount}`)
    check(ui.activeSpeed === '1x', `默认速度勾选 1x（实际 ${ui.activeSpeed}）`)

    // 点击"速度 2x"按钮 → 下发 IPC 到主进程
    await win.webContents.executeJavaScript(
      `document.querySelector('.seg button[data-key="speed"][data-value="2"]').click(); true`,
    )
    await new Promise((r) => setTimeout(r, 300))
    check(
      applied && applied.key === 'speed' && applied.value === 2,
      `点击调节下发：主进程收到 speed=2（实际 ${JSON.stringify(applied)}）`,
    )

    // 主进程广播覆盖层状态 → 面板开关跟随
    await win.webContents.executeJavaScript(`(() => {
      window.__ev = [];
      window.trayPopup.onChanged((m) => window.__ev.push(m));
      return true;
    })()`)
    win.webContents.send('danmaku-state-changed', true)
    win.webContents.send('danmaku-settings-changed-broadcast', 'speed', 2)
    await new Promise((r) => setTimeout(r, 300))
    const ev = await win.webContents.executeJavaScript(`window.__ev`)
    const checkedAfter = await win.webContents.executeJavaScript(
      `document.getElementById('overlay').checked`,
    )
    const speedActive = await win.webContents.executeJavaScript(
      `document.querySelector('.seg button[data-key="speed"].active')?.textContent`,
    )
    check(ev.length === 2, `收到主进程广播：overlay+setting（实际 ${ev.length} 条）`)
    check(checkedAfter === true, `广播后开关点亮（实际 ${checkedAfter}）`)
    check(speedActive === '2x', `广播后速度勾选 2x（实际 ${speedActive}）`)

    // invoke 读取状态（初始为 defaults）
    const st = await win.webContents.executeJavaScript(`window.trayPopup.getState()`)
    check(st && st.settings && st.settings.speed === 1, `getState 返回初始设置（实际 ${JSON.stringify(st && st.settings)}）`)

    win.destroy()
    win = null
  } catch (e) {
    console.log('✗ 异常: ' + e.message)
    fail++
  }
  console.log(fail === 0 ? '\nTRAY POPUP OK' : `\nTRAY POPUP FAIL (${fail})`)
  app.exit(fail === 0 ? 0 : 1)
})
