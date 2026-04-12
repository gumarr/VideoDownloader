import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { AppSettings } from '../types/ipc';

/* ── Default settings ─────────────────────────────────── */

const DEFAULT_SETTINGS: AppSettings = {
  saveMode: 'ask',
  defaultFolder: '',
  lastUsedFolder: '',
  openFolderAfterDownload: false,
  maxConcurrentDownloads: 2,
  autoUpdateYtDlp: true,
  lastUpdateCheckTimestamp: 0,
  skippedUpdateVersion: '',
  updateCheckInterval: 24,
  cookieSource: 'auto',
  cookieProfile: 'Default',
  cookieFilePath: '',
};

/* ── Settings file path ───────────────────────────────── */

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

/* ── Cached in-memory copy ────────────────────────────── */

let cachedSettings: AppSettings | null = null;

/* ── PUBLIC: Load settings from disk ──────────────────── */

export function loadSettings(): AppSettings {
  try {
    const filePath = getSettingsPath();

    if (!fs.existsSync(filePath)) {
      // First run — create default settings file
      const defaults = {
        ...DEFAULT_SETTINGS,
        defaultFolder: app.getPath('downloads'),
      };
      saveSettingsToDisk(defaults);
      cachedSettings = defaults;
      return defaults;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;

    // Merge with defaults to fill any missing keys (forward-compat)
    cachedSettings = {
      ...DEFAULT_SETTINGS,
      defaultFolder: app.getPath('downloads'),
      ...parsed,
    };

    console.log('[settingsService] Loaded settings:', cachedSettings);
    return cachedSettings;
  } catch (err: any) {
    console.error('[settingsService] Failed to load settings:', err.message);
    cachedSettings = {
      ...DEFAULT_SETTINGS,
      defaultFolder: app.getPath('downloads'),
    };
    return cachedSettings;
  }
}

/* ── PUBLIC: Get current settings (from cache) ────────── */

export function getSettings(): AppSettings {
  if (!cachedSettings) {
    return loadSettings();
  }
  return cachedSettings;
}

/* ── PUBLIC: Save full settings object ────────────────── */

export function saveSettings(settings: AppSettings): void {
  cachedSettings = { ...settings };
  saveSettingsToDisk(cachedSettings);
  console.log('[settingsService] Saved settings:', cachedSettings);
}

/* ── PUBLIC: Partial update (merge & save) ────────────── */

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...partial };
  saveSettings(updated);
  return updated;
}

/* ── Internal: write JSON to disk ─────────────────────── */

function saveSettingsToDisk(settings: AppSettings): void {
  try {
    const filePath = getSettingsPath();
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[settingsService] Failed to write settings:', err.message);
  }
}
