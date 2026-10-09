import { describe, expect, it } from 'vitest';
import { GAME_MAP, GAMES } from './catalog';
import { getInstallPresentation } from './presentation';
import type { GameDefinition, InstallJob, Stage } from './types';

const STAGES: Stage[] = ['download', 'unpack', 'write', 'verify'];
function jobAt(game: GameDefinition, progress: number): InstallJob {
  const total = STAGES.reduce((sum, stage) => sum + game.work[stage], 0);
  const work = progress * total;
  let previous = 0;
  for (const stage of STAGES) {
    if (work < previous + game.work[stage] || stage === 'verify') {
      return { id: 'presentation-test', gameId: game.id, stage,
        stageProgress: Math.min(1, Math.max(0, (work - previous) / game.work[stage])), progress, elapsed: work };
    }
    previous += game.work[stage];
  }
  throw new Error('Unreachable stage');
}

describe('file-based installation presentation', () => {
  it('never goes backward or gets ahead of real work across the complete catalog', () => {
    for (const game of GAMES) {
      let previousDisplay = 0;
      let previousCompleted = 0;
      for (let step = 0; step <= 1000; step++) {
        const progress = step / 1000;
        const presentation = getInstallPresentation(game, jobAt(game, progress));
        expect(presentation.displayProgress).toBeGreaterThanOrEqual(previousDisplay);
        expect(presentation.displayProgress).toBeLessThanOrEqual(progress);
        expect(presentation.displayProgress).toBeGreaterThanOrEqual(0);
        expect(presentation.fileProgress).toBeGreaterThanOrEqual(0);
        expect(presentation.fileProgress).toBeLessThanOrEqual(1);
        expect(presentation.completedFiles).toBeGreaterThanOrEqual(previousCompleted);
        expect(presentation.completedFiles).toBeLessThanOrEqual(presentation.totalFiles);
        expect(presentation.recentFiles.length).toBeLessThanOrEqual(8);
        previousDisplay = presentation.displayProgress;
        previousCompleted = presentation.completedFiles;
      }
      expect(previousDisplay).toBe(1);
      expect(previousCompleted).toBe(40);
    }
  });

  it('commits the previous stage fully and starts the next without losing progress', () => {
    const game = GAME_MAP['red-alert'];
    const totalWork = Object.values(game.work).reduce((a, b) => a + b, 0);
    let previousWork = 0;
    for (let index = 0; index < STAGES.length - 1; index++) {
      previousWork += game.work[STAGES[index]];
      const progress = previousWork / totalWork;
      const previous: InstallJob = { id: 'boundary', gameId: game.id, stage: STAGES[index], stageProgress: 1, progress, elapsed: 0 };
      const next = { ...previous, stage: STAGES[index + 1], stageProgress: 0 };
      const a = getInstallPresentation(game, previous);
      const b = getInstallPresentation(game, next);
      expect(a.displayProgress).toBeCloseTo(progress, 12);
      expect(b.displayProgress).toBeCloseTo(progress, 12);
      expect(a.completedFiles).toBe(b.completedFiles);
      expect(a.recentFiles).toEqual(b.recentFiles);
    }
  });

  it('gives large files a visible wait followed by a larger jump than small files', () => {
    const game = GAME_MAP['red-alert'];
    const jumps: number[] = [];
    const waits: number[] = [];
    let previous = getInstallPresentation(game, jobAt(game, 0));
    let lastBoundary = 0;
    for (let millis = 10; millis <= 12000; millis += 10) {
      const result = getInstallPresentation(game, jobAt(game, millis / 30000));
      if (result.completedFiles !== previous.completedFiles) {
        jumps.push(result.displayProgress - previous.displayProgress);
        waits.push((millis - lastBoundary) / 1000);
        lastBoundary = millis;
      }
      previous = result;
    }
    expect(jumps).toHaveLength(10);
    expect(Math.max(...jumps)).toBeGreaterThan(.09);
    expect(Math.min(...jumps)).toBeLessThan(.01);
    expect(Math.max(...jumps) / Math.min(...jumps)).toBeGreaterThan(10);
    expect(waits.some(seconds => seconds >= 2 && seconds <= 4)).toBe(true);
    expect(waits.some(seconds => seconds < .5)).toBe(true);
  });

  it('is stable after reload, uses genre files, and retains only completed log lines', () => {
    const game = GAME_MAP['legend-sword'];
    const job = jobAt(game, .57);
    const first = getInstallPresentation(game, job);
    const restored = getInstallPresentation(JSON.parse(JSON.stringify(game)), JSON.parse(JSON.stringify(job)));
    expect(restored).toEqual(first);
    expect(first.fileName).toMatch(/^textures\/.*\.pak$/);
    expect(first.recentFiles).not.toContain(first.fileName);
    expect(new Set(first.recentFiles).size).toBe(first.recentFiles.length);
    expect(first.recentFiles).toHaveLength(8);
  });

  it('shows exact start and finish and supplies a different file rhythm for different games', () => {
    const first = GAME_MAP['red-alert'];
    const other = GAME_MAP['war-canteen'];
    expect(getInstallPresentation(first, jobAt(first, 0))).toMatchObject({ displayProgress: 0, completedFiles: 0, fileProgress: 0, recentFiles: [] });
    expect(getInstallPresentation(first, jobAt(first, 1))).toMatchObject({ displayProgress: 1, completedFiles: 40, totalFiles: 40, fileProgress: 1 });
    const firstRhythm = [.05, .13, .24, .32].map(progress => getInstallPresentation(first, jobAt(first, progress)).displayProgress);
    const secondRhythm = [.05, .13, .24, .32].map(progress => getInstallPresentation(other, jobAt(other, progress)).displayProgress);
    expect(firstRhythm).not.toEqual(secondRhythm);
  });
});
