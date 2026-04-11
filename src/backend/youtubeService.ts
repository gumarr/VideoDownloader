import { app, ipcMain, dialog, shell, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC_CHANNELS, DownloadOptions, AppSettings, DownloadTask, DownloadTaskProgress } from '../types/ipc';
import { fetchVideoInfo } from './ytDlpService';
import { getSettings, saveSettings, updateSettings, loadSettings } from './settingsService';
import { downloadManager } from './downloadManager';
import { checkForUpdates, installUpdate } from './ytDlpUpdater';

/**
 * Register all IPC handlers.
 * Called once from main.ts during app.whenReady().
 */
export function attachYoutubeHandlers() {
  // Ensure settings are loaded at startup
  loadSettings();
  downloadManager.init();

  /* ── Fetch video metadata ─────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.FETCH_VIDEO_INFO, async (_event, url: string) => {
    try {
      console.log(`[IPC] fetch-video-info: ${url}`);
      const info = await fetchVideoInfo(url);
      return { success: true, data: info };
    } catch (err: any) {
      console.error(`[IPC] fetch-video-info error:`, err.message);
      return { success: false, error: err.message };
    }
  });

  /* ── Add download to queue ────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.ADD_DOWNLOAD, async (event, options: DownloadOptions & { title?: string; thumbnail?: string }) => {
    try {
      console.log(`[IPC] add-download:`, options);
      const settings = getSettings();

      // Determine output directory based on save mode
      let outputDir = options.outputDir;
      let customFileName = options.customFileName;

      if (!outputDir) {
        if (settings.saveMode === 'ask') {
          // Show save dialog
          const ext = options.format === 'mp3' ? 'mp3' : 'mp4';
          const defaultName = customFileName || options.title || 'video';
          const defaultPath = path.join(
            settings.lastUsedFolder || settings.defaultFolder,
            `${defaultName}.${ext}`
          );

          const result = await dialog.showSaveDialog({
            title: 'Save Download As',
            defaultPath,
            filters: [
              { name: ext.toUpperCase(), extensions: [ext] },
              { name: 'All Files', extensions: ['*'] },
            ],
          });

          if (result.canceled || !result.filePath) {
            return { success: false, error: 'Download cancelled — save dialog was dismissed' };
          }

          // Extract directory and filename from the chosen path
          outputDir = path.dirname(result.filePath);
          const parsedName = path.basename(result.filePath, path.extname(result.filePath));
          customFileName = parsedName;

          // Remember last used folder
          updateSettings({ lastUsedFolder: outputDir });
        } else {
          // Default folder mode
          outputDir = settings.defaultFolder;
        }
      }

      // Add task to the download manager queue
      const taskId = downloadManager.addTask({
        url: options.url,
        title: options.title || 'Untitled',
        thumbnail: options.thumbnail || '',
        format: options.format,
        quality: options.quality,
        outputDir,
        customFileName,
      });

      return { success: true, taskId };
    } catch (err: any) {
      console.error(`[IPC] add-download error:`, err.message);
      return { success: false, error: err.message };
    }
  });

  /* ── Cancel a task ────────────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.CANCEL_TASK, async (_event, taskId: string) => {
    const success = downloadManager.cancelTask(taskId);
    return { success };
  });

  /* ── Remove a task ────────────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.REMOVE_TASK, async (_event, taskId: string) => {
    const success = downloadManager.removeTask(taskId);
    return { success };
  });

  /* ── Retry a failed task ──────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.RETRY_TASK, async (_event, taskId: string) => {
    const success = downloadManager.retryTask(taskId);
    return { success };
  });

  /* ── Get queue snapshot ───────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.GET_QUEUE, async () => {
    return downloadManager.getSnapshot();
  });

  /* ── Clear completed/failed/cancelled tasks ───────────── */
  ipcMain.handle(IPC_CHANNELS.CLEAR_COMPLETED, async () => {
    downloadManager.clearCompleted();
    return { success: true };
  });

  /* ── Select output directory ──────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select download folder',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  /* ── Get settings ─────────────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return getSettings();
  });

  /* ── Save settings ────────────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, settings: AppSettings) => {
    try {
      saveSettings(settings);
      return { success: true };
    } catch (err: any) {
      console.error(`[IPC] save-settings error:`, err.message);
      return { success: false, error: err.message };
    }
  });

  /* ── Show save dialog ─────────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.SHOW_SAVE_DIALOG, async (_event, defaultName: string, format: string) => {
    const settings = getSettings();
    const ext = format === 'mp3' ? 'mp3' : 'mp4';
    const defaultPath = path.join(
      settings.lastUsedFolder || settings.defaultFolder,
      `${defaultName}.${ext}`
    );

    const result = await dialog.showSaveDialog({
      title: 'Save Download As',
      defaultPath,
      filters: [
        { name: ext.toUpperCase(), extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    // Update last used folder
    updateSettings({ lastUsedFolder: path.dirname(result.filePath) });
    return result.filePath;
  });

  /* ── Open folder containing file ──────────────────────── */
  ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async (_event, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found. It may have been moved or deleted.' };
    }
    console.log(`[IPC] OPEN_FOLDER: ${filePath}`);
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  /* ── Open file directly ───────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.OPEN_FILE, async (_event, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found. It may have been moved or deleted.' };
    }
    console.log(`[IPC] OPEN_FILE: ${filePath}`);
    const err = await shell.openPath(filePath);
    if (err) {
      console.error(`[IPC] OPEN_FILE returned error: ${err}`);
      return { success: false, error: err };
    }
    return { success: true };
  });

  /* ── Updater Handlers ─────────────────────────────────── */
  ipcMain.handle(IPC_CHANNELS.CHECK_YT_DLP_UPDATE, async (_event, force: boolean) => {
    return await checkForUpdates(force);
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_YT_DLP_UPDATE, async (event) => {
    // Send progress updates back through the event sender
    return await installUpdate((percent) => {
      event.sender.send(`${IPC_CHANNELS.INSTALL_YT_DLP_UPDATE}-progress`, percent);
    });
  });

  ipcMain.handle(IPC_CHANNELS.SKIP_UPDATE, async (_event, version: string) => {
    updateSettings({ skippedUpdateVersion: version });
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RESTART_APP, (_event) => {
    app.relaunch();
    app.quit();
  });

  /* ── Forward download manager events to renderer ──────── */
  function getMainWindow(): BrowserWindow | null {
    const wins = BrowserWindow.getAllWindows();
    return wins.length > 0 ? wins[0] : null;
  }

  downloadManager.on('queue-update', (tasks: DownloadTask[]) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.QUEUE_UPDATE, tasks);
    }
  });

  downloadManager.on('task-progress', (progress: DownloadTaskProgress) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.TASK_PROGRESS, progress);
    }
  });
}
