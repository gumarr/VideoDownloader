import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, AppSettings, DownloadOptions, DownloadProgress, DownloadTask, DownloadTaskProgress, SupportedPlatform } from '../types/ipc';

console.log('[preload] Preload script starting...');

/**
 * Preload script — the ONLY bridge between Node.js and the renderer.
 * 
 * Security rules enforced:
 *   - nodeIntegration: false
 *   - contextIsolation: true
 *   - Only whitelisted IPC channels are exposed
 *   - No direct access to ipcRenderer, fs, child_process, etc.
 */

contextBridge.exposeInMainWorld('api', {
  /* ── Video info ──────────────────────────────────────── */

  fetchVideoInfo: (url: string, platform?: SupportedPlatform) =>
    ipcRenderer.invoke(IPC_CHANNELS.FETCH_VIDEO_INFO, url, platform),

  /* ── Download queue ──────────────────────────────────── */

  addDownload: (options: DownloadOptions & { title?: string; thumbnail?: string; platform: SupportedPlatform }) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_DOWNLOAD, options),

  addTasks: (tasks: { url: string; title: string; thumbnail: string; platform: SupportedPlatform }[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_TASKS, tasks),

  startTask: (taskId: string, outputDir?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.START_TASK, taskId, outputDir),

  updateTask: (taskId: string, format: 'mp4'|'mp3', quality: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TASK, taskId, format, quality),

  cancelTask: (taskId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_TASK, taskId),

  removeTask: (taskId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_TASK, taskId),

  retryTask: (taskId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RETRY_TASK, taskId),

  getQueue: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_QUEUE),

  clearCompleted: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_COMPLETED),

  clearAllTasks: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_ALL_TASKS),

  /* ── Queue event listeners (main → renderer push) ───── */

  onQueueUpdate: (callback: (tasks: DownloadTask[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tasks: DownloadTask[]) => {
      callback(tasks);
    };
    ipcRenderer.on(IPC_CHANNELS.QUEUE_UPDATE, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.QUEUE_UPDATE, handler);
    };
  },

  onTaskProgress: (callback: (progress: DownloadTaskProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadTaskProgress) => {
      callback(progress);
    };
    ipcRenderer.on(IPC_CHANNELS.TASK_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TASK_PROGRESS, handler);
    };
  },

  /* ── Legacy single-download (backward compat) ────────── */

  downloadVideo: (options: DownloadOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_DOWNLOAD, options),

  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => {
      callback(progress);
    };
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler);
    };
  },

  cancelDownload: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_DOWNLOAD),

  /* ── Folders & dialogs ───────────────────────────────── */

  selectDirectory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),

  showSaveDialog: (defaultName: string, format: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_SAVE_DIALOG, defaultName, format),

  openFolder: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER, filePath),

  openFile: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE, filePath),

  /* ── Settings ────────────────────────────────────────── */

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  saveSettings: (settings: AppSettings): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),

  selectCookieFile: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_COOKIE_FILE),

  /* ── Updater ─────────────────────────────────────────── */

  checkForUpdates: (force: boolean = false) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHECK_YT_DLP_UPDATE, force),

  installUpdate: (onProgress: (percent: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, percent: number) => onProgress(percent);
    ipcRenderer.on(`${IPC_CHANNELS.INSTALL_YT_DLP_UPDATE}-progress`, handler);

    return ipcRenderer.invoke(IPC_CHANNELS.INSTALL_YT_DLP_UPDATE).finally(() => {
      ipcRenderer.removeListener(`${IPC_CHANNELS.INSTALL_YT_DLP_UPDATE}-progress`, handler);
    });
  },

  skipUpdate: (version: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKIP_UPDATE, version),

  restartApp: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RESTART_APP),

  /* ── App auto-update (electron-updater) ──────────────── */

  appUpdateCheck: () =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATE_CHECK),

  appUpdateDownload: () =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATE_DOWNLOAD),

  appUpdateInstall: () =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATE_INSTALL),

  onAppUpdateStatus: (callback: (data: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.APP_UPDATE_STATUS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.APP_UPDATE_STATUS, handler);
    };
  },

  /* ── App Info ───────────────────────────────────────── */

  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
});

console.log('[preload] window.api exposed successfully via contextBridge');
