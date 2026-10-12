import { describe, expect, it } from 'vitest';
import { HARDWARE } from './catalog';
import { createInitialState } from './engine';
import { sortedHardwareOptions } from './hardwarePresentation';
import { parseSave } from './persistence';
import type { HardwareKey } from './types';

describe('hardware display order preserves saved option identities', () => {
  it('puts every intermediate choice before flagships in all five counters', () => {
    for (const models of Object.values(HARDWARE)) {
      const before = [...models];
      const display = sortedHardwareOptions(models);
      expect(display.map(({ model }) => model.generation)).toEqual([0, 1, 1, 2, 2]);
      for (let i = 1; i < display.length; i++) {
        if (display[i - 1].model.generation === display[i].model.generation) {
          expect(display[i - 1].model.price).toBeLessThanOrEqual(display[i].model.price);
        }
      }
      expect(models).toEqual(before);
      for (const { model, option } of display) expect(model).toBe(models[option]);
    }
  });

  it('uses price only within a generation and keeps original indices as the final tie break', () => {
    const base = HARDWARE.cpu[0];
    const models = [
      { ...base, generation: 2 as const, price: 100 },
      { ...base, generation: 1 as const, price: 900 },
      { ...base, generation: 1 as const, price: 300 },
      { ...base, generation: 1 as const, price: 300 },
      { ...base, generation: 0 as const, price: 0 },
    ];
    expect(sortedHardwareOptions(models).map(({ option }) => option)).toEqual([4, 2, 3, 1, 0]);
  });

  it('leaves equipped and owned branch models unchanged when an existing save is reopened', () => {
    const state = createInitialState();
    const keys = Object.keys(HARDWARE) as HardwareKey[];
    for (const key of keys) {
      state.hardware[key] = 3;
      state.ownedHardware[key] = [0, 3, 4];
    }
    state.points = 987;
    const restored = parseSave(JSON.stringify(state))!;
    expect(restored).toEqual(state);
    for (const key of keys) {
      const display = sortedHardwareOptions(HARDWARE[key]);
      expect(display.find(item => item.option === restored.hardware[key])?.model).toBe(HARDWARE[key][3]);
      expect(display.filter(item => restored.ownedHardware[key].includes(item.option)).map(item => item.option).sort()).toEqual([0, 3, 4]);
    }
  });
});
