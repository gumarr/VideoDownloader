import { useState, useEffect, useCallback } from 'react';
import logo from './assets/logo.png';
import ThemeToggle from './components/ThemeToggle';
import UrlInput from './components/UrlInput';
import VideoInfo from './components/VideoInfo';
import DownloadOptions from './components/DownloadOptions';
import DownloadQueue from './components/DownloadQueue';
import SettingsPanel from './components/SettingsPanel';
import FileNamePreview from './components/FileNamePreview';
import DebugPanel from './components/DebugPanel';
import UpdateModal from './components/UpdateModal';

/* ── Types ──────────────────────────────────────────────── */
interface VideoData {
  title: string;
  thumbnail: string;
  duration: string;
}

interface DownloadTask {
  id: string;
  title: string;
  thumbnail: string;
  format: 'mp4' | 'mp3';
  quality: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: {
    percent: number;
    downloaded: string;
    total: string;
    speed: string;
    eta: string;
  };
  filePath?: string;
  error?: string;
  addedAt: number;
}

/* ── Check if running inside Electron ───────────────────── */
const hasElectronAPI = typeof window !== 'undefined' && !!window.api;

/* ── App ────────────────────────────────────────────────── */
export default function App() {
  /* Theme */
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  /* URL & fetching */
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Options */
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('1080p');

  /* File name */
  const [customFileName, setCustomFileName] = useState('');

  /* Download queue */
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  /* Settings panel */
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  /* Debug panel */
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  /* Updater Modal */
  const [updateData, setUpdateData] = useState<{ currentVersion: string; latestVersion: string } | null>(null);

  /* Check for updates on startup */
  useEffect(() => {
    if (!hasElectronAPI) return;
    
    // We do NOT pass force=true, so it respects the user's autoUpdateYtDlp preference
    // and the 24-hour interval check constraint on the backend.
    window.api.checkForUpdates().then(result => {
      if (result.updateAvailable) {
        // Also ensure user didn't previously tap "Skip" for this exact version
        window.api.getSettings().then(settings => {
          if (settings.skippedUpdateVersion !== result.latestVersion) {
            setUpdateData({
              currentVersion: result.currentVersion,
              latestVersion: result.latestVersion,
            });
          }
        });
      }
    });
  }, []);

  /* Subscribe to queue updates and per-task progress from main process */
  useEffect(() => {
    if (!hasElectronAPI) return;

    // Load initial queue state
    window.api.getQueue().then((initialTasks) => {
      setTasks(initialTasks);
    });

    // Listen for full queue snapshots
    const unsubQueue = window.api.onQueueUpdate((updatedTasks) => {
      setTasks(updatedTasks);
    });

    // Listen for per-task progress updates (high frequency)
    const unsubProgress = window.api.onTaskProgress((progress) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === progress.taskId
            ? {
                ...t,
                progress: {
                  percent: progress.percent,
                  downloaded: progress.downloaded,
                  total: progress.total,
                  speed: progress.speed,
                  eta: progress.eta,
                },
              }
            : t
        )
      );
    });

    return () => {
      unsubQueue();
      unsubProgress();
    };
  }, []);

  /* ── Handlers ─────────────────────────────────────────── */

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      console.warn('Clipboard read failed');
    }
  }, []);

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;
    setIsFetching(true);
    setVideoInfo(null);
    setError(null);

    if (!hasElectronAPI) {
      setError('Electron API not available — run this app inside Electron to fetch real video data.');
      setIsFetching(false);
      return;
    }

    try {
      console.log('[App] Fetching video info for:', url.trim());
      const result = await window.api.fetchVideoInfo(url.trim());
      if (result.success && result.data) {
        console.log('[App] Video info received:', result.data.title);
        setVideoInfo({
          title: result.data.title,
          thumbnail: result.data.thumbnail,
          duration: result.data.durationFormatted,
        });
      } else {
        const errMsg = result.error || 'Failed to fetch video info';
        console.error('[App] Fetch error:', errMsg);
        setError(errMsg);
      }
    } catch (err: any) {
      console.error('[App] Fetch exception:', err.message);
      setError(err.message || 'Unexpected error');
    }

    setIsFetching(false);
  }, [url]);

  const handleAddToQueue = useCallback(async () => {
    if (!hasElectronAPI) {
      setError('Electron API not available — run this app inside Electron to download videos.');
      return;
    }

    try {
      console.log('[App] Adding to queue:', { url: url.trim(), format, quality, customFileName });
      const result = await window.api.addDownload({
        url: url.trim(),
        format: format as 'mp4' | 'mp3',
        quality,
        customFileName: customFileName || undefined,
        title: videoInfo?.title,
        thumbnail: videoInfo?.thumbnail,
      });

      if (!result.success) {
        console.error('[App] Add to queue failed:', result.error);
        setError(result.error || 'Failed to add download');
      } else {
        console.log('[App] Added to queue, task ID:', result.taskId);
        // Clear the current video after adding to queue so user can paste another
        setVideoInfo(null);
        setUrl('');
        setCustomFileName('');
      }
    } catch (err: any) {
      console.error('[App] Add to queue exception:', err.message);
      setError(err.message || 'Queue error');
    }
  }, [url, format, quality, customFileName, videoInfo]);

  const handleCancelTask = useCallback(async (taskId: string) => {
    if (hasElectronAPI) {
      await window.api.cancelTask(taskId);
    }
  }, []);

  const handleRemoveTask = useCallback(async (taskId: string) => {
    if (hasElectronAPI) {
      await window.api.removeTask(taskId);
    }
  }, []);

  const handleRetryTask = useCallback(async (taskId: string) => {
    if (hasElectronAPI) {
      await window.api.retryTask(taskId);
    }
  }, []);

  const handleOpenFolder = useCallback(async (filePath: string) => {
    if (hasElectronAPI && filePath) {
      const res = await window.api.openFolder(filePath);
      if (!res.success) alert(res.error);
    }
  }, []);

  const handleOpenFile = useCallback(async (filePath: string) => {
    if (hasElectronAPI && filePath) {
      const res = await window.api.openFile(filePath);
      if (!res.success) alert(res.error);
    }
  }, []);

  const handleClearCompleted = useCallback(async () => {
    if (hasElectronAPI) {
      await window.api.clearCompleted();
    }
  }, []);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
      {/* ─── Header ─────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-surface-900/70
                          border-b border-surface-200/60 dark:border-surface-800/60">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} className="w-8 h-8" alt="Video Downloader Logo" />
            <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50 tracking-tight">
              Video Downloader
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Debug button — only when running in Electron */}
            {hasElectronAPI && (
              <button
                id="debug-toggle-btn"
                onClick={() => setIsDebugOpen(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center
                           text-surface-400 hover:text-amber-500 dark:hover:text-amber-400
                           hover:bg-surface-100 dark:hover:bg-surface-800 transition-all cursor-pointer"
                title="Open Debug Panel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
            )}
            {/* Settings button */}
            <button
              id="settings-toggle-btn"
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center
                         text-surface-400 hover:text-surface-600 dark:hover:text-surface-300
                         hover:bg-surface-100 dark:hover:bg-surface-800 transition-all cursor-pointer"
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
          </div>
        </div>
      </header>

      {/* ─── Main Content ───────────────────── */}
      <main className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        {/* URL Input */}
        <UrlInput
          url={url}
          onUrlChange={setUrl}
          onPaste={handlePaste}
          onFetch={handleFetch}
          isFetching={isFetching}
        />

        {/* Error message */}
        {error && (
          <div className="animate-fade-in-up rounded-xl px-4 py-3 bg-red-50 dark:bg-red-900/20 
                          border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm
                          flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1 min-w-0">
              <span className="font-medium">Error:</span> {error}
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 transition-colors cursor-pointer flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Video Info Card */}
        {videoInfo && (
          <VideoInfo
            title={videoInfo.title}
            thumbnail={videoInfo.thumbnail}
            duration={videoInfo.duration}
          />
        )}

        {/* File Name Preview & Rename */}
        {videoInfo && (
          <FileNamePreview
            videoTitle={videoInfo.title}
            format={format}
            onFileNameChange={setCustomFileName}
          />
        )}

        {/* Download Options */}
        {videoInfo && (
          <DownloadOptions
            format={format}
            onFormatChange={setFormat}
            quality={quality}
            onQualityChange={setQuality}
            onDownload={handleAddToQueue}
          />
        )}

        {/* ─── Download Queue ─────────────────── */}
        <DownloadQueue
          tasks={tasks}
          onCancel={handleCancelTask}
          onRemove={handleRemoveTask}
          onRetry={handleRetryTask}
          onOpenFolder={handleOpenFolder}
          onOpenFile={handleOpenFile}
          onClearCompleted={handleClearCompleted}
        />
      </main>

      {/* ─── Footer ─────────────────────────── */}
      <footer className="max-w-2xl mx-auto px-5 pb-6">
        <p className="text-center text-xs text-surface-400 dark:text-surface-600">
          {hasElectronAPI ? 'Running in Electron' : 'Running in browser'} · Built with Electron · React · Vite
        </p>
      </footer>

      {/* ─── Settings Panel ─────────────────── */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* ─── Debug Panel ────────────────────── */}
      {hasElectronAPI && (
        <DebugPanel
          isOpen={isDebugOpen}
          onClose={() => setIsDebugOpen(false)}
        />
      )}

      {/* ─── Updater Modal ────────────────────── */}
      {updateData && (
        <UpdateModal
          currentVersion={updateData.currentVersion}
          latestVersion={updateData.latestVersion}
          onUpdate={async () => {
            if (!hasElectronAPI) return;
            const res = await window.api.installUpdate((_percent) => {
              // The modal uses indeterminate progress, but we could hook this up if needed.
            });
            if (!res.success) {
              throw new Error(res.error || 'Update failed');
            }
          }}
          onSkip={async () => {
             if (hasElectronAPI) {
               await window.api.skipUpdate(updateData.latestVersion);
             }
             setUpdateData(null);
          }}
          onRemindLater={() => setUpdateData(null)}
          onRestart={() => window.api.restartApp()}
        />
      )}
    </div>
  );
}
