import type { SupportedPlatform } from '../../types/ipc';

/**
 * Renderer-safe platform detection — mirrors the logic in
 * src/backend/platformHandler.ts without any Electron/Node imports.
 */
export function detectPlatform(url: string): SupportedPlatform {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }

  try {
    const { hostname } = new URL(normalized);
    const host = hostname.toLowerCase();

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

    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'youtu.be') {
      return 'youtube';
    }

    if (host === 'soundcloud.com' || host === 'www.soundcloud.com') {
      return 'soundcloud';
    }
  } catch {
    // fall through
  }

  return 'youtube';
}
