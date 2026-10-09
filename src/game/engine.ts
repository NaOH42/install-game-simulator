import { GAME_MAP, HARDWARE } from './catalog';
import type { Action, ActionResult, GameDefinition, HardwareKey, InstallJob, SaveGame, Stage } from './types';

export const PIPELINE_COST = 480;
export const AUTOMATION_COST = 2400;
const STAGES: Stage[] = ['download', 'unpack', 'write', 'verify'];
const DISK_SPEED = [1, 3.6, 12];
const HARDWARE_LABEL: Record<HardwareKey, string> = { cpu: '处理器', ram: '内存', disk: '硬盘', gpu: '显卡', network: '网络' };
const STAGE_LABEL: Record<Stage, string> = { download: '下载', unpack: '解压', write: '写入', verify: '校验' };
const EPSILON = 1e-8;

export function createInitialState(): SaveGame {
  return {
    version: 1, points: 120, earned: 120, hardware: { cpu: 0, ram: 0, disk: 0, gpu: 0, network: 0 },
    owned: ['red-alert'], installed: [], collected: [], queue: [], jobs: [], automation: false,
    pipeline: false, autoEnabled: false, playTime: 0, installedCount: 0, events: [], nextEventId: 1,
    won: false, settings: { music: .18, effects: .25, reducedMotion: false },
  };
}

function copy(state: SaveGame): SaveGame {
  return { ...state, hardware: { ...state.hardware }, owned: [...state.owned], installed: [...state.installed],
    collected: [...state.collected], queue: [...state.queue], jobs: state.jobs.map(job => ({ ...job })),
    events: [...state.events], settings: { ...state.settings } };
}

function addEvent(state: SaveGame, text: string, kind: 'info' | 'success' | 'warning' = 'info') {
  state.events.push({ id: state.nextEventId++, text, kind });
  if (state.events.length > 80) state.events.splice(0, state.events.length - 80);
}

export function incomePerSecond(state: SaveGame): number {
  return state.installed.reduce((total, id) => total + (GAME_MAP[id]?.income ?? 0), 0);
}
export function usedSpace(state: SaveGame): number {
  return state.installed.reduce((total, id) => total + (GAME_MAP[id]?.sizeGB ?? 0), 0);
}
export function reservedSpace(state: SaveGame): number {
  return state.jobs.reduce((total, job) => total + (GAME_MAP[job.gameId]?.sizeGB ?? 0), 0);
}
export function diskCapacity(state: SaveGame): number { return HARDWARE.disk[state.hardware.disk].value; }
export function maxJobs(state: SaveGame): number { return state.pipeline ? HARDWARE.ram[state.hardware.ram].value : 1; }

export function installBlockReason(state: SaveGame, definition: GameDefinition | string): string | null {
  const game = typeof definition === 'string' ? GAME_MAP[definition] : definition;
  if (!game) return '找不到这款游戏';
  if (!state.owned.includes(game.id)) return '请先购买这款游戏';
  if (state.installed.includes(game.id)) return '游戏已经安装';
  if (state.jobs.some(job => job.gameId === game.id)) return '游戏正在安装';
  for (const key of Object.keys(game.min) as HardwareKey[]) {
    if (state.hardware[key] < game.min[key]) return `${HARDWARE_LABEL[key]}不足：需要 ${HARDWARE[key][game.min[key]].name}`;
  }
  if (usedSpace(state) + reservedSpace(state) + game.sizeGB > diskCapacity(state) + EPSILON) return '磁盘空间不足，请升级硬盘或卸载游戏';
  if (state.jobs.length >= maxJobs(state)) return '安装通道已满，等待当前任务完成';
  return null;
}

function startJob(state: SaveGame, game: GameDefinition) {
  state.queue = state.queue.filter(id => id !== game.id);
  state.jobs.push({ id: `${game.id}-${state.nextEventId}`, gameId: game.id, stage: 'download', stageProgress: 0, progress: 0, elapsed: 0 });
  addEvent(state, `开始下载《${game.title}》，预留 ${game.sizeGB.toFixed(2)} GB`);
}

