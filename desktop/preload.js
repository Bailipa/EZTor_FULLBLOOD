'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('eztor', {
  closeOverlay: () => ipcRenderer.send('close-overlay'),
})
