const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

  aiRequest: (options) => ipcRenderer.invoke('ai-request', options),

  aiRequestStream: (options) => ipcRenderer.invoke('ai-request-stream', options),

  onStreamChunk: (callback) => ipcRenderer.on('ai-stream-chunk', (event, data) => callback(data)),
  onStreamEnd: (callback) => ipcRenderer.on('ai-stream-end', (event, data) => callback(data)),
  onStreamError: (callback) => ipcRenderer.on('ai-stream-error', (event, data) => callback(data)),

  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Auto update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (options) => ipcRenderer.invoke('download-update', options),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, data) => callback(data)),
});
