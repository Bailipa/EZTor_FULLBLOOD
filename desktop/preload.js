'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('eztor', {
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  // 应用内弹幕开关直接控制全局弹幕悬浮窗
  setGlobalDanmaku: (enabled) => ipcRenderer.send('set-overlay', enabled),
  // 自动更新：订阅状态 / 触发安装 / 手动检查
  installUpdate: () => ipcRenderer.send('install-update'),
  checkUpdate: () => ipcRenderer.send('check-update'),
  onUpdateStatus: (cb) => {
    const handler = (_event, payload) => cb(payload)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
})
