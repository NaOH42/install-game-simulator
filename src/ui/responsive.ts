import { useSyncExternalStore } from 'react';

export const COMPACT_LAYOUT_QUERY = '(max-width: 760px), (max-width: 960px) and (max-height: 500px)';

export function isCompactViewport(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height)
    && (width <= 760 || (width <= 960 && height <= 500));
}

function getCompactSnapshot(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(COMPACT_LAYOUT_QUERY).matches;
}

function subscribeToCompactLayout(onChange: () => void): () => void {
  const media = window.matchMedia(COMPACT_LAYOUT_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function useCompactLayout(): boolean {
  return useSyncExternalStore(subscribeToCompactLayout, getCompactSnapshot, () => false);
}
