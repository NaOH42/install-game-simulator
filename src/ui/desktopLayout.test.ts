import { describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_ICON_HEIGHT,
  DESKTOP_ICON_WIDTH,
  DESKTOP_TASKBAR_HEIGHT,
  clampDesktopPosition,
  desktopPositionKey,
  desktopPositionsOverlap,
  findFreeDesktopPosition,
  fitDesktopPosition,
  getInitialDesktopPosition,
  isUsableDesktopViewport,
  parseDesktopPosition,
  saveDesktopPosition,
  type DesktopPosition,
  type DesktopPositionStorage,
} from './desktopLayout';

class MemoryStorage implements DesktopPositionStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] || null; }
  getItem(key: string) { return this.values.get(key) || null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('freeform desktop positions', () => {
  it('places all four system icons and 24 games without overlap at both desktop sizes', () => {
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
      const positions: DesktopPosition[] = [];
      for (let index = 0; index < 28; index++) {
        const point = findFreeDesktopPosition(index, positions, viewport);
        expect(positions.some(other => desktopPositionsOverlap(point, other))).toBe(false);
        expect(point.x + DESKTOP_ICON_WIDTH).toBeLessThan(viewport.width);
        expect(point.y + DESKTOP_ICON_HEIGHT).toBeLessThan(viewport.height - DESKTOP_TASKBAR_HEIGHT);
        positions.push(point);
      }
      expect(new Set(positions.map(point => point.x)).size).toBeGreaterThan(1);
    }
  });

  it('skips manually saved icon footprints when placing a new one', () => {
    const viewport = { width: 1366, height: 768 };
    const occupied = [{ x: 35, y: 38 }, { x: 125, y: 130 }];
    const position = findFreeDesktopPosition(0, occupied, viewport);
    expect(occupied.some(point => desktopPositionsOverlap(point, position))).toBe(false);
  });

  it('preserves unsnapped pixel positions across restoring and separate id writes', () => {
    const storage = new MemoryStorage();
    saveDesktopPosition('test:icon-a', { x: 287.5, y: 149 }, storage);
    saveDesktopPosition('test:icon-b', { x: 451, y: 265.25 }, storage);
    expect(getInitialDesktopPosition('test:icon-a', 0, { width: 1366, height: 768 }, storage)).toEqual({ x: 287.5, y: 149 });
    expect(parseDesktopPosition(storage.getItem(desktopPositionKey('test:icon-b')))).toEqual({ x: 451, y: 265.25 });
    expect(storage.length).toBe(2);
  });

  it('rejects malformed records and clamps offscreen coordinates above the taskbar', () => {
    for (const raw of [null, '{bad', 'null', '{"version":1,"x":"80","y":40}', '{"version":2,"x":80,"y":40}']) {
      expect(parseDesktopPosition(raw)).toBeNull();
    }
    expect(clampDesktopPosition({ x: -200, y: 5000 }, { width: 1366, height: 768 })).toEqual({ x: 8, y: 627 });
  });

  it('continues in memory when browser storage is denied', () => {
    const unavailable: DesktopPositionStorage = { get length(): number { throw new Error('denied'); }, key() { throw new Error('denied'); }, getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(() => saveDesktopPosition('test:denied', { x: 220, y: 180 }, unavailable)).not.toThrow();
    expect(getInitialDesktopPosition('test:denied', 0, { width: 1366, height: 768 }, unavailable)).toEqual({ x: 220, y: 180 });
  });

  it('never overwrites a valid saved position during zero, tiny, or invalid resize events', () => {
    const storage = new MemoryStorage();
    const id = 'test:invalid-resize';
    const position = { x: 287.5, y: 149 };
    saveDesktopPosition(id, position, storage);
    const saved = storage.getItem(desktopPositionKey(id));
    for (const viewport of [{ width: 0, height: 0 }, { width: 50, height: 80 }, { width: 100, height: 149 }, { width: NaN, height: 768 }, { width: 1366, height: Infinity }]) {
      expect(isUsableDesktopViewport(viewport)).toBe(false);
      expect(fitDesktopPosition(id, position, viewport, storage)).toBeNull();
      expect(storage.getItem(desktopPositionKey(id))).toBe(saved);
    }
  });

  it('still clamps a real resize but ignores a subsequent collapsing viewport', () => {
    const storage = new MemoryStorage();
    const id = 'test:valid-then-hidden';
    const next = fitDesktopPosition(id, { x: 1200, y: 620 }, { width: 960, height: 640 }, storage);
    expect(next).toEqual({ x: 868, y: 499 });
    expect(fitDesktopPosition(id, next!, { width: 0, height: 0 }, storage)).toBeNull();
    expect(parseDesktopPosition(storage.getItem(desktopPositionKey(id)))).toEqual(next);
  });

  it('initializes with the last valid viewport when the surface temporarily has no size', () => {
    const storage = new MemoryStorage();
    const id = 'test:last-valid-viewport';
    const position = { x: 1550, y: 700 };
    saveDesktopPosition(id, position, storage);
    expect(getInitialDesktopPosition(id, 0, { width: 1920, height: 1080 }, storage)).toEqual(position);
    expect(getInitialDesktopPosition(id, 0, { width: 0, height: 0 }, storage)).toEqual(position);
  });

  it('uses 1366 by 768 at startup when no valid viewport has ever been observed', async () => {
    vi.resetModules();
    const freshLayout = await import('./desktopLayout');
    const storage = new MemoryStorage();
    const id = 'test:first-hidden-frame';
    freshLayout.saveDesktopPosition(id, { x: 1300, y: 700 }, storage);
    expect(freshLayout.getInitialDesktopPosition(id, 0, { width: 0, height: 0 }, storage)).toEqual({ x: 1274, y: 627 });
  });
});
