import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import {
  VideoMetadata,
  VideoFormat,
  DownloadOptions,
  DownloadProgress,
} from '../types/ipc';
import { getSettings } from './settingsService';

/* ── Cached Cookie Configuration ──────────────────────── */
let cachedCookieArgs: string[] = [];


/* ── Binary path resolution ───────────────────────────── */

function getBundledAssetPath(filename: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    // In development: assets/ is at the project root
    return path.join(process.cwd(), 'assets', filename);
  } else {
    // In production: extraResources puts assets/ next to app.asar
    return path.join(process.resourcesPath, 'assets', filename);
  }
}

function getUserDataBinaryPath(filename: string): string {
  // Store binaries in a standard subdirectory within userData
  const binDir = path.join(app.getPath('userData'), 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  return path.join(binDir, filename);
}

function ensureBinaryExists(filename: string): string {
  const userDataPath = getUserDataBinaryPath(filename);
  
  if (!fs.existsSync(userDataPath)) {
    const bundledPath = getBundledAssetPath(filename);
    if (!fs.existsSync(bundledPath)) {
      throw new Error(`Bundled base binary not found at: ${bundledPath}`);
    }
    
    // Copy the read-only bundled binary to the writable userData runtime path
    console.log(`[ytDlpService] Cloning ${filename} to userData for execution: ${userDataPath}`);
    fs.copyFileSync(bundledPath, userDataPath);
  }
  
  return userDataPath;
}

export function getYtDlpPath(): string {
  return getUserDataBinaryPath('yt-dlp.exe');
}

function ensureYtDlpExists(): string {
  return ensureBinaryExists('yt-dlp.exe');
}

function ensureFFmpegExists(): string {
  return ensureBinaryExists('ffmpeg.exe');
}

/* ── Helper: format seconds to MM:SS or HH:MM:SS ─────── */

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── Helper: map quality label from resolution ────────── */

function getQualityLabel(height: number | null): string {
  if (!height) return 'audio';
  if (height >= 2160) return '2160p';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720)  return '720p';
  if (height >= 480)  return '480p';
  if (height >= 360)  return '360p';
  if (height >= 240)  return '240p';
  return '144p';
}

