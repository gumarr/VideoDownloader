interface ProgressBarProps {
  progress: number;     // 0–100
  speed?: string;       // e.g. "2.4 MB/s"
  downloaded?: string;  // e.g. "12.5 MB"
  total?: string;       // e.g. "45.2 MB"
  eta?: string;         // e.g. "00:15"
  isComplete: boolean;
  onCancel?: () => void;
}

export default function ProgressBar({ progress, speed, downloaded, total, eta, isComplete, onCancel }: ProgressBarProps) {
  return (
    <div className="animate-fade-in-up space-y-2.5" style={{ animationDelay: '0.2s' }}>
      {/* Top stats row */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <span className="flex items-center gap-1.5 text-accent-500 font-semibold">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Download Complete
            </span>
          ) : (
            <span className="text-surface-600 dark:text-surface-300 font-medium">
              {downloaded && total ? `${downloaded} / ${total}` : 'Preparing...'}
            </span>
          )}
        </div>
        <span className="font-semibold text-surface-900 dark:text-surface-50 tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Bar */}
      <div className="relative w-full h-3 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out
                      ${isComplete 
                        ? 'bg-gradient-to-r from-accent-500 to-accent-400' 
                        : 'bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400'}`}
          style={{ width: `${progress}%` }}
        >
          {!isComplete && progress > 0 && progress < 100 && (
            <div className="absolute inset-0 animate-shimmer rounded-full" />
          )}
        </div>
      </div>

      {/* Bottom info row (Speed, ETA, Cancel) */}
      {!isComplete && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-surface-400 dark:text-surface-500">
            {speed && speed !== '—' && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {speed}
              </span>
            )}
            {eta && eta !== '—' && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ETA: {eta}
              </span>
            )}
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