function startQueued(state: SaveGame) {
  if (!state.automation || !state.autoEnabled) return;
  for (const id of [...state.queue]) {
    const game = GAME_MAP[id];
    if (game && !installBlockReason(state, game)) startJob(state, game);
    if (state.jobs.length >= maxJobs(state)) break;
  }
}

function resource(stage: Stage): 'network' | 'cpu' | 'disk' {
  return stage === 'download' ? 'network' : stage === 'unpack' ? 'cpu' : 'disk';
}

export function jobRate(state: SaveGame, job: InstallJob): number {
  const key = resource(job.stage);
  const competing = Math.max(1, state.jobs.filter(other => resource(other.stage) === key).length);
  const speed = key === 'disk' ? DISK_SPEED[state.hardware.disk] : HARDWARE[key][state.hardware[key]].value;
  return speed / competing;
}

function completeStage(state: SaveGame, job: InstallJob) {
  const game = GAME_MAP[job.gameId];
  const nextStage = STAGES[STAGES.indexOf(job.stage) + 1];
  if (nextStage) {
    job.stage = nextStage;
    job.stageProgress = 0;
    addEvent(state, `《${game.title}》${STAGE_LABEL[nextStage]}中…`);
    return;
  }
  state.jobs = state.jobs.filter(other => other.id !== job.id);
  if (!state.installed.includes(game.id)) state.installed.push(game.id);
  state.installedCount++;
  if (!state.collected.includes(game.id)) {
    state.collected.push(game.id);
    state.points += game.reward;
    state.earned += game.reward;
    addEvent(state, `《${game.title}》安装完成！首装奖励 +${game.reward} 装机点`, 'success');
  } else addEvent(state, `《${game.title}》重新安装完成，收藏收益已恢复`, 'success');
  if (game.id === 'crisis-final' && !state.won) {
    state.won = true;
    addEvent(state, '旗舰游戏安装成功！这台老电脑，终于装下了整个青春。', 'success');
  }
}

/** Advance open-page time; onIncome reports each game's passive receipts, excluding first-install rewards. */
export function tick(original: SaveGame, seconds: number, onIncome?: (gameId: string, amount: number) => void): SaveGame {
  if (!Number.isFinite(seconds) || seconds <= 0) return original;
  const state = copy(original);
  let remaining = seconds;
  startQueued(state);
  // Integrate exactly at stage boundaries so a large background tick matches small foreground ticks.
  while (remaining > EPSILON) {
    const rates = new Map(state.jobs.map(job => [job.id, jobRate(state, job)]));
    const toBoundary = state.jobs.reduce((time, job) => Math.min(time,
      GAME_MAP[job.gameId].work[job.stage] * (1 - job.stageProgress) / rates.get(job.id)!), remaining);
    const step = Math.max(0, toBoundary);
    const income = incomePerSecond(state) * step;
    state.points += income;
    state.earned += income;
    if (onIncome && step > 0) {
      for (const gameId of state.installed) {
        const amount = (GAME_MAP[gameId]?.income ?? 0) * step;
        if (amount > 0) onIncome(gameId, amount);
      }
    }
    state.playTime += step;
    remaining -= step;
    for (const job of state.jobs) {
      const game = GAME_MAP[job.gameId];
      job.elapsed += step;
      job.stageProgress = Math.min(1, job.stageProgress + rates.get(job.id)! * step / game.work[job.stage]);
      const completedWork = STAGES.slice(0, STAGES.indexOf(job.stage)).reduce((total, stage) => total + game.work[stage], 0);
      const totalWork = STAGES.reduce((total, stage) => total + game.work[stage], 0);
      job.progress = Math.min(1, (completedWork + job.stageProgress * game.work[job.stage]) / totalWork);
    }
    const finished = state.jobs.filter(job => job.stageProgress >= 1 - EPSILON);
    for (const job of finished) completeStage(state, job);
    startQueued(state);
    if (step < EPSILON && finished.length === 0) break;
  }
  return state;
}

