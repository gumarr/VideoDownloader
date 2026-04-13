import { useState, useEffect, useCallback } from 'react';
import logo from './assets/logo.png';
import ThemeToggle from './components/ThemeToggle';
import UrlInput from './components/UrlInput';
import DownloadQueue from './components/DownloadQueue';
import SettingsPanel from './components/SettingsPanel';
import DebugPanel from './components/DebugPanel';
import UpdateModal from './components/UpdateModal';
import AppUpdateModal from './components/AppUpdateModal';
import type { SupportedPlatform } from '../types/ipc';

/* ── Types ──────────────────────────────────────────────── */
interface DownloadTask {
  id: string;
  url?: string;
  platform: SupportedPlatform;
  title: string;
  thumbnail: string;
  format: 'mp4' | 'mp3';
  quality: string;
  status: 'pending' | 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
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
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  /* Platform */
  const [platform, setPlatform] = useState<SupportedPlatform>('youtube');

  /* Download queue */
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  /* Settings panel */
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  /* Debug panel */
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  /* Updater Modal */
  const [updateData, setUpdateData] = useState<{ currentVersion: string; latestVersion: string } | null>(null);

  /* App version */
  const [appVersion, setAppVersion] = useState<string>('');

  /* Fetch app version on mount */
  useEffect(() => {
    if (!hasElectronAPI) return;
    window.api.getAppVersion().then(v => setAppVersion(v));
  }, []);

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
    setError(null);
    setWarning(null);

    if (!hasElectronAPI) {
      setError('Electron API not available — run this app inside Electron to fetch real video data.');
      setIsFetching(false);
      return;
    }

    let cleanUrl = url.trim();
    try {
      const parsedUrl = new URL(cleanUrl);
      // Strip only known generic tracking tokens
      ['si', 'utm_source', 'utm_medium', 'utm_campaign'].forEach(p => parsedUrl.searchParams.delete(p));
      cleanUrl = parsedUrl.toString();
    } catch {
      // Ignored
    }

