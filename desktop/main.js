'use strict'

const { app, BrowserWindow, Menu, shell, ipcMain, Tray, nativeImage, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

// 线上地址（可被 EZTOR_APP_URL 覆盖，用于本地联调）
const APP_URL = process.env.EZTOR_APP_URL || 'https://eztor.dogeggcode.cyou'
// 注意：图标文件与 main.js 同目录并被 files 打进包（asar 内），
// 不能用 ../public/... —— 打包后 __dirname 是 resources/app.asar，相对路径会指空。
const ICON = path.join(__dirname, 'icon-512.png')
const TRAY_ICON = path.join(__dirname, 'tray-icon.png')
const TRAY_ICON_MAC = path.join(__dirname, 'tray-icon-mac.png')
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

  // 应用页每次加载完成后重推最近一次更新状态（启动竞态兜底：下载先就绪时提示不丢）
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow.webContents.getURL().startsWith('file://') && lastUpdateStatus) {
      mainWindow.webContents.send('update-status', lastUpdateStatus)
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

// 托盘/快捷键（主进程入口）改动弹幕状态后，同步回 App 内开关：
// 让 App 里的 zustand store 与托盘勾选保持一致（反向同步），并持久化到 localStorage。
function notifyDanmakuState(enabled) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('danmaku-state-changed', enabled)
  }
}

function toggleOverlay() {
  if (isOverlayVisible()) {
    closeOverlayWindows()
  } else {
    createOverlayWindows()
  }
  syncTrayDanmakuState()
  notifyDanmakuState(isOverlayVisible())
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
// 业内标准流程：发现新版本 → 提示用户选择（available）→ 用户确认后才下载
// （download-update）→ 下载完成提示「重启更新」（ready）→ quitAndInstall()。
// 仅在打包应用里生效（dev 模式自动跳过）。
// lastUpdateStatus：主进程持久化最近一次状态。页面加载晚于事件时靠
// ① did-finish-load 重推、② get-update-status 查询两条路径补齐，保证提示不丢。
let lastUpdateStatus = null

function sendUpdateStatus(payload) {
  lastUpdateStatus = payload
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('update-status', payload)
  }
}

function initAutoUpdater() {
  // 不默认自动下载：发现新版本先问用户，点「立即更新」后才下载（业内标准）。
  // 用户可在下载页开启"自动下载"开关（持久化），开启后后台自动下载。
  autoDownloadEnabled = readAutoDownloadEnabled()
  autoUpdater.autoDownload = autoDownloadEnabled
  autoUpdater.autoInstallOnAppQuit = true // 兜底：用户直接退出时也静默安装

  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ status: 'checking' }))
  // 发现新版本 → available（提示用户选择），用户确认后由 download-update 触发下载
  autoUpdater.on('update-available', (info) =>
    sendUpdateStatus({ status: 'available', version: info.version }),
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
    autoUpdater.checkForUpdates()
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

// 用户点击「立即更新」后开始下载（autoDownload=false，需手动触发）
ipcMain.on('download-update', () => {
  try {
    autoUpdater.downloadUpdate()
  } catch (err) {
    console.warn('EZTor download-update failed:', err)
  }
})

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

// 页面挂载时查询最近一次更新状态（错过实时事件的补齐路径）
ipcMain.handle('get-update-status', () => lastUpdateStatus)

// ==================== 自动下载更新开关 ====================
// 默认关闭（发现新版本先询问用户，业界默认尊重用户选择）；可在下载页开启"自动下载"。
// 持久化到 userData，重启后保持。
let autoDownloadEnabled = false

function settingsFilePath() {
  return path.join(app.getPath('userData'), 'eztor-settings.json')
}

function readAutoDownloadEnabled() {
  try {
    const raw = fs.readFileSync(settingsFilePath(), 'utf8')
    return !!JSON.parse(raw).autoDownload
  } catch {
    return false
  }
}

function persistAutoDownloadEnabled(enabled) {
  try {
    fs.writeFileSync(settingsFilePath(), JSON.stringify({ autoDownload: enabled }))
  } catch (err) {
    console.warn('EZTor persist settings failed:', err)
  }
}

// 用户切换开关：立即生效；若已发现新版本且刚开启，立刻开始下载
ipcMain.on('set-auto-download', (_event, enabled) => {
  autoDownloadEnabled = !!enabled
  persistAutoDownloadEnabled(autoDownloadEnabled)
  autoUpdater.autoDownload = autoDownloadEnabled
  if (autoDownloadEnabled && lastUpdateStatus && lastUpdateStatus.status === 'available') {
    try {
      autoUpdater.downloadUpdate()
    } catch (ignored) {
      /* 忽略 */
    }
  }
})

ipcMain.handle('get-auto-download', () => autoDownloadEnabled)

// 托盘：后台驻留入口（显示主页 / 弹幕开关 / 退出）
function createTray() {
  const isMac = process.platform === 'darwin'
  // Windows：白底圆角 + 蓝 logo（与 App/网站图标一致）；macOS：纯 logo 模板（菜单栏明暗自适应）
  let trayImage = nativeImage.createFromPath(isMac ? TRAY_ICON_MAC : TRAY_ICON)
  if (trayImage.isEmpty()) {
    // 兜底：回退到窗口图标（应不会发生，只是防御）
    trayImage = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 })
  }
  if (isMac) {
    trayImage = trayImage.resize({ width: 16, height: 16 })
    trayImage.setTemplateImage(true)
  }
  tray = new Tray(trayImage)
  tray.setToolTip('EZTor 已在后台运行')
  // 原生 contextMenu 每次点击都会收起，连续调节体验差；
  // 改用常驻弹窗面板（showTrayPopup）：右键弹出、点别处才收起，可连续调节。
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  tray.on('right-click', showTrayPopup)
}

