import { useState, useEffect, useCallback } from 'react';

import type { AppSettings } from '../../types/ipc';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const hasElectronAPI = typeof window !== 'undefined' && !!window.api;

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>({
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
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [appVersion, setAppVersion] = useState('');

  /* Load settings on open */
  useEffect(() => {
    if (isOpen && hasElectronAPI) {
      window.api.getSettings().then((s) => {
        setSettings(s);
      });
      window.api.getAppVersion().then(v => setAppVersion(v));
    }
  }, [isOpen]);

  /* Save settings */
  const handleSave = useCallback(async () => {
    if (!hasElectronAPI) return;
    setIsSaving(true);
    setSaveMessage('');
    try {
      await window.api.saveSettings(settings);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setSaveMessage('Failed to save settings');
    }
    setIsSaving(false);
  }, [settings]);

  /* Pick default folder */
  const handlePickFolder = useCallback(async () => {
    if (!hasElectronAPI) return;
    const dir = await window.api.selectDirectory();
    if (dir) {
      setSettings((prev) => ({ ...prev, defaultFolder: dir }));
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-md
                      bg-white dark:bg-surface-900 shadow-2xl
                      border-l border-surface-200 dark:border-surface-800
                      animate-fade-in-up flex flex-col"
           style={{ animation: 'slideInRight 0.3s ease-out both' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700
                            flex items-center justify-center shadow-md shadow-primary-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-surface-900 dark:text-surface-50">Settings</h2>
          </div>
          <button
            id="settings-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-surface-400 hover:text-surface-600 dark:hover:text-surface-300
                       hover:bg-surface-100 dark:hover:bg-surface-800 transition-all cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Save Mode ────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 uppercase tracking-wider">
              Save Location
            </h3>
            <div className="space-y-2">
              {/* Ask every time */}
              <label
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200
                  ${settings.saveMode === 'ask'
                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600 shadow-sm'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'}`}
              >
                <input
                  type="radio"
                  name="saveMode"
                  value="ask"
                  checked={settings.saveMode === 'ask'}
                  onChange={() => setSettings((s) => ({ ...s, saveMode: 'ask' }))}
                  className="accent-primary-500 w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-50">Ask every time</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Choose file name and location for each download
                  </p>
                </div>
                <svg className="w-5 h-5 text-surface-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                </svg>
              </label>

              {/* Default folder */}
              <label
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200
                  ${settings.saveMode === 'default'
                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600 shadow-sm'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'}`}
              >
                <input
                  type="radio"
                  name="saveMode"
                  value="default"
                  checked={settings.saveMode === 'default'}
                  onChange={() => setSettings((s) => ({ ...s, saveMode: 'default' }))}
                  className="accent-primary-500 w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-50">Default folder</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Automatically save to a predefined directory
                  </p>
                </div>
                <svg className="w-5 h-5 text-surface-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </label>
            </div>

            {/* Folder picker — visible when saveMode === 'default' */}
            {settings.saveMode === 'default' && (
              <div className="animate-fade-in-up rounded-xl border border-surface-200 dark:border-surface-700
                              bg-surface-50 dark:bg-surface-800/50 p-3.5 space-y-2.5">
                <p className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Default Folder
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700
                                  text-sm text-surface-700 dark:text-surface-300 truncate font-mono">
                    {settings.defaultFolder || 'Not set'}
                  </div>
                  <button
                    id="pick-folder-btn"
                    onClick={handlePickFolder}
                    className="px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium
                               transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                            d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    Browse
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Post-Download ─────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 uppercase tracking-wider">
              After Download
            </h3>
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-surface-700
                              hover:border-surface-300 dark:hover:border-surface-600 cursor-pointer transition-all duration-200">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-50">Open folder after download</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Reveal downloaded file in file explorer
                  </p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.openFolderAfterDownload}
                  onChange={(e) => setSettings((s) => ({ ...s, openFolderAfterDownload: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 rounded-full transition-colors duration-300
                                bg-surface-200 dark:bg-surface-700 peer-checked:bg-primary-500
                                cursor-pointer" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md
                                transition-transform duration-300 peer-checked:translate-x-5" />
              </div>
            </label>
          </section>

          {/* ── Concurrent Downloads ────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 uppercase tracking-wider">
              Downloads
            </h3>
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-surface-700">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-50">Max concurrent downloads</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    How many downloads run at the same time
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSettings((s) => ({ ...s, maxConcurrentDownloads: n }))}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer
                      ${settings.maxConcurrentDownloads === n
                        ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
                      }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── YouTube Authentication (Cookies) ──────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 uppercase tracking-wider">
              YouTube Authentication (Cookies)
            </h3>
            
            <div className="space-y-3 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/20">
              <div>
                <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1.5">
                  Cookie Source
                </label>
                <select
                  value={settings.cookieSource}
                  onChange={(e) => setSettings(s => ({ ...s, cookieSource: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="auto">Auto (Smart Fallback)</option>
                  <option value="none">None (Public Videos Only)</option>
                  <option value="chrome">Google Chrome</option>
                  <option value="edge">Microsoft Edge</option>
                  <option value="firefox">Mozilla Firefox</option>
                  <option value="file">Custom cookies.txt File</option>
                </select>
                <p className="text-[11px] text-surface-500 mt-1.5 leading-relaxed">
                  Auto will try to dynamically find a working browser if a video restricts access to prevent bot detection.
                </p>
              </div>

              {['chrome', 'edge', 'firefox'].includes(settings.cookieSource) && (
                <div className="animate-fade-in-up">
                  <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1.5">
                    Browser Profile
                  </label>
                  <select
                    value={settings.cookieProfile}
                    onChange={(e) => setSettings(s => ({ ...s, cookieProfile: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="Default">Default</option>
                    <option value="Profile 1">Profile 1</option>
                    <option value="Profile 2">Profile 2</option>
                    <option value="Profile 3">Profile 3</option>
                  </select>
                </div>
              )}

              {settings.cookieSource === 'file' && (
                <div className="space-y-1.5 animate-fade-in-up">
                  <label className="block text-xs font-medium text-surface-500 dark:text-surface-400">
                    Cookie File Path
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={settings.cookieFilePath || 'No file selected'}
                      className="flex-1 px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs font-mono text-surface-600 dark:text-surface-300 truncate outline-none cursor-default"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const hasElectronAPI = typeof window !== 'undefined' && !!window.api;
                        if (hasElectronAPI) {
                           const path = await window.api.selectCookieFile();
                           if (path) setSettings(s => ({ ...s, cookieFilePath: path }));
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Browse
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── yt-dlp Updater ──────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 uppercase tracking-wider">
              Updates
            </h3>
            
            {/* Auto-check update toggle */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-surface-700
                              hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-surface-400 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" 
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-50">Auto-update yt-dlp</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Check GitHub for newer binaries automatically
                  </p>
                </div>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoUpdateYtDlp ?? true}
                  onChange={(e) => setSettings((s) => ({ ...s, autoUpdateYtDlp: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 rounded-full transition-colors duration-300
                                bg-surface-200 dark:bg-surface-700 peer-checked:bg-primary-500" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md
                                transition-transform duration-300 peer-checked:translate-x-5" />
              </div>
            </label>

            {/* Check Now / Reset Skip Button */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-surface-700
                              bg-surface-50/50 dark:bg-surface-800/20">
              <div className="flex-1">
                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">Manual Check</p>
                {settings.skippedUpdateVersion && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    Currently skipping v{settings.skippedUpdateVersion}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {settings.skippedUpdateVersion && (
                  <button 
                    onClick={() => setSettings(s => ({...s, skippedUpdateVersion: ''}))}
                    className="px-3 py-1.5 text-xs font-medium bg-surface-200 dark:bg-surface-700 
                               text-surface-700 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-600 
                               rounded-lg transition-colors cursor-pointer"
                  >
                    Reset Skip
                  </button>
                )}
                <button
                  onClick={async () => {
                    const hasElectronAPI = typeof window !== 'undefined' && !!window.api;
                    if (hasElectronAPI) {
                      // We can just rely on the main process emitting the event natively if we designed it that way
                      // Wait, we didn't hook a global event for manual check results if it's "up to date".
                      // We will just fetch it here and alert natively.
                      const res = await window.api.checkForUpdates(true);
                      if (!res.updateAvailable) {
                        alert(res.error ? `Update check failed: ${res.error}` : `yt-dlp is up to date (${res.currentVersion})`);
                      } else {
                        alert(`Update available: ${res.latestVersion}. Close settings to view the prompt.`);
                        // The user expects the modal to show. 
                        // To make it show, we could trigger a global event, or let the user close the settings 
                        // and App.tsx will eventually pick it up, or we force reload... 
                        // For now we just tell them to restart/close settings if we didn't implement an event bus.
                        window.location.reload(); 
                      }
                    }
                  }}
                  className="px-4 py-1.5 text-xs font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-600 
                             dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-lg 
                             transition-colors cursor-pointer border border-primary-200 dark:border-primary-800"
                >
                  Check Updates
                </button>
              </div>
            </div>
          </section>

          {/* ── Info ──────────────────────────────── */}
          {settings.lastUsedFolder && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 uppercase tracking-wider">
                Recent
              </h3>
              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50
                              border border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Last used folder</p>
                <p className="text-sm text-surface-700 dark:text-surface-300 font-mono truncate">
                  {settings.lastUsedFolder}
                </p>
              </div>
            </section>
          )}
        </div>

          {/* ── About ──────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 uppercase tracking-wider">
              About
            </h3>
            <div className="p-4 rounded-xl bg-gradient-to-br from-surface-50 to-surface-100
                            dark:from-surface-800/50 dark:to-surface-800/30
                            border border-surface-200 dark:border-surface-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">Video Downloader</p>
                  <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                    Built with Electron · React · Vite
                  </p>
                </div>
                {appVersion && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
                                   bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400
                                   border border-primary-200 dark:border-primary-800">
                    v{appVersion}
                  </span>
                )}
              </div>
            </div>
          </section>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-800 space-y-2">
          {saveMessage && (
            <p className={`text-xs font-medium text-center
              ${saveMessage.includes('success') ? 'text-accent-500' : 'text-red-500'}`}>
              {saveMessage}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                         text-surface-600 dark:text-surface-300 text-sm font-medium
                         hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="settings-save-btn"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500
                         hover:from-primary-700 hover:to-primary-600 text-white text-sm font-semibold
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer
                         shadow-lg shadow-primary-500/25"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
