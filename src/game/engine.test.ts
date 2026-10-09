import { describe, expect, it } from 'vitest';
import { GAMES, GAME_MAP, HARDWARE } from './catalog';
import { createInitialState, dispatch, tick, incomePerSecond, usedSpace, reservedSpace, diskCapacity, jobRate, installBlockReason, maxJobs, getSystemLoad, gamePerformance, hardwareMeetsRecommendation } from './engine';
import type { Action, SaveGame, HardwareKey } from './types';

const totalWork = (id: string) => Object.values(GAME_MAP[id].work).reduce((sum, value) => sum + value, 0);
function act(state: SaveGame, action: Action): SaveGame {
  const result = dispatch(state, action);
  expect(result.error).toBeUndefined();
  return result.state;
}
function unlocked(): SaveGame {
  return { ...createInitialState(), points: 1e6, owned: GAMES.map(game => game.id), hardware: { cpu: 2, ram: 2, disk: 4, gpu: 2, network: 2 }, ownedHardware: { cpu: [0,1,2,3,4], ram: [0,1,2,3,4], disk: [0,1,2,3,4], gpu: [0,1,2,3,4], network: [0,1,2,3,4] }, pipeline: true, automation: true, autoEnabled: false };
}
function withInstalled(ids: string[]): SaveGame {
  return { ...unlocked(), installed: [...ids], collected: [...ids], installedCount: ids.length };
}

describe('catalog and installation', () => {
  it('has 32 independent games with declared workload and online status', () => {
    expect(GAMES).toHaveLength(32);
    expect(new Set(GAMES.map(game => game.id)).size).toBe(32);
    expect(new Set(GAMES.map(game => game.cover)).size).toBe(32);
    expect(GAMES.filter(game => game.online).length).toBeGreaterThanOrEqual(8);
    expect(GAMES.filter(game => !game.online).every(game => game.runtime.network === 0)).toBe(true);
    expect(GAMES.every(game => Object.values(game.runtime).every(value => Number.isFinite(value) && value >= 0))).toBe(true);
  });
  it('makes the first wait meaningful but leaves it below ten seconds on final fast hardware', () => {
    const duration = totalWork('red-alert');
    expect(duration).toBeGreaterThanOrEqual(75);
    expect(duration).toBeLessThanOrEqual(110);
    let initial = act(createInitialState(), { type: 'install', gameId: 'red-alert' });
    initial = tick(initial, duration - 1);
    expect(initial.installed).toEqual([]);
    initial = tick(initial, 1);
    expect(initial.installed).toEqual(['red-alert']);
    expect(initial.running).toEqual([]);
    const fast = unlocked(); fast.hardware.disk = 2;
    expect(tick(act(fast, { type: 'install', gameId: 'red-alert' }), 9.9).installed).toContain('red-alert');
  });
  it('allows low-spec installation and operation with reduced efficiency', () => {
    let state = createInitialState();
    state.owned.push('world-war-lan');
    expect(installBlockReason(state, 'world-war-lan')).toBeNull();
    state = tick(act(state, { type: 'install', gameId: 'world-war-lan' }), totalWork('world-war-lan') * 4);
    expect(state.installed).toContain('world-war-lan');
    state = act(state, { type: 'run', gameId: 'world-war-lan' });
    const performance = gamePerformance(state, 'world-war-lan');
    expect(performance.efficiency).toBeGreaterThan(0);
    expect(performance.efficiency).toBeLessThan(1);
    expect(performance.incomePerSecond).toBeLessThan(GAME_MAP['world-war-lan'].income);
  });
  it('adds compatibility overhead and a real earnings penalty for a lone tier-two game below its entry reference', () => {
    const game = GAME_MAP['empire-dorm'];
    let state = { ...createInitialState(), owned: ['red-alert', game.id], installed: [game.id], collected: [game.id], installedCount: 1 };
    state = act(state, { type: 'run', gameId: game.id });
    const low = gamePerformance(state, game.id);
    const load = getSystemLoad(state);
    expect(load.cpu.ratio).toBeLessThan(1); // Underload alone must not make an incompatible game fully efficient.
    expect(load.ram.ratio).toBeLessThan(1);
    expect(low.demand.cpu).toBeGreaterThan(game.runtime.cpu);
    expect(low.demand.ram).toBeGreaterThan(game.runtime.ram);
    expect(low.demand.gpu).toBeGreaterThan(game.runtime.gpu);
    expect(low.efficiency).toBeGreaterThan(0);
    expect(low.efficiency).toBeLessThan(.75);
    expect(incomePerSecond(state)).toBeCloseTo(low.incomePerSecond);
    let received = 0;
    const after = tick(state, 10, (_, amount) => { received += amount; });
    expect(received).toBeCloseTo(low.incomePerSecond * 10);
    expect(after.points - state.points).toBeCloseTo(received);
    state.points = 5000;
    for (const key of ['cpu', 'ram', 'gpu'] as HardwareKey[]) state = act(state, { type: 'upgrade', key, option: 1 });
    const upgraded = gamePerformance(state, game.id);
    expect(upgraded.efficiency).toBe(1);
    expect(upgraded.demand.ram).toBe(game.runtime.ram);
    expect(upgraded.incomePerSecond).toBeGreaterThan(low.incomePerSecond);
    expect(state.hardware.disk).toBe(0); // A physically sufficient disk is not a run-time compute penalty.
  });
  it('rejects purchases without money and disk reservations that do not fit without changing state', () => {
    const initial = createInitialState();
    const snapshot = JSON.stringify(initial);
    expect(dispatch(initial, { type: 'buy', gameId: 'crisis-final' }).error).toContain('不足');
    expect(JSON.stringify(initial)).toBe(snapshot);
    let state = unlocked(); state.hardware.disk = 0;
    state.installed = ['need-parking', 'half-sleep', 'paladin-homework', 'car-school'];
    state = act(state, { type: 'install', gameId: 'star-internet' });
    expect(reservedSpace(state)).toBeCloseTo(.95);
    expect(dispatch(state, { type: 'install', gameId: 'legend-sword' }).error).toContain('磁盘');
    expect(usedSpace(state) + reservedSpace(state)).toBeLessThanOrEqual(diskCapacity(state));
    state = tick(state, 1000);
    expect(reservedSpace(state)).toBe(0);
    expect(usedSpace(state)).toBeCloseTo(3.89);
  });
  it('preserves purchase and first-reward history across uninstall and reinstall', () => {
    let state = tick(act(createInitialState(), { type: 'install', gameId: 'red-alert' }), totalWork('red-alert'));
    const firstPoints = state.points;
    state = act(state, { type: 'run', gameId: 'red-alert' });
    state = act(state, { type: 'uninstall', gameId: 'red-alert' });
    expect(state.running).toEqual([]);
    expect(state.collected).toEqual(['red-alert']);
    expect(state.owned).toContain('red-alert');
    state = tick(act(state, { type: 'install', gameId: 'red-alert' }), totalWork('red-alert'));
    expect(state.points).toBeCloseTo(firstPoints);
    expect(state.installedCount).toBe(2);
    expect(incomePerSecond(state)).toBe(0);
  });
});