export function dispatch(original: SaveGame, action: Action): ActionResult {
  const state = copy(original);
  const fail = (error: string): ActionResult => ({ state: original, error });
  if ('gameId' in action && !GAME_MAP[action.gameId]) return fail('找不到这款游戏');
  if (action.type === 'buy') {
    const game = GAME_MAP[action.gameId];
    if (state.owned.includes(game.id)) return fail('你已经拥有这款游戏');
    if (state.points + EPSILON < game.price) return fail('装机点不足');
    state.points = Math.max(0, state.points - game.price);
    state.owned.push(game.id);
    addEvent(state, `购买《${game.title}》，可随时重新安装`);
  } else if (action.type === 'install') {
    const game = GAME_MAP[action.gameId];
    const error = installBlockReason(state, game);
    if (error) return fail(error);
    startJob(state, game);
  } else if (action.type === 'queue') {
    const game = GAME_MAP[action.gameId];
    if (!state.owned.includes(game.id)) return fail('请先购买这款游戏');
    if (state.installed.includes(game.id)) return fail('游戏已经安装');
    if (state.jobs.some(job => job.gameId === game.id)) return fail('游戏正在安装');
    if (state.queue.includes(game.id)) return fail('游戏已在队列中');
    state.queue.push(game.id);
    addEvent(state, `《${game.title}》加入安装队列`);
  } else if (action.type === 'removeQueue') {
    state.queue = state.queue.filter(id => id !== action.gameId);
  } else if (action.type === 'moveQueue') {
    const from = state.queue.indexOf(action.gameId);
    const to = from + action.direction;
    if (from >= 0 && to >= 0 && to < state.queue.length) [state.queue[from], state.queue[to]] = [state.queue[to], state.queue[from]];
  } else if (action.type === 'uninstall') {
    if (!state.installed.includes(action.gameId)) return fail('游戏尚未安装');
    state.installed = state.installed.filter(id => id !== action.gameId);
    addEvent(state, `已卸载《${GAME_MAP[action.gameId].title}》，购买与收藏记录已保留`);
  } else if (action.type === 'upgrade') {
    const level = state.hardware[action.key];
    const upgrade = HARDWARE[action.key][level + 1];
    if (!upgrade) return fail('这项配置已经升到顶级');
    if (state.points + EPSILON < upgrade.price) return fail('装机点不足');
    state.points = Math.max(0, state.points - upgrade.price);
    state.hardware[action.key]++;
    addEvent(state, `${HARDWARE_LABEL[action.key]}升级为 ${upgrade.name}`, 'success');
  } else if (action.type === 'unlockPipeline') {
    if (state.pipeline) return fail('流水线已经解锁');
    if (state.hardware.ram < 1) return fail('请先将内存升级到 512 MB');
    if (state.points + EPSILON < PIPELINE_COST) return fail('装机点不足');
    state.points = Math.max(0, state.points - PIPELINE_COST);
    state.pipeline = true;
    addEvent(state, '流水线已解锁！下载、解压与写入可以交叠进行', 'success');
  } else if (action.type === 'unlockAutomation') {
    if (state.automation) return fail('自动队列已经解锁');
    if (!state.pipeline) return fail('请先解锁安装流水线');
    if (state.points + EPSILON < AUTOMATION_COST) return fail('装机点不足');
    state.points = Math.max(0, state.points - AUTOMATION_COST);
    state.automation = true;
    state.autoEnabled = true;
    addEvent(state, '自动队列已开启，将跳过暂时不满足条件的任务', 'success');
  } else if (action.type === 'toggleAuto') {
    if (!state.automation) return fail('请先解锁自动队列');
    state.autoEnabled = !state.autoEnabled;
  } else if (action.type === 'settings') {
    const { music, effects, reducedMotion } = action.settings;
    if (typeof music === 'number' && Number.isFinite(music)) state.settings.music = Math.max(0, Math.min(1, music));
    if (typeof effects === 'number' && Number.isFinite(effects)) state.settings.effects = Math.max(0, Math.min(1, effects));
    if (typeof reducedMotion === 'boolean') state.settings.reducedMotion = reducedMotion;
  }
  startQueued(state);
  return { state };
}
