'use strict'

const { app, BrowserWindow, Menu, shell, ipcMain, Tray, nativeImage, screen } = require('electron')
const path = require('path')

// 线上地址（可被 EZTOR_APP_URL 覆盖，用于本地联调）
const APP_URL = process.env.EZTOR_APP_URL || 'https://eztor.dogeggcode.cyou'
const ICON = path.join(__dirname, '../public/icons/icon-512.png')
const SPLASH = path.join(__dirname, 'splash.html')

let mainWindow = null
let overlayWindows = [] // 每显示器一个弹幕悬浮窗
let tray = null
let isQuitting = false

// 内存优化：限制 V8 堆、关拼写检查
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=384')

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    return
  }
  createMainWindow()
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 480,
    minHeight: 600,
    title: 'EZTor',
    icon: ICON,
    autoHideMenuBar: true,
    show: false, // 先本地 splash，避免白屏等待
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  // 先显示本地 splash（毫秒级），再加载线上应用 —— 启动"体感"快很多
  mainWindow.loadFile(SPLASH)
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // splash 渲染完成后无缝切换到线上应用（并带上桌面 App 版本 UA）
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow.webContents.getURL().startsWith('file://')) {
      mainWindow.webContents.setUserAgent(
        mainWindow.webContents.getUserAgent() + ` EZTorDesktop/${app.getVersion()}`,
      )
      mainWindow.loadURL(APP_URL)
    }
  })

  // 外链一律交给系统浏览器，避免在新窗口里再次套壳
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // 点关闭按钮 = 隐藏到后台驻留（托盘），不真正退出
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 全局弹幕：每个显示器一个全屏透明、始终置顶、点击穿透的悬浮窗，
// 覆盖整个桌面（多屏），弹幕飘过所有应用之上。
function createOverlayWindows() {
  if (overlayWindows.length > 0) return

  const displays = screen.getAllDisplays()

  for (const d of displays) {
    const { x, y, width, height } = d.bounds
    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      fullscreenable: false,
      focusable: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    // 最高置顶级别（screen-saver 层级），压过绝大多数应用窗口
    win.setAlwaysOnTop(true, 'screen-saver')
    // 点击穿透
    win.setIgnoreMouseEvents(true, { forward: true })
    win.loadURL(`${APP_URL}/danmaku-overlay.html`)
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => {
      overlayWindows = overlayWindows.filter((w) => w !== win)
    })
    overlayWindows.push(win)
  }
}

function closeOverlayWindows() {
  for (const w of [...overlayWindows]) {
    if (!w.isDestroyed()) w.close()
  }
  overlayWindows = []
}

function isOverlayVisible() {
  return overlayWindows.length > 0
}

function toggleOverlay() {
  if (isOverlayVisible()) {
    closeOverlayWindows()
  } else {
    createOverlayWindows()
  }
}

ipcMain.on('close-overlay', () => {
  closeOverlayWindows()
})

// 托盘：后台驻留入口（显示主页 / 弹幕开关 / 退出）
function createTray() {
  const icon = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('EZTor 已在后台运行')

  const menu = Menu.buildFromTemplate([
    { label: '显示主页', click: showMainWindow },
    {
      label: '全局弹幕',
      type: 'checkbox',
      checked: false,
      click: (item) => {
        if (item.checked) createOverlayWindows()
        else closeOverlayWindows()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
}

function buildMenu() {
  const template = [
    {
      label: 'EZTor',
      submenu: [
        {
          label: '全局弹幕',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => toggleOverlay(),
        },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit() } },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
  ]
  return Menu.buildFromTemplate(template)
}

app.whenReady().then(() => {
  createTray()
  createMainWindow()
  Menu.setApplicationMenu(buildMenu())

  app.on('activate', () => showMainWindow())
})

// 后台驻留：窗口全部关闭也不退出（托盘仍在运行），仅"退出"菜单可完全退出
app.on('window-all-closed', () => {
  if (process.platform === 'darwin' || isQuitting) app.quit()
})

// 退出前确保弹幕层一并关闭
app.on('before-quit', () => {
  isQuitting = true
})
