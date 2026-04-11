import { useState, useEffect } from 'react';

interface FileNamePreviewProps {
  videoTitle: string;
  format: string;
  onFileNameChange: (fileName: string) => void;
}

export default function FileNamePreview({ videoTitle, format, onFileNameChange }: FileNamePreviewProps) {
  const [fileName, setFileName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  /* Sync the file name from video title */
  useEffect(() => {
    // Sanitize the title for file system safety
    const sanitized = videoTitle
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    setFileName(sanitized);
    onFileNameChange(sanitized);
  }, [videoTitle]);

  const ext = format === 'mp3' ? '.mp3' : '.mp4';

  const handleNameChange = (value: string) => {
    // Sanitize as user types
    const sanitized = value.replace(/[<>:"/\\|?*]/g, '');
    setFileName(sanitized);
    onFileNameChange(sanitized);
  };

  return (
    <div className="animate-fade-in-up space-y-2" style={{ animationDelay: '0.12s' }}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-surface-700 dark:text-surface-200">
          File Name
        </label>
        <button
          id="edit-filename-btn"
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300
                     font-medium transition-colors cursor-pointer flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isEditing ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            )}
          </svg>
          {isEditing ? 'Done' : 'Rename'}
        </button>
      </div>

      <div className="flex items-center gap-0 rounded-xl border border-surface-200 dark:border-surface-700
                      bg-white dark:bg-surface-800 overflow-hidden transition-all duration-200
                      focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-transparent">
        {/* File icon */}
        <div className="px-3 py-3 bg-surface-50 dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 flex-shrink-0">
          <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>

        {/* File name */}
        {isEditing ? (
          <input
            id="filename-input"
            type="text"
            value={fileName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="flex-1 px-3 py-2.5 bg-transparent text-sm text-surface-900 dark:text-surface-50
                       focus:outline-none min-w-0"
            autoFocus
          />
        ) : (
          <span className="flex-1 px-3 py-2.5 text-sm text-surface-900 dark:text-surface-50 truncate">
            {fileName || 'Untitled'}
          </span>
        )}

        {/* Extension badge */}
        <div className="px-3 py-2.5 flex-shrink-0">
          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold
                           bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            {ext}
          </span>
        </div>
      </div>
    </div>
  );
}
