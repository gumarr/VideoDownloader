import { spawn } from 'child_process';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { getYtDlpPath } from './ytDlpService';
import { getSettings, updateSettings } from './settingsService';
import { downloadManager } from './downloadManager';

const GITHUB_API_URL = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  error?: string;
}

/**
 * Run \`yt-dlp --version\`
 * e.g., output: "2024.03.10"
 */
function getCurrentVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytPath = getYtDlpPath();
    const proc = spawn(ytPath, ['--version'], { windowsHide: true });
    
    let out = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.on('close', code => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`Failed to get version, exit code ${code}`));
    });
    proc.on('error', err => reject(err));
  });
}

/**
 * Fetch latest tag from GitHub releases
 */
function getLatestRelease(): Promise<{ version: string; downloadUrl: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(GITHUB_API_URL, {
      headers: {
        'User-Agent': 'VideoDownloader-Electron-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      if (res.statusCode === 3.01 || res.statusCode === 3.02) {
        // Redirection handling if necessary, though api.github usually drops JSON directly
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GitHub API returned status ${res.statusCode}`));
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const tagPattern = json.tag_name || '';
          
          // Find the windows .exe asset
          const exeAsset = json.assets?.find((a: any) => a.name === 'yt-dlp.exe');
          if (!exeAsset) {
            return reject(new Error('yt-dlp.exe asset not found in latest release'));
          }

          resolve({
            version: tagPattern,
            downloadUrl: exeAsset.browser_download_url
          });
        } catch (e: any) {
          reject(new Error(`Failed to parse GitHub JSON: ${e.message}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
    });
  });
}

/**
 * Main check routine
 * Uses raw string comparison for the date-based tags (e.g. "2023.11.16" < "2024.03.10")
 */
export async function checkForUpdates(force = false): Promise<UpdateCheckResult> {
  const settings = getSettings();
  
  // Guard interval check unless forced
  if (!force && settings.autoUpdateYtDlp) {
    const now = Date.now();
    const msSinceLast = now - settings.lastUpdateCheckTimestamp;
    const intervalMs = (settings.updateCheckInterval || 24) * 60 * 60 * 1000;
    
    if (msSinceLast < intervalMs) {
      return { updateAvailable: false, currentVersion: '', latestVersion: '' };
    }
  }

  try {
    const currentPromise = getCurrentVersion();
    const releasePromise = getLatestRelease();

    const [currentVersion, release] = await Promise.all([currentPromise, releasePromise]);
    
    // Save timestamp
    updateSettings({ lastUpdateCheckTimestamp: Date.now() });

    console.log(`[Updater] Current: ${currentVersion}, Latest: ${release.version}`);

    // If string is strictly greater, it's a newer date format
    const updateAvailable = currentVersion < release.version;

    return {
      updateAvailable,
      currentVersion,
      latestVersion: release.version,
    };
  } catch (error: any) {
    console.error(`[Updater] Update check failed:`, error.message);
    return {
      updateAvailable: false,
      currentVersion: '',
      latestVersion: '',
      error: error.message
    };
  }
}

/**
 * Downloads the binary, locks out the manager, streams to .new, backups, overwrites
 */
export async function installUpdate(
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  let activeDownloadsHalted = false;
  const ytPath = getYtDlpPath();
  const newPath = `${ytPath}.new`;
  const bakPath = `${ytPath}.bak`;

  try {
    // 1. Fetch download url
    const release = await getLatestRelease();

    // 2. Clear processes to drop .exe handles
    downloadManager.pauseQueue();
    activeDownloadsHalted = true;

    // Give the OS a brief moment to release file handles after killing
    await new Promise(r => setTimeout(r, 500));

    // 3. Pre-cleanup any stale .new / .bak files
    if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);

    // 4. Download to .new file securely
    await new Promise<void>((resolve, reject) => {
      console.log(`[Updater] Downloading from: ${release.downloadUrl}`);

      https.get(release.downloadUrl, (res) => {
        // Handle standard 302 redirects from GitHub Assets
        if (res.statusCode === 302 && res.headers.location) {
          https.get(res.headers.location, handleResponse).on('error', reject);
        } else {
          handleResponse(res);
        }

        function handleResponse(finalRes: any) {
          if (finalRes.statusCode !== 200) {
            return reject(new Error(`Download failed with status ${finalRes.statusCode}`));
          }

          const fileStream = fs.createWriteStream(newPath);
          const totalBytes = parseInt(finalRes.headers['content-length'] || '0', 10);
          let downloaded = 0;

          finalRes.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            if (totalBytes > 0 && onProgress) {
              const percent = Math.round((downloaded / totalBytes) * 100);
              onProgress(percent);
            }
          });

          finalRes.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });

          fileStream.on('error', (err) => {
            fs.unlinkSync(newPath);
            reject(err);
          });
        }
      }).on('error', reject).setTimeout(30000, function(this: any) {
        this.destroy();
        reject(new Error("Download timed out"));
      });
    });

    // 5. Validate filesize
    const stat = fs.statSync(newPath);
    if (stat.size < 1000000) {
      throw new Error(`Downloaded file is mysteriously too small or corrupt (${stat.size} bytes). Aborting swap.`);
    }

    // 6. SWAP (with rollback protection)
    console.log('[Updater] Performing binary swap...');
    fs.renameSync(ytPath, bakPath);

    try {
      fs.renameSync(newPath, ytPath);
    } catch (swapErr: any) {
      // Rollback
      console.error('[Updater] New binary rename failed! Rolling back...', swapErr.message);
      fs.renameSync(bakPath, ytPath);
      throw new Error(`Swap failed, rolled back securely: ${swapErr.message}`);
    }

    console.log('[Updater] Update installed successfully.');
    
    // Resume tasks if it all works out!
    downloadManager.resumeQueue();
    return { success: true };

  } catch (err: any) {
    console.error(`[Updater] Installation failed:`, err.message);
    
    // Ensure we un-pause the queue on failure
    if (activeDownloadsHalted) {
      downloadManager.resumeQueue();
    }
    
    // Cleanup dangling temp file if error happened mid-download
    if (fs.existsSync(newPath)) {
      try { fs.unlinkSync(newPath); } catch {}
    }

    return { success: false, error: err.message };
  }
}
