import { useCallback } from 'react';
import type { DownloadTask } from '../../types/ipc';

interface DownloadQueueProps {
  tasks: DownloadTask[];
  onStart: (taskId: string) => void;
  onUpdateTask: (taskId: string, format: 'mp4'|'mp3', quality: string) => void;
  onStartAllPending: () => void;
  onCancel: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onRetry: (taskId: string) => void;
  onOpenFolder: (filePath: string) => void;
  onOpenFile: (filePath: string) => void;
  onClearCompleted: () => void;
  onClearAllTasks: () => void;
}

const statusConfig = {
  pending: {
    label: 'Ready',
    dotClass: 'bg-purple-500',
    textClass: 'text-purple-600 dark:text-purple-400',
  },
  queued: {
    label: 'Queued',
    dotClass: 'bg-surface-400',
    textClass: 'text-surface-500 dark:text-surface-400',
  },
  downloading: {
    label: 'Downloading',
    dotClass: 'bg-blue-500 animate-pulse',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  completed: {
    label: 'Completed',
    dotClass: 'bg-accent-500',
    textClass: 'text-accent-600 dark:text-accent-400',
  },
  failed: {
    label: 'Failed',
    dotClass: 'bg-red-500',
    textClass: 'text-red-600 dark:text-red-400',
  },
  cancelled: {
    label: 'Cancelled',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
};

export default function DownloadQueue({
  tasks,
  onStart,
  onUpdateTask,
  onStartAllPending,
  onCancel,
  onRemove,
  onRetry,
  onOpenFolder,
  onOpenFile,
  onClearCompleted,
  onClearAllTasks,
}: DownloadQueueProps) {
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const activeTasks = tasks.filter(t => t.status === 'downloading' || t.status === 'queued');
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');
  
  if (tasks.length === 0) return null;

  return (
    <div className="animate-fade-in-up space-y-3">
      {/* ── Header ─────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg className="w-4.5 h-4.5 text-surface-500 dark:text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-200 uppercase tracking-wider">
            Queue
          </h2>
          {/* Badges */}
          <div className="flex items-center gap-1.5">
            {pendingTasks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                {pendingTasks.length} pending
              </span>
            )}
            {activeTasks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                {activeTasks.length} active
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingTasks.length > 0 && (
            <button
              onClick={onStartAllPending}
              className="text-xs font-semibold px-2 py-1 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800/60
                         transition-colors cursor-pointer"
            >
              Download All Pending
            </button>
          )}
          {completedTasks.length > 0 && (
            <button
              onClick={onClearCompleted}
              className="text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300
                         transition-colors cursor-pointer"
            >
              Clear finished
            </button>
          )}
          <button
            onClick={onClearAllTasks}
            className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400
                       transition-colors cursor-pointer ml-1"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* ── Pending Task List ─────────────────────── */}
      {pendingTasks.length > 0 && (
        <div className="space-y-2 mb-4">
          <h3 className="text-xs font-medium text-surface-500 uppercase tracking-wide">
            Pending
          </h3>
          {pendingTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStart={onStart}
              onUpdateTask={onUpdateTask}
              onCancel={onCancel}
              onRemove={onRemove}
              onRetry={onRetry}
              onOpenFolder={onOpenFolder}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}

      {/* ── Active Task List ──────────────────────── */}
      {activeTasks.length > 0 && (
        <div className="space-y-2">
          {activeTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStart={onStart}
              onUpdateTask={onUpdateTask}
              onCancel={onCancel}
              onRemove={onRemove}
              onRetry={onRetry}
              onOpenFolder={onOpenFolder}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}

      {/* ── Completed Task List ────────────────────── */}
      {completedTasks.length > 0 && (
        <div className="space-y-2 mt-4">
          <h3 className="text-xs font-medium text-surface-500 uppercase tracking-wide">
            Finished
          </h3>
          {completedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStart={onStart}
              onUpdateTask={onUpdateTask}
              onCancel={onCancel}
              onRemove={onRemove}
              onRetry={onRetry}
              onOpenFolder={onOpenFolder}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Individual Task Card ──────────────────────────────── */

function TaskCard({
  task,
  onStart,
  onUpdateTask,
  onCancel,
  onRemove,
  onRetry,
  onOpenFolder,
  onOpenFile,
}: {
  task: DownloadTask;
  onStart: (id: string) => void;
  onUpdateTask: (id: string, format: 'mp4'|'mp3', quality: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onOpenFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const status = statusConfig[task.status];
  const isPending = task.status === 'pending';
  const isActive = task.status === 'downloading';
  const canStart = task.status === 'pending';
  const canCancel = task.status === 'queued' || task.status === 'downloading';
  const canRetry = task.status === 'failed' || task.status === 'cancelled';
  const canRemove = task.status !== 'downloading' && task.status !== 'queued';
  const canOpen = task.status === 'completed' && !!task.filePath;

  const handleStart = useCallback(() => onStart(task.id), [task.id, onStart]);

  const handleCancel = useCallback(() => onCancel(task.id), [task.id, onCancel]);
  const handleRemove = useCallback(() => onRemove(task.id), [task.id, onRemove]);
  const handleRetry = useCallback(() => onRetry(task.id), [task.id, onRetry]);
  const handleOpenFolder = useCallback(() => {
    if (task.filePath) onOpenFolder(task.filePath);
  }, [task.filePath, onOpenFolder]);
  const handleOpenFile = useCallback(() => {
    if (task.filePath) onOpenFile(task.filePath);
  }, [task.filePath, onOpenFile]);

  return (
    <div className={`rounded-xl border transition-all duration-300
      ${isActive
        ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 shadow-sm'
        : task.status === 'completed'
          ? 'border-accent-300/50 dark:border-accent-700/30 bg-accent-50/30 dark:bg-accent-900/5'
          : task.status === 'failed'
            ? 'border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/5'
            : isPending
              ? 'border-purple-200 dark:border-purple-800/40 bg-purple-50/10 dark:bg-purple-900/5'
              : 'border-surface-200 dark:border-surface-700/60 bg-white dark:bg-surface-800/40'
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Thumbnail */}
        {task.thumbnail ? (
          <div className="w-16 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-surface-200 dark:bg-surface-700">
            <img
              src={task.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="w-16 h-10 rounded-lg flex-shrink-0 bg-surface-200 dark:bg-surface-700
                          flex items-center justify-center">
            <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1 items-start min-w-0 flex-1">
              {task.platform === 'soundcloud' ? (
                <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                  SoundCloud
                </span>
              ) : task.platform === 'facebook' ? (
                <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  Facebook
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  YouTube
                </span>
              )}
              <h3 className="text-sm font-medium text-surface-900 dark:text-surface-100 line-clamp-1 leading-snug break-all">
                {task.title}
              </h3>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              {canOpen && (
                <>
                  <button onClick={handleOpenFile} title="Open file"
                    className="w-6 h-6 rounded-md flex items-center justify-center
                               text-surface-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20
                               transition-all cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" 
                            d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                    </svg>
                  </button>
                  <button onClick={handleOpenFolder} title="Open folder"
                    className="w-6 h-6 rounded-md flex items-center justify-center
                               text-surface-400 hover:text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-900/20
                               transition-all cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                            d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                    </svg>
                  </button>
                </>
              )}
              {canStart && (
                <button onClick={handleStart} title="Start Download"
                  className="w-6 h-6 rounded-md flex items-center justify-center
                             text-primary-500 hover:text-white hover:bg-primary-500
                             transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
              )}
              {canRetry && (
                <button onClick={handleRetry} title="Retry"
                  className="w-6 h-6 rounded-md flex items-center justify-center
                             text-surface-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20
                             transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                </button>
              )}
              {canCancel && (
                <button onClick={handleCancel} title="Cancel"
                  className="w-6 h-6 rounded-md flex items-center justify-center
                             text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                             transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {canRemove && (
                <button onClick={handleRemove} title="Remove"
                  className="w-6 h-6 rounded-md flex items-center justify-center
                             text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                             transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Status + meta */}
          <div className="flex items-center gap-2 mt-1 -ml-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ml-0.5 ${status.dotClass}`} />
            <span className={`text-[11px] font-medium mr-1 ${status.textClass}`}>{status.label}</span>
            
            {isPending ? (
              <div className="flex items-center gap-1.5">
                {task.platform === 'soundcloud' ? (
                  <span className="text-[10px] text-surface-400 font-medium bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded border border-surface-200 dark:border-surface-700">
                    MP3 · Best Quality
                  </span>
                ) : (
                  <>
                    <select
                      value={task.format}
                      onChange={(e) => onUpdateTask(task.id, e.target.value as 'mp4'|'mp3', task.quality)}
                      className="bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700
                                 text-[10px] text-surface-600 dark:text-surface-300 rounded px-1.5 py-0.5 outline-none cursor-pointer"
                    >
                      <option value="mp4">MP4</option>
                      <option value="mp3">MP3</option>
                    </select>
                    <select
                      value={task.quality}
                      onChange={(e) => onUpdateTask(task.id, task.format, e.target.value)}
                      disabled={task.format === 'mp3'}
                      className="bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700
                                 text-[10px] text-surface-600 dark:text-surface-300 rounded px-1.5 py-0.5 outline-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="best">Best</option>
                      <option value="1080p">1080p</option>
                      <option value="720p">720p</option>
                      <option value="480p">480p</option>
                      <option value="360p">360p</option>
                      <option value="240p">240p</option>
                      <option value="144p">144p</option>
                    </select>
                  </>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-surface-400">
                {task.format.toUpperCase()} · {task.quality}
              </span>
            )}
          </div>

          {/* Error message */}
          {task.error && (
            <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 line-clamp-1">
              {task.error}
            </p>
          )}

          {/* Progress bar — only when downloading */}
          {isActive && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-primary-500 transition-all duration-300"
                  style={{ width: `${Math.min(task.progress.percent, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-surface-400 dark:text-surface-500 tabular-nums">
                <span>{task.progress.percent.toFixed(1)}%</span>
                <div className="flex items-center gap-3">
                  {task.progress.speed !== '—' && <span>{task.progress.speed}</span>}
                  {task.progress.eta !== '—' && <span>ETA {task.progress.eta}</span>}
                  {task.progress.downloaded !== '—' && task.progress.total !== '—' && (
                    <span>{task.progress.downloaded} / {task.progress.total}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Completed — show check + file path */}
          {task.status === 'completed' && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <svg className="w-3.5 h-3.5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span className="text-[10px] text-accent-600 dark:text-accent-400 font-medium">
                Download complete
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
