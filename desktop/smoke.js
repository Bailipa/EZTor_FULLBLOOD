'use strict'

// Smoke test: 启动 Electron，分别加载主页与弹幕悬浮窗，确认无加载失败。
const { app, BrowserWindow } = require('electron')

const APP_URL = process.env.EZTOR_APP_URL || 'https://eztor.dogeggcode.cyou'
const targets = [
  { name: 'main', url: APP_URL },
  { name: 'overlay', url: `${APP_URL}/danmaku-overlay.html` },
]

let failures = []

function testOne(t) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({ show: false, width: 400, height: 300 })
    win.webContents.on('did-fail-load', (e, code, desc) => {
      failures.push(`${t.name}: did-fail-load code=${code} desc=${desc}`)
      win.destroy()
      resolve()
    })
    win.webContents.on('did-finish-load', () => {
      const title = win.webContents.getTitle()
      console.log(`✓ ${t.name} loaded: ${win.webContents.getURL()} (title=${title})`)
      win.destroy()
      resolve()
    })
    win.loadURL(t.url)
    setTimeout(() => {
      if (!win.isDestroyed()) {
        failures.push(`${t.name}: timeout loading ${t.url}`)
        win.destroy()
      }
      resolve()
    }, 30000)
  })
}

app.whenReady().then(async () => {
  for (const t of targets) await testOne(t)
  if (failures.length > 0) {
    console.error('SMOKE FAIL:\n' + failures.join('\n'))
    app.exit(1)
  } else {
    console.log('SMOKE OK: main + overlay 均可加载')
    app.exit(0)
  }
})
