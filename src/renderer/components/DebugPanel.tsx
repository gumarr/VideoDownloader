import { useState, useEffect, useRef, useCallback } from 'react';

interface ProgressEntry {
  timestamp: string;
  percent: number;
  speed: string;
  eta: string;
  downloaded: string;
  total: string;
}

interface LogEntry {
  id: number;
  type: 'info' | 'success' | 'error';
  message: string;
  timestamp: string;
}

const hasElectronAPI = typeof window !== 'undefined' && !!window.api;

export default function DebugPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  /* ── Fetch test state ─────────────────────────── */
  const [fetchUrl, setFetchUrl] = useState('');
  const [isFetchTesting, setIsFetchTesting] = useState(false);
  const [fetchResult, setFetchResult] = useState<any>(null);

  /* ── Download test state ──────────────────────── */
  const [dlUrl, setDlUrl] = useState('');
  const [dlFormat, setDlFormat] = useState<'mp4' | 'mp3'>('mp4');
  const [dlQuality, setDlQuality] = useState('720p');
  const [isDlTesting, setIsDlTesting] = useState(false);
  const [dlResult, setDlResult] = useState<any>(null);

  /* ── Progress monitor ─────────────────────────── */
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [progressStatus, setProgressStatus] = useState<'idle' | 'receiving' | 'complete'>('idle');

  /* ── Logs ──────────────────────────────────────── */
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      id: logIdRef.current++,
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    setLogs((prev) => [...prev.slice(-49), entry]); // keep last 50
    console.log(`[DebugPanel] [${type}]`, message);
  }, []);

  /* ── Subscribe to progress ─────────────────────── */
  useEffect(() => {
    if (!hasElectronAPI || !isOpen) return;

    const unsub = window.api.onDownloadProgress((prog) => {
      const entry: ProgressEntry = {
        timestamp: new Date().toLocaleTimeString(),
        percent: prog.percent,
        speed: prog.speed,
        eta: prog.eta,
        downloaded: prog.downloaded,
        total: prog.total,
      };
      setProgressEntries((prev) => [...prev.slice(-19), entry]); // keep last 20
      setProgressStatus(prog.percent >= 100 ? 'complete' : 'receiving');
    });

    return () => unsub();
  }, [isOpen]);

  /* Auto-scroll logs */
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  /* ── Test: Fetch Video Info ──────────────────── */
  const handleTestFetch = useCallback(async () => {
    if (!hasElectronAPI || !fetchUrl.trim()) return;
    setIsFetchTesting(true);
    setFetchResult(null);
    addLog('info', `Testing fetchVideoInfo("${fetchUrl.trim()}")...`);

    try {
      const result = await window.api.fetchVideoInfo(fetchUrl.trim());
      setFetchResult(result);

      if (result.success && result.data) {
        addLog('success', `✓ Title: "${result.data.title}"`);
        addLog('success', `✓ Duration: ${result.data.durationFormatted}`);
        addLog('success', `✓ Thumbnail: ${result.data.thumbnail ? 'present' : 'missing'}`);
        addLog('success', `✓ Formats: ${result.data.formats?.length || 0} available`);
        console.log('[DebugPanel] fetchVideoInfo result:', result.data);
      } else {
        addLog('error', `✗ Error: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      addLog('error', `✗ Exception: ${err.message}`);
      setFetchResult({ success: false, error: err.message });
    }
    setIsFetchTesting(false);
  }, [fetchUrl, addLog]);

  /* ── Test: Download Video ────────────────────── */
  const handleTestDownload = useCallback(async () => {
    if (!hasElectronAPI || !dlUrl.trim()) return;
    setIsDlTesting(true);
    setDlResult(null);
    setProgressEntries([]);
    setProgressStatus('idle');
    addLog('info', `Testing downloadVideo("${dlUrl.trim()}", ${dlFormat}, ${dlQuality})...`);

    try {
      const result = await window.api.downloadVideo({
        url: dlUrl.trim(),
        format: dlFormat,
        quality: dlQuality,
      });
      setDlResult(result);

      if (result.success) {
        addLog('success', `✓ Download complete: ${result.filePath || 'unknown path'}`);
        console.log('[DebugPanel] downloadVideo result:', result);
      } else {
        addLog('error', `✗ Download failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      addLog('error', `✗ Download exception: ${err.message}`);
      setDlResult({ success: false, error: err.message });
    }
    setIsDlTesting(false);
  }, [dlUrl, dlFormat, dlQuality, addLog]);

  if (!isOpen) return null;

  const statusColors = {
    idle: 'bg-surface-400',
    receiving: 'bg-amber-400 animate-pulse',
    complete: 'bg-accent-500',
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-4 z-[70] flex items-center justify-center">
        <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-surface-900 rounded-2xl shadow-2xl
                        border border-surface-200 dark:border-surface-800 flex flex-col overflow-hidden"
             style={{ animation: 'fadeInScale 0.25s ease-out both' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600
                              flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M11.42 15.17l-5.1-5.1m0 0L11.42 4.97m-5.1 5.1H21M3 21h18" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-surface-900 dark:text-surface-50">Debug Panel</h2>
                <p className="text-xs text-surface-400">IPC Test & Diagnostics</p>
              </div>
            </div>
            <button
              id="debug-close-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400
                         hover:text-surface-600 dark:hover:text-surface-300
                         hover:bg-surface-100 dark:hover:bg-surface-800 transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ── A. Fetch Video Info ─────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">
                A. Fetch Video Info
              </h3>
              <div className="flex gap-2">
                <input
                  id="debug-fetch-url"
                  type="text"
                  value={fetchUrl}
                  onChange={(e) => setFetchUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-sm text-surface-900 dark:text-surface-50
                             placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  id="debug-fetch-btn"
                  onClick={handleTestFetch}
                  disabled={isFetchTesting || !fetchUrl.trim()}
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer
                             flex items-center gap-1.5"
                >
                  {isFetchTesting && (
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Test Fetch
                </button>
              </div>

              {/* Fetch result */}
              {fetchResult && (
                <div className={`rounded-lg p-3 text-xs font-mono overflow-x-auto border
                  ${fetchResult.success
                    ? 'bg-accent-500/10 border-accent-500/30 text-accent-600 dark:text-accent-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'}`}>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(fetchResult, null, 2)}</pre>
                </div>
              )}
            </section>

            {/* ── B. Download Video ───────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">
                B. Download Video
              </h3>
              <div className="flex flex-wrap gap-2">
                <input
                  id="debug-dl-url"
                  type="text"
                  value={dlUrl}
                  onChange={(e) => setDlUrl(e.target.value)}
                  placeholder="URL"
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-sm text-surface-900 dark:text-surface-50
                             placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <select
                  id="debug-dl-format"
                  value={dlFormat}
                  onChange={(e) => setDlFormat(e.target.value as 'mp4' | 'mp3')}
                  className="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-sm text-surface-900 dark:text-surface-50
                             focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
                >
                  <option value="mp4">MP4</option>
                  <option value="mp3">MP3</option>
                </select>
                <select
                  id="debug-dl-quality"
                  value={dlQuality}
                  onChange={(e) => setDlQuality(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-800 text-sm text-surface-900 dark:text-surface-50
                             focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
                >
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                  <option value="360p">360p</option>
                </select>
                <button
                  id="debug-dl-btn"
                  onClick={handleTestDownload}
                  disabled={isDlTesting || !dlUrl.trim()}
                  className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer
                             flex items-center gap-1.5"
                >
                  {isDlTesting && (
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Test Download
                </button>
              </div>

              {/* Download result */}
              {dlResult && (
                <div className={`rounded-lg p-3 text-xs font-mono overflow-x-auto border
                  ${dlResult.success
                    ? 'bg-accent-500/10 border-accent-500/30 text-accent-600 dark:text-accent-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'}`}>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(dlResult, null, 2)}</pre>
                </div>
              )}
            </section>

            {/* ── C. Progress Monitor ────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">
                  C. Progress Monitor
                </h3>
                <span className={`w-2 h-2 rounded-full ${statusColors[progressStatus]}`} />
                <span className="text-xs text-surface-400 capitalize">{progressStatus}</span>
              </div>

              {progressEntries.length > 0 ? (
                <div className="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-50 dark:bg-surface-800 sticky top-0">
                        <tr className="text-surface-500 dark:text-surface-400">
                          <th className="px-3 py-2 text-left font-medium">Time</th>
                          <th className="px-3 py-2 text-right font-medium">%</th>
                          <th className="px-3 py-2 text-right font-medium">Speed</th>
                          <th className="px-3 py-2 text-right font-medium">ETA</th>
                          <th className="px-3 py-2 text-right font-medium">Downloaded</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                        {progressEntries.map((entry, i) => (
                          <tr key={i} className="text-surface-700 dark:text-surface-300 font-mono">
                            <td className="px-3 py-1.5">{entry.timestamp}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{entry.percent.toFixed(1)}%</td>
                            <td className="px-3 py-1.5 text-right">{entry.speed}</td>
                            <td className="px-3 py-1.5 text-right">{entry.eta}</td>
                            <td className="px-3 py-1.5 text-right">{entry.downloaded}</td>
                            <td className="px-3 py-1.5 text-right">{entry.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-surface-400 dark:text-surface-500 italic">
                  No progress events yet. Start a download to see real-time updates.
                </p>
              )}

              <button
                onClick={() => { setProgressEntries([]); setProgressStatus('idle'); }}
                className="text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300
                           transition-colors cursor-pointer"
              >
                Clear progress log
              </button>
            </section>

            {/* ── Console Log ────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest">
                  Console Log
                </h3>
                <button
                  onClick={() => setLogs([])}
                  className="text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300
                             transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div
                ref={logContainerRef}
                className="rounded-lg bg-surface-950 dark:bg-black/50 p-3 max-h-48 overflow-y-auto
                           border border-surface-200 dark:border-surface-800 font-mono text-xs space-y-0.5"
              >
                {logs.length === 0 ? (
                  <span className="text-surface-500">Waiting for test actions...</span>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-surface-500 flex-shrink-0">[{log.timestamp}]</span>
                      <span className={
                        log.type === 'success' ? 'text-accent-400' :
                        log.type === 'error' ? 'text-red-400' :
                        'text-blue-400'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Animation */}
      <style>{`
        @keyframes fadeInScale {
          from { transform: scale(0.95); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
