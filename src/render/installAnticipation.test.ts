import { describe, expect, it, vi } from 'vitest';
import {
  createInstallAnticipationRegistry, getAnticipationIntensity, INSTALL_ANTICIPATION_VARIANTS,
  parseInstallAnticipationSnapshot, serializeInstallAnticipationSnapshot,
} from './installAnticipation';

describe('installation anticipation intensity', () => {
  it('starts quietly at 75%, gathers most strength near completion, and reaches its cap at 99%', () => {
    expect(getAnticipationIntensity(.75)).toBe(0);
    expect(getAnticipationIntensity(.8)).toBeGreaterThan(0);
    expect(getAnticipationIntensity(.85)).toBeLessThan(.1);
    expect(getAnticipationIntensity(.9)).toBeLessThan(.4);
    expect(getAnticipationIntensity(.95)).toBeGreaterThan(.75);
    expect(getAnticipationIntensity(.99)).toBe(1);
    expect(getAnticipationIntensity(1)).toBe(1);
    expect(getAnticipationIntensity(2)).toBe(1);
  });

  it('is bounded, monotonic and continuous, and rejects non-finite progress', () => {
    let previous = 0;
    for (let step = 0; step <= 10000; step++) {
      const intensity = getAnticipationIntensity(step / 10000);
      expect(intensity).toBeGreaterThanOrEqual(previous);
      expect(intensity).toBeLessThanOrEqual(1);
      previous = intensity;
    }
    for (const boundary of [.75, .9, .99]) {
      expect(getAnticipationIntensity(boundary + .000001) - getAnticipationIntensity(boundary - .000001)).toBeLessThan(.0001);
    }
    for (const invalid of [NaN, Infinity, -Infinity, -2]) expect(getAnticipationIntensity(invalid)).toBe(0);
  });
});

