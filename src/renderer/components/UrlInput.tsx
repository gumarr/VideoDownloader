interface UrlInputProps {
  url: string;
  onUrlChange: (url: string) => void;
  onPaste: () => void;
  onFetch: () => void;
  isFetching: boolean;
}

export default function UrlInput({ url, onUrlChange, onPaste, onFetch, isFetching }: UrlInputProps) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
      <label htmlFor="url-input" className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-2">
        Video URL
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <input
            id="url-input"
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                       bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50
                       placeholder:text-surface-400 dark:placeholder:text-surface-500
                       focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                       transition-all duration-200"
          />
        </div>

        <button
          id="paste-btn"
          onClick={onPaste}
          className="px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700
                     bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300
                     hover:bg-surface-50 dark:hover:bg-surface-700 hover:border-primary-300 dark:hover:border-primary-500
                     focus:outline-none focus:ring-2 focus:ring-primary-400
                     transition-all duration-200 cursor-pointer flex items-center gap-1.5 text-sm font-medium"
          title="Paste from clipboard"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Paste
        </button>

        <button
          id="fetch-btn"
          onClick={onFetch}
          disabled={!url.trim() || isFetching}
          className="px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 
                     text-white font-semibold text-sm
                     disabled:opacity-40 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:focus:ring-offset-surface-900
                     transition-all duration-200 cursor-pointer flex items-center gap-2
                     shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
        >
          {isFetching ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          {isFetching ? 'Fetching...' : 'Fetch'}
        </button>
      </div>
    </div>
  );
}
