import { isTauri } from './tauri';

// Match URLs with protocol, or www. prefix, or domain-like patterns (e.g. example.com/path)
export const URL_REGEX = /^(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)$/;

// Open Graph metadata fetch
export interface OGMetadata {
  title?: string;
  description?: string;
  image?: string;
}

/** Portable fetch that uses Tauri HTTP plugin (no CORS) or browser fetch */
async function portableFetch(url: string, options?: { signal?: AbortSignal }): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SpatialOrganiser/1.0)' },
      connectTimeout: 5000,
    }) as unknown as Response;
  }
  return fetch(url, { mode: 'cors', ...options });
}

/**
 * Fetch OG metadata using microlink.io (free, CORS-friendly metadata extraction).
 * Falls back to direct fetch for CORS-permissive sites.
 */
export async function fetchOGMetadata(url: string): Promise<OGMetadata> {
  // Try microlink.io API (free OG extraction service, CORS-friendly)
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
    const res = await portableFetch(apiUrl);
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const d = json.data;
        const result: OGMetadata = {};
        if (d.title) result.title = d.title;
        if (d.description) result.description = d.description;
        if (d.image?.url) result.image = d.image.url;
        if (result.title || result.description || result.image) return result;
      }
    }
  } catch {
    // microlink failed, try direct fetch
  }

  // Fallback: direct fetch (works in Tauri since no CORS; browser only for permissive sites)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await portableFetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const getMetaContent = (property: string): string | undefined => {
      const el = doc.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      return el?.content || undefined;
    };

    return {
      title: getMetaContent('og:title') || doc.querySelector('title')?.textContent || undefined,
      description: getMetaContent('og:description'),
      image: getMetaContent('og:image'),
    };
  } catch {
    return {};
  }
}

/**
 * Normalize a user-entered URL string so it always has a protocol.
 * "test.com" → "https://test.com"
 * "http://example.com" → "http://example.com" (unchanged)
 */
export function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return url;
  // Already has a protocol
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)) return url;
  // Starts with // (protocol-relative)
  if (url.startsWith('//')) return 'https:' + url;
  // Otherwise prepend https://
  return 'https://' + url;
}

/**
 * Get the favicon URL for a given site URL using Google's favicon service.
 */
export function getFaviconUrl(siteUrl: string, size: number = 32): string {
  try {
    const hostname = new URL(siteUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
  } catch {
    return '';
  }
}

/** Portable image fetch — used by dropzone for fetching image URLs */
export async function fetchImage(url: string): Promise<Response> {
  return portableFetch(url);
}