/* ── Spawn helper: run yt-dlp and collect stdout ──────── */

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytDlpPath = ensureYtDlpExists();
    const ffmpegPath = ensureFFmpegExists();

    // Inject --ffmpeg-location so yt-dlp uses our bundled FFmpeg
    const fullArgs = ['--ffmpeg-location', path.dirname(ffmpegPath), ...args];

    console.log(`[ytDlpService] Spawning yt-dlp: ${ytDlpPath}`);
    console.log(`[ytDlpService] FFmpeg location: ${path.dirname(ffmpegPath)}`);
    console.log(`[ytDlpService] Arguments: ${fullArgs.join(' ')}`);
    
    // Force UTF-8 so JSON parsing doesn't break on Unicode characters (e.g. Vietnamese)
    const proc = spawn(ytDlpPath, fullArgs, { 
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      console.log(`[ytDlpService] Received stdout chunk (${data.length} bytes)`);
    });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      console.log(`[ytDlpService] Process exited with code ${code}`);
      if (code === 0) {
        console.log(`[ytDlpService] Total stdout: ${stdout.length} bytes`);
        resolve(stdout.trim());
      } else {
        console.error(`[ytDlpService] stderr output: ${stderr.trim()}`);
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr.trim()}`));
      }
    });

    proc.on('error', (err) => {
      console.error(`[ytDlpService] Spawn error: ${err.message}`);
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

export async function fetchVideoInfo(url: string): Promise<VideoMetadata[]> {
  console.log(`[ytDlpService] fetchVideoInfo started for URL: ${url}`);

  const settings = getSettings();
  let candidateArgs: string[][] = [];

  // Identify YouTube playlist type
  let isRealPlaylist = false;
  try {
    const parsedUrl = new URL(url);
    const listParam = parsedUrl.searchParams.get('list');
    const startRadio = parsedUrl.searchParams.has('start_radio');
    
    // Auto-generated Mixes start with 'RD'. start_radio=1 also indicates a Mix.
    // If there is no 'list', it's a single video.
    // Only treat it as a true playlist if list exists, doesn't start with RD, and no start_radio.
    if (listParam && !listParam.startsWith('RD') && !startRadio) {
      isRealPlaylist = true;
    }
  } catch (e) {
    // URL parsing failed, fallback to default behavior (single video)
  }

  const playlistArgs = isRealPlaylist 
    ? ['--flat-playlist', '--playlist-end', '150'] 
    : ['--no-playlist'];

  // 1. Cached successful arguments
  if (cachedCookieArgs.length > 0) {
    candidateArgs.push(cachedCookieArgs);
  }

  // 2. User-selected option
  if (settings.cookieSource !== 'none' && settings.cookieSource !== 'auto') {
    if (settings.cookieSource === 'file' && settings.cookieFilePath) {
      candidateArgs.push(['--cookies', settings.cookieFilePath]);
    } else {
      const profileStr = settings.cookieProfile ? `profile=${settings.cookieProfile}` : '';
      candidateArgs.push(['--cookies-from-browser', profileStr ? `${settings.cookieSource}:${profileStr}` : settings.cookieSource]);
    }
  }

  // 3. Fallbacks
  const fallbacks = [
    [], // Baseline (no cookies)
    ['--cookies-from-browser', 'chrome:profile=Default'],
    ['--cookies-from-browser', 'chrome:profile=Profile 1'],
    ['--cookies-from-browser', 'chrome:profile=Profile 2'],
    ['--cookies-from-browser', 'edge:profile=Default'],
    ['--cookies-from-browser', 'firefox']
  ];
  candidateArgs.push(...fallbacks);

  // Remove duplicate argument sets
  const uniqueCandidates: string[][] = [];
  const seenStr = new Set<string>();
  for (const args of candidateArgs) {
    const key = args.join('|');
    if (!seenStr.has(key)) {
      seenStr.add(key);
      uniqueCandidates.push(args);
    }
  }

  let lastError: any = null;

  for (let i = 0; i < uniqueCandidates.length; i++) {
    const cookieArgs = uniqueCandidates[i];
    const logLabel = cookieArgs.length ? cookieArgs.join(' ') : 'No cookies';
    console.log(`[ytDlpService] Info attempt ${i + 1}/${uniqueCandidates.length} using args: [${logLabel}]`);

    try {
      const raw = await runYtDlp([
        ...cookieArgs,
        '-J',
        ...playlistArgs,
        '--no-warnings',
        url,
      ]);

      console.log(`[ytDlpService] Raw JSON received, parsing...`);
      const data = JSON.parse(raw);

      // We succeeded! Cache this cookie config so we don't repeat the loop
      if (cookieArgs.join('|') !== cachedCookieArgs.join('|')) {
        console.log(`[ytDlpService] Caching successful cookie args for future use.`);
        cachedCookieArgs = cookieArgs;
      }

      console.log(`[ytDlpService] Parsed data root type: ${data._type}`);

      let entries = [];
      if (data._type === 'playlist' || data.entries) {
        entries = data.entries || [];
      } else {
        entries = [data]; // single video
      }

      const results: VideoMetadata[] = entries
        .filter((entry: any) => entry && entry.id && entry.title !== '[Deleted video]' && entry.title !== '[Private video]')
        .map((entry: any) => {
          // Extract relevant formats
          const formats: VideoFormat[] = (entry.formats || [])
            .filter((f: any) => f.ext !== 'mhtml')
            .map((f: any) => ({
              formatId: f.format_id || '',
              ext: f.ext || '',
              resolution: f.resolution || (f.height ? `${f.width}x${f.height}` : 'audio only'),
              qualityLabel: getQualityLabel(f.height || null),
              filesize: f.filesize || f.filesize_approx || null,
              vcodec: f.vcodec || 'none',
              acodec: f.acodec || 'none',
            }));

          return {
            id: entry.id || '',
            url: entry.url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : url),
            title: entry.title || 'Unknown Title',
            thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || '',
            duration: entry.duration || 0,
            durationFormatted: formatDuration(entry.duration || 0),
            uploader: entry.uploader || entry.channel || 'Unknown',
            formats,
          };
      });

      if (results.length === 0) {
        throw new Error("No accessible videos found in the specific URL/Playlist.");
      }

      return results;
    } catch (err: any) {
      console.warn(`[ytDlpService] Attempt ${i + 1} failed: ${err.message}`);
      lastError = err;

      // Detect if we should retry
      const msg = err.message.toLowerCase();
      const isRecoverable =
        msg.includes('bot') ||
        msg.includes('sign in') ||
        msg.includes('locked') ||
        msg.includes('403') ||
        msg.includes('429') ||
        msg.includes('http error') ||
        msg.includes('unable to extract') ||
        msg.includes('permission denied');

      if (!isRecoverable) {
        console.warn(`[ytDlpService] Non-recoverable error pattern detected, breaking retry loop.`);
        break;
      }
    }
  }

  // If we reach here, all fallbacks failed
  const errMsg = lastError?.message || 'Unknown processing error';
  let friendlyMsg = 'An unexpected error occurred while fetching video info.';
  const lowerMsg = errMsg.toLowerCase();

  // Try to parse the error message to give helpful UX
  if (lowerMsg.includes('locked')) {
    friendlyMsg = 'Your browser database is locked. Please close your browser and try again.';
  } else if (lowerMsg.includes('bot') || lowerMsg.includes('sign in') || lowerMsg.includes('403') || lowerMsg.includes('429')) {
    friendlyMsg = 'YouTube bot detection triggered or login required. Please close your browser and try again. Make sure you are logged into YouTube.';
  } else if (lowerMsg.includes('unable to extract')) {
    friendlyMsg = 'YouTube structure changed or video is restricted. Check your cookie settings.';
  } else {
    friendlyMsg = `Failed with: ${errMsg.split('\\n')[0].substring(0, 100)}...`;
  }

  // Clear cache if we failed completely, so next URL tries afresh
  cachedCookieArgs = [];
  throw new Error(friendlyMsg);
}

/* ── PUBLIC: Download video/audio ─────────────────────── */

export interface DownloadHandle {
  proc: ChildProcess;
  promise: Promise<string>;
}

/**
 * Start a download and return both the ChildProcess (for cancellation)
 * and a Promise that resolves to the output file path.
 */
export function downloadVideo(
  options: DownloadOptions,
  onProgress: (progress: DownloadProgress) => void,
): DownloadHandle {
  const ytDlpPath = ensureYtDlpExists();
  const ffmpegPath = ensureFFmpegExists();

  // Determine output directory
  const outputDir = options.outputDir || app.getPath('downloads');
  // Use custom file name if provided, otherwise default to video title
  const fileNamePart = options.customFileName
    ? `${options.customFileName}.%(ext)s`
    : '%(title)s.%(ext)s';
  const outputTemplate = path.join(outputDir, fileNamePart);

  // Pre-compute expected output path from known data (avoids yt-dlp stdout encoding issues)
  const ext = options.format === 'mp3' ? 'mp3' : 'mp4';
  const expectedFilePath = options.customFileName
    ? path.join(outputDir, `${options.customFileName}.${ext}`)
    : ''; // If no custom name, we'll have to rely on yt-dlp stdout

  // Build yt-dlp arguments
  const args: string[] = [
    '--ffmpeg-location', path.dirname(ffmpegPath),
    ...cachedCookieArgs, // Apply the successful cookie args found during fetchVideoInfo
    '--no-playlist',
    '--no-warnings',
    '--newline',       // ensures progress lines are newline-separated
    '-o', outputTemplate,
  ];

  if (options.format === 'mp3') {
    // Extract audio as MP3
    args.push(
      '-x',                       // extract audio
      '--audio-format', 'mp3',
      '--audio-quality', '0',     // best quality
    );
  } else {
    // Download video as MP4
    if (options.quality === 'best') {
      args.push(
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
      );
    } else {
      const qualityHeight = options.quality.replace('p', '');
      args.push(
        '-f', `bestvideo[height<=${qualityHeight}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${qualityHeight}][ext=mp4]/best`,
        '--merge-output-format', 'mp4',
      );
    }
  }

  args.push(options.url);

  console.log(`[ytDlpService] Spawning: ${ytDlpPath} ${args.join(' ')}`);
  console.log(`[ytDlpService] Expected output: ${expectedFilePath || '(will parse from stdout)'}`);

  // Force UTF-8 so the destination string preserves Unicode instead of ? fallback
  const proc = spawn(ytDlpPath, args, { 
    windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  const promise = new Promise<string>((resolve, reject) => {
    let lastFilePath = '';

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        // Parse progress lines robustly
        if (line.includes('[download]') && line.includes('%')) {
          const percentStr = line.match(/([\d.]+)%/)?.[1];
          const sizeStr = line.match(/of\s+(?:~\s*)?(\s*[\d.]+[a-zA-Z]+)/)?.[1] || '—';
          const speedStr = line.match(/at\s+([^\s]+)/)?.[1] || '—';
          let etaStr = line.match(/ETA\s+([^\s]+)/)?.[1] || '—';
          
          if (!line.includes('ETA')) {
             const inMatch = line.match(/in\s+([\d:]+)/);
             if (inMatch) etaStr = inMatch[1];
          }

          if (percentStr) {
            const percent = parseFloat(percentStr);
            let downloadedStr = '—';
            if (sizeStr !== '—') {
              const sizeVal = parseFloat(sizeStr);
              const sizeUnit = sizeStr.replace(/[\d.]/g, '');
              downloadedStr = `${((percent / 100) * sizeVal).toFixed(1)}${sizeUnit}`;
            }

            onProgress({
              percent,
              total: sizeStr,
              speed: speedStr,
              eta: etaStr,
              downloaded: downloadedStr,
            });
          }
        }

        // Capture destination file path (fallback for when we don't have customFileName)
        const destMatch = line.match(/(?:Destination|Merging formats into)\s*"?(.+\.\w+)"?/);
        if (destMatch) {
          lastFilePath = path.normalize(destMatch[1].replace(/"/g, '').trim());
          if (!path.isAbsolute(lastFilePath)) {
            lastFilePath = path.resolve(outputDir, lastFilePath);
          }
        }

        // Already downloaded
        if (line.includes('has already been downloaded')) {
          onProgress({ percent: 100, total: '—', speed: '—', eta: '00:00', downloaded: '—' });
        }
      }
    });

    let stderrOut = '';

    proc.stderr.on('data', (data: Buffer) => {
      stderrOut += data.toString();
      console.error(`[ytDlpService] stderr: ${data.toString()}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        // Send 100% completion
        onProgress({ percent: 100, total: '—', speed: '—', eta: '00:00', downloaded: '—' });

        // Priority: use our pre-computed path (correct Unicode) if it exists on disk,
        // then fall back to yt-dlp's parsed path, then the output directory.
        let resolvedPath = outputDir;
        if (expectedFilePath && fs.existsSync(expectedFilePath)) {
          resolvedPath = expectedFilePath;
          console.log(`[ytDlpService] Resolved via expectedFilePath: ${resolvedPath}`);
        } else if (lastFilePath && fs.existsSync(lastFilePath)) {
          resolvedPath = lastFilePath;
          console.log(`[ytDlpService] Resolved via parsed stdout: ${resolvedPath}`);
        } else {
          // Last resort: scan outputDir for recently modified files matching the extension
          try {
            const files = fs.readdirSync(outputDir)
              .filter(f => f.endsWith(`.${ext}`))
              .map(f => ({ name: f, mtime: fs.statSync(path.join(outputDir, f)).mtimeMs }))
              .sort((a, b) => b.mtime - a.mtime);
            if (files.length > 0) {
              resolvedPath = path.join(outputDir, files[0].name);
              console.log(`[ytDlpService] Resolved via directory scan: ${resolvedPath}`);
            }
          } catch (e) {
            console.error(`[ytDlpService] Directory scan failed:`, e);
          }
        }

        resolve(resolvedPath);
      } else {
        const errorMsg = stderrOut.split('\n').find(line => line.includes('ERROR:')) 
                         || stderrOut.trim().split('\n')[0] 
                         || 'Unknown error';
        reject(new Error(`yt-dlp download failed (code ${code}): ${errorMsg.trim()}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });

  return { proc, promise };
}

