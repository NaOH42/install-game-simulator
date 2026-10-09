import { describe, expect, it } from 'vitest';
import { GAMES, GAME_MAP } from './catalog';
import { createInitialState, dispatch, tick, incomePerSecond, usedSpace, reservedSpace, diskCapacity, jobRate, installBlockReason, maxJobs } from './engine';
import type { Action, SaveGame } from './types';

function act(state: SaveGame, action: Action): SaveGame {
  const result = dispatch(state, action);
  expect(result.error).toBeUndefined();
  return result.state;
}
function unlocked(): SaveGame {
  return { ...createInitialState(), points: 1e6, owned: GAMES.map(game => game.id), hardware: { cpu: 2, ram: 2, disk: 2, gpu: 2, network: 2 }, pipeline: true, automation: true, autoEnabled: false };
}

describe('catalog and progression', () => {
  it('contains 24 unique covers, three shelves and four equally represented genres', () => {
    expect(new Set(GAMES.map(game => game.id)).size).toBe(24);
    expect(new Set(GAMES.map(game => game.cover)).size).toBe(24);
    for (const tier of [1, 2, 3]) expect(GAMES.filter(game => game.tier === tier)).toHaveLength(8);
    for (const genre of ['strategy', 'wuxia', 'racing', 'scifi']) expect(GAMES.filter(game => game.genre === genre)).toHaveLength(6);
  });
  it('finishes the free starter in 30 seconds and unlocks an upgrade within two minutes', () => {
    let state = act(createInitialState(), { type: 'install', gameId: 'red-alert' });
    state = tick(state, 29);
    expect(state.collected).toEqual([]);
    expect(state.jobs[0].progress).toBeCloseTo(29 / 30);
    state = tick(state, 1);
    expect(state.collected).toEqual(['red-alert']);
    state = act(state, { type: 'buy', gameId: 'legend-sword' });
    state = act(state, { type: 'install', gameId: 'legend-sword' });
    state = tick(state, 36);
    state = act(state, { type: 'upgrade', key: 'cpu' });
    expect(state.hardware.cpu).toBe(1);
    expect(state.playTime).toBe(66);
  });
  it('keeps the free starter usable after spending everything and uninstalling', () => {
    let state = tick(act(createInitialState(), { type: 'install', gameId: 'red-alert' }), 30);
    state = act(state, { type: 'uninstall', gameId: 'red-alert' });
    state.points = 0;
    expect(installBlockReason(state, 'red-alert')).toBeNull();
    state = tick(act(state, { type: 'install', gameId: 'red-alert' }), 31);
    expect(state.points).toBeCloseTo(.2);
  });
});

