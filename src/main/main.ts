import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { attachYoutubeHandlers } from '../backend/youtubeService';
import { loadSettings } from '../backend/settingsService';
import { initAppUpdater, checkForAppUpdate, downloadAppUpdate, installAppUpdate } from '../backend/appUpdater';
import { IPC_CHANNELS } from '../types/ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Check for app updates after window is ready (production only)
  mainWindow.webContents.on('did-finish-load', () => {
    if (!isDev) {
      checkForAppUpdate();
    }
  });
}

app.whenReady().then(() => {
  // Load user settings from disk first
  loadSettings();
  console.log('[main] Settings loaded');

  // Register all IPC handlers (including settings handlers)
  attachYoutubeHandlers();

  // Initialize app auto-updater
  initAppUpdater();

  // Register app-update IPC handlers
  ipcMain.handle(IPC_CHANNELS.APP_UPDATE_CHECK, () => {
    checkForAppUpdate();
  });

  ipcMain.handle(IPC_CHANNELS.APP_UPDATE_DOWNLOAD, () => {
    downloadAppUpdate();
  });

  ipcMain.handle(IPC_CHANNELS.APP_UPDATE_INSTALL, () => {
    installAppUpdate();
  });

  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => {
    return app.getVersion();
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
