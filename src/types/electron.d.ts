import { AppSettings, DownloadOptions, DownloadProgress, DownloadTask, DownloadTaskProgress, VideoMetadata } from './ipc';

/** Shape of the API exposed to the renderer via contextBridge */
export interface ElectronAPI {
  /* ── Video info ── */
  fetchVideoInfo: (url: string) => Promise<{
    success: boolean;
    data?: VideoMetadata;
    error?: string;
  }>;

  /* ── Download queue ── */
  addDownload: (options: DownloadOptions & { title?: string; thumbnail?: string }) => Promise<{
    success: boolean;
    taskId?: string;
    error?: string;
  }>;
  cancelTask: (taskId: string) => Promise<{ success: boolean }>;
  removeTask: (taskId: string) => Promise<{ success: boolean }>;
  retryTask: (taskId: string) => Promise<{ success: boolean }>;
  getQueue: () => Promise<DownloadTask[]>;
  clearCompleted: () => Promise<{ success: boolean }>;

  /* ── Queue event listeners (main → renderer push) ── */
  onQueueUpdate: (callback: (tasks: DownloadTask[]) => void) => () => void;
  onTaskProgress: (callback: (progress: DownloadTaskProgress) => void) => () => void;

  /* ── Legacy single-download (kept for backward compat) ── */
  downloadVideo: (options: DownloadOptions) => Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }>;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void;
  cancelDownload: () => Promise<{ success: boolean }>;

  /* ── Folders & dialogs ── */
  selectDirectory: () => Promise<string | null>;
  showSaveDialog: (defaultName: string, format: string) => Promise<string | null>;
  openFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;

  /* ── Settings ── */
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>;

  /* ── Updater ── */
  checkForUpdates: (force?: boolean) => Promise<{
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string;
    error?: string;
  }>;
  installUpdate: (onProgress: (percent: number) => void) => Promise<{ success: boolean; error?: string }>;
  skipUpdate: (version: string) => Promise<{ success: boolean }>;
  restartApp: () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
