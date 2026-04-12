import { useState, useEffect, useCallback } from 'react';

interface AppUpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  message?: string;
  releaseNotes?: string;
}

const hasElectronAPI = typeof window !== 'undefined' && !!window.api;

export default function AppUpdateModal() {
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Listen for update status events from main process
  useEffect(() => {
    if (!hasElectronAPI) return;

    const unsub = window.api.onAppUpdateStatus((data) => {
      setUpdateStatus(data);
      // Show modal when update is available
      if (data.status === 'available') {
        setDismissed(false);
      }
    });

    return unsub;
  }, []);

  const handleDownload = useCallback(() => {
    if (hasElectronAPI) {
      window.api.appUpdateDownload();
    }
  }, []);

  const handleInstall = useCallback(() => {
    if (hasElectronAPI) {
      window.api.appUpdateInstall();
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render if no update status, user dismissed, or status is not actionable
  if (!updateStatus || dismissed) return null;
  if (updateStatus.status === 'checking' || updateStatus.status === 'not-available') return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden
                      border border-surface-200 dark:border-surface-800">

        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">App Update</h2>
              <p className="text-emerald-100 text-sm mt-0.5">
                {updateStatus.status === 'available' && 'A new version is available!'}
                {updateStatus.status === 'downloading' && 'Downloading update...'}
                {updateStatus.status === 'downloaded' && 'Update ready to install'}
                {updateStatus.status === 'error' && 'Update error'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="p-6">

          {/* State: Update Available */}
          {updateStatus.status === 'available' && (
            <div className="space-y-5">
              <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl p-4
                              border border-surface-100 dark:border-surface-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-surface-500">Current Version:</span>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300 font-mono">
                    Current
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">New Version:</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {updateStatus.version}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleDownload}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl
                             shadow-lg shadow-emerald-500/30 transition-all duration-200 cursor-pointer"
                >
                  Update Now
                </button>
                <button
                  onClick={handleDismiss}
                  className="w-full py-2.5 text-sm font-medium text-surface-600 dark:text-surface-300
                             hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
          )}

          {/* State: Downloading */}
          {updateStatus.status === 'downloading' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-surface-500">
                  <span>Downloading...</span>
                  <span>{(updateStatus.percent ?? 0).toFixed(1)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                    style={{ width: `${Math.min(updateStatus.percent ?? 0, 100)}%` }}
                  />
                </div>
                {updateStatus.bytesPerSecond != null && (
                  <p className="text-[11px] text-surface-400 text-right tabular-nums">
                    {formatBytes(updateStatus.transferred ?? 0)} / {formatBytes(updateStatus.total ?? 0)}
                    {' · '}
                    {formatBytes(updateStatus.bytesPerSecond)}/s
                  </p>
                )}
              </div>
            </div>
          )}

          {/* State: Downloaded - Ready to install */}
          {updateStatus.status === 'downloaded' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Update Ready!</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 pb-6 leading-relaxed">
                Version <strong className="font-mono text-surface-700 dark:text-surface-200">{updateStatus.version}</strong> has been downloaded.<br/>
                Restart the app to apply the update.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleInstall}
                  className="w-full py-3 bg-surface-900 dark:bg-white text-white dark:text-surface-900 font-medium rounded-xl
                             shadow-md hover:bg-surface-800 dark:hover:bg-surface-100 transition-colors cursor-pointer"
                >
                  Restart &amp; Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="w-full py-2.5 text-sm font-medium text-surface-600 dark:text-surface-300
                             hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors cursor-pointer"
                >
                  Install on Next Restart
                </button>
              </div>
            </div>
          )}

          {/* State: Error */}
          {updateStatus.status === 'error' && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg
                              border border-red-100 dark:border-red-900/50">
                <strong className="font-semibold block mb-1">Update failed</strong>
                {updateStatus.message || 'An unknown error occurred.'}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { if (hasElectronAPI) window.api.appUpdateCheck(); }}
                  className="flex-1 py-2.5 text-sm font-medium bg-surface-100 dark:bg-surface-800
                             text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700
                             rounded-xl transition-colors cursor-pointer"
                >
                  Retry
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-300
                             hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
