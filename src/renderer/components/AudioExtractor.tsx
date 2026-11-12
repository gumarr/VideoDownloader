import { useRef, useState } from 'react';
import type { AudioExtractMode } from '../../types/ipc';

type Status = 'waiting' | 'working' | 'done' | 'saved' | 'error' | 'cancelled';

interface Item {
  input: string;
  status: Status;
  percent: number;
  tempPath?: string;   // extracted, waiting for the user to choose where to save
  outputPath?: string; // final saved location
  error?: string;
}

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;
const dirName = (p: string) => p.slice(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')));

const STATUS_LABEL: Record<Status, string> = {
  waiting: 'Waiting', working: '', done: 'Extracted — not saved yet', saved: 'Saved', error: 'Failed', cancelled: 'Cancelled',
};

const MODES: { value: AudioExtractMode; label: string; hint: string }[] = [
  { value: 'mp3', label: 'MP3 · 320 kbps', hint: 'Highest MP3 quality, plays everywhere. Keeps sample rate, channels and tags.' },
  { value: 'original', label: 'Original (lossless)', hint: 'Copies the audio stream untouched — zero quality loss, very fast. File type follows the video (usually .m4a).' },
];

export default function AudioExtractor() {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<AudioExtractMode>('mp3');
  const [running, setRunning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const patch = (i: number, changes: Partial<Item>) =>
    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...changes } : it)));

  const pickFiles = async () => {
    const files = await window.api.selectVideoFiles();
    if (files.length === 0) return;
    setItems(files.map((input) => ({ input, status: 'waiting', percent: 0 })));
    setSaveError(null);
  };

  /** Ask the user where to save, then move the extracted temp files there. */
  const save = async (list: { i: number; input: string; tempPath: string }[]) => {
    if (list.length === 0) return;
    setSaveError(null);
    const res = await window.api.saveExtractedAudio(list.map((x) => x.tempPath), dirName(list[0].input));
    if (res.success && res.savedPaths) {
      res.savedPaths.forEach((p, k) => patch(list[k].i, { status: 'saved', outputPath: p, tempPath: undefined }));
    } else if (!res.canceled) {
      setSaveError(res.error || 'Could not save the files.');
    }
  };

  const extractAll = async () => {
    cancelRef.current = false;
    setRunning(true);
    setSaveError(null);
    const extracted: { i: number; input: string; tempPath: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const { input } = items[i];
      if (cancelRef.current) { patch(i, { status: 'cancelled', percent: 0 }); continue; }
      patch(i, { status: 'working', percent: 0, error: undefined, outputPath: undefined, tempPath: undefined });
      const res = await window.api.extractAudio(input, mode, (percent) => patch(i, { percent }));
      if (res.success && res.tempPath) {
        patch(i, { status: 'done', percent: 100, tempPath: res.tempPath });
        extracted.push({ i, input, tempPath: res.tempPath });
      } else if (res.cancelled) {
        patch(i, { status: 'cancelled', percent: 0 });
      } else {
        patch(i, { status: 'error', error: res.error || 'Extraction failed' });
      }
    }

    setRunning(false);
    await save(extracted); // even after a cancel, offer to save what finished
  };

  const cancel = () => {
    cancelRef.current = true;
    window.api.cancelExtractAudio();
  };

  const unsaved = items.flatMap((it, i) => (it.status === 'done' && it.tempPath ? [{ i, input: it.input, tempPath: it.tempPath }] : []));

  const btn = 'px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  const secondaryBtn = `${btn} border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800
                        text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700`;

  return (
    <div className="animate-fade-in-up space-y-4 rounded-2xl p-5 bg-white dark:bg-surface-900
                    border border-surface-200 dark:border-surface-800 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-surface-900 dark:text-surface-50">Extract Audio from Video</h2>
        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
          Choose one or more videos on your computer. After extraction you choose where to save the audio.
        </p>
      </div>

      {/* Output format */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Output format">
        {MODES.map((m) => (
          <label
            key={m.value}
            className={`rounded-xl border px-3 py-2.5 cursor-pointer transition-all
                        ${mode === m.value
                          ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'}
                        ${running ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input type="radio" name="audio-mode" className="sr-only" value={m.value}
                   checked={mode === m.value} onChange={() => setMode(m.value)} disabled={running} />
            <span className="block text-sm font-semibold text-surface-800 dark:text-surface-100">{m.label}</span>
            <span className="block text-[11px] leading-snug text-surface-500 dark:text-surface-400 mt-0.5">{m.hint}</span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={pickFiles} disabled={running} className={secondaryBtn}>Choose Videos…</button>
        <span className="flex-1 min-w-0 text-sm text-surface-500 dark:text-surface-400">
          {items.length === 0 ? 'No file selected' : `${items.length} file(s) selected`}
        </span>
        {running ? (
          <button onClick={cancel} className={`${btn} bg-red-600 hover:bg-red-700 text-white font-semibold`}>Cancel</button>
        ) : (
          <button
            onClick={extractAll}
            disabled={items.length === 0}
            className={`${btn} bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-lg shadow-primary-500/25`}
          >
            Extract
          </button>
        )}
      </div>

      {/* Files */}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.input} className="rounded-xl px-3 py-2.5 bg-surface-50 dark:bg-surface-800/60">
              <div className="flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate text-surface-800 dark:text-surface-100" title={it.input}>
                  {baseName(it.input)}
                </span>
                {it.status === 'working' ? (
                  <span className="tabular-nums text-xs text-surface-500">{Math.round(it.percent)}%</span>
                ) : (
                  <span className={`text-xs whitespace-nowrap ${
                    it.status === 'saved' ? 'text-emerald-600 dark:text-emerald-400'
                    : it.status === 'error' ? 'text-red-600 dark:text-red-400'
                    : it.status === 'done' ? 'text-amber-600 dark:text-amber-400'
                    : 'text-surface-400'}`}>
                    {STATUS_LABEL[it.status]}
                  </span>
                )}
                {it.status === 'saved' && it.outputPath && (
                  <>
                    <button onClick={() => window.api.openFile(it.outputPath!)} className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">Play</button>
                    <button onClick={() => window.api.openFolder(it.outputPath!)} className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">Folder</button>
                  </>
                )}
              </div>
              {it.status === 'working' && (
                <div className="relative w-full h-1.5 mt-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-300"
                       style={{ width: `${it.percent}%` }} />
                </div>
              )}
              {it.status === 'saved' && it.outputPath && (
                <p className="text-[11px] text-surface-400 truncate mt-1" title={it.outputPath}>{it.outputPath}</p>
              )}
              {it.status === 'error' && it.error && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">{it.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Save dialog was dismissed — let the user try again */}
      {!running && unsaved.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm bg-amber-50 dark:bg-amber-900/20
                        text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          <span className="flex-1">{unsaved.length} file(s) extracted but not saved yet.</span>
          <button onClick={() => save(unsaved)} className={`${btn} py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold`}>
            Save…
          </button>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl px-4 py-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300
                        border border-red-200 dark:border-red-800">
          {saveError}
        </div>
      )}
    </div>
  );
}
