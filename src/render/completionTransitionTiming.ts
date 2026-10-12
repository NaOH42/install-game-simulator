/** Presentation only: this timeline never delays the engine's completed state or reward. */
export const TRANSITION_IMPACT_MS = 300;
export const TRANSITION_REVEAL_MS = 620;
export const TRANSITION_DURATION_MS = TRANSITION_IMPACT_MS + TRANSITION_REVEAL_MS;
export const REDUCED_TRANSITION_IMPACT_MS = 120;
export const REDUCED_TRANSITION_REVEAL_MS = 160;
export const REDUCED_TRANSITION_DURATION_MS = REDUCED_TRANSITION_IMPACT_MS + REDUCED_TRANSITION_REVEAL_MS;

export type CompletionOrigin = {
  left: number; top: number; width: number; height: number;
  /** A rotated/squeezed bar can finish somewhere other than its bounding box's right edge. */
  tipX?: number; tipY?: number; hideBar?: boolean;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const completionEaseOutCubic = (value: number) => 1 - (1 - clamp(Number.isFinite(value) ? value : 0, 0, 1)) ** 3;

/** Clip a zoomed progress bar to the current viewport. Stale/offscreen rects use a safe fallback. */
export function getTransitionGeometry(origin: CompletionOrigin | null, viewportWidth: number, viewportHeight: number) {
  const width = Number.isFinite(viewportWidth) ? Math.max(1, viewportWidth) : 1;
  const height = Number.isFinite(viewportHeight) ? Math.max(1, viewportHeight) : 1;
  const insetX = Math.min(16, width / 4);
  const insetY = Math.min(16, height / 4);
  const valid = origin !== null && [origin.left, origin.top, origin.width, origin.height].every(Number.isFinite)
    && origin.width > 0 && origin.height > 0
    && origin.left < width - insetX && origin.left + origin.width > insetX
    && origin.top < height - insetY && origin.top + origin.height > insetY;
  const fallbackWidth = Math.min(480, width * .68);
  const rect = valid ? origin : {
    left: (width - fallbackWidth) / 2, top: height * .57 - 12,
    width: fallbackWidth, height: Math.min(24, height * .15),
  };
  const barLeft = clamp(rect.left, insetX, width - insetX);
  const barTop = clamp(rect.top, insetY, height - insetY);
  const barRight = clamp(rect.left + rect.width, barLeft, width - insetX);
  const barBottom = clamp(rect.top + rect.height, barTop, height - insetY);
  const originX = valid && Number.isFinite(origin.tipX) ? clamp(origin.tipX!, barLeft, barRight) : barRight;
  const originY = valid && Number.isFinite(origin.tipY) ? clamp(origin.tipY!, barTop, barBottom) : (barTop + barBottom) / 2;
  return {
    originX, originY,
    // The same radius and easing reveal the pixel scene behind the shockwave.
    radius: Math.hypot(Math.max(originX, width - originX), Math.max(originY, height - originY)) + 2,
    barLeft, barTop, barWidth: barRight - barLeft, barHeight: barBottom - barTop,
    fallback: !valid,
  };
}

export function getTransitionFrame(elapsedMs: number, reducedMotion = false) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const impactMs = reducedMotion ? REDUCED_TRANSITION_IMPACT_MS : TRANSITION_IMPACT_MS;
  const revealMs = reducedMotion ? REDUCED_TRANSITION_REVEAL_MS : TRANSITION_REVEAL_MS;
  const duration = impactMs + revealMs;
  const burstProgress = clamp((elapsed - impactMs) / revealMs, 0, 1);
  return {
    elapsed, duration, impactMs, revealMs,
    charge: clamp(elapsed / impactMs, 0, 1),
    impacted: elapsed >= impactMs,
    finished: elapsed >= duration,
    burstProgress,
    reveal: completionEaseOutCubic(burstProgress),
  };
}
