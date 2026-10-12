import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetUrl } from './assetUrl';

afterEach(() => vi.unstubAllEnvs());

describe('assetUrl deployment targets', () => {
  it('keeps existing PNG URLs for the root site and GitHub Pages', () => {
    vi.stubEnv('VITE_COVER_FORMAT', '');
    vi.stubEnv('BASE_URL', '/');
    expect(assetUrl('/assets/covers/red-alert.png')).toBe('/assets/covers/red-alert.png');
    vi.stubEnv('BASE_URL', '/install-game-simulator/');
    expect(assetUrl('/assets/covers/red-alert.png')).toBe('/install-game-simulator/assets/covers/red-alert.png');
  });

  it('uses relative WebP covers only in the TOY build', () => {
    vi.stubEnv('VITE_COVER_FORMAT', 'webp');
    vi.stubEnv('BASE_URL', './');
    expect(assetUrl('/assets/covers/red-alert.png')).toBe('./assets/covers/red-alert.webp');
    expect(assetUrl('/assets/icons/computer.png')).toBe('./assets/icons/computer.png');
    expect(assetUrl('https://example.com/cover.png')).toBe('https://example.com/cover.png');
    expect(assetUrl('//example.com/cover.png')).toBe('//example.com/cover.png');
  });
});
