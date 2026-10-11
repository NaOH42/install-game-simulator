import { describe, expect, it } from 'vitest';
import { isCompactViewport } from './responsive';

describe('compact desktop viewport', () => {
  it('uses compact layout for phone portrait and landscape viewports', () => {
    for (const [width, height] of [[360, 800], [390, 844], [760, 1000], [844, 390], [960, 500]]) {
      expect(isCompactViewport(width, height)).toBe(true);
    }
  });

  it('keeps ordinary tablets and both desktop acceptance sizes in desktop layout', () => {
    for (const [width, height] of [[761, 501], [768, 1024], [961, 500], [1366, 768], [1920, 1080]]) {
      expect(isCompactViewport(width, height)).toBe(false);
    }
  });

  it('does not classify invalid dimensions as a phone', () => {
    expect(isCompactViewport(NaN, 800)).toBe(false);
    expect(isCompactViewport(390, Infinity)).toBe(false);
  });
});