describe('running games and resource pressure', () => {
  it('only running games earn, and stop/stopAll release their resources immediately', () => {
    let state = withInstalled(['red-alert', 'legend-sword']);
    expect(incomePerSecond(state)).toBe(0);
    expect(tick(state, 600).points).toBe(state.points);
    state = act(state, { type: 'run', gameId: 'red-alert' });
    expect(incomePerSecond(state)).toBeCloseTo(GAME_MAP['red-alert'].income);
    expect(getSystemLoad(state).cpu.demand).toBeGreaterThan(0);
    expect(dispatch(state, { type: 'run', gameId: 'red-alert' }).error).toContain('已经');
    state = act(state, { type: 'run', gameId: 'legend-sword' });
    state = act(state, { type: 'stop', gameId: 'red-alert' });
    expect(state.installed).toContain('red-alert');
    expect(state.running).toEqual(['legend-sword']);
    state = act(state, { type: 'stopAll' });
    expect(incomePerSecond(state)).toBe(0);
    expect(getSystemLoad(state).cpu.demand).toBe(0);
  });
  it('recovers installation speed and active game efficiency when heavy games are stopped', () => {
    let state = withInstalled(['world-war-lan', 'crisis-final', 'red-alert']);
    state.hardware.cpu = 0;
    state = act(state, { type: 'run', gameId: 'world-war-lan' });
    state = act(state, { type: 'run', gameId: 'crisis-final' });
    state = act(state, { type: 'run', gameId: 'red-alert' });
    state = act(state, { type: 'install', gameId: 'legend-sword' });
    state.jobs[0].stage = 'unpack';
    const rate = jobRate(state, state.jobs[0]);
    const efficiency = gamePerformance(state, 'red-alert').efficiency;
    state = act(state, { type: 'stop', gameId: 'crisis-final' });
    expect(jobRate(state, state.jobs[0])).toBeGreaterThan(rate);
    expect(gamePerformance(state, 'red-alert').efficiency).toBeGreaterThan(efficiency);
  });
  it('does not apply network pressure to offline games, but slows online games and downloads', () => {
    let state = withInstalled(['red-alert', 'world-war-lan', 'galaxy-odyssey']);
    state.hardware.network = 0;
    for (const id of state.installed) state = act(state, { type: 'run', gameId: id });
    expect(getSystemLoad(state).network.ratio).toBeGreaterThan(1);
    expect(gamePerformance(state, 'red-alert').efficiency).toBe(1);
    expect(gamePerformance(state, 'world-war-lan').bottleneck).toBe('network');
    state = act(state, { type: 'install', gameId: 'legend-sword' });
    const busyRate = jobRate(state, state.jobs[0]);
    state = act(state, { type: 'stop', gameId: 'world-war-lan' });
    state = act(state, { type: 'stop', gameId: 'galaxy-odyssey' });
    expect(jobRate(state, state.jobs[0])).toBeGreaterThan(busyRate);
  });
  it('treats memory and graphics as real bottlenecks rather than hardware index gates', () => {
    let state = withInstalled(['crisis-final']);
    state.hardware.ram = 0;
    state = act(state, { type: 'run', gameId: 'crisis-final' });
    expect(gamePerformance(state, 'crisis-final').bottleneck).toBe('ram');
    state = act(state, { type: 'equipHardware', key: 'ram', option: 2 });
    state.hardware.gpu = 0;
    expect(gamePerformance(state, 'crisis-final').bottleneck).toBe('gpu');
    expect(gamePerformance(state, 'crisis-final').efficiency).toBeLessThan(1);
  });
});

