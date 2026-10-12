/// <reference types="vite/client" />

/** Prefix local public assets with the deployment path; external URLs stay intact. */
export function assetUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  if (import.meta.env.VITE_COVER_FORMAT === 'webp') {
    path = path.replace(/^(\/assets\/covers\/[^/]+)\.png$/, '$1.webp');
  }
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;
}
