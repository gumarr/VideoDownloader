import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { DownloadTask, DownloadOptions, DownloadProgress, DownloadTaskProgress } from '../types/ipc';
import { downloadVideo } from './ytDlpService';
import { getSettings } from './settingsService';

/**
 * DownloadManager — owns the download queue and concurrency.
 *
 * Events:
 *   'queue-update'   → (tasks: DownloadTask[])          full snapshot
 *   'task-progress'  → (progress: DownloadTaskProgress)  per-task progress
 */
class DownloadManager extends EventEmitter {
  private tasks = new Map<string, DownloadTask>();
  private processes = new Map<string, ChildProcess>();
  private queue: string[] = [];           // ordered task IDs waiting to run
  private activeIds = new Set<string>();  // currently-downloading task IDs
  private isPaused = false;               // lock for updater API

  /* ── Queue helpers ──────────────────────────────────── */

  private get maxConcurrent(): number {
    const settings = getSettings();
    return settings.maxConcurrentDownloads || 2;
  }

  private getQueueFilePath(): string {
    return path.join(app.getPath('userData'), 'queue.json');
  }

  /* ── Initialization & Persistence ───────────────────── */

  init() {
    try {
      const filePath = this.getQueueFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const savedTasks = JSON.parse(raw) as DownloadTask[];
        
        for (const task of savedTasks) {
          // If app closed while downloading, reset to queued
          if (task.status === 'downloading') {
            task.status = 'queued';
            task.progress = { percent: 0, downloaded: '—', total: '—', speed: '—', eta: '—' };
          }
          
          this.tasks.set(task.id, task);
          if (task.status === 'queued') {
            this.queue.push(task.id);
          }
        }
        console.log(`[DownloadManager] Restored ${this.tasks.size} tasks from disk`);
        this.emitUpdate();
        this.processQueue();
      }
    } catch (err: any) {
      console.error(`[DownloadManager] Failed to load queue:`, err.message);
    }
  }

  private saveQueueToDisk() {
    try {
      const filePath = this.getQueueFilePath();
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(this.getSnapshot(), null, 2), 'utf-8');
    } catch (err: any) {
      console.error(`[DownloadManager] Failed to save queue to disk:`, err.message);
    }
  }

  private emitUpdate() {
    this.saveQueueToDisk();
    this.emit('queue-update', this.getSnapshot());
  }

  /** Return all tasks as a sorted array (newest first) */
  getSnapshot(): DownloadTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.addedAt - a.addedAt);
  }

  /* ── Public API ─────────────────────────────────────── */

  addTasks(tasks: {
    url: string;
    title: string;
    thumbnail: string;
  }[]): string[] {
    const ids: string[] = [];
    
    for (const t of tasks) {
      const id = randomUUID();
      const task: DownloadTask = {
        id,
        url: t.url,
        title: t.title || 'Untitled',
        thumbnail: t.thumbnail || '',
        format: 'mp4',
        quality: 'best',
        status: 'pending',
        progress: { percent: 0, downloaded: '—', total: '—', speed: '—', eta: '—' },
        addedAt: Date.now(),
      };
      
      this.tasks.set(id, task);
      ids.push(id);
      console.log(`[DownloadManager] Pending task added: ${id} — "${task.title}"`);
    }

    this.emitUpdate();
    return ids;
  }

  updateTask(id: string, format: 'mp4' | 'mp3', quality: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    
    // Can only update if not downloading/completed
    if (task.status === 'downloading' || task.status === 'completed') return false;

    task.format = format;
    task.quality = quality;
    
    this.emitUpdate();
    return true;
  }

  startTask(id: string, outputDir?: string): boolean {
    const task = this.tasks.get(id);
    // Can only start a pending, cancelled, or failed task
    if (!task || (task.status !== 'pending' && task.status !== 'cancelled' && task.status !== 'failed')) {
      return false;
    }

    if (!task.format || !task.quality) {
       console.error(`[DownloadManager] Cannot start task ${id} without format/quality`);
       return false;
    }

    if (outputDir) {
      task.outputDir = outputDir;
    }

    if (!task.format || !task.quality) {
       console.error(`[DownloadManager] Cannot start task ${id} without format/quality`);
       return false;
    }

    // Reset progress
    task.progress = { percent: 0, downloaded: '—', total: '—', speed: '—', eta: '—' };
    task.error = undefined;
    task.filePath = undefined;
    task.status = 'queued';
    
    this.queue.push(id);
    console.log(`[DownloadManager] Task queued for download: ${id} — "${task.title}"`);
    
    this.emitUpdate();
    this.processQueue();
    return true;
  }

  addTask(opts: {
    url: string;
    title: string;
    thumbnail: string;
    format: 'mp4' | 'mp3';
    quality: string;
    outputDir?: string;
    customFileName?: string;
  }): string {
    const id = randomUUID();
    const task: DownloadTask = {
      id,
      url: opts.url,
      title: opts.title || 'Untitled',
      thumbnail: opts.thumbnail || '',
      format: opts.format,
      quality: opts.quality,
      outputDir: opts.outputDir,
      customFileName: opts.customFileName,
      status: 'queued',
      progress: { percent: 0, downloaded: '—', total: '—', speed: '—', eta: '—' },
      addedAt: Date.now(),
    };

    this.tasks.set(id, task);
    this.queue.push(id);
    console.log(`[DownloadManager] Task added: ${id} — "${task.title}"`);

    this.emitUpdate();
    this.processQueue();
    return id;
  }

  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    if (task.status === 'pending') {
      task.status = 'cancelled';
    } else if (task.status === 'queued') {
      // Remove from pending queue
      this.queue = this.queue.filter(qId => qId !== id);
      task.status = 'cancelled';
      console.log(`[DownloadManager] Queued task cancelled: ${id}`);
    } else if (task.status === 'downloading') {
      // Kill the process
      const proc = this.processes.get(id);
      if (proc) {
        console.log(`[DownloadManager] Killing active download: ${id}`);
        proc.kill('SIGINT');
        this.processes.delete(id);
      }
      this.activeIds.delete(id);
      task.status = 'cancelled';
      // processQueue will be triggered when the close event fires
      this.processQueue();
    } else {
      return false; // already completed/failed/cancelled
    }

    this.emitUpdate();
    return true;
  }

  removeTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    // Can only remove non-active tasks
    if (task.status === 'downloading') {
      this.cancelTask(id);
    }
    if (task.status === 'queued') {
      this.queue = this.queue.filter(qId => qId !== id);
    }
    // 'pending' doesn't exist in this.queue, so no need to filter it.

    this.tasks.delete(id);
    this.processes.delete(id);
    console.log(`[DownloadManager] Task removed: ${id}`);
    this.emitUpdate();
    return true;
  }

  retryTask(id: string): boolean {
    return this.startTask(id);
  }

  clearCompleted(): number {
    let removed = 0;
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        this.tasks.delete(id);
        removed++;
      }
    }
    console.log(`[DownloadManager] Cleared ${removed} completed/failed/cancelled tasks`);
    this.emitUpdate();
    return removed;
  }

  clearAllTasks(): number {
    let count = 0;
    const allIds = Array.from(this.tasks.keys());
    for (const id of allIds) {
      if (this.tasks.get(id)?.status === 'downloading') {
         this.cancelTask(id);
      }
      this.tasks.delete(id);
      count++;
    }
    this.queue = [];
    this.activeIds.clear();
    this.processes.clear();
    console.log(`[DownloadManager] Cleared ALL ${count} tasks`);
    this.emitUpdate();
    return count;
  }

  /* ── Queue processing engine ────────────────────────── */

  /** Intercepts queue to clear the way for binary updates */
  pauseQueue() {
    this.isPaused = true;
    console.log(`[DownloadManager] Pausing queue and halting ${this.activeIds.size} active tasks...`);
    
    // Kill processes so Windows releases the yt-dlp.exe file lock
    for (const taskId of this.activeIds) {
      const proc = this.processes.get(taskId);
      if (proc) proc.kill('SIGINT');
      
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'queued'; // Reschedule for later
        task.progress = { percent: 0, downloaded: '—', total: '—', speed: '—', eta: '—' };
        // Put back at front of queue
        this.queue.unshift(taskId);
      }
    }
    this.processes.clear();
    this.activeIds.clear();
    this.emitUpdate();
  }

  resumeQueue() {
    this.isPaused = false;
    console.log(`[DownloadManager] Resuming queue...`);
    this.processQueue();
  }

  private processQueue() {
    if (this.isPaused) return;

    while (this.activeIds.size < this.maxConcurrent && this.queue.length > 0) {
      const nextId = this.queue.shift()!;
      const task = this.tasks.get(nextId);
      if (!task || task.status !== 'queued') continue;

      this.startDownload(nextId);
    }
  }

  private startDownload(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'downloading';
    this.activeIds.add(taskId);
    this.emitUpdate();

    console.log(`[DownloadManager] Starting download: ${taskId} — "${task.title}"`);
    console.log(`[DownloadManager] Active: ${this.activeIds.size}/${this.maxConcurrent}, Queued: ${this.queue.length}`);

    // If no output dir, get from settings
    let finalOutputDir = task.outputDir;
    if (!finalOutputDir) {
      const settings = getSettings();
      // If we didn't pass outputDir (e.g. Download All clicked) or saveMode=default
      if (settings.defaultFolder) {
         finalOutputDir = settings.defaultFolder;
      } else {
         finalOutputDir = app.getPath('downloads'); // Fallback 
      }
    }

    const options: DownloadOptions = {
      url: task.url,
      format: task.format as 'mp4' | 'mp3',
      quality: task.quality,
      outputDir: finalOutputDir,
      customFileName: task.customFileName,
    };

    const { proc, promise } = downloadVideo(options, (progress: DownloadProgress) => {
      // Update task progress
      task.progress = progress;

      // Emit per-task progress event
      const taskProgress: DownloadTaskProgress = {
        ...progress,
        taskId,
      };
      this.emit('task-progress', taskProgress);
    });

    this.processes.set(taskId, proc);

    promise
      .then((filePath) => {
        task.status = 'completed';
        task.filePath = filePath;
        task.progress = { percent: 100, downloaded: '—', total: '—', speed: '—', eta: '00:00' };
        console.log(`[DownloadManager] Download completed: ${taskId} → ${filePath}`);
      })
      .catch((err: Error) => {
        // Don't mark as failed if it was already cancelled
        if (task.status !== 'cancelled') {
          task.status = 'failed';
          task.error = err.message;
          console.error(`[DownloadManager] Download failed: ${taskId} — ${err.message}`);
        }
      })
      .finally(() => {
        this.activeIds.delete(taskId);
        this.processes.delete(taskId);
        this.emitUpdate();
        this.processQueue(); // Start next queued item
      });
  }
}

// Singleton instance
export const downloadManager = new DownloadManager();