describe('hardware choices and shared installation resources', () => {
  it('keeps old model identities and offers real capacity-versus-speed/slots/CPU-relief choices', () => {
    expect(HARDWARE.cpu[0].name).toContain('慢半拍');
    expect(HARDWARE.cpu[1].name).toContain('双响炮');
    expect(HARDWARE.cpu[2].name).toContain('四核');
    for (const key of ['cpu', 'network'] as HardwareKey[]) {
      expect(HARDWARE[key][3].installSpeed).toBeGreaterThan(HARDWARE[key][1].installSpeed);
      expect(HARDWARE[key][3].capacity).toBeLessThan(HARDWARE[key][1].capacity);
    }
    expect(HARDWARE.disk[3].capacity).toBeGreaterThan(HARDWARE.disk[1].capacity);
    expect(HARDWARE.disk[3].installSpeed).toBeLessThan(HARDWARE.disk[1].installSpeed);
    expect(HARDWARE.ram[3].capacity).toBeGreaterThan(HARDWARE.ram[1].capacity);
    expect(HARDWARE.ram[3].slots).toBeLessThan(HARDWARE.ram[1].slots);
    expect(HARDWARE.gpu[3].capacity).toBeLessThan(HARDWARE.gpu[1].capacity);
    expect(HARDWARE.gpu[3].cpuRelief).toBeGreaterThan(HARDWARE.gpu[1].cpuRelief);
  });
  it('charges each model once and allows free switching back without ranking by index', () => {
    let state = createInitialState(); state.points = 2000;
    state = act(state, { type: 'upgrade', key: 'cpu', option: 3 });
    const paid = state.points;
    expect(state.ownedHardware.cpu).toEqual([0, 3]);
    expect(hardwareMeetsRecommendation(state, GAME_MAP['empire-dorm'], 'cpu')).toBe(false);
    state = act(state, { type: 'equipHardware', key: 'cpu', option: 0 });
    state = act(state, { type: 'upgrade', key: 'cpu', option: 3 });
    expect(state.points).toBe(paid);
    state.points = 1e4;
    state = act(state, { type: 'upgrade', key: 'cpu' });
    expect(state.hardware.cpu).toBe(2);
    expect(dispatch(state, { type: 'equipHardware', key: 'gpu', option: 4 }).error).toContain('购买');
  });
  it('rejects swaps that cannot hold installed data or current task slots without charging', () => {
    let state = withInstalled(['crisis-final']);
    const points = state.points;
    expect(dispatch(state, { type: 'equipHardware', key: 'disk', option: 0 }).error).toContain('容量');
    expect(state.points).toBe(points);
    state = act(state, { type: 'install', gameId: 'red-alert' });
    state = act(state, { type: 'install', gameId: 'legend-sword' });
    expect(dispatch(state, { type: 'equipHardware', key: 'ram', option: 3 }).error).toContain('通道');
  });
  it('shares bandwidth and CPU across parallel tasks and includes mixed-stage backpressure', () => {
    let state = unlocked(); state.hardware.network = 0; state.hardware.cpu = 0;
    state = act(state, { type: 'install', gameId: 'red-alert' });
    expect(jobRate(state, state.jobs[0])).toBe(1);
    state = act(state, { type: 'install', gameId: 'legend-sword' });
    expect(state.jobs.map(job => jobRate(state, job))).toEqual([.5, .5]);
    state.jobs[0].stage = 'unpack';
    expect(jobRate(state, state.jobs[0])).toBeLessThan(1);
    expect(jobRate(state, state.jobs[1])).toBeLessThan(1);
    state.jobs[1].stage = 'unpack';
    expect(state.jobs.map(job => jobRate(state, job))).toEqual([.5, .5]);
  });
  it('skips capacity-blocked queue entries and continues a small eligible game', () => {
    let state = createInitialState();
    state.owned.push('crisis-final', 'legend-sword');
    state.automation = true; state.autoEnabled = true; state.pipeline = true;
    state.queue = ['crisis-final', 'red-alert', 'legend-sword'];
    state = tick(state, totalWork('red-alert') + totalWork('legend-sword'));
    expect(state.installed).toEqual(['red-alert', 'legend-sword']);
    expect(state.running).toEqual([]);
    expect(state.queue).toEqual(['crisis-final']);
  });
  it('uses RAM slots only after the pipeline is unlocked and compares capacities correctly', () => {
    const state = unlocked(); state.pipeline = false;
    expect(maxJobs(state)).toBe(1);
    state.pipeline = true; state.hardware.ram = 3;
    expect(maxJobs(state)).toBe(1);
    state.hardware.ram = 4;
    expect(maxJobs(state)).toBe(2);
    state.hardware.ram = 2;
    expect(maxJobs(state)).toBe(3);
  });
});

