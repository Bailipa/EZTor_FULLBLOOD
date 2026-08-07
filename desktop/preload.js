'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('eztor', {
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  // 应用内弹幕开关直接控制全局弹幕悬浮窗
  setGlobalDanmaku: (enabled) => ipcRenderer.send('set-overlay', enabled),
})
