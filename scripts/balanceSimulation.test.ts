import { describe, expect, it } from 'vitest';
import { GAMES, HARDWARE } from '../src/game/catalog';
import { createInitialState, dispatch } from '../src/game/engine';
import { chooseDiskOption, nextGameBudget, simulateBalance } from './balanceSimulation';

describe('balance simulation planning', () => {
  it('reserves the next purchasable game rather than treating suggested hardware as an install gate', () => {
    const state = createInitialState();
    state.collected = ['red-alert'];
    state.installed = ['red-alert'];
    state.points = 280;
    expect(nextGameBudget(state)).toBe(70);
    const upgraded = dispatch(state, { type: 'upgrade', key: 'cpu', option: 1 });
    expect(upgraded.error).toBeUndefined();
    expect(upgraded.state.points).toBeGreaterThanOrEqual(nextGameBudget(state));
    const bought = dispatch(upgraded.state, { type: 'buy', gameId: 'legend-sword' });
    const installing = dispatch(bought.state, { type: 'install', gameId: 'legend-sword' });
    expect(installing.error).toBeUndefined();
  });

  it('chooses capacity using model data even though 40 GB follows 80 GB in the catalog', () => {
    const state = createInitialState();
    expect(chooseDiskOption(state, 30, 'collector')).toBe(3);
    expect(chooseDiskOption(state, 70, 'collector')).toBe(4);
    expect(chooseDiskOption(state, 90, 'installer')).toBe(4);
    state.hardware.disk = 2;
    expect(chooseDiskOption(state, 79.9, 'balanced')).toBeNull();
    expect(chooseDiskOption(state, 80.1, 'balanced')).toBe(4);
    expect(chooseDiskOption(state, 200, 'balanced')).toBeNull();
  });

  it('runs three different hardware branches to all games with real economy and capacity checks', () => {
    const strategies = ['balanced', 'installer', 'collector'] as const;
    const reports = strategies.map(strategy => simulateBalance(strategy));
    for (const report of reports) {
      expect(report.complete).toBe(true);
      expect(report.collected).toBe(GAMES.length);
      expect(report.won).toBe(true);
      expect(report.automation).toBe(true);
      expect(report.firstUpgradeSeconds).toBeGreaterThanOrEqual(85);
      expect(report.firstUpgradeSeconds).toBeLessThanOrEqual(240);
      expect(report.runInstallOverlapSeconds).toBeGreaterThan(600);
      expect(report.usedGB).toBeLessThanOrEqual(report.capacityGB);
      expect(report.points).toBeCloseTo(report.earned - report.spent, 1);
      expect(report.firstInstallRewards).toBe(GAMES.reduce((sum, game) => sum + game.reward, 0));
      expect(report.hardwarePurchases.some(item => item.key === 'cpu')).toBe(true);
    }
    expect(reports[0].hardwarePurchases.some(item => item.key === 'cpu' && item.option === 1)).toBe(true);
    expect(reports[1].hardwarePurchases.some(item => item.key === 'cpu' && item.option === 3)).toBe(true);
    expect(reports[2].hardwarePurchases.some(item => item.key === 'disk' && item.option === 3)).toBe(true);
    expect(HARDWARE.disk[reports[2].finalHardware.disk.option].capacity).toBe(160);
  }, 30000);
});
