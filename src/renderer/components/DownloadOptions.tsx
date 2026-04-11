interface DownloadOptionsProps {
  format: string;
  onFormatChange: (format: string) => void;
  quality: string;
  onQualityChange: (quality: string) => void;
  onDownload: () => void;
}

const FORMATS = [
  { value: 'mp4', label: 'MP4 (Video)' },
  { value: 'mp3', label: 'MP3 (Audio Only)' },
];

const QUALITIES = [
  { value: '1080p', label: '1080p – Full HD' },
  { value: '720p', label: '720p – HD' },
  { value: '480p', label: '480p – SD' },
  { value: '360p', label: '360p' },
  { value: '240p', label: '240p' },
  { value: '144p', label: '144p' },
];

export default function DownloadOptions({
  format,
  onFormatChange,
  quality,
  onQualityChange,
  onDownload,
}: DownloadOptionsProps) {
  const isAudio = format === 'mp3';

  return (
    <div className="animate-fade-in-up space-y-4" style={{ animationDelay: '0.15s' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Format Dropdown */}
        <div>
          <label htmlFor="format-select" className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
            Format
          </label>
          <div className="relative">
            <select
              id="format-select"
              value={format}
              onChange={(e) => onFormatChange(e.target.value)}
              className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-surface-200 dark:border-surface-700
                         bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50
                         focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                         transition-all duration-200 cursor-pointer text-sm font-medium"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Quality Dropdown */}
        <div className={isAudio ? 'opacity-40 pointer-events-none' : ''}>
          <label htmlFor="quality-select" className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
            Quality {isAudio && <span className="text-xs text-surface-400">(N/A for audio)</span>}
          </label>
          <div className="relative">
            <select
              id="quality-select"
              value={quality}
              onChange={(e) => onQualityChange(e.target.value)}
              disabled={isAudio}
              className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-surface-200 dark:border-surface-700
                         bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50
                         focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-200 cursor-pointer text-sm font-medium"
            >
              {QUALITIES.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Add to Queue button */}
      <button
        id="download-btn"
        onClick={onDownload}
        className="w-full py-3.5 rounded-xl font-semibold text-sm
                   bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600
                   text-white
                   focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:focus:ring-offset-surface-900
                   transition-all duration-200 cursor-pointer
                   shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50
                   active:scale-[0.98]
                   flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add to Queue — {format.toUpperCase()}
      </button>
    </div>
  );
}
