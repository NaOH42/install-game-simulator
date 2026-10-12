import { describe, expect, it } from 'vitest';
import { achievementCardLayout, cardThumbnailSize, coverSourceRect, loadCardImageSources } from './renderCard';

describe('card image memory budget', () => {
  it('caps original artwork at a 512px edge and never enlarges small icons', () => {
    expect(cardThumbnailSize(1024, 1536)).toEqual({ width: 341, height: 512 });
    expect(cardThumbnailSize(1536, 1024)).toEqual({ width: 512, height: 341 });
    expect(cardThumbnailSize(43, 43)).toEqual({ width: 43, height: 43 });
    expect(cardThumbnailSize(10000, 1)).toEqual({ width: 512, height: 1 });
  });

  it('decodes relative/absolute duplicates once with at most three concurrent images', async () => {
    let active = 0;
    let peak = 0;
    const calls: string[] = [];
    const sources = ['/cover.png', 'https://game.test/cover.png', ...Array.from({ length: 12 }, (_, index) => `/cover-${index}.png`)];
    const images = await loadCardImageSources(sources, async url => {
      calls.push(url);
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return { source: url };
    }, 'https://game.test/toy/game/index.html');
    expect(peak).toBe(3);
    expect(calls).toHaveLength(13);
    expect(images.size).toBe(14);
    expect(images.get('/cover.png')).toBe(images.get('https://game.test/cover.png'));
  });

  it('keeps failed sources as placeholders and processes the remaining queue', async () => {
    const images = await loadCardImageSources(['/missing.png', '/cover.png'], async url => url.includes('missing') ? null : url, 'https://game.test/');
    expect(images.get('/missing.png')).toBeNull();
    expect(images.get('/cover.png')).toBe('https://game.test/cover.png');
  });
});

describe('achievement card layout', () => {
  it('leaves every collection row above the footer for 0 through 32 games', () => {
    for (let count = 0; count <= 32; count++) {
      const layout = achievementCardLayout(count, { width: 1366, height: 768 });
      const lastRowEnd = count === 0 ? layout.collectionY + 164 : layout.collectionY + Math.ceil(count / layout.columns) * layout.cellHeight;
      expect(lastRowEnd).toBeLessThan(layout.height - 156);
      expect(layout.width).toBe(1080);
    }
  });

  it('keeps a bounded desktop panorama for extremely narrow or wide windows', () => {
    expect(achievementCardLayout(32, { width: 360, height: 800 }).desktopHeight).toBe(590);
    expect(achievementCardLayout(32, { width: 3000, height: 800 }).desktopHeight).toBe(350);
  });
});

describe('cover crop', () => {
  it('preserves the full 2:3 bitmap and keeps a landscape focal point within its source', () => {
    expect(coverSourceRect(1024, 1536, 140, 210, '50% 35%')).toEqual({ x:0, y:0, width:1024, height:1536 });
    const crop = coverSourceRect(1500, 1000, 140, 210, '80% 35%');
    expect(crop.x).toBeCloseTo((1500 - 1000 * 2 / 3) * 0.8);
    expect(crop.height).toBe(1000);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1500);
  });

  it('clamps malformed focal coordinates instead of drawing outside the bitmap', () => {
    const crop = coverSourceRect(1500, 1000, 140, 210, '200% broken');
    expect(crop.x + crop.width).toBe(1500);
    expect(crop.y).toBe(0);
  });
});
