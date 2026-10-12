import { getSystemLoad } from '../game/engine';
import type { SaveGame, Stage, SystemLoad } from '../game/types';
import { getInstallIntensity } from './installIntensity';

/** Normalized sound controls; acoustic inertia and volume belong to the audio renderer. */
export interface MachineActivity {
 fanLoad: number;
 diskActivity: number;
 diskIntensity: number;
}

const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const DISK_ACTIVITY: Record<Stage, number> = { download: .14, unpack: .42, write: .78, verify: .64 };

/** Read actual work, independently of the focused installer or waiting queue. */
export function getMachineActivity(state: SaveGame, load: SystemLoad = getSystemLoad(state)): MachineActivity {
 const cpu = clamp(load.cpu.ratio);
 const gpu = clamp(load.gpu.ratio);
 // CPU and GPU each spin up the case; simultaneous saturation reaches full cooling.
 const fanLoad = clamp(.85 * cpu + .6 * gpu - .45 * cpu * gpu);
 const active = state.jobs.length > 0 || state.running.length > 0;
 const runtimeReads = Math.min(.14, state.running.length * .045);
 const paging = active ? .55 * clamp((load.ram.ratio - 1) / 1.5) : 0;
 let diskIdle = (1 - runtimeReads) * (1 - paging);
 let diskIntensity = 0;
 for (const job of state.jobs) {
  // Shared hardware cannot get arbitrarily louder simply by adding jobs.
  diskIdle *= 1 - DISK_ACTIVITY[job.stage];
  if (job.stage === 'write' || job.stage === 'verify') {
   diskIntensity = Math.max(diskIntensity, getInstallIntensity(job.progress));
  }
 }
 return { fanLoad, diskActivity: clamp(1 - diskIdle), diskIntensity };
}
