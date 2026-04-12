import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../types/ipc';

/**
 * AppUpdater — handles Electron app auto-update via electron-updater + GitHub Releases.
 *
 * Emits status events to the renderer via IPC_CHANNELS.APP_UPDATE_STATUS:
 *   { status: 'checking' }
 *   { status: 'available', version, releaseNotes? }
 *   { status: 'not-available', version }
 *   { status: 'downloading', percent, bytesPerSecond, transferred, total }
 *   { status: 'downloaded', version }
 *   { status: 'error', message }
 */

function sendStatusToRenderer(data: Record<string, unknown>) {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    wins[0].webContents.send(IPC_CHANNELS.APP_UPDATE_STATUS, data);
  }
}

export function initAppUpdater() {
  // Don't auto-download; let the user decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AppUpdater] Checking for update...');
    sendStatusToRenderer({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[AppUpdater] Update available: ${info.version}`);
    sendStatusToRenderer({
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log(`[AppUpdater] Up to date: ${info.version}`);
    sendStatusToRenderer({ status: 'not-available', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AppUpdater] Error:', err.message);
    sendStatusToRenderer({ status: 'error', message: err.message });
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AppUpdater] Download progress: ${progress.percent.toFixed(1)}%`);
    sendStatusToRenderer({
      status: 'downloading',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[AppUpdater] Update downloaded: ${info.version}`);
    sendStatusToRenderer({ status: 'downloaded', version: info.version });
  });

  console.log('[AppUpdater] Initialized');
}

export function checkForAppUpdate() {
  autoUpdater.checkForUpdates();
}

export function downloadAppUpdate() {
  autoUpdater.downloadUpdate();
}

export function installAppUpdate() {
  autoUpdater.quitAndInstall(false, true);
}
