export interface DesktopPosition { x: number; y: number; }
export interface DesktopViewport { width: number; height: number; }
export interface DesktopPositionStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DESKTOP_ICON_WIDTH = 84;
export const DESKTOP_ICON_HEIGHT = 94;
export const DESKTOP_TASKBAR_HEIGHT = 39;
export const DESKTOP_POSITION_PREFIX = 'install-simulator.desktop-icon.v1.';
const EDGE = 8;
const FIRST_X = 13;
const FIRST_Y = 23;
const COLUMN_STEP = DESKTOP_ICON_WIDTH + 12;
const ROW_STEP = DESKTOP_ICON_HEIGHT + 10;
const sessionPositions = new Map<string, DesktopPosition>();

export function desktopPositionKey(id: string) { return `${DESKTOP_POSITION_PREFIX}${encodeURIComponent(id)}`; }

export function currentDesktopViewport(): DesktopViewport {
  return typeof window === 'undefined' ? { width: 1366, height: 768 } : { width: window.innerWidth, height: window.innerHeight };
}

function browserStorage(): DesktopPositionStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

export function parseDesktopPosition(raw: string | null): DesktopPosition | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (value.version !== 1 || typeof value.x !== 'number' || typeof value.y !== 'number' || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
    return { x: value.x, y: value.y };
  } catch { return null; }
}

export function clampDesktopPosition(point: DesktopPosition, viewport: DesktopViewport): DesktopPosition {
  const maxX = Math.max(EDGE, viewport.width - DESKTOP_ICON_WIDTH - EDGE);
  const maxY = Math.max(EDGE, viewport.height - DESKTOP_TASKBAR_HEIGHT - DESKTOP_ICON_HEIGHT - EDGE);
  return {
    x: Math.min(maxX, Math.max(EDGE, Number.isFinite(point.x) ? point.x : FIRST_X)),
    y: Math.min(maxY, Math.max(EDGE, Number.isFinite(point.y) ? point.y : FIRST_Y)),
  };
}

export function desktopPositionsOverlap(a: DesktopPosition, b: DesktopPosition) {
  return a.x < b.x + DESKTOP_ICON_WIDTH + 3 && a.x + DESKTOP_ICON_WIDTH + 3 > b.x
    && a.y < b.y + DESKTOP_ICON_HEIGHT + 3 && a.y + DESKTOP_ICON_HEIGHT + 3 > b.y;
}

/** Default placement uses columns, but saved and dragged coordinates stay unsnapped. */
export function findFreeDesktopPosition(index: number, occupied: DesktopPosition[], viewport: DesktopViewport): DesktopPosition {
  const rows = Math.max(1, Math.floor((viewport.height - DESKTOP_TASKBAR_HEIGHT - EDGE - FIRST_Y + 10) / ROW_STEP));
  const columns = Math.max(1, Math.floor((viewport.width - EDGE - FIRST_X + 12) / COLUMN_STEP));
  const total = rows * columns;
  const start = Math.max(0, Math.floor(index)) % total;
  for (let offset = 0; offset < total; offset++) {
    const slot = (start + offset) % total;
    const candidate = clampDesktopPosition({ x: FIRST_X + Math.floor(slot / rows) * COLUMN_STEP, y: FIRST_Y + (slot % rows) * ROW_STEP }, viewport);
    if (!occupied.some(point => desktopPositionsOverlap(point, candidate))) return candidate;
  }
  // A saved freeform position can straddle several default slots. Check finer
  // placements before falling back when an unusually small viewport is full.
  const maxX = Math.max(EDGE, viewport.width - DESKTOP_ICON_WIDTH - EDGE);
  const maxY = Math.max(EDGE, viewport.height - DESKTOP_TASKBAR_HEIGHT - DESKTOP_ICON_HEIGHT - EDGE);
  for (let x = EDGE; x <= maxX; x += 12) {
    for (let y = EDGE; y <= maxY; y += 12) {
      const candidate = { x, y };
      if (!occupied.some(point => desktopPositionsOverlap(point, candidate))) return candidate;
    }
  }
  return clampDesktopPosition({ x: FIRST_X + Math.floor(start / rows) * COLUMN_STEP, y: FIRST_Y + (start % rows) * ROW_STEP }, viewport);
}

function readStoredPositions(storage: DesktopPositionStorage | null): Map<string, DesktopPosition> {
  const positions = new Map<string, DesktopPosition>();
  if (!storage) return positions;
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(DESKTOP_POSITION_PREFIX)) continue;
      const position = parseDesktopPosition(storage.getItem(key));
      if (!position) continue;
      try { positions.set(decodeURIComponent(key.slice(DESKTOP_POSITION_PREFIX.length)), position); } catch { /* An unrelated malformed key does not affect valid icons. */ }
    }
  } catch { /* Private browsing or storage denial leaves in-memory placement usable. */ }
  return positions;
}

export function getInitialDesktopPosition(id: string, index: number, viewport = currentDesktopViewport(), storage = browserStorage()): DesktopPosition {
  const stored = readStoredPositions(storage);
  const existing = stored.get(id) || sessionPositions.get(id);
  if (existing) {
    const bounded = clampDesktopPosition(existing, viewport);
    sessionPositions.set(id, bounded);
    return bounded;
  }
  const occupied = new Map([...stored, ...sessionPositions]);
  occupied.delete(id);
  const position = findFreeDesktopPosition(index, [...occupied.values()].map(point => clampDesktopPosition(point, viewport)), viewport);
  // Reserve synchronously so sibling components mounting in the same React
  // render cannot choose the same free position before their effects run.
  sessionPositions.set(id, position);
  return position;
}

export function saveDesktopPosition(id: string, position: DesktopPosition, storage = browserStorage()): void {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
  sessionPositions.set(id, { ...position });
  try { storage?.setItem(desktopPositionKey(id), JSON.stringify({ version: 1, x: position.x, y: position.y })); }
  catch { /* Layout persistence is optional and never blocks a desktop action. */ }
}
