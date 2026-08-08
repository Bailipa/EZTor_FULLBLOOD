'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('eztor', {
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  // 应用内弹幕开关直接控制全局弹幕悬浮窗
  setGlobalDanmaku: (enabled) => ipcRenderer.send('set-overlay', enabled),
  // 托盘/快捷键改动弹幕状态 → 同步回 App 内开关（反向同步）
  onDanmakuStateChanged: (cb) => {
    const handler = (_event, enabled) => cb(enabled)
    ipcRenderer.on('danmaku-state-changed', handler)
    return () => ipcRenderer.removeListener('danmaku-state-changed', handler)
  },
  // 自动更新：订阅状态 / 触发下载（用户确认后）/ 触发安装 / 手动检查 / 查询最近状态
  installUpdate: () => ipcRenderer.send('install-update'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  checkUpdate: () => ipcRenderer.send('check-update'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  // 自动下载更新开关（持久化在主进程，重启保持）
  setAutoDownload: (enabled) => ipcRenderer.send('set-auto-download', enabled),
  getAutoDownload: () => ipcRenderer.invoke('get-auto-download'),
  onUpdateStatus: (cb) => {
    const handler = (_event, payload) => cb(payload)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
})
