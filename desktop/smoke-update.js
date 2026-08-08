'use strict'

// 自动更新桥接测试：验证 preload 暴露的 getUpdateStatus（invoke）与 onUpdateStatus（事件订阅）。
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let fail = 0
function check(cond, msg) {
  console.log((cond ? '✓' : '✗') + ' ' + msg)
  if (!cond) fail++
}

// 模拟主进程的 get-update-status 处理器（真实实现见 main.js）
ipcMain.handle('get-update-status', () => ({
  status: 'ready',
  version: '9.9.9',
  percent: 100,
}))

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  await win.loadURL('data:text/html,<html><body>update smoke</body></html>')

  // 1. getUpdateStatus 通过 invoke 取到主进程最近状态
  const fromInvoke = await win.webContents.executeJavaScript(
    `window.eztor.getUpdateStatus().then((s) => JSON.stringify(s))`,
  )
  const parsed = JSON.parse(fromInvoke)
  check(parsed.status === 'ready' && parsed.version === '9.9.9',
    `getUpdateStatus 返回最近状态（status=${parsed.status} version=${parsed.version}）`)

  // 1.5 下载/安装/检查/查询/自动下载开关五个桥都暴露为函数
  const bridge = await win.webContents.executeJavaScript(
    `JSON.stringify({
      downloadUpdate: typeof window.eztor.downloadUpdate,
      installUpdate: typeof window.eztor.installUpdate,
      checkUpdate: typeof window.eztor.checkUpdate,
      getUpdateStatus: typeof window.eztor.getUpdateStatus,
      setAutoDownload: typeof window.eztor.setAutoDownload,
      getAutoDownload: typeof window.eztor.getAutoDownload,
    })`,
  )
  const b = JSON.parse(bridge)
  check(
    b.downloadUpdate === 'function' && b.installUpdate === 'function' &&
      b.checkUpdate === 'function' && b.getUpdateStatus === 'function' &&
      b.setAutoDownload === 'function' && b.getAutoDownload === 'function',
    `更新桥方法均暴露（${b.downloadUpdate}/${b.installUpdate}/${b.checkUpdate}/${b.getUpdateStatus}/${b.setAutoDownload}/${b.getAutoDownload}）`,
  )

  // 2. onUpdateStatus 订阅后能收到主进程广播的事件
  await win.webContents.executeJavaScript(`(() => {
    window.__lastStatus = null
    window.__unsub = window.eztor.onUpdateStatus((p) => { window.__lastStatus = p })
    return true
  })()`)
  win.webContents.send('update-status', { status: 'downloading', percent: 42 })
  await new Promise((r) => setTimeout(r, 300))
  const received = await win.webContents.executeJavaScript(`JSON.stringify(window.__lastStatus)`)
  const rec = JSON.parse(received)
  check(rec.status === 'downloading' && rec.percent === 42,
    `onUpdateStatus 收到广播事件（status=${rec.status} percent=${rec.percent}）`)

  // 3. 退订后不再收到（清理，避免泄漏）
  await win.webContents.executeJavaScript(`window.__unsub()`)
  win.webContents.send('update-status', { status: 'uptodate' })
  await new Promise((r) => setTimeout(r, 200))
  const after = await win.webContents.executeJavaScript(`JSON.stringify(window.__lastStatus)`)
  check(JSON.parse(after).status === 'downloading',
    `退订后不再收到新事件（保持 downloading=${JSON.parse(after).status}）`)

  win.destroy()
  console.log(fail === 0 ? '\nUPDATE BRIDGE OK' : `\nUPDATE BRIDGE FAIL (${fail})`)
  app.exit(fail === 0 ? 0 : 1)
})
