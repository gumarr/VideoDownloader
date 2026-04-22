import { AppSettings, DownloadOptions, DownloadProgress, DownloadTask, DownloadTaskProgress, SupportedPlatform, VideoMetadata } from './ipc';

/** Shape of the API exposed to the renderer via contextBridge */
export interface ElectronAPI {
  /* ── Video info ── */
  fetchVideoInfo: (url: string, platform?: SupportedPlatform) => Promise<{
    success: boolean;
    data?: VideoMetadata[];
    warnings?: string[];
    error?: string;
    requiresFacebookAuth?: boolean;
  }>;

  /* ── Download queue ── */
  addDownload: (options: DownloadOptions & { title?: string; thumbnail?: string; platform: SupportedPlatform }) => Promise<{
    success: boolean;
    taskId?: string;
    error?: string;
  }>;
  addTasks: (tasks: { url: string; title: string; thumbnail: string; platform: SupportedPlatform }[]) => Promise<{
    success: boolean;
    taskIds?: string[];
    error?: string;
  }>;
  startTask: (taskId: string, outputDir?: string) => Promise<{ success: boolean }>;
  updateTask: (taskId: string, format: 'mp4'|'mp3', quality: string) => Promise<{ success: boolean }>;
  cancelTask: (taskId: string) => Promise<{ success: boolean }>;
  removeTask: (taskId: string) => Promise<{ success: boolean }>;
  retryTask: (taskId: string) => Promise<{ success: boolean }>;
  getQueue: () => Promise<DownloadTask[]>;
  clearCompleted: () => Promise<{ success: boolean }>;
  clearAllTasks: () => Promise<{ success: boolean }>;

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
  selectCookieFile: () => Promise<string | null>;

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

  /* ── App auto-update (electron-updater) ── */
  appUpdateCheck: () => Promise<void>;
  appUpdateDownload: () => Promise<void>;
  appUpdateInstall: () => Promise<void>;
  onAppUpdateStatus: (callback: (data: {
    status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    percent?: number;
    bytesPerSecond?: number;
    transferred?: number;
    total?: number;
    message?: string;
    releaseNotes?: string;
  }) => void) => () => void;

  /* ── App Info ── */
  getAppVersion: () => Promise<string>;

  /* ── Facebook auth ── */
  facebookLogin: () => Promise<{ success: boolean; error?: string }>;
  facebookLogout: () => Promise<{ success: boolean }>;
  getFacebookAuthStatus: () => Promise<{ isLoggedIn: boolean }>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
