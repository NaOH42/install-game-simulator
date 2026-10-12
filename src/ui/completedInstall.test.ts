import { describe, expect, it } from 'vitest';
import type { InstallJob } from '../game/types';
import { completedInstallView } from './completedInstall';

const job: InstallJob = { id: 'one', gameId: 'red-alert', stage: 'verify', stageProgress: .99, progress: .999, elapsed: 60 };
describe('completed install view', () => {
 it('holds 100% across the completion commit and celebration without holding the next real job', () => {
  const next = { ...job, id: 'two', gameId: 'legend-sword', stage: 'download' as const, progress: .01, stageProgress: .01 };
  expect(completedInstallView(job, [], ['red-alert'], [next])?.progress).toBe(1);
  expect(completedInstallView(job, ['red-alert'], ['red-alert'], [next], 'red-alert')?.stageProgress).toBe(1);
  expect(completedInstallView(job, ['red-alert'], ['red-alert'], [next])).toBeNull();
  expect(next.progress).toBe(.01);
  expect(job.progress).toBe(.999);
 });
 it('does not fabricate completion for a running, cancelled, or uninstalled job, or hold the previous queued scene', () => {
  expect(completedInstallView(job, [], [], [])).toBeNull();
  expect(completedInstallView(job, [], ['red-alert'], [job])).toBeNull();
  expect(completedInstallView(job, ['red-alert'], ['red-alert'], [], 'legend-sword')).toBeNull();
  expect(completedInstallView(undefined, [], ['red-alert'], [])).toBeNull();
 });
});
