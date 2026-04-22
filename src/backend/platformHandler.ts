import { SupportedPlatform } from '../types/ipc';

export interface PlatformHandler {
  platform: SupportedPlatform;
  /** Validate/sanitize url locally if possible before fetching */
  sanitizeUrl(url: string): string;
  /** Returns explicitly required format/quality defaults. */
  getDefaults(): { format: 'mp4'|'mp3', quality: string };
  /** Define custom yt-dlp extracting arguments, if needed */
  getExtractArgs(url: string): string[];
}

export const youtubeHandler: PlatformHandler = {
  platform: 'youtube',
  sanitizeUrl(url: string): string {
    // Basic YouTube sanitization, leave specific tracking removal to yt-dlp or frontend if preferred
    return url;
  },
  getDefaults() {
    return { format: 'mp4', quality: 'best' };
  },
  getExtractArgs(url: string): string[] {
    let isRealPlaylist = false;
    try {
      const parsedUrl = new URL(url);
      const listParam = parsedUrl.searchParams.get('list');
      const startRadio = parsedUrl.searchParams.has('start_radio');
      if (listParam && !listParam.startsWith('RD') && !startRadio) {
        isRealPlaylist = true;
      }
    } catch {
      // Ignored
    }
    return isRealPlaylist 
      ? ['--flat-playlist', '--playlist-end', '150'] 
      : ['--no-playlist'];
  }
};

export const soundcloudHandler: PlatformHandler = {
  platform: 'soundcloud',
  sanitizeUrl(url: string): string {
    // Strip query params from SoundCloud URLs (tracking tokens, share params)
    try {
      const parsed = new URL(url);
      // Only keep the pathname — SoundCloud doesn't need query params for resolution
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url;
    }
  },
  getDefaults() {
    return { format: 'mp3', quality: 'best' };
  },
  getExtractArgs(_url: string): string[] {
    // DO NOT use --flat-playlist for SoundCloud:
    // It strips track titles, thumbnails, and durations, causing "Untitled Track" / missing art.
    // Full -J with --playlist-end cap keeps metadata intact while preventing huge payloads.
    return ['--playlist-end', '150'];
  }
};

export const facebookHandler: PlatformHandler = {
  platform: 'facebook',

  sanitizeUrl(url: string): string {
    // fb.watch short URLs — yt-dlp resolves the redirect, pass as-is
    try {
      if (new URL(url).hostname === 'fb.watch') return url;
    } catch { /* fall through */ }

    // Params to STRIP entirely (tracking / navigation junk)
    const STRIP_PARAMS = [
      'fbclid', '__tn__', '__cft__', 'ref', 'referrer', '_rdr',
      'sfnsn', 'source', 'action_history', 'set',
    ];

    // Params to KEEP (video / content identification)
    const KEEP_PARAMS = new Set(['v', 'story_fbid', 'id']);

    try {
      const parsed = new URL(url);

      // Delete explicit strip-list params (including array-style variants like __cft__[])
      const keysToDelete: string[] = [];
      for (const key of parsed.searchParams.keys()) {
        const base = key.replace(/\[.*\]$/, ''); // strip [] suffix
        if (STRIP_PARAMS.includes(base) || base.startsWith('__cft__') || base.startsWith('__tn__')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(k => parsed.searchParams.delete(k));

      // Remove any remaining params that are NOT in the keep-list
      const remainingKeys = [...parsed.searchParams.keys()];
      remainingKeys.forEach(k => {
        if (!KEEP_PARAMS.has(k)) {
          parsed.searchParams.delete(k);
        }
      });

      // Strip trailing '?' if no params remain
      const clean = parsed.toString();
      return clean.endsWith('?') ? clean.slice(0, -1) : clean;
    } catch {
      return url;
    }
  },

  getDefaults() {
    return { format: 'mp4', quality: 'best' };
  },

  getExtractArgs(url: string): string[] {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;

      // fb.watch short URLs — single video redirect
      if (parsed.hostname === 'fb.watch') {
        return ['--no-playlist'];
      }

      // Group posts / group permalinks
      if (/^\/groups\/[^/]+\/(?:posts|permalink)\//i.test(path)) {
        return ['--no-playlist'];
      }

      // Reels
      if (/^\/reels?\//i.test(path)) {
        return ['--no-playlist'];
      }

      // Specific watch URL with v= param  OR  /videos/<numeric_id>
      if (
        (parsed.pathname === '/watch' && parsed.searchParams.has('v')) ||
        /^\/(?:[^/]+\/)?videos\/\d+/i.test(path)
      ) {
        return ['--no-playlist'];
      }

      // Profile video tab without a specific ID (e.g. /username/videos or /pg/id/videos)
      if (/\/videos\/?$/i.test(path)) {
        return ['--playlist-end', '20'];
      }
    } catch {
      // fall through to default
    }
    return ['--no-playlist'];
  },
};

export function getPlatformHandler(platform?: SupportedPlatform): PlatformHandler {
  if (platform === 'soundcloud') return soundcloudHandler;
  if (platform === 'facebook') return facebookHandler;
  return youtubeHandler; // Default fallback
}

export function detectPlatform(url: string): SupportedPlatform {
  // Normalise: add a scheme if missing so URL parsing works
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }

  try {
    const { hostname } = new URL(normalized);
    const host = hostname.toLowerCase();

    // Facebook
    if (
      host === 'facebook.com' ||
      host === 'www.facebook.com' ||
      host === 'm.facebook.com' ||
      host === 'web.facebook.com' ||
      host === 'fb.com' ||
      host === 'fb.watch'
    ) {
      return 'facebook';
    }

    // YouTube
    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'youtu.be') {
      return 'youtube';
    }

    // SoundCloud
    if (host === 'soundcloud.com' || host === 'www.soundcloud.com') {
      return 'soundcloud';
    }
  } catch {
    // fall through to default
  }

  return 'youtube'; // Default
}
