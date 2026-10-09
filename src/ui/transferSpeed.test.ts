import { describe, expect, it } from 'vitest';
import { TRANSFER_BASE_SECONDS, transferPlaybackRate } from './transferSpeed';

describe('paper-plane transfer speed', () => {
  it('makes upgrades perceptibly faster while allowing resource sharing to slow down', () => {
    const cycle = (speed: number) => TRANSFER_BASE_SECONDS / transferPlaybackRate(speed);
    expect(cycle(1)).toBeCloseTo(6.4);
    expect(cycle(3.6)).toBeCloseTo(3.3731, 3);
    expect(cycle(12)).toBeCloseTo(1.8475, 3);
    expect(cycle(0.5)).toBeGreaterThan(cycle(1));
    expect(cycle(6)).toBeGreaterThan(cycle(12));
  });

  it('keeps even extreme active speeds within readable cycle lengths', () => {
    expect(TRANSFER_BASE_SECONDS / transferPlaybackRate(0.0001)).toBe(14);
    expect(TRANSFER_BASE_SECONDS / transferPlaybackRate(1e8)).toBe(1.4);
  });

  it('pauses safely with no available processing speed', () => {
    for (const speed of [0, -1, NaN, Infinity, -Infinity]) {
      expect(transferPlaybackRate(speed)).toBe(0);
    }
  });
});
