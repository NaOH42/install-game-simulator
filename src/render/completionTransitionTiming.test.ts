import { describe, expect, it } from 'vitest';
import { getTransitionFrame, getTransitionGeometry, TRANSITION_DURATION_MS, REDUCED_TRANSITION_DURATION_MS } from './completionTransitionTiming';

describe('completion transition presentation', () => {
  it('holds a complete bar before the impact and leaves one shared reveal interval', () => {
    expect(getTransitionFrame(299).impacted).toBe(false);
    expect(getTransitionFrame(300)).toMatchObject({ impacted: true, reveal: 0, finished: false });
    expect(getTransitionFrame(610).reveal).toBeCloseTo(.875);
    expect(getTransitionFrame(TRANSITION_DURATION_MS)).toMatchObject({ finished: true, reveal: 1 });
    expect(getTransitionFrame(119, true).impacted).toBe(false);
    expect(getTransitionFrame(120, true)).toMatchObject({ impacted: true, finished: false });
    expect(getTransitionFrame(REDUCED_TRANSITION_DURATION_MS, true).finished).toBe(true);
  });

  it('places the release at the visible right end, including zoomed bars extending offscreen', () => {
    const normal = getTransitionGeometry({ left: 100, top: 200, width: 400, height: 28 }, 1366, 768);
    expect(normal).toMatchObject({ originX: 500, originY: 214, fallback: false });
    const zoomed = getTransitionGeometry({ left: -120, top: 610, width: 1900, height: 42 }, 1366, 768);
    expect(zoomed).toMatchObject({ originX: 1350, originY: 631, barLeft: 16, barWidth: 1334 });
    for (const [x, y] of [[0, 0], [1366, 0], [0, 768], [1366, 768]]) {
      expect(Math.hypot(x - zoomed.originX, y - zoomed.originY)).toBeLessThan(zoomed.radius);
    }
  });

  it('keeps fallback coordinates and radii safe on mobile, stale windows, and malformed dimensions', () => {
    for (const origin of [null, { left: 2000, top: 2000, width: 100, height: 24 }, { left: NaN, top: 0, width: 100, height: 24 }]) {
      const geometry = getTransitionGeometry(origin, 360, 800);
      expect(geometry.fallback).toBe(true);
      expect(geometry.originX).toBeGreaterThan(16);
      expect(geometry.originX).toBeLessThan(344);
      expect(geometry.barTop).toBeGreaterThan(16);
      expect(geometry.barLeft + geometry.barWidth).toBeLessThan(344);
    }
    expect(Object.values(getTransitionGeometry(null, NaN, -1)).every(value => typeof value === 'boolean' || Number.isFinite(value))).toBe(true);
    expect(getTransitionFrame(NaN)).toMatchObject({ charge: 0, impacted: false, reveal: 0 });
    expect(getTransitionFrame(-1)).toMatchObject({ charge: 0, impacted: false });
  });

  it('releases from the actual transformed tip and bounds invalid or clipped endpoints', () => {
    const rotated = { left: 100, top: 200, width: 400, height: 28, tipX: 102, tipY: 214, hideBar: true };
    expect(getTransitionGeometry(rotated, 1366, 768)).toMatchObject({ originX: 102, originY: 214, fallback: false });
    expect(getTransitionGeometry({ ...rotated, tipX: -100, tipY: 600 }, 1366, 768)).toMatchObject({ originX: 100, originY: 228 });
    expect(getTransitionGeometry({ ...rotated, tipX: NaN, tipY: Infinity }, 1366, 768)).toMatchObject({ originX: 500, originY: 214 });
  });
});