describe('transactions and disk reservations', () => {
  it('rejects unavailable purchases and incompatible installs without modifying state', () => {
    const state = createInitialState();
    const snapshot = JSON.stringify(state);
    expect(dispatch(state, { type: 'buy', gameId: 'crisis-final' }).error).toContain('不足');
    expect(dispatch(state, { type: 'install', gameId: 'legend-sword' }).error).toContain('购买');
    const owned = { ...state, owned: [...state.owned, 'crisis-final'] };
    expect(dispatch(owned, { type: 'install', gameId: 'crisis-final' }).error).toContain('处理器');
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it('reserves space immediately and releases it into installed space atomically', () => {
    let state = unlocked();
    state.hardware.disk = 0;
    state.installed = ['need-parking', 'half-sleep', 'paladin-homework', 'car-school']; // 2.94 GB
    state = act(state, { type: 'install', gameId: 'star-internet' });
    expect(reservedSpace(state)).toBeCloseTo(.95);
    expect(dispatch(state, { type: 'install', gameId: 'legend-sword' }).error).toContain('磁盘');
    expect(usedSpace(state) + reservedSpace(state)).toBeLessThanOrEqual(diskCapacity(state));
    state = tick(state, 1000);
    expect(reservedSpace(state)).toBe(0);
    expect(usedSpace(state)).toBeCloseTo(3.89);
    state = act(state, { type: 'uninstall', gameId: 'star-internet' });
    expect(usedSpace(state)).toBeCloseTo(2.94);
  });
  it('prevents duplicate tasks, purchases and repeated first-install rewards', () => {
    let state = act(createInitialState(), { type: 'install', gameId: 'red-alert' });
    expect(dispatch(state, { type: 'install', gameId: 'red-alert' }).error).toContain('正在');
    expect(dispatch(state, { type: 'buy', gameId: 'red-alert' }).error).toContain('拥有');
    state = tick(state, 30);
    expect(state.points).toBeCloseTo(280);
    state = act(state, { type: 'uninstall', gameId: 'red-alert' });
    expect(incomePerSecond(state)).toBe(0);
    expect(state.owned).toContain('red-alert');
    expect(state.collected).toEqual(['red-alert']);
    state = tick(act(state, { type: 'install', gameId: 'red-alert' }), 30);
    expect(state.points).toBeCloseTo(280);
    expect(state.collected).toEqual(['red-alert']);
    expect(state.installedCount).toBe(2);
  });
});

describe('shared resources and automation', () => {
  it('splits bandwidth instead of multiplying it when a second download starts', () => {
    let state = unlocked();
    state.hardware.network = 0;
    state = act(state, { type: 'install', gameId: 'red-alert' });
    expect(jobRate(state, state.jobs[0])).toBe(1);
    state = act(state, { type: 'install', gameId: 'legend-sword' });
    expect(state.jobs.map(job => jobRate(state, job))).toEqual([.5, .5]);
    state = tick(state, 12);
    expect(state.jobs[0].stageProgress).toBeCloseTo(.5);
    expect(state.jobs[1].stageProgress).toBeCloseTo(6 / 14.4);
  });
  it('shares disk capacity between write and verify stages', () => {
    let state = unlocked();
    state = act(state, { type: 'install', gameId: 'red-alert' });
    state = act(state, { type: 'install', gameId: 'legend-sword' });
    state.jobs[0].stage = 'write';
    state.jobs[1].stage = 'verify';
    expect(jobRate(state, state.jobs[0]) + jobRate(state, state.jobs[1])).toBe(12);
  });
  it('needs the pipeline and sufficient RAM to run two or three tasks', () => {
    let state = unlocked();
    state.pipeline = false;
    expect(maxJobs(state)).toBe(1);
    state.pipeline = true;
    state.hardware.ram = 1;
    expect(maxJobs(state)).toBe(2);
    state.hardware.ram = 2;
    expect(maxJobs(state)).toBe(3);
  });
  it('skips blocked queue items without buying, upgrading, or uninstalling anything', () => {
    let state = createInitialState();
    state.owned.push('crisis-final', 'legend-sword');
    state.pipeline = true;
    state.automation = true;
    state = act(state, { type: 'queue', gameId: 'crisis-final' });
    state = act(state, { type: 'queue', gameId: 'red-alert' });
    state = act(state, { type: 'queue', gameId: 'legend-sword' });
    state = act(state, { type: 'toggleAuto' });
    expect(state.jobs[0].gameId).toBe('red-alert');
    expect(state.queue).toEqual(['crisis-final', 'legend-sword']);
    state = tick(state, 66);
    expect(state.installed).toEqual(['red-alert', 'legend-sword']);
    expect(state.queue).toEqual(['crisis-final']);
    expect(state.hardware).toEqual(createInitialState().hardware);
    expect(state.owned).toEqual(['red-alert', 'crisis-final', 'legend-sword']);
  });
  it('does not start queued items while auto is disabled; reorder and removal are explicit', () => {
    let state = unlocked();
    state = act(state, { type: 'queue', gameId: 'red-alert' });
    state = act(state, { type: 'queue', gameId: 'legend-sword' });
    state = act(state, { type: 'moveQueue', gameId: 'legend-sword', direction: -1 });
    expect(state.queue).toEqual(['legend-sword', 'red-alert']);
    state = tick(state, 100);
    expect(state.jobs).toHaveLength(0);
    state = act(state, { type: 'removeQueue', gameId: 'red-alert' });
    expect(state.queue).toEqual(['legend-sword']);
  });
});

describe('time, persistence boundaries and long sessions', () => {
  it('produces the same result for a background delta and many foreground deltas', () => {
    let state = unlocked();
    state.autoEnabled = true;
    for (const game of GAMES.slice(0, 8)) state = act(state, { type: 'queue', gameId: game.id });
    const large = tick(state, 600);
    let small = state;
    for (let i = 0; i < 2400; i++) small = tick(small, .25);
    expect(large.installed).toEqual(small.installed);
    expect(large.collected).toEqual(small.collected);
    expect(large.points).toBeCloseTo(small.points, 5);
    expect(large.playTime).toBeCloseTo(small.playTime);
    expect(large.jobs).toEqual(small.jobs);
  });
  it('does not read wall time or progress without an explicit tick, and resumes serialized jobs', () => {
    const original = act(createInitialState(), { type: 'install', gameId: 'red-alert' });
    const active = tick(original, 15);
    const saved = JSON.stringify(active);
    const restored: SaveGame = JSON.parse(saved);
    expect(restored).toEqual(active);
    expect(tick(restored, 0)).toBe(restored);
    expect(tick(restored, -999)).toBe(restored);
    expect(tick(restored, Number.NaN)).toBe(restored);
    const finished = tick(restored, 15);
    expect(finished.installed).toEqual(['red-alert']);
    expect(original.playTime).toBe(0);
    expect(active.playTime).toBe(15);
  });
  it('keeps progress monotonic, stage fractions bounded, and logs bounded over reinstalls', () => {
    let state = unlocked();
    for (let n = 0; n < 25; n++) {
      state = act(state, { type: 'install', gameId: 'red-alert' });
      let progress = 0;
      while (state.jobs.length) {
        state = tick(state, .1);
        if (state.jobs.length) {
          expect(state.jobs[0].progress).toBeGreaterThanOrEqual(progress);
          expect(state.jobs[0].stageProgress).toBeGreaterThanOrEqual(0);
          expect(state.jobs[0].stageProgress).toBeLessThanOrEqual(1);
          progress = state.jobs[0].progress;
        }
      }
      state = act(state, { type: 'uninstall', gameId: 'red-alert' });
    }
    expect(state.events.length).toBeLessThanOrEqual(80);
    expect(state.collected).toEqual(['red-alert']);
  });
  it('installs an early game in under ten seconds with the final hardware', () => {
    const state = tick(act(unlocked(), { type: 'install', gameId: 'red-alert' }), 2.5);
    expect(state.installed).toContain('red-alert');
  });
  it('marks the flagship ending once', () => {
    let state = tick(act(unlocked(), { type: 'install', gameId: 'crisis-final' }), 125);
    expect(state.won).toBe(true);
    expect(state.collected).toContain(GAME_MAP['crisis-final'].id);
    const endings = state.events.filter(event => event.text.includes('装下了整个青春')).length;
    state = tick(state, 1000);
    expect(state.events.filter(event => event.text.includes('装下了整个青春'))).toHaveLength(endings);
  });
});

describe('per-game income receipts', () => {
  it('credits only the installed part of a long tick when games finish at different times', () => {
    let state = createInitialState();
    state.owned.push('legend-sword');
    state.automation = true;
    state.autoEnabled = true;
    state.queue = ['red-alert', 'legend-sword'];
    const receipts: Record<string, number> = {};
    const result = tick(state, 100, (id, amount) => { receipts[id] = (receipts[id] ?? 0) + amount; });
    expect(receipts['red-alert']).toBeCloseTo(14); // 70 seconds installed.
    expect(receipts['legend-sword']).toBeCloseTo(10.88); // 34 seconds installed.
    const passive = Object.values(receipts).reduce((sum, value) => sum + value, 0);
    expect(result.earned - state.earned).toBeCloseTo(GAME_MAP['red-alert'].reward + GAME_MAP['legend-sword'].reward + passive);
    expect(result).toEqual(tick(state, 100));
  });

  it('keeps exact individual receipts when concurrent installs compete for the same hardware', () => {
    let state = unlocked();
    state.hardware = { cpu: 0, ram: 1, disk: 0, gpu: 0, network: 0 };
    state = act(state, { type: 'install', gameId: 'red-alert' });
    state = act(state, { type: 'install', gameId: 'legend-sword' });
    const largeReceipts: Record<string, number> = {};
    const smallReceipts: Record<string, number> = {};
    const large = tick(state, 70, (id, amount) => { largeReceipts[id] = (largeReceipts[id] ?? 0) + amount; });
    let small = state;
    for (let index = 0; index < 280; index++) small = tick(small, .25, (id, amount) => { smallReceipts[id] = (smallReceipts[id] ?? 0) + amount; });
    expect(largeReceipts['red-alert']).toBeCloseTo(3.32); // Shared resources postpone completion to 53.4 s.
    expect(largeReceipts['legend-sword']).toBeCloseTo(3.392); // Finishes at 59.4 s.
    for (const id of ['red-alert', 'legend-sword']) expect(largeReceipts[id]).toBeCloseTo(smallReceipts[id], 8);
    expect(large.points).toBeCloseTo(small.points, 7);
  });

  it('stops receipts while uninstalled and resumes passive income without reporting a second reward', () => {
    const receipts: number[] = [];
    const observe = (id: string, amount: number) => { expect(id).toBe('red-alert'); receipts.push(amount); };
    let state = tick(act(createInitialState(), { type: 'install', gameId: 'red-alert' }), 30, observe);
    expect(receipts).toEqual([]);
    state = tick(state, 5, observe);
    expect(receipts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    state = act(state, { type: 'uninstall', gameId: 'red-alert' });
    const receiptCount = receipts.length;
    state = tick(state, 100, observe);
    expect(receipts).toHaveLength(receiptCount);
    state = act(state, { type: 'install', gameId: 'red-alert' });
    state = tick(state, 35, observe);
    expect(receipts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(2);
    expect(state.earned).toBeCloseTo(120 + GAME_MAP['red-alert'].reward + 2);
    expect(state.collected).toEqual(['red-alert']);
  });
});
