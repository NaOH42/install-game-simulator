import type { GameDefinition, Genre, InstallJob, Stage } from './types';

export interface InstallFileEntry {
  index: number;
  stage: Stage;
  path: string;
  operation: string;
}
export interface InstallFileFrame {
  completedFiles: number;
  totalFiles: number;
  entries: InstallFileEntry[];
}

const STAGES: Stage[] = ['download', 'unpack', 'write', 'verify'];
const NOMINAL_SPEED = [1, 3.6, 12];
const FILES_PER_SECOND: Record<Stage, number> = { download: 18, unpack: 24, write: 22, verify: 14 };
const ASSETS: Record<Genre, string[]> = {
  strategy: ['terrain', 'armor', 'base', 'radar', 'campaign', 'voices'],
  wuxia: ['bamboo', 'swords', 'temple', 'robes', 'mountain', 'dialogue'],
  racing: ['asphalt', 'cars', 'city', 'engines', 'rain', 'tracks'],
  scifi: ['stars', 'station', 'planets', 'ruins', 'nebula', 'robots'],
};
const OPERATIONS: Record<Stage, string> = { download: 'FETCH', unpack: 'EXPAND', write: 'WRITE', verify: 'CHECK' };
// Several tiny members travel together; large members briefly hold the stream.
const MEMBER_WEIGHTS = [.015, .015, .02, .02, .04, .06, .07, .07, .11, .16, .18, .24];
const MEMBERS_PER_GROUP = MEMBER_WEIGHTS.length;
const MAX_RETURNED_LINES = 24;

function hash(id: string): number {
  let value = 2166136261;
  for (let index = 0; index < id.length; index++) value = Math.imul(value ^ id.charCodeAt(index), 16777619);
  return value >>> 0;
}

function stageCounts(game: GameDefinition): number[] {
  const speed = NOMINAL_SPEED[Math.max(0, Math.min(2, game.tier - 1))];
  return STAGES.map(stage => Math.max(1, Math.ceil(game.work[stage] / speed * FILES_PER_SECOND[stage] / MEMBERS_PER_GROUP)) * MEMBERS_PER_GROUP);
}

function completedInStage(progress: number, count: number, seed: number): number {
  const fraction = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (fraction === 1) return count;
  const groups = count / MEMBERS_PER_GROUP;
  const groupPosition = fraction * groups;
  const completedGroups = Math.floor(groupPosition);
  const withinGroup = groupPosition - completedGroups;
  const rotation = (seed + Math.imul(completedGroups, 7)) % MEMBERS_PER_GROUP;
  let edge = 0;
  let completeMembers = 0;
  for (let index = 0; index < MEMBERS_PER_GROUP; index++) {
    edge += MEMBER_WEIGHTS[(index + rotation) % MEMBERS_PER_GROUP];
    if (withinGroup + 1e-12 >= edge) completeMembers++;
    else break;
  }
  return Math.min(count, completedGroups * MEMBERS_PER_GROUP + completeMembers);
}

function makeEntry(game: GameDefinition, counts: number[], index: number): InstallFileEntry {
  let stageIndex = 0;
  let localIndex = index - 1;
  while (stageIndex < STAGES.length - 1 && localIndex >= counts[stageIndex]) localIndex -= counts[stageIndex++];
  const stage = STAGES[stageIndex];
  const assets = ASSETS[game.genre];
  const asset = assets[(Math.floor(localIndex / 37) + hash(game.id)) % assets.length];
  const serial = String(localIndex + 1).padStart(5, '0');
  const suffix: Record<Stage, string> = {
    download: `setup\\${asset}\\vol_${serial}.cab`,
    unpack: `textures\\${asset}\\mip_${serial}.dds`,
    write: `data\\${asset}\\part_${serial}.bin`,
    verify: `cache\\checksums\\${asset}_${serial}.crc`,
  };
  return { index, stage, path: `C:\\Program Files\\Century Games\\${game.id}\\${suffix[stage]}`, operation: OPERATIONS[stage] };
}

/** Derived solely from completed work: no wall clock, synthetic catch-up, or accumulated log array. */
export function getInstallFileFrame(game: GameDefinition, job: InstallJob): InstallFileFrame {
  const counts = stageCounts(game);
  const stageIndex = STAGES.indexOf(job.stage);
  const priorFiles = counts.slice(0, stageIndex).reduce((sum, count) => sum + count, 0);
  const totalFiles = counts.reduce((sum, count) => sum + count, 0);
  const completedFiles = job.progress >= 1 ? totalFiles
    : priorFiles + completedInStage(job.stageProgress, counts[stageIndex], hash(`${game.id}:${job.stage}`));
  const first = Math.max(1, completedFiles - MAX_RETURNED_LINES + 1);
  const entries: InstallFileEntry[] = [];
  for (let index = first; index <= completedFiles; index++) entries.push(makeEntry(game, counts, index));
  return { completedFiles, totalFiles, entries };
}
