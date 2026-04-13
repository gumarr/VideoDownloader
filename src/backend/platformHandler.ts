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

export function getPlatformHandler(platform?: SupportedPlatform): PlatformHandler {
  if (platform === 'soundcloud') return soundcloudHandler;
  return youtubeHandler; // Default fallback
}