describe('precise time and per-game receipts', () => {
  it('matches short foreground ticks and long background ticks despite changing contention', () => {
    let state = withInstalled(['red-alert', 'world-war-lan', 'crisis-final']);
    for (const id of state.installed) state = act(state, { type: 'run', gameId: id });
    state.autoEnabled = true;
    for (const game of GAMES.slice(1, 8)) state = act(state, { type: 'queue', gameId: game.id });
    const largeReceipts: Record<string, number> = {}, smallReceipts: Record<string, number> = {};
    const large = tick(state, 600, (id, amount) => { largeReceipts[id] = (largeReceipts[id] ?? 0) + amount; });
    let small = state;
    for (let index = 0; index < 2400; index++) small = tick(small, .25, (id, amount) => { smallReceipts[id] = (smallReceipts[id] ?? 0) + amount; });
    expect(large.installed).toEqual(small.installed);
    expect(large.running).toEqual(state.running);
    expect(large.points).toBeCloseTo(small.points, 5);
    for (const id of state.running) expect(largeReceipts[id]).toBeCloseTo(smallReceipts[id], 6);
    expect(large.jobs).toEqual(small.jobs);
  });
  it('never grants income before run, after stop, or for an install reward', () => {
    const receipts: Record<string, number> = {};
    const observe = (id: string, amount: number) => { receipts[id] = (receipts[id] ?? 0) + amount; };
    let state = tick(act(createInitialState(), { type: 'install', gameId: 'red-alert' }), 200, observe);
    expect(receipts).toEqual({});
    state = act(state, { type: 'run', gameId: 'red-alert' });
    state = tick(state, 5, observe);
    expect(receipts['red-alert']).toBeCloseTo(1);
    state = act(state, { type: 'stop', gameId: 'red-alert' });
    state = tick(state, 100, observe);
    expect(receipts['red-alert']).toBeCloseTo(1);
    state = act(state, { type: 'uninstall', gameId: 'red-alert' });
    state = tick(act(state, { type: 'install', gameId: 'red-alert' }), 200, observe);
    state = act(state, { type: 'run', gameId: 'red-alert' });
    state = tick(state, 5, observe);
    expect(receipts['red-alert']).toBeCloseTo(2);
    expect(state.earned).toBeCloseTo(120 + GAME_MAP['red-alert'].reward + 2);
  });
  it('attributes different real running durations exactly and leaves economy unchanged by observation', () => {
    let state = withInstalled(['red-alert', 'legend-sword']);
    const receipts: Record<string, number> = {};
    const observe = (id: string, amount: number) => { receipts[id] = (receipts[id] ?? 0) + amount; };
    state = act(state, { type: 'run', gameId: 'red-alert' });
    state = tick(state, 3, observe);
    state = act(state, { type: 'run', gameId: 'legend-sword' });
    const observed = tick(state, 2, observe);
    expect(observed).toEqual(tick(state, 2));
    expect(receipts['red-alert']).toBeCloseTo(1);
    expect(receipts['legend-sword']).toBeCloseTo(.64);
  });
  it('does not read wall time or advance without explicit positive elapsed time', () => {
    const state = act(createInitialState(), { type: 'install', gameId: 'red-alert' });
    const saved = JSON.stringify(state);
    expect(tick(state, 0)).toBe(state);
    expect(tick(state, -1)).toBe(state);
    expect(tick(state, Number.NaN)).toBe(state);
    expect(JSON.stringify(state)).toBe(saved);
  });
});
