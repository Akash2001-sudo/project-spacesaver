const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

let mainWindow;
let cancelFlag = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 650,
    frame: false,
    transparent: false,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: true
  });

  mainWindow.loadFile('index.html');
  mainWindow.focus();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ── Window Controls ──
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

// ── Folder Picker ──
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── File categorization helpers ──
const FILE_CATEGORIES = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif', '.raw', '.heic', '.heif', '.avif'],
  videos: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'],
  audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus', '.aiff'],
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp', '.csv', '.md'],
  software: ['.exe', '.msi', '.dmg', '.deb', '.rpm', '.appimage', '.apk', '.jar', '.bat', '.cmd', '.ps1', '.sh'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.cab'],
  code: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.rb', '.go', '.rs', '.php', '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.sql'],
  temp: ['.tmp', '.temp', '.bak', '.old', '.swp', '.swo', '.log', '.cache', '.crdownload', '.part']
};

const JUNK_PATTERNS = [
  /^thumbs\.db$/i, /^desktop\.ini$/i, /^\.ds_store$/i,
  /^~\$/, /\.tmp$/i, /\.temp$/i, /\.bak$/i, /\.old$/i,
  /\.log$/i, /\.cache$/i, /^npm-debug\.log/i,
  /\.crdownload$/i, /\.part$/i, /^~/, /\.swp$/i
];

function categorizeFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) return category;
  }
  return 'other';
}

function isJunkFile(filename) {
  return JUNK_PATTERNS.some(pattern => pattern.test(filename));
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ── Cancel support ──
ipcMain.on('cancel-operation', () => {
  cancelFlag = true;
});

// ── Scan folder ──
ipcMain.handle('scan-folder', async (event, folderPath) => {
  cancelFlag = false;
  const files = [];
  let scannedCount = 0;

  async function scanDir(dirPath, depth = 0) {
    if (cancelFlag || depth > 15) return;
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (cancelFlag) return;
        const fullPath = path.join(dirPath, entry.name);
        try {
          if (entry.isFile()) {
            const stats = await fsp.stat(fullPath);
            const category = categorizeFile(entry.name);
            const isJunk = isJunkFile(entry.name);
            files.push({
              name: entry.name,
              path: fullPath,
              relativePath: path.relative(folderPath, fullPath),
              size: stats.size,
              sizeFormatted: formatSize(stats.size),
              modified: stats.mtime.toISOString(),
              modifiedFormatted: stats.mtime.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
              category,
              isJunk,
              ext: path.extname(entry.name).toLowerCase()
            });
            scannedCount++;
            if (scannedCount % 100 === 0) {
              mainWindow?.webContents.send('scan-progress', { count: scannedCount });
            }
          } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '$RECYCLE.BIN' && entry.name !== 'System Volume Information') {
            await scanDir(fullPath, depth + 1);
          }
        } catch (e) { /* skip inaccessible files */ }
      }
    } catch (e) { /* skip inaccessible dirs */ }
  }

  await scanDir(folderPath);

  // Build summary
  const summary = { totalFiles: files.length, totalSize: 0, categories: {}, junkFiles: [], duplicates: [] };
  const nameMap = new Map();

  for (const file of files) {
    summary.totalSize += file.size;
    if (!summary.categories[file.category]) {
      summary.categories[file.category] = { count: 0, size: 0, files: [] };
    }
    summary.categories[file.category].count++;
    summary.categories[file.category].size += file.size;
    summary.categories[file.category].files.push(file);

    if (file.isJunk) summary.junkFiles.push(file);

    // Track potential duplicates by name+size
    const key = `${file.name}|${file.size}`;
    if (nameMap.has(key)) nameMap.get(key).push(file);
    else nameMap.set(key, [file]);
  }

  // Find duplicates
  for (const [, group] of nameMap) {
    if (group.length > 1) summary.duplicates.push(...group.slice(1));
  }

  summary.totalSizeFormatted = formatSize(summary.totalSize);
  for (const cat of Object.values(summary.categories)) {
    cat.sizeFormatted = formatSize(cat.size);
  }

  return { files, summary, cancelled: cancelFlag };
});

// ── Delete files ──
ipcMain.handle('delete-files', async (event, filePaths) => {
  cancelFlag = false;
  let deleted = 0;
  let failed = 0;
  let freedBytes = 0;

  for (const filePath of filePaths) {
    if (cancelFlag) break;
    try {
      const stats = await fsp.stat(filePath);
      await shell.trashItem(filePath);
      deleted++;
      freedBytes += stats.size;
      mainWindow?.webContents.send('delete-progress', { deleted, total: filePaths.length, freedBytes, freedFormatted: formatSize(freedBytes) });
    } catch (e) {
      failed++;
    }
  }

  return { deleted, failed, freedBytes, freedFormatted: formatSize(freedBytes), cancelled: cancelFlag };
});

// ── Sort/Organize files ──
ipcMain.handle('sort-files', async (event, folderPath, filesToSort, categoryMapping) => {
  cancelFlag = false;
  let moved = 0;
  let failed = 0;

  const folderNames = {
    images: 'Images',
    videos: 'Videos',
    audio: 'Audio',
    documents: 'Documents',
    software: 'Software',
    archives: 'Archives',
    code: 'Code',
    temp: 'Temporary',
    other: 'Other'
  };

  for (const file of filesToSort) {
    if (cancelFlag) break;
    const targetFolder = folderNames[file.category] || 'Other';
    const targetDir = path.join(folderPath, targetFolder);
    const targetPath = path.join(targetDir, file.name);

    if (file.path === targetPath) continue; // already in right place

    try {
      await fsp.mkdir(targetDir, { recursive: true });
      // Handle name collision
      let finalPath = targetPath;
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        const ext = path.extname(file.name);
        const base = path.basename(file.name, ext);
        finalPath = path.join(targetDir, `${base} (${counter})${ext}`);
        counter++;
      }
      await fsp.rename(file.path, finalPath);
      moved++;
      mainWindow?.webContents.send('sort-progress', { moved, total: filesToSort.length });
    } catch (e) {
      failed++;
    }
  }

  return { moved, failed, cancelled: cancelFlag };
});

// ── Open file in explorer ──
ipcMain.handle('show-in-explorer', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});
