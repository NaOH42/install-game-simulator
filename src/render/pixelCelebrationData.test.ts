import { describe, expect, it } from 'vitest';
import { GAMES } from '../game/catalog';
import { getCelebrationPhase, getPixelCelebration, PIXEL_CELEBRATIONS } from './pixelCelebrationData';

describe('pixel celebration catalog', () => {
  it('assigns every real game an exact title, authored move and usable palette', () => {
    expect(Object.keys(PIXEL_CELEBRATIONS).sort()).toEqual(GAMES.map(game => game.id).sort());
    for (const game of GAMES) {
      const scene = getPixelCelebration(game.id);
      expect(scene.title).toBe(game.title);
      expect(scene.skill.length).toBeGreaterThan(3);
      for (const color of [scene.primary, scene.accent, scene.backdrop]) expect(color).toMatch(/^#[\da-f]{6}$/i);
    }
    expect(new Set(Object.values(PIXEL_CELEBRATIONS).map(scene => scene.skill)).size).toBe(GAMES.length);
    expect(new Set(Object.values(PIXEL_CELEBRATIONS).map(scene => scene.mechanism)).size).toBe(8);
  });
  it('keeps the signature sword and cat scenes attached to stable IDs', () => {
    expect(getPixelCelebration('legend-sword')).toMatchObject({ mechanism: 'swords', skill: '万剑归宗' });
    expect(getPixelCelebration('cats-creed')).toMatchObject({ mechanism: 'assassin', skill: '信仰之跃' });
    expect(getPixelCelebration('dark-suffering').mechanism).toBe('bonfire');
    expect(getPixelCelebration('missing-game').title).toBe('新游戏');
  });
  it('times charge, release, settle, fade and completion without reward data', () => {
    expect(getCelebrationPhase(0)).toMatchObject({ phase: 'charge', opacity: 1, finished: false });
    expect(getCelebrationPhase(1100).phase).toBe('release');
    expect(getCelebrationPhase(3400).phase).toBe('settle');
    expect(getCelebrationPhase(4600).opacity).toBe(.5);
    expect(getCelebrationPhase(4800)).toMatchObject({ progress: 1, opacity: 0, finished: true });
  });
  it('uses a short static scene when motion is reduced and bounds invalid timing', () => {
    expect(getCelebrationPhase(100, true)).toMatchObject({ phase: 'still', duration: 1600 });
    expect(getCelebrationPhase(1600, true).finished).toBe(true);
    expect(getCelebrationPhase(-10).progress).toBe(0);
    expect(getCelebrationPhase(Number.NaN).progress).toBe(0);
  });
});
