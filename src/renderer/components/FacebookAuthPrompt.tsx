interface FacebookAuthPromptProps {
  isLoading: boolean;
  isLoggedIn: boolean;
  /** true = fetch was blocked by a private-content auth error */
  triggeredByError: boolean;
  onLogin: () => void;
  onDismiss: () => void;
  onLogout: () => void;
}

/* ── Shared micro-components ──────────────────────────────── */

function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function FacebookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

/* ── Main component ───────────────────────────────────────── */

export default function FacebookAuthPrompt({
  isLoading,
  isLoggedIn,
  triggeredByError,
  onLogin,
  onDismiss,
  onLogout,
}: FacebookAuthPromptProps) {
  /* ── CASE A: private-content auth error ─────────────────── */
  if (triggeredByError) {
    return (
      <div className="animate-fade-in-up rounded-xl border border-blue-200 dark:border-blue-800/60
                      overflow-hidden shadow-sm shadow-blue-500/10">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 flex items-center gap-3">
          {/* Lock icon */}
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">
              Private Content Detected
            </p>
            <p className="text-xs text-blue-100 mt-0.5">
              This video requires Facebook login to access
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-4 space-y-4">
          {/* Info box */}
          <div className="bg-white dark:bg-blue-900/20 rounded-lg px-3.5 py-3
                          border border-blue-100 dark:border-blue-800/40 space-y-1.5">
            <p className="text-xs text-surface-700 dark:text-surface-300 leading-relaxed">
              This video is in a private group or requires login.
              Connect your Facebook account to download it.
            </p>
            <p className="text-xs text-accent-600 dark:text-accent-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Your login is saved — you only need to do this once.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              id="fb-auth-error-login-btn"
              onClick={onLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                         bg-gradient-to-r from-blue-600 to-indigo-600
                         hover:from-blue-500 hover:to-indigo-500
                         text-white text-sm font-semibold
                         transition-all shadow-md shadow-blue-500/25
                         disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <Spinner />
              ) : (
                <FacebookIcon className="w-4 h-4" />
              )}
              {isLoading ? 'Opening browser…' : 'Connect Facebook Account'}
            </button>

            <button
              id="fb-auth-error-dismiss-btn"
              onClick={onDismiss}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl
                         text-surface-500 dark:text-surface-400 text-sm
                         hover:bg-blue-100 dark:hover:bg-blue-900/30
                         border border-transparent hover:border-blue-200 dark:hover:border-blue-800/40
                         transition-all cursor-pointer"
            >
              Try Without Login
              <span className="text-[10px] opacity-60">(Public videos only)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── CASE B: informational (user clicked Facebook in sidebar) ── */
  return (
    <div className="animate-fade-in-up rounded-xl border border-blue-100 dark:border-blue-900/40
                    bg-blue-50/60 dark:bg-blue-950/20 px-4 py-4 shadow-sm space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <FacebookIcon className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            Facebook Video Downloader
          </p>
          <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
            Paste any Facebook video, reel, or post URL above
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-blue-100 dark:border-blue-900/40" />

      {/* Auth status section */}
      {isLoggedIn ? (
        /* Connected state */
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-accent-600 dark:text-accent-400 font-medium">
              Facebook account connected
            </span>
          </div>
          <button
            id="fb-disconnect-btn"
            onClick={onLogout}
            className="text-xs text-surface-400 hover:text-red-500 dark:hover:text-red-400
                       transition-colors px-2 py-1 rounded-lg
                       hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      ) : (
        /* Not connected state */
        <div className="space-y-2">
          <p className="text-xs text-surface-500 dark:text-surface-400">
            For private groups or restricted videos, connect your account first.
          </p>
          <button
            id="fb-info-login-btn"
            onClick={onLogin}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl
                       bg-blue-600 hover:bg-blue-500
                       text-white text-sm font-medium
                       transition-all shadow-sm shadow-blue-500/20
                       disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <Spinner />
            ) : (
              <FacebookIcon className="w-4 h-4" />
            )}
            {isLoading ? 'Opening browser…' : 'Connect Facebook Account'}
          </button>
        </div>
      )}
    </div>
  );
}
