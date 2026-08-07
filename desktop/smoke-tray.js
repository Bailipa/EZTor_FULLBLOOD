'use strict'

// 静默 smoke：验证 1) 托盘/窗口图标可被 nativeImage 加载（修复空白根因）
// 2) preload 暴露 setGlobalDanmaku 且 main 能收到 set-overlay。不开真实窗口。
const { app, BrowserWindow, nativeImage, ipcMain } = require('electron')
const path = require('path')

let fail = 0

function check(cond, msg) {
  console.log((cond ? '✓' : '✗') + ' ' + msg)
  if (!cond) fail++
}

app.whenReady().then(async () => {
  const tray = nativeImage.createFromPath(path.join(__dirname, 'tray-icon.png'))
  check(!tray.isEmpty(), `tray-icon.png 可加载 (size=${JSON.stringify(tray.getSize())})`)

  const icon512 = nativeImage.createFromPath(path.join(__dirname, 'icon-512.png'))
  check(!icon512.isEmpty(), `icon-512.png 可加载 (size=${JSON.stringify(icon512.getSize())})`)

  let received = null
  ipcMain.on('set-overlay', (_e, enabled) => { received = enabled })

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  await win.loadURL('about:blank')

  const type = await win.webContents.executeJavaScript('typeof (window.eztor && window.eztor.setGlobalDanmaku)')
  check(type === 'function', `window.eztor.setGlobalDanmaku 暴露为函数 (got ${type})`)

  await win.webContents.executeJavaScript('window.eztor.setGlobalDanmaku(true)')
  check(received === true, 'main 收到 set-overlay(true)')
  await win.webContents.executeJavaScript('window.eztor.setGlobalDanmaku(false)')
  check(received === false, 'main 收到 set-overlay(false)')

  win.destroy()
  console.log(fail === 0 ? '\nSMOKE OK' : `\nSMOKE FAIL (${fail})`)
  app.exit(fail === 0 ? 0 : 1)
})
