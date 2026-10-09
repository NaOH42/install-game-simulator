import { describe, expect, it } from 'vitest';
import {
  DESKTOP_ICON_HEIGHT,
  DESKTOP_ICON_WIDTH,
  DESKTOP_TASKBAR_HEIGHT,
  clampDesktopPosition,
  desktopPositionKey,
  desktopPositionsOverlap,
  findFreeDesktopPosition,
  getInitialDesktopPosition,
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
});
