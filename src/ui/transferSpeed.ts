export const TRANSFER_BASE_SECONDS = 6.4;

/** Ease the visual speedup so the plane stays legible on upgraded hardware. */
export function transferPlaybackRate(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  const duration = Math.min(14, Math.max(1.4, TRANSFER_BASE_SECONDS / Math.sqrt(speed)));
  return TRANSFER_BASE_SECONDS / duration;
}
