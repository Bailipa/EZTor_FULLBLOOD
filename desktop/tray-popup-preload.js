'use strict'

// 托盘弹幕调节面板的 preload 桥：与主进程交互（开关/调节 + 状态广播订阅）。
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('trayPopup', {
  getState: () => ipcRenderer.invoke('get-danmaku-state'),
  setOverlay: (enabled) => ipcRenderer.send('set-overlay', enabled),
  applySetting: (key, value) => ipcRenderer.send('danmaku-settings-apply', key, value),
  openApp: () => ipcRenderer.send('open-app'),
  onChanged: (cb) => {
    const onState = (_e, enabled) => cb({ type: 'overlay', enabled })
    const onSetting = (_e, key, value) => cb({ type: 'setting', key, value })
    ipcRenderer.on('danmaku-state-changed', onState)
    ipcRenderer.on('danmaku-settings-changed-broadcast', onSetting)
    return () => {
      ipcRenderer.removeListener('danmaku-state-changed', onState)
      ipcRenderer.removeListener('danmaku-settings-changed-broadcast', onSetting)
    }
  },
})
