import { describe, expect, it } from 'vitest';
import { GAMES } from './catalog';
import { createInitialState, dispatch, tick } from './engine';
import { getStoreProgress, gameUnlockRequirement, isGameUnlocked, STORE_UNLOCK_STAGES } from './progression';
import type { Action, InstallJob, SaveGame } from './types';

const ids = GAMES.map(game => game.id);
const act = (state: SaveGame, action: Action) => {
  const result = dispatch(state, action);
  expect(result.error).toBeUndefined();
  return result.state;
};
const storeEvents = (state: SaveGame) => state.events.filter(event => event.text.startsWith('商店上新：'));
const jobFor = (gameId: string): InstallJob => ({ id: `legacy-${gameId}`, gameId, stage: 'download', stageProgress: 0, progress: 0, elapsed: 0 });

describe('store discovery', () => {
  it('reveals exactly the first two games at the start, both affordable on the initial machine', () => {
    const state = createInitialState();
    expect(GAMES.filter(game => isGameUnlocked(state, game.id)).map(game => game.id)).toEqual(ids.slice(0, 2));
    expect(getStoreProgress(state)).toEqual({ collectedCount: 0, unlockedCount: 2, next: { required: 1, count: 2, remaining: 1 } });
    expect(dispatch(state, { type: 'install', gameId: ids[0] }).error).toBeUndefined();
    const bought = act(state, { type: 'buy', gameId: ids[1] });
    expect(dispatch(bought, { type: 'install', gameId: ids[1] }).error).toBeUndefined();
  });

  it('makes every milestone reachable from earlier revealed games and eventually reveals all 32', () => {
    let priorTotal = 0;
    for (const stage of STORE_UNLOCK_STAGES) {
      expect(stage.required).toBeLessThanOrEqual(priorTotal);
      const state = { ...createInitialState(), collected: ids.slice(0, stage.required) };
      expect(getStoreProgress(state).unlockedCount).toBe(stage.total);
      expect(GAMES.slice(0, stage.total).every(game => isGameUnlocked(state, game.id))).toBe(true);
      expect(GAMES.slice(stage.total).every(game => !isGameUnlocked(state, game.id))).toBe(true);
      for (const id of ids.slice(priorTotal, stage.total)) expect(gameUnlockRequirement(id)).toBe(stage.required);
      priorTotal = stage.total;
    }
    expect(getStoreProgress({ ...createInitialState(), collected: ids.slice(0, 26) }).next).toBeNull();
  });

  it('only counts distinct known first installations, never installation totals or unknown IDs', () => {
    const state = { ...createInitialState(), collected: [ids[0], ids[0], 'missing-game', 'toString'], installedCount: 100 };
    expect(getStoreProgress(state)).toEqual({ collectedCount: 1, unlockedCount: 4, next: { required: 3, count: 4, remaining: 2 } });
    for (const id of ['missing-game', 'toString']) {
      state.owned.push(id);
      state.installed.push(id);
      state.jobs.push(jobFor(id));
      expect(isGameUnlocked(state, id)).toBe(false);
      expect(gameUnlockRequirement(id)).toBe(Infinity);
    }
  });

  it('keeps existing legitimate library and pending games available without allowing an unowned queue bypass', () => {
    const legacyId = ids[31];
    for (const field of ['owned', 'installed', 'collected'] as const) {
      const state = createInitialState();
      state[field].push(legacyId);
      expect(isGameUnlocked(state, legacyId)).toBe(true);
    }
    const pending = createInitialState();
    pending.jobs.push(jobFor(legacyId));
    expect(isGameUnlocked(pending, legacyId)).toBe(true);
    const queued = createInitialState();
    queued.queue.push(legacyId);
    expect(isGameUnlocked(queued, legacyId)).toBe(false);
    queued.owned.push(legacyId);
    expect(isGameUnlocked(queued, legacyId)).toBe(true);
    const installable = { ...createInitialState(), owned: [...ids], points: 1e5, hardware: { cpu: 0, ram: 0, disk: 4, gpu: 0, network: 0 } };
    expect(dispatch(installable, { type: 'install', gameId: legacyId }).error).toBeUndefined();
    expect(dispatch(installable, { type: 'queue', gameId: legacyId }).error).toBeUndefined();
  });

  it('reports only genuinely new titles at the next milestone, including legacy ownership', () => {
    let state = createInitialState();
    state.owned.push(ids[2]);
    expect(getStoreProgress(state).next).toEqual({ required: 1, count: 1, remaining: 1 });
    state.owned.push(ids[3]);
    expect(getStoreProgress(state).next).toEqual({ required: 3, count: 4, remaining: 3 });
    state = tick(act(state, { type: 'install', gameId: ids[0] }), 1000);
    expect(storeEvents(state)).toEqual([]);
    expect(getStoreProgress(state).next).toEqual({ required: 3, count: 4, remaining: 2 });
  });

  it('rejects a hidden purchase before charging or revealing its title, even with ample funds', () => {
    const state = { ...createInitialState(), points: 1e6 };
    const before = JSON.stringify(state);
    const result = dispatch(state, { type: 'buy', gameId: ids[2] });
    expect(result.error).toContain('尚未解锁');
    expect(result.error).not.toContain(GAMES[2].title);
    expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(dispatch(state, { type: 'queue', gameId: ids[2] }).error).toContain('先购买');
    expect(dispatch(state, { type: 'install', gameId: ids[2] }).error).toContain('先购买');
  });

  it('keeps discovery after uninstall/reinstall without repeat rewards or another discovery event', () => {
    let state = tick(act(createInitialState(), { type: 'install', gameId: ids[0] }), 1000);
    expect(storeEvents(state)).toEqual([expect.objectContaining({ kind: 'success', text: '商店上新：新解锁 2 款游戏，快去看看。' })]);
    const discovered = getStoreProgress(state);
    const earned = state.earned;
    state = act(state, { type: 'uninstall', gameId: ids[0] });
    expect(getStoreProgress(state)).toEqual(discovered);
    state = tick(act(state, { type: 'install', gameId: ids[0] }), 1000);
    expect(getStoreProgress(state)).toEqual(discovered);
    expect(storeEvents(state)).toHaveLength(1);
    expect(state.installedCount).toBe(2);
    expect(state.earned).toBe(earned);
  });

  it('handles several first completions in one background advance exactly like foreground ticks', () => {
    const state = { ...createInitialState(), owned: ids.slice(0, 3), queue: ids.slice(0, 3), automation: true, autoEnabled: true };
    const background = tick(state, 1000);
    let foreground = state;
    for (let index = 0; index < 1000; index++) foreground = tick(foreground, 1);
    expect(background.collected).toEqual(ids.slice(0, 3));
    expect(getStoreProgress(background)).toEqual(getStoreProgress(foreground));
    expect(storeEvents(background)).toEqual(storeEvents(foreground));
    expect(storeEvents(background).map(event => event.text)).toEqual([
      '商店上新：新解锁 1 款游戏，快去看看。',
      '商店上新：新解锁 4 款游戏，快去看看。',
    ]);
    expect(background.events.filter(event => event.text.includes('首装奖励'))).toHaveLength(3);
    expect(background.earned).toBe(120 + GAMES.slice(0, 3).reduce((sum, game) => sum + game.reward, 0));
    expect(tick(background, 1000).events).toEqual(background.events);
  });
});
