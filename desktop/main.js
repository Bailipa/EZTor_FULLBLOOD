'use strict'

const { app, BrowserWindow, Menu, shell, ipcMain, Tray, nativeImage, screen } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

// 线上地址（可被 EZTOR_APP_URL 覆盖，用于本地联调）
const APP_URL = process.env.EZTOR_APP_URL || 'https://eztor.dogeggcode.cyou'
// 注意：图标文件与 main.js 同目录并被 files 打进包（asar 内），
// 不能用 ../public/... —— 打包后 __dirname 是 resources/app.asar，相对路径会指空。
const ICON = path.join(__dirname, 'icon-512.png')
const TRAY_ICON = path.join(__dirname, 'tray-icon.png')
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
  // 清理已销毁的窗口，避免残留导致重复创建
  overlayWindows = overlayWindows.filter((w) => !w.isDestroyed())
  if (overlayWindows.length > 0) return

  const displays = screen.getAllDisplays()

  for (const d of displays) {
    const { x, y, width, height } = d.bounds
    // 按显示区域去重：同一块屏幕只放一个悬浮窗（Windows 上显示器热插拔/枚举偶发重复）
    const alreadyCovered = overlayWindows.some(
      (w) => w.getBounds().x === x && w.getBounds().y === y && w.getBounds().width === width && w.getBounds().height === height,
    )
    if (alreadyCovered) continue

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
        // 关键：focusable:false 的置顶窗口永不聚焦 → 被 Chromium 当"后台窗口"。
        // 默认 backgroundThrottling:true 会冻结 CSS 动画/定时器，且让
        // document.visibilityState 报 hidden → 弹幕冻住 + visibilitychange 反复清空重发。
        backgroundThrottling: false,
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
  syncTrayDanmakuState()
}

ipcMain.on('close-overlay', () => {
  closeOverlayWindows()
})

// 应用内开启/关闭弹幕 → 直接控制全局弹幕悬浮窗（真正的"全局"）
ipcMain.on('set-overlay', (_event, enabled) => {
  if (enabled) createOverlayWindows()
  else closeOverlayWindows()
  syncTrayDanmakuState()
})

// ==================== 自动更新（electron-updater） ====================
// 后台下载新版 → 通知网页提示"重启更新" → 用户点击后 quitAndInstall()：
// 自动退出、NSIS 静默安装、自动重启，全程无需手动关软件。
// 仅在打包应用里生效（dev 模式自动跳过）。
function sendUpdateStatus(payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('update-status', payload)
  }
}

function initAutoUpdater() {
  autoUpdater.autoDownload = true // 后台自动下载，用户点"重启更新"时已就绪
  autoUpdater.autoInstallOnAppQuit = true // 兜底：用户直接退出时也静默安装

  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ status: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    sendUpdateStatus({ status: 'downloading', version: info.version }),
  )
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ status: 'uptodate' }))
  autoUpdater.on('download-progress', (p) =>
    sendUpdateStatus({ status: 'downloading', percent: Math.round(p.percent) }),
  )
  autoUpdater.on('update-downloaded', (info) =>
    sendUpdateStatus({ status: 'ready', version: info.version }),
  )
  autoUpdater.on('error', (err) =>
    sendUpdateStatus({ status: 'error', message: String(err && err.message ? err.message : err) }),
  )

  try {
    autoUpdater.checkForUpdatesAndNotify()
  } catch (err) {
    console.warn('EZTor autoUpdater check failed:', err)
  }
  // 之后每小时再查一次（用户常驻后台）
  setInterval(() => {
    try {
      autoUpdater.checkForUpdates()
    } catch (ignored) {
      /* 忽略 */
    }
  }, 60 * 60 * 1000)
}

ipcMain.on('install-update', () => {
  try {
    autoUpdater.quitAndInstall()
  } catch (err) {
    console.warn('EZTor install-update failed:', err)
  }
})

ipcMain.on('check-update', () => {
  try {
    autoUpdater.checkForUpdates()
  } catch (err) {
    console.warn('EZTor check-update failed:', err)
  }
})

// 托盘：后台驻留入口（显示主页 / 弹幕开关 / 退出）
function createTray() {
  let trayImage = nativeImage.createFromPath(TRAY_ICON)
  if (trayImage.isEmpty()) {
    // 兜底：回退到窗口图标（应不会发生，只是防御）
    trayImage = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 })
  }
  if (process.platform === 'darwin') {
    trayImage = trayImage.resize({ width: 16, height: 16 })
  }
  tray = new Tray(trayImage)
  tray.setToolTip('EZTor 已在后台运行')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '显示主页', click: showMainWindow },
    {
      label: '全局弹幕',
      type: 'checkbox',
      checked: isOverlayVisible(),
      click: (item) => {
        if (item.checked) createOverlayWindows()
        else closeOverlayWindows()
        syncTrayDanmakuState()
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
}

// 托盘 checkbox 与当前悬浮窗状态保持一致（托盘/快捷键/应用内三种入口切换后都刷新）
function syncTrayDanmakuState() {
  if (tray) tray.setContextMenu(buildTrayMenu())
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
  initAutoUpdater()

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