describe('presentation-only anticipation assignments', () => {
  it('assigns every job once and stays stable across repeated renders and focus-order changes', () => {
    const random = vi.fn(() => .35);
    const registry = createInstallAnticipationRegistry({ random });
    expect(registry.assign(['a', 'b', 'c'])).toBe(true);
    const original = registry.snapshot();
    const calls = random.mock.calls.length;
    expect(registry.assign(['a', 'b', 'c'])).toBe(false);
    expect(registry.assign(['c', 'a', 'b', 'a'])).toBe(false);
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.snapshot()).toEqual(original);
    expect(random).toHaveBeenCalledTimes(calls);
    expect(new Set(original.assignments.map(([, variant]) => variant)).size).toBe(3);
  });

  it('draws all five before repeating and prevents adjacent repeats across shuffled-bag boundaries', () => {
    let seed = 731;
    const registry = createInstallAnticipationRegistry({ random: () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    } });
    const draws = Array.from({ length: 250 }, (_, index) => {
      const id = `job-${index}`;
      registry.assign([id]);
      return registry.get(id);
    });
    for (let index = 1; index < draws.length; index++) expect(draws[index]).not.toBe(draws[index - 1]);
    for (let index = 0; index < draws.length; index += 5) {
      expect(new Set(draws.slice(index, index + 5))).toEqual(new Set(INSTALL_ANTICIPATION_VARIANTS));
    }
  });

  it('also guards a forced repeat on the next bag boundary', () => {
    // First bag ends in gravity-flip; the next identity shuffle would begin with it.
    const values = [0, 0, 0, 0, 1, 1, 1, 1];
    const registry = createInstallAnticipationRegistry({ random: () => values.shift() ?? .5 });
    registry.assign(['a', 'b', 'c', 'd', 'e']);
    expect(registry.get('e')).toBe('gravity-flip');
    registry.assign(['f']);
    expect(registry.get('f')).not.toBe('gravity-flip');
  });

  it('restores in-flight jobs and pending bag without drawing again or depending on focus', () => {
    const original = createInstallAnticipationRegistry({ random: () => .2 });
    original.assign(['a', 'b']);
    const saved = parseInstallAnticipationSnapshot(serializeInstallAnticipationSnapshot(original.snapshot()));
    const random = vi.fn(() => .95);
    const restored = createInstallAnticipationRegistry({ snapshot: saved, random });
    expect(restored.assign(['b', 'a'])).toBe(false);
    expect(restored.get('a')).toBe(original.get('a'));
    original.assign(['a', 'b', 'c', 'd', 'e']);
    restored.assign(['a', 'b', 'c', 'd', 'e']);
    expect(restored.snapshot()).toEqual(original.snapshot());
    expect(random).not.toHaveBeenCalled();
  });

  it('keeps old active jobs plus at most 64 inactive assignments', () => {
    const registry = createInstallAnticipationRegistry({ random: () => .5 });
    registry.assign(['long-running']);
    const variant = registry.get('long-running');
    for (let index = 0; index < 500; index++) registry.assign(['long-running', `short-${index}`]);
    expect(registry.get('long-running')).toBe(variant);
    expect(registry.get('short-0')).toBeUndefined();
    expect(registry.snapshot().assignments).toHaveLength(66);
    registry.assign([]);
    expect(registry.snapshot().assignments).toHaveLength(64);
    expect(parseInstallAnticipationSnapshot(serializeInstallAnticipationSnapshot(registry.snapshot()))).toEqual(registry.snapshot());
  });

  it('supports more than 64 active jobs without evicting any, then bounds their completed history', () => {
    const registry = createInstallAnticipationRegistry();
    const ids = Array.from({ length: 100 }, (_, index) => `active-${index}`);
    registry.assign(ids);
    for (const id of ids) expect(registry.get(id)).toBeDefined();
    expect(registry.snapshot().assignments).toHaveLength(100);
    registry.assign([]);
    expect(registry.snapshot().assignments).toHaveLength(64);
  });

  it('returns isolated snapshots and does not mutate the supplied restore data', () => {
    const registry = createInstallAnticipationRegistry();
    registry.assign(['a']);
    const saved = registry.snapshot();
    const serialized = serializeInstallAnticipationSnapshot(saved);
    const restored = createInstallAnticipationRegistry({ snapshot: saved });
    restored.assign(['a', 'b']);
    expect(serializeInstallAnticipationSnapshot(saved)).toBe(serialized);
    saved.assignments[0][0] = 'tampered';
    saved.bag.length = 0;
    expect(registry.get('a')).toBeDefined();
    expect(restored.get('a')).toBeDefined();
    expect(registry.snapshot().bag).toHaveLength(4);
  });

  it('safely discards malformed storage instead of injecting unsupported effects', () => {
    const invalid = [null, '', '{', '{}', 'null', JSON.stringify({ version: 2, assignments: [], bag: [], last: null }),
      JSON.stringify({ version: 1, assignments: [['a', 'unknown']], bag: [], last: 'unknown' }),
      JSON.stringify({ version: 1, assignments: [['a', 'gravity-flip'], ['a', 'pixel-tunnel']], bag: [], last: 'pixel-tunnel' }),
      JSON.stringify({ version: 1, assignments: [], bag: ['tip-gravity', 'tip-gravity'], last: null }),
      JSON.stringify({ version: 1, assignments: [['a', 'tip-gravity']], bag: ['tip-gravity'], last: 'tip-gravity' }),
      JSON.stringify({ version: 1, assignments: [['a', 'tip-gravity']], bag: [], last: 'system-fault' }),
    ];
    for (const value of invalid) expect(parseInstallAnticipationSnapshot(value)).toBeUndefined();
    const registry = createInstallAnticipationRegistry({ snapshot: { version: 1, assignments: 'bad', bag: null } });
    expect(() => registry.assign(['new'])).not.toThrow();
    expect(registry.get('new')).toBeDefined();
  });

  it('bounds invalid random samples and treats job identifiers as keys rather than object properties', () => {
    for (const sample of [NaN, Infinity, -Infinity, -2, 0, 1, 2]) {
      const registry = createInstallAnticipationRegistry({ random: () => sample });
      registry.assign(['__proto__', 'constructor', 'normal', '', '   ']);
      for (const id of ['__proto__', 'constructor', 'normal']) expect(INSTALL_ANTICIPATION_VARIANTS).toContain(registry.get(id));
      expect(registry.snapshot().assignments).toHaveLength(3);
      expect(parseInstallAnticipationSnapshot(serializeInstallAnticipationSnapshot(registry.snapshot()))).toEqual(registry.snapshot());
    }
  });
});
