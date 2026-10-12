import { describe, expect, it } from 'vitest';
import { GAME_MAP, HARDWARE } from './catalog';
import { createInitialState, dispatch, tick, PIPELINE_COST, AUTOMATION_COST } from './engine';
import type { HardwareKey } from './types';

describe('upgrade economy pacing', () => {
  it('lets a common first-install hardware purchase keep the next game affordable', () => {
    const initial = dispatch(createInitialState(), { type: 'install', gameId: 'red-alert' }).state;
    const first = tick(initial, 100);
    expect(first.collected).toEqual(['red-alert']);
    for (const key of Object.keys(HARDWARE) as HardwareKey[]) {
      for (const option of key === 'cpu' || key === 'network' ? [1, 3] : [1]) {
        const upgrade = dispatch(first, { type: 'upgrade', key, option });
        expect(upgrade.error).toBeUndefined();
        expect(upgrade.state.points).toBeGreaterThanOrEqual(GAME_MAP['legend-sword'].price);
        const purchase = dispatch(upgrade.state, { type: 'buy', gameId: 'legend-sword' });
        expect(purchase.error).toBeUndefined();
        expect(dispatch(purchase.state, { type: 'install', gameId: 'legend-sword' }).error).toBeUndefined();
      }
    }
    expect(first.points).toBe(createInitialState().points + GAME_MAP['red-alert'].reward);
  });

  it('avoids a tenfold price wall for the same hardware route', () => {
    for (const key of Object.keys(HARDWARE) as HardwareKey[]) {
      const options = HARDWARE[key];
      expect(options[2].price / options[1].price).toBeLessThanOrEqual(8);
      expect(options[4].price / options[3].price).toBeLessThanOrEqual(12);
      expect(options[2].price).toBeGreaterThan(options[1].price);
      expect(options[4].price).toBeGreaterThan(options[3].price);
    }
    expect(AUTOMATION_COST).toBeGreaterThan(PIPELINE_COST);
  });

  it('honors a purchased old-save model at the new price without charging again', () => {
    const oldSave = createInitialState();
    oldSave.ownedHardware.cpu = [0, 1, 3];
    oldSave.hardware.cpu = 3;
    oldSave.points = 0;
    const switchBack = dispatch(oldSave, { type: 'equipHardware', key: 'cpu', option: 1 });
    expect(switchBack.error).toBeUndefined();
    expect(switchBack.state.points).toBe(0);
    expect(switchBack.state.hardware.cpu).toBe(1);
    expect(oldSave.hardware.cpu).toBe(3);
    const buyAgain = dispatch(switchBack.state, { type: 'upgrade', key: 'cpu', option: 3 });
    expect(buyAgain.error).toBeUndefined();
    expect(buyAgain.state.points).toBe(0);
  });
});
