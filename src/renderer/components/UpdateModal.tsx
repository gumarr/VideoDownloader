import { useState } from 'react';

export interface UpdateModalProps {
  currentVersion: string;
  latestVersion: string;
  onUpdate: () => Promise<void>;
  onSkip: () => void;
  onRemindLater: () => void;
  onRestart: () => void;
}

export default function UpdateModal({
  currentVersion,
  latestVersion,
  onUpdate,
  onSkip,
  onRemindLater,
  onRestart,
}: UpdateModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateComplete, setUpdateComplete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      // Wire up progress listener temporarily if we can...
      // but since `onUpdate` is a standard void promise wrapper,
      // we rely on the App.tsx injecting the listener
      await onUpdate();
      setUpdateComplete(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unknown error occurred during update.');
    } finally {
      setIsUpdating(false);
    }
  };

  // We expose a globally bindable function for App to update percent
  // (Alternatively, pass percent as a prop from App. For simplicity, we just hope App passes it if needed, or we use a basic animation)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-surface-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-surface-200 dark:border-surface-800 animate-slide-up scale-100">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-500 to-blue-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" 
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Update Available</h2>
              <p className="text-blue-100 text-sm mt-0.5">A new version of yt-dlp is ready.</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!updateComplete ? (
            <div className="space-y-5">
              <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl p-4 border border-surface-100 dark:border-surface-700/50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-surface-500">Current Version:</span>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300 font-mono">
                    {currentVersion || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">Latest Version:</span>
                  <span className="text-base font-bold text-primary-600 dark:text-primary-400 font-mono">
                    {latestVersion}
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-100 dark:border-red-900/50">
                  <strong className="font-semibold block mb-1">Update Failed:</strong>
                  {errorMsg}
                </div>
              )}

              {isUpdating && !errorMsg ? (
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between text-xs font-medium text-surface-500">
                    <span>Downloading update...</span>
                    <span className="animate-pulse">Please wait</span>
                  </div>
                  <div className="h-2 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full animate-progress-indeterminate"></div>
                  </div>
                </div>
              ) : (
                <div className="pt-3 flex flex-col gap-2.5">
                  <button 
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-xl 
                               shadow-lg shadow-primary-500/30 transition-all duration-200"
                  >
                    Update Now
                  </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={onRemindLater}
                      className="flex-1 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-300 
                                 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
                    >
                      Remind me later
                    </button>
                    <button 
                      onClick={onSkip}
                      className="flex-1 py-2.5 text-sm font-medium text-surface-500 hover:text-red-600 
                                 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                    >
                      Skip this version
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Success State
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Update Complete!</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 pb-6 leading-relaxed">
                yt-dlp has been successfully updated to version <strong className="font-mono text-surface-700 dark:text-surface-200">{latestVersion}</strong>.<br/>
                The app will now restart to apply changes.
              </p>
              <button 
                onClick={onRestart}
                className="w-full py-3 bg-surface-900 dark:bg-white text-white dark:text-surface-900 font-medium rounded-xl 
                           shadow-md hover:bg-surface-800 dark:hover:bg-surface-100 transition-colors"
              >
                Restart App
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Required tailwind keyframe for indeterminate progress */}
      <style>{`
        @keyframes progress-indeterminate {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 50%; transform: translateX(50%); }
          100% { width: 0%; transform: translateX(200%); }
        }
        .animate-progress-indeterminate {
          animation: progress-indeterminate 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
}
