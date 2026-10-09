import { describe, expect, it } from 'vitest';
import { GAME_MAP, GAMES } from './catalog';
import { getInstallFileFrame } from './fileStream';
import type { GameDefinition, InstallJob, Stage } from './types';

const STAGES: Stage[] = ['download', 'unpack', 'write', 'verify'];
function jobAt(game: GameDefinition, progress: number): InstallJob {
  const total = Object.values(game.work).reduce((sum, value) => sum + value, 0);
  let previous = 0;
  for (const stage of STAGES) {
    if (progress * total < previous + game.work[stage] || stage === 'verify') {
      return { id: 'file-stream', gameId: game.id, stage, stageProgress: Math.max(0, Math.min(1, (progress * total - previous) / game.work[stage])), progress, elapsed: progress * total };
    }
    previous += game.work[stage];
  }
  throw new Error('Unreachable stage');
}

describe('fine-grained file stream', () => {
  it('has hundreds or thousands of monotonic completed paths, with a hard 24-entry bound', () => {
    for (const game of GAMES) {
      let previousCount = 0;
      for (let step = 0; step <= 200; step++) {
        const frame = getInstallFileFrame(game, jobAt(game, step / 200));
        expect(frame.completedFiles).toBeGreaterThanOrEqual(previousCount);
        expect(frame.completedFiles).toBeLessThanOrEqual(frame.totalFiles);
        expect(frame.entries.length).toBeLessThanOrEqual(24);
        expect(frame.entries.every(entry => entry.index <= frame.completedFiles)).toBe(true);
        if (frame.entries.length) expect(frame.entries.at(-1)!.index).toBe(frame.completedFiles);
        previousCount = frame.completedFiles;
      }
      expect(previousCount).toBeGreaterThan(500);
    }
    expect(getInstallFileFrame(GAME_MAP['crisis-final'], jobAt(GAME_MAP['crisis-final'], 1)).totalFiles).toBeGreaterThan(2000);
  });

  it('does not create completed paths from elapsed time if real work is stalled', () => {
    const game = GAME_MAP['red-alert'];
    const job = jobAt(game, .235);
    const first = getInstallFileFrame(game, job);
    const stalled = getInstallFileFrame(game, { ...job, elapsed: job.elapsed + 600 });
    expect(stalled).toEqual(first);
    expect(getInstallFileFrame(game, JSON.parse(JSON.stringify(job)))).toEqual(first);
  });

  it('provides absolute Windows paths and a stage-specific operation for each completed member', () => {
    const game = GAME_MAP['legend-sword'];
    for (const progress of [.2, .55, .8, .98]) {
      const frame = getInstallFileFrame(game, jobAt(game, progress));
      expect(frame.entries.every(entry => entry.path.startsWith('C:\\Program Files\\Century Games\\legend-sword\\'))).toBe(true);
      expect(new Set(frame.entries.map(entry => entry.path)).size).toBe(frame.entries.length);
      const entry = frame.entries.at(-1)!;
      expect(entry.stage).toBe(jobAt(game, progress).stage);
      expect(entry.operation).toMatch(/^(FETCH|EXPAND|WRITE|CHECK)$/);
    }
  });

  it('produces roughly 12–25 lines per second on the initial machine, including short bursts', () => {
    const game = GAME_MAP['red-alert'];
    const duration = Object.values(game.work).reduce((sum, value) => sum + value, 0);
    const complete = getInstallFileFrame(game, jobAt(game, 1));
    expect(complete.totalFiles / duration).toBeGreaterThanOrEqual(12);
    expect(complete.totalFiles / duration).toBeLessThanOrEqual(25);
    const batches: number[] = [];
    let previous = 0;
    for (let millis = 50; millis <= game.work.download * 1000; millis += 50) {
      const current = getInstallFileFrame(game, jobAt(game, millis / (duration * 1000))).completedFiles;
      batches.push(current - previous);
      previous = current;
    }
    expect(batches.some(count => count === 0)).toBe(true);
    expect(Math.max(...batches)).toBeGreaterThanOrEqual(3);
  });

  it('does not lose or duplicate members at phase boundaries', () => {
    const game = GAME_MAP['red-alert'];
    const total = Object.values(game.work).reduce((sum, value) => sum + value, 0);
    let work = 0;
    for (let index = 0; index < STAGES.length - 1; index++) {
      work += game.work[STAGES[index]];
      const job = { ...jobAt(game, 0), stage: STAGES[index], stageProgress: 1, progress: work / total };
      const before = getInstallFileFrame(game, job);
      const after = getInstallFileFrame(game, { ...job, stage: STAGES[index + 1], stageProgress: 0 });
      expect(after).toEqual(before);
    }
  });
});
