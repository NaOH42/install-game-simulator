import type { GameDefinition, Genre, InstallJob, Stage } from './types';

export interface InstallPresentation {
  displayProgress: number;
  fileName: string;
  fileProgress: number;
  completedFiles: number;
  totalFiles: number;
  recentFiles: string[];
}

const STAGES: Stage[] = ['download', 'unpack', 'write', 'verify'];
const FILE_STEMS: Record<Genre, string[]> = {
  strategy: ['terrain', 'armored_units', 'command_center', 'battlefield', 'supply_depot', 'radar', 'campaign', 'explosions', 'unit_voices', 'tactical_maps'],
  wuxia: ['bamboo_forest', 'sword_forms', 'ancient_temple', 'moonlight', 'hero_robes', 'spirit_mountain', 'martial_arts', 'story_dialogue', 'jade_flute', 'clouds'],
  racing: ['asphalt', 'car_bodies', 'city_streets', 'headlights', 'engine_sounds', 'rain_effects', 'race_tracks', 'dashboard', 'tire_marks', 'finish_line'],
  scifi: ['star_fields', 'space_station', 'planet_surface', 'alien_ruins', 'ship_engines', 'nebulae', 'holograms', 'airlock', 'robot_voices', 'jump_gate'],
};
const FILE_PATHS: Record<Stage, { folder: string; extension: string }> = {
  download: { folder: 'packages', extension: 'cab' },
  unpack: { folder: 'textures', extension: 'pak' },
  write: { folder: 'data', extension: 'dat' },
  verify: { folder: 'integrity', extension: 'crc' },
};
const BASE_WEIGHTS = [.015, .022, .035, .043, .06, .075, .1, .15, .2, .3];
const WITHIN_FILE_CREEP = .12;
type FileBlock = { name: string; start: number; end: number };
const manifests = new Map<string, FileBlock[][]>();

function seededRandom(text: string): () => number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  value >>>= 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function manifest(game: GameDefinition): FileBlock[][] {
  const key = `${game.id}:${game.genre}`;
  const cached = manifests.get(key);
  if (cached) return cached;
  const random = seededRandom(key);
  const result = STAGES.map(stage => {
    const weights = BASE_WEIGHTS.map(weight => weight * (.95 + random() * .1));
    for (let index = weights.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [weights[index], weights[other]] = [weights[other], weights[index]];
    }
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let end = 0;
    return weights.map((weight, index) => {
      const start = end;
      end = index === weights.length - 1 ? 1 : end + weight / total;
      const { folder, extension } = FILE_PATHS[stage];
      return { name: `${folder}/${FILE_STEMS[game.genre][index]}.${extension}`, start, end };
    });
  });
  manifests.set(key, result);
  return result;
}

function fraction(value: number): number { return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0; }

/** File completion controls the displayed bar; simulation throughput and rewards remain untouched. */
export function getInstallPresentation(game: GameDefinition, job: InstallJob): InstallPresentation {
  const stages = manifest(game);
  const allFiles = stages.flat();
  const totalFiles = allFiles.length;
  const realProgress = fraction(job.progress);
  if (realProgress === 1) {
    return { displayProgress: 1, fileName: allFiles[totalFiles - 1].name, fileProgress: 1,
      completedFiles: totalFiles, totalFiles, recentFiles: allFiles.slice(-8).map(file => file.name) };
  }
  const stageIndex = STAGES.indexOf(job.stage);
  const files = stages[stageIndex];
  const stageProgress = fraction(job.stageProgress);
  const completeInStage = files.filter(file => stageProgress >= file.end).length;
  const previousFiles = stages.slice(0, stageIndex).flat();
  const completed = [...previousFiles, ...files.slice(0, completeInStage)];
  const file = files[Math.min(completeInStage, files.length - 1)];
  const fileProgress = completeInStage === files.length ? 1 : fraction((stageProgress - file.start) / (file.end - file.start));
  const displayedStage = completeInStage === files.length ? 1
    : file.start + (file.end - file.start) * fileProgress * WITHIN_FILE_CREEP;
  const totalWork = STAGES.reduce((sum, stage) => sum + game.work[stage], 0);
  const previousWork = STAGES.slice(0, stageIndex).reduce((sum, stage) => sum + game.work[stage], 0);
  const displayProgress = Math.min(realProgress, fraction((previousWork + displayedStage * game.work[job.stage]) / totalWork));
  return { displayProgress, fileName: file.name, fileProgress, completedFiles: completed.length, totalFiles,
    recentFiles: completed.slice(-8).map(block => block.name) };
}