    let detectedPlatform: 'youtube' | 'soundcloud' | 'unknown' = 'unknown';
    if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) detectedPlatform = 'youtube';
    else if (cleanUrl.includes("soundcloud.com")) detectedPlatform = 'soundcloud';

    const finalPlatform = detectedPlatform !== 'unknown' ? detectedPlatform : platform;
    if (finalPlatform !== platform) {
      setPlatform(finalPlatform);
    }

    try {
      console.log('[App] Fetching playlist or video info for:', cleanUrl, 'platform:', finalPlatform);
      const result = await window.api.fetchVideoInfo(cleanUrl, finalPlatform);
      if (result.success && result.data && result.data.length > 0) {
        console.log(`[App] Video info received: ${result.data.length} item(s)`);
        
        if (result.warnings && result.warnings.length > 0) {
            setWarning(`Note: ${result.warnings.length} track(s) were unavailable or private and have been skipped.`);
        }

        // Directly add all items to the queue in 'pending' state
        const taskResult = await window.api.addTasks(
          result.data.map(v => ({
             url: v.url,
             title: v.title,
             thumbnail: v.thumbnail,
             platform: finalPlatform
          }))
        );

        if (!taskResult.success) {
           setError(taskResult.error || 'Failed to add items to queue');
        } else {
           setUrl(''); // Clear input
        }
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
  }, [url, platform]);

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

  const handleClearAllTasks = useCallback(async () => {
    if (hasElectronAPI) {
      await window.api.clearAllTasks();
    }
  }, []);

  const handleStartTask = useCallback(async (taskId: string) => {
    if (!hasElectronAPI) return;
    const settings = await window.api.getSettings();
    let selectedDir: string | undefined = undefined;
    if (settings.saveMode === 'ask') {
      const result = await window.api.selectDirectory();
      if (!result) return; // user cancelled picking folder
      selectedDir = result;
    }
    await window.api.startTask(taskId, selectedDir);
  }, []);

  const handleUpdateTask = useCallback((taskId: string, format: 'mp4'|'mp3', quality: string) => {
    if (hasElectronAPI) window.api.updateTask(taskId, format, quality);
  }, []);

  const handleStartAllPending = useCallback(async () => {
    if (!hasElectronAPI) return;
    const pendingIds = tasks.filter(t => t.status === 'pending').map(t => t.id);
    for (const id of pendingIds) {
      await window.api.startTask(id); // Backend will processQueue automatically
    }
  }, [tasks]);

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

      {/* ─── Main Content Layout ──────────────── */}
      <div className="max-w-4xl mx-auto px-5 py-8 flex items-start gap-8 flex-col md:flex-row">
        
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-56 shrink-0 space-y-2 relative">
          <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4 px-2">Platforms</h2>
          <button 
            onClick={() => setPlatform('youtube')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
                        ${platform === 'youtube' 
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shadow-sm border border-red-100 dark:border-red-900/30' 
                          : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 border border-transparent'}`}
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.582 6.186a2.506 2.506 0 00-1.766-1.774C18.258 4 12 4 12 4s-6.258 0-7.816.412A2.506 2.506 0 002.418 6.186C2 7.747 2 12 2 12s0 4.253.418 5.814a2.506 2.506 0 001.766 1.774C5.742 20 12 20 12 20s6.258 0 7.816-.412a2.506 2.506 0 001.766-1.774C22 16.253 22 12 22 12s0-4.253-.418-5.814zM9.75 15.02v-6.04L15.5 12l-5.75 3.02z" />
            </svg>
            YouTube
          </button>

          <button 
            onClick={() => setPlatform('soundcloud')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
                        ${platform === 'soundcloud' 
                          ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 shadow-sm border border-orange-100 dark:border-orange-900/30' 
                          : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 border border-transparent'}`}
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.69 13.92H7.2a.5.5 0 01-.5-.5v-4.14a.5.5 0 01.5-.5h2.24a.5.5 0 01.44.27l1.97 3.93a.5.5 0 010 .45l-.16.49z"/>
              <path d="M19.34 8.78h-2.1a1 1 0 00-1 1v6a1 1 0 001 1h2.1a3.66 3.66 0 003.66-3.66v-.68A3.66 3.66 0 0019.34 8.78z"/>
              <path d="M11.66 10.42a1 1 0 010-2h2.09a1 1 0 011 1v6a1 1 0 01-1 1h-2.09a1 1 0 010-2V10.42zM5.3 10.7a1 1 0 010 2h.2v-2h-.2zM3.4 11.2a1 1 0 010 2h.1v-2h-.1zM1.5 11.7a1 1 0 010 2h0v-2h0z"/>
            </svg>
            SoundCloud
          </button>
        </aside>

        <main className="flex-1 w-full space-y-6">
          {/* URL Input */}
          <UrlInput
            url={url}
            placeholder={platform === "youtube" ? "Paste YouTube video or playlist URL..." : "Paste SoundCloud track or playlist URL..."}
            onUrlChange={setUrl}
            onPaste={handlePaste}
            onFetch={handleFetch}
            isFetching={isFetching}
          />

          {/* Warning Message */}
          {warning && (
            <div className="animate-fade-in-up rounded-xl px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 
                            border border-yellow-200 dark:border-yellow-800/60 text-yellow-800 dark:text-yellow-300 text-sm
                            flex items-center gap-3 shadow-sm">
              <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1 min-w-0">
                <span className="opacity-90 leading-snug">{warning}</span>
              </div>
              <button
                onClick={() => setWarning(null)}
                className="text-yellow-600 hover:text-yellow-900 dark:hover:text-yellow-100 transition-colors p-1"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="animate-fade-in-up rounded-xl px-4 py-3 bg-red-50 dark:bg-red-900/20 
                            border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm
                            flex items-start gap-3 shadow-sm shadow-red-500/5">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="flex-1 min-w-0">
                <span className="font-semibold mr-1">Error:</span>
                <span className="opacity-90">{error}</span>
                <div className="flex gap-2 mt-2.5">
                  <button 
                    onClick={handleFetch} 
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors cursor-pointer"
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={() => { setError(null); setIsSettingsOpen(true); }} 
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Authentication Settings
                  </button>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="mt-0.5 text-red-400 hover:text-red-700 dark:hover:text-red-200 transition-colors cursor-pointer flex-shrink-0 p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* ─── Download Queue ─────────────────── */}
          <DownloadQueue
            tasks={tasks}
            onStart={handleStartTask}
            onUpdateTask={handleUpdateTask}
            onStartAllPending={handleStartAllPending}
            onCancel={handleCancelTask}
            onRemove={handleRemoveTask}
            onRetry={handleRetryTask}
            onOpenFolder={handleOpenFolder}
            onOpenFile={handleOpenFile}
            onClearCompleted={handleClearCompleted}
            onClearAllTasks={handleClearAllTasks}
          />
        </main>
      </div>

      {/* ─── Footer ─────────────────────────── */}
      <footer className="max-w-2xl mx-auto px-5 pb-6">
        <p className="text-center text-xs text-surface-400 dark:text-surface-600">
          {hasElectronAPI ? 'Running in Electron' : 'Running in browser'}
          {appVersion && (
            <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                             bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400
                             border border-primary-200 dark:border-primary-800">
              v{appVersion}
            </span>
          )}
          {' · Built with Electron · React · Vite'}
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

      {/* ─── App Update Modal (electron-updater) ── */}
      <AppUpdateModal />
    </div>
  );
}
