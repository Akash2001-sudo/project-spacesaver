const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Folder operations
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  deleteFiles: (filePaths) => ipcRenderer.invoke('delete-files', filePaths),
  sortFiles: (folderPath, files, mapping) => ipcRenderer.invoke('sort-files', folderPath, files, mapping),
  showInExplorer: (filePath) => ipcRenderer.invoke('show-in-explorer', filePath),
  cancelOperation: () => ipcRenderer.send('cancel-operation'),

  // Progress listeners
  onScanProgress: (callback) => ipcRenderer.on('scan-progress', (_, data) => callback(data)),
  onDeleteProgress: (callback) => ipcRenderer.on('delete-progress', (_, data) => callback(data)),
  onSortProgress: (callback) => ipcRenderer.on('sort-progress', (_, data) => callback(data)),
});
