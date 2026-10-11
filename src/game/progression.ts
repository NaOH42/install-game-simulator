import { GAMES } from './catalog';
import type { SaveGame } from './types';

/** Catalog order is stable; each milestone reveals the next batch permanently. */
export const STORE_UNLOCK_STAGES = [
  { required: 0, total: 2 },
  { required: 1, total: 4 },
  { required: 3, total: 8 },
  { required: 6, total: 12 },
  { required: 10, total: 16 },
  { required: 14, total: 20 },
  { required: 18, total: 24 },
  { required: 22, total: 28 },
  { required: 26, total: 32 },
] as const;

const catalogIndex = new Map(GAMES.map((game, index) => [game.id, index]));

function collectedCount(state: SaveGame): number {
  return new Set(state.collected.filter(id => catalogIndex.has(id))).size;
}

export function gameUnlockRequirement(gameId: string): number {
  const index = catalogIndex.get(gameId);
  return index === undefined ? Infinity : STORE_UNLOCK_STAGES.find(stage => index < stage.total)?.required ?? Infinity;
}

function hasExistingAccess(state: SaveGame, gameId: string): boolean {
  // A valid queued game is already owned. An unowned queue entry must not reveal a game.
  return state.owned.includes(gameId) || state.installed.includes(gameId)
    || state.collected.includes(gameId) || state.jobs.some(job => job.gameId === gameId);
}

export function isGameUnlocked(state: SaveGame, gameId: string): boolean {
  return catalogIndex.has(gameId)
    && (hasExistingAccess(state, gameId) || collectedCount(state) >= gameUnlockRequirement(gameId));
}

export interface StoreProgress {
  collectedCount: number;
  unlockedCount: number;
  next: { required: number; count: number; remaining: number } | null;
}

export function getStoreProgress(state: SaveGame): StoreProgress {
  const collected = collectedCount(state);
  const unlocked = new Set(GAMES.filter(game => isGameUnlocked(state, game.id)).map(game => game.id));
  for (const stage of STORE_UNLOCK_STAGES) {
    if (stage.required <= collected) continue;
    const count = GAMES.slice(0, stage.total).filter(game => !unlocked.has(game.id)).length;
    if (count > 0) {
      return { collectedCount: collected, unlockedCount: unlocked.size,
        next: { required: stage.required, count, remaining: stage.required - collected } };
    }
  }
  return { collectedCount: collected, unlockedCount: unlocked.size, next: null };
}