// ==================== 托盘弹幕调节（常驻弹窗面板） ====================
// 主进程维护最近一次设置的快照：托盘面板勾选态 + 调节下发用。
// 来源：① 托盘面板点击；② App 内设置面板改动后 reportDanmakuSetting 上报。
let lastDanmakuSettings = { speed: 1, amount: 1, opacity: 80, size: 1 }
const DANMAKU_SETTINGS_KEY = 'vocab_danmaku_settings'
const DANMAKU_SETTINGS_DEFAULTS = { speed: 1, amount: 1, opacity: 80, size: 1 }
const TRAY_POPUP_WIDTH = 300
const TRAY_POPUP_HEIGHT = 390

let trayPopup = null

function createTrayPopup() {
  if (trayPopup && !trayPopup.isDestroyed()) return trayPopup
  trayPopup = new BrowserWindow({
    width: TRAY_POPUP_WIDTH,
    height: TRAY_POPUP_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'tray-popup-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })
  trayPopup.loadFile(path.join(__dirname, 'tray-popup.html'))
  // 点击面板外（失焦）即收起 —— 面板可连续调节不收起
  trayPopup.on('blur', () => {
    if (trayPopup && !trayPopup.isDestroyed()) trayPopup.hide()
  })
  trayPopup.on('closed', () => {
    trayPopup = null
  })
  return trayPopup
}

function showTrayPopup() {
  const popup = createTrayPopup()
  if (!popup) return
  const tb = tray ? tray.getBounds() : null
  let x = 100
  let y = 100
  if (tb && tb.width > 0) {
    const display = screen.getDisplayNearestPoint({
      x: Math.round(tb.x + tb.width / 2),
      y: Math.round(tb.y + tb.height / 2),
    })
    const wa = display.workArea
    x = Math.round(tb.x + tb.width - TRAY_POPUP_WIDTH)
    y = Math.round(tb.y - TRAY_POPUP_HEIGHT)
    x = Math.max(wa.x + 2, Math.min(x, wa.x + wa.width - TRAY_POPUP_WIDTH - 2))
    y = Math.max(wa.y + 2, Math.min(y, wa.y + wa.height - TRAY_POPUP_HEIGHT - 2))
  }
  popup.setPosition(x, y)
  popup.show()
  popup.focus()
}

// 把当前弹幕状态（开关 + 全部设置）同步到托盘面板。
// 面板常驻、事件驱动，任何入口（托盘/快捷键/App 内）改动后都会刷新它。
function syncTrayDanmakuState() {
  if (!trayPopup || trayPopup.isDestroyed()) return
  trayPopup.webContents.send('danmaku-state-changed', isOverlayVisible())
  for (const key of Object.keys(lastDanmakuSettings)) {
    trayPopup.webContents.send('danmaku-settings-changed-broadcast', key, lastDanmakuSettings[key])
  }
}

// 直接写入悬浮层 localStorage（storage 事件/2s 轮询立即生效），并带上 storage 事件。
// 作为兜底：即使 App 主窗口 IPC 未就绪（启动 splash 瞬间），悬浮层也能第一时间生效。
function writeDanmakuSettingsToOverlay(key, value) {
  for (const w of overlayWindows) {
    if (w.isDestroyed()) continue
    w.webContents
      .executeJavaScript(`(() => {
        try {
          const prev = JSON.parse(localStorage.getItem('${DANMAKU_SETTINGS_KEY}') || '{}')
          const base = (prev && prev.state) || prev || {}
          const state = Object.assign({}, ${JSON.stringify(DANMAKU_SETTINGS_DEFAULTS)}, base, { ${key}: ${value} })
          localStorage.setItem('${DANMAKU_SETTINGS_KEY}', JSON.stringify({ state, version: 0 }))
          window.dispatchEvent(new StorageEvent('storage', {
            key: '${DANMAKU_SETTINGS_KEY}', newValue: localStorage.getItem('${DANMAKU_SETTINGS_KEY}'),
          }))
        } catch (e) {}
        return true
      })()`)
      .catch(() => {})
  }
}

// 托盘面板调节 → 更新快照 + 下发悬浮层 + 通知 App 内 store（App 内滑块/开关同步）
function applyDanmakuSetting(key, value) {
  lastDanmakuSettings[key] = value
  writeDanmakuSettingsToOverlay(key, value)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('danmaku-settings-apply', key, value)
  }
  syncTrayDanmakuState()
}

// App 内设置面板改动 → 上报主进程，托盘面板勾选态跟随
ipcMain.on('danmaku-settings-changed', (_event, key, value) => {
  if (Object.prototype.hasOwnProperty.call(lastDanmakuSettings, key)) {
    lastDanmakuSettings[key] = value
    syncTrayDanmakuState()
  }
})

// 托盘面板：读取初始状态 / 应用调节 / 打开主窗口
ipcMain.handle('get-danmaku-state', () => ({
  overlayVisible: isOverlayVisible(),
  settings: { ...lastDanmakuSettings },
}))
ipcMain.on('danmaku-settings-apply', (_event, key, value) => {
  if (Object.prototype.hasOwnProperty.call(lastDanmakuSettings, key)) {
    applyDanmakuSetting(key, value)
  }
})
ipcMain.on('open-app', () => showMainWindow())

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
