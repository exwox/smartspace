const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PORT = 3187;
let mainWindow = null;

function ensureWritableData() {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');
  const uploadDir = path.join(userData, 'uploads');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });

  const targetDb = path.join(dataDir, 'db.json');
  const bundledDb = path.join(__dirname, '..', 'backend', 'data', 'db.json');
  if (!fs.existsSync(targetDb) && fs.existsSync(bundledDb)) {
    fs.copyFileSync(bundledDb, targetDb);
  }

  process.env.PORT = String(PORT);
  process.env.SMARTSPACE_DATA_DIR = dataDir;
  process.env.SMARTSPACE_UPLOAD_DIR = uploadDir;
  process.env.NODE_ENV = 'production';

  return { userData, dataDir, uploadDir };
}

async function startBackend() {
  const backendEntry = path.join(__dirname, '..', 'backend', 'dist', 'index.js');
  if (!fs.existsSync(backendEntry)) {
    throw new Error(`Backend build tidak ditemukan: ${backendEntry}`);
  }
  await import(pathToFileURL(backendEntry).href);
}

async function waitForServer(url, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/rooms`);
      if (res.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Server Smart Space tidak merespons tepat waktu.');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#07131f',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith(`http://127.0.0.1:${PORT}`)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(async () => {
  try {
    ensureWritableData();
    await startBackend();
    await waitForServer(`http://127.0.0.1:${PORT}`);
    createWindow();
  } catch (error) {
    console.error(error);
    dialog.showErrorBox(
      'Smart Space TNJ gagal dijalankan',
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && app.isReady()) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
