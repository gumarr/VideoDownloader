/* ── Shared IPC type definitions ── */

/** Supported platforms for downloading */
export type SupportedPlatform = 'youtube' | 'soundcloud';

/** Metadata returned from yt-dlp --dump-json */
export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  duration: number;        // seconds
  durationFormatted: string; // e.g. "14:32"
  uploader: string;
  platform: SupportedPlatform;
  formats: VideoFormat[];
}

export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;     // e.g. "1920x1080" or "audio only"
  qualityLabel: string;    // e.g. "1080p", "720p", "audio"
  filesize: number | null; // bytes, may be null
  vcodec: string;
  acodec: string;
}

/** Options sent from renderer to main for downloading */
export interface DownloadOptions {
  url: string;
  platform: SupportedPlatform;
  format: 'mp4' | 'mp3';
  quality: string;            // e.g. "1080p", "720p"
  outputDir?: string;         // optional save-to directory
  customFileName?: string;    // user-provided file name (without extension)
}

/** Progress updates streamed during download */
export interface DownloadProgress {
  percent: number;     // 0–100
  downloaded: string;  // e.g. "12.5MiB"
  total: string;       // e.g. "45.2MiB"
  speed: string;       // e.g. "2.4MiB/s"
  eta: string;         // e.g. "00:15"
}

/** Per-task progress sent to renderer (extends DownloadProgress with taskId) */
export interface DownloadTaskProgress extends DownloadProgress {
  taskId: string;
}

/** A single download task in the queue */
export interface DownloadTask {
  id: string;
  url: string;
  platform: SupportedPlatform;
  title: string;
  thumbnail: string;
  format: 'mp4' | 'mp3';
  quality: string;
  outputDir?: string;
  customFileName?: string;
  status: 'pending' | 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: DownloadProgress;
  filePath?: string;
  error?: string;
  addedAt: number;  // Date.now() timestamp
}

/** User-configurable application settings */
export interface AppSettings {
  saveMode: 'ask' | 'default';       // "Ask every time" vs "Default folder"
  defaultFolder: string;              // path when saveMode === 'default'
  lastUsedFolder: string;             // remember last save location
  openFolderAfterDownload: boolean;   // auto-open folder after download
  maxConcurrentDownloads: number;     // concurrent download limit (1–5)
  autoUpdateYtDlp: boolean;           // auto check for updates?
  lastUpdateCheckTimestamp: number;   // when did we last check
  skippedUpdateVersion: string;       // version the user skipped
  updateCheckInterval: number;        // hours (default 24)
  cookieSource: 'none' | 'auto' | 'chrome' | 'edge' | 'firefox' | 'file';
  cookieProfile: string;              // e.g. "Default", "Profile 1"
  cookieFilePath: string;             // path to cookies.txt manually imported
}

/** IPC channel names — single source of truth */
export const IPC_CHANNELS = {
  FETCH_VIDEO_INFO: 'fetch-video-info',
  SELECT_DIRECTORY: 'select-directory',

  // Queue management
  ADD_DOWNLOAD: 'add-download',
  ADD_TASKS: 'add-tasks',
  START_TASK: 'start-task',
  UPDATE_TASK: 'update-task',
  CANCEL_TASK: 'cancel-task',
  REMOVE_TASK: 'remove-task',
  RETRY_TASK: 'retry-task',
  GET_QUEUE: 'get-queue',
  CLEAR_COMPLETED: 'clear-completed',
  CLEAR_ALL_TASKS: 'clear-all-tasks',

  // Main → Renderer push events
  QUEUE_UPDATE: 'queue-update',
  TASK_PROGRESS: 'task-progress',

  // Settings
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  SHOW_SAVE_DIALOG: 'show-save-dialog',
  OPEN_FOLDER: 'open-folder',
  OPEN_FILE: 'open-file',
  SELECT_COOKIE_FILE: 'select-cookie-file',

  // Legacy (kept for backward compat, will map to queue internally)
  DOWNLOAD_VIDEO: 'download-video',
  DOWNLOAD_PROGRESS: 'download-progress',
  CANCEL_DOWNLOAD: 'cancel-download',

  // yt-dlp binary updater
  CHECK_YT_DLP_UPDATE: 'check-yt-dlp-update',
  INSTALL_YT_DLP_UPDATE: 'install-yt-dlp-update',
  RESTART_APP: 'restart-app',
  SKIP_UPDATE: 'skip-update',

  // App auto-update (electron-updater)
  APP_UPDATE_CHECK: 'app-update-check',
  APP_UPDATE_DOWNLOAD: 'app-update-download',
  APP_UPDATE_INSTALL: 'app-update-install',
  // Main → Renderer push events
  APP_UPDATE_STATUS: 'app-update-status',

  // App info
  GET_APP_VERSION: 'get-app-version',
} as const;
