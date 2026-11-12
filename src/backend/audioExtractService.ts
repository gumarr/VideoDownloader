import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ensureFFmpegExists } from './ytDlpService';
import type { AudioExtractMode } from '../types/ipc';

const CODEC_EXT: Record<string, string> = {
  aac: 'm4a', alac: 'm4a', mp3: 'mp3', opus: 'opus', vorbis: 'ogg', flac: 'flac', ac3: 'ac3', eac3: 'eac3',
};

/** Container that can hold `codec` without re-encoding. Matroska audio (.mka) accepts anything. */
export function extForCodec(codec: string): string {
  return codec.startsWith('pcm_') ? 'wav' : CODEC_EXT[codec] ?? 'mka';
}

let current: ChildProcess | null = null;
let cancelRequested = false;

/** Extracted files wait here until the user picks where to save them. */
export function getTempRoot(): string {
  return path.join(app.getPath('temp'), 'VideoDownloader-audio');
}

export function clearTempRoot(): void {
  fs.rmSync(getTempRoot(), { recursive: true, force: true });
}

function toSeconds(hms: string): number {
  const [h, m, s] = hms.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function runFFmpeg(args: string[], onStdout?: (text: string) => void): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ensureFFmpegExists(), args, { windowsHide: true });
    current = proc;
    let stderr = '';
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    if (onStdout) proc.stdout.on('data', (c: Buffer) => onStdout(c.toString('utf8')));
    proc.on('error', (err) => { current = null; reject(err); });
    proc.on('close', (code) => { current = null; resolve({ code, stderr }); });
  });
}

/**
 * Extract the first audio track of `inputPath` into a temp file and return its path.
 * Call `moveToDestination` afterwards once the user has chosen where to save it.
 */
export async function extractAudio(
  inputPath: string,
  mode: AudioExtractMode,
  onProgress: (percent: number) => void,
): Promise<string> {
  if (current) throw new Error('Another extraction is already running.');
  cancelRequested = false;

  // Probe: `ffmpeg -i` with no output prints stream info to stderr (exit code 1 is expected)
  const probe = await runFFmpeg(['-hide_banner', '-i', inputPath]);
  if (cancelRequested) throw new Error('CANCELLED');
  const codec = probe.stderr.match(/Stream #[^\n]*?: Audio: (\w+)/)?.[1];
  if (!codec) throw new Error('This video has no audio track (or is not a valid media file).');
  const durMatch = probe.stderr.match(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/);
  const duration = durMatch ? toSeconds(durMatch[1]) : 0;

  const ext = mode === 'mp3' ? 'mp3' : extForCodec(codec);
  fs.mkdirSync(getTempRoot(), { recursive: true });
  const jobDir = fs.mkdtempSync(path.join(getTempRoot(), 'job-'));
  const outPath = path.join(jobDir, `${path.parse(inputPath).name}.${ext}`);

  const codecArgs = mode === 'mp3'
    ? ['-c:a', 'libmp3lame', '-b:a', '320k'] // MP3 maximum; sample rate & channels kept from source
    : ['-c:a', 'copy'];
  if (ext === 'mp3') codecArgs.push('-id3v2_version', '3'); // tags readable by Windows Explorer

  const { code, stderr } = await runFFmpeg([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', inputPath,
    '-vn', '-map', '0:a:0', '-map_metadata', '0',
    ...codecArgs,
    '-progress', 'pipe:1', '-nostats',
    outPath,
  ], (text) => {
    const m = text.match(/out_time=(\d+:\d+:\d+(?:\.\d+)?)/);
    if (m && duration > 0) onProgress(Math.min(99, (toSeconds(m[1]) / duration) * 100));
  });

  if (cancelRequested || code !== 0) {
    fs.rmSync(jobDir, { recursive: true, force: true });
    if (cancelRequested) throw new Error('CANCELLED');
    throw new Error(`FFmpeg failed (code ${code}): ${stderr.trim().split(/\r?\n/).pop() || 'unknown error'}`);
  }
  onProgress(100);
  return outPath;
}

export function cancelExtraction(): void {
  cancelRequested = true;
  current?.kill();
}

/** `dir/name.ext`, or `dir/name (n).ext` if that already exists. */
export function uniquePath(dir: string, fileName: string): string {
  const { name, ext } = path.parse(fileName);
  let candidate = path.join(dir, fileName);
  for (let n = 1; fs.existsSync(candidate); n++) candidate = path.join(dir, `${name} (${n})${ext}`);
  return candidate;
}

/** Move a temp file to its final place (works across drives) and remove its job folder. */
export function moveToDestination(tempPath: string, destPath: string): void {
  try {
    fs.renameSync(tempPath, destPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
    fs.copyFileSync(tempPath, destPath);
    fs.unlinkSync(tempPath);
  }
  fs.rmSync(path.dirname(tempPath), { recursive: true, force: true });
}

/** Only files we created in the temp root may be moved (renderer input is untrusted). */
export function isOwnTempFile(p: string): boolean {
  return path.resolve(p).toLowerCase().startsWith(getTempRoot().toLowerCase() + path.sep) && fs.existsSync(p);
}
