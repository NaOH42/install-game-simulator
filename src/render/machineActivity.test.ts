import { describe, expect, it } from 'vitest';
import { createInitialState, getSystemLoad } from '../game/engine';
import type { InstallJob, SaveGame, Stage, SystemLoad } from '../game/types';
import { getMachineActivity } from './machineActivity';

const job = (stage: Stage, progress = .5, id = stage): InstallJob => ({
 id, gameId: 'red-alert', stage, progress, stageProgress: .5, elapsed: 20,
});
const installing = (stage: Stage, progress = .5): SaveGame => ({ ...createInitialState(), jobs: [job(stage, progress)] });
function withLoad(state: SaveGame, ratios: Partial<Record<keyof SystemLoad, number>>) {
 const load = getSystemLoad(state);
 for (const key of Object.keys(ratios) as Array<keyof SystemLoad>) load[key] = { ...load[key], ratio: ratios[key]! };
 return getMachineActivity(state, load);
}

describe('actual machine activity for sound', () => {
 it('keeps idle, merely installed games and blocked queued games free of work sounds', () => {
  const initial = createInitialState();
  const quiet = { fanLoad: 0, diskActivity: 0, diskIntensity: 0 };
  expect(getMachineActivity(initial)).toEqual(quiet);
  expect(getMachineActivity({ ...initial, installed: ['red-alert'], queue: ['legend-sword'], automation: true, autoEnabled: true })).toEqual(quiet);
 });

 it('follows real running and installation loads, with independent CPU and GPU contributions', () => {
  const idle = createInitialState();
  const running = { ...idle, installed: ['red-alert'], running: ['red-alert'] };
  const activity = getMachineActivity(running);
  expect(activity.fanLoad).toBeGreaterThan(0);
  expect(activity.diskActivity).toBeGreaterThan(0);
  expect(activity.diskActivity).toBeLessThan(.15);
  expect(activity.diskIntensity).toBe(0);
  expect(withLoad(running, { cpu: .6, gpu: .1 }).fanLoad).toBeGreaterThan(withLoad(running, { cpu: .2, gpu: .1 }).fanLoad);
  expect(withLoad(running, { cpu: .2, gpu: .8 }).fanLoad).toBeGreaterThan(withLoad(running, { cpu: .2, gpu: .1 }).fanLoad);
  expect(getMachineActivity(installing('unpack')).fanLoad).toBeGreaterThan(getMachineActivity(installing('download')).fanLoad);
  expect(getMachineActivity({ ...running, running: [] })).toEqual({ fanLoad: 0, diskActivity: 0, diskIntensity: 0 });
 });

 it('makes writing and verification seek more than unpacking and download buffering', () => {
  const activity = (stage: Stage) => getMachineActivity(installing(stage)).diskActivity;
  expect(activity('write')).toBeGreaterThan(activity('verify'));
  expect(activity('verify')).toBeGreaterThan(activity('unpack'));
  expect(activity('unpack')).toBeGreaterThan(activity('download'));
  expect(activity('download')).toBeGreaterThan(0);
 });

 it('builds the final seek density only from actual write/verify progress', () => {
  expect(getMachineActivity(installing('download', .99)).diskIntensity).toBe(0);
  expect(getMachineActivity(installing('unpack', .99)).diskIntensity).toBe(0);
  const early = getMachineActivity(installing('write', .65));
  const late = getMachineActivity(installing('write', .88));
  const final = getMachineActivity(installing('verify', .98));
  expect(late.diskIntensity).toBeGreaterThan(early.diskIntensity);
  expect(final.diskIntensity).toBeGreaterThan(late.diskIntensity);
  expect(final.diskIntensity).toBe(1);
  // Finishing a task immediately removes its final-write emphasis.
  expect(getMachineActivity({ ...installing('verify', .98), jobs: [] }).diskIntensity).toBe(0);
 });

 it('includes every active task, with bounded combined activity and no queue contribution', () => {
  const single = installing('download', .2);
  const parallel = { ...single, jobs: [...single.jobs, job('write', .8), job('verify', .98)] };
  const all = getMachineActivity(parallel);
  expect(all.diskIntensity).toBe(1);
  expect(all.diskActivity).toBeGreaterThan(getMachineActivity(installing('write')).diskActivity);
  expect(getMachineActivity({ ...parallel, jobs: [...parallel.jobs].reverse(), queue: ['legend-sword', 'need-parking'] })).toEqual(all);
  const overload = withLoad({ ...parallel, running: Array.from({ length: 20 }, () => 'red-alert') }, { cpu: 99, gpu: 99, ram: 99 });
  for (const value of Object.values(overload)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
  expect(overload.fanLoad).toBe(1);
 });

 it('adds restrained paging only when active work exceeds available memory', () => {
  const running = { ...createInitialState(), installed: ['red-alert'], running: ['red-alert'] };
  const normal = withLoad(running, { ram: .5 });
  expect(withLoad(running, { ram: 1 }).diskActivity).toBe(normal.diskActivity);
  const pressure = withLoad(running, { ram: 1.5 });
  const severe = withLoad(running, { ram: 2.5 });
  expect(pressure.diskActivity).toBeGreaterThan(normal.diskActivity);
  expect(severe.diskActivity).toBeGreaterThan(pressure.diskActivity);
  expect(severe.diskActivity).toBeLessThan(.6);
  expect(severe.diskIntensity).toBe(0);
  expect(withLoad(createInitialState(), { ram: 3 }).diskActivity).toBe(0);
 });

 it('is read-only, accepts the existing shared load, and returns safe controls for malformed ratios', () => {
  const state = installing('write', .9);
  const snapshot = JSON.stringify(state);
  expect(getMachineActivity(state, getSystemLoad(state))).toEqual(getMachineActivity(state));
  expect(JSON.stringify(state)).toBe(snapshot);
  const invalid = withLoad(state, { cpu: NaN, gpu: Infinity, ram: NaN });
  expect(Object.values(invalid).every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
 });
});
