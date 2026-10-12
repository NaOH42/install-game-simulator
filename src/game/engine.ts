import { GAME_MAP, HARDWARE } from './catalog';
import { getStoreProgress, isGameUnlocked } from './progression';
import type { Action, ActionResult, GameDefinition, HardwareKey, InstallJob, SaveGame, Stage, ResourceKey, ResourceDemand, SystemLoad, GamePerformance } from './types';

export const PIPELINE_COST = 360;
export const AUTOMATION_COST = 1400;
const STAGES: Stage[] = ['download', 'unpack', 'write', 'verify'];
const RESOURCE_KEYS: ResourceKey[] = ['cpu', 'ram', 'gpu', 'network'];
const HARDWARE_LABEL: Record<HardwareKey, string> = { cpu: '处理器', ram: '内存', disk: '硬盘', gpu: '显卡', network: '网络' };
const STAGE_LABEL: Record<Stage, string> = { download: '下载', unpack: '解压', write: '写入', verify: '校验' };
const EPSILON = 1e-8;

export function createInitialState(): SaveGame {
  return {
    version: 1, points: 120, earned: 120, hardware: { cpu: 0, ram: 0, disk: 0, gpu: 0, network: 0 },
    ownedHardware: { cpu: [0], ram: [0], disk: [0], gpu: [0], network: [0] },
    owned: ['red-alert'], installed: [], running: [], collected: [], queue: [], jobs: [], automation: false,
    pipeline: false, autoEnabled: false, playTime: 0, installedCount: 0, events: [], nextEventId: 1,
    won: false, settings: { music: .18, effects: .25, reducedMotion: false },
  };
}

function copy(state: SaveGame): SaveGame {
  return { ...state, hardware: { ...state.hardware }, owned: [...state.owned], installed: [...state.installed],
    running: [...state.running], ownedHardware: Object.fromEntries(Object.entries(state.ownedHardware).map(([key, options]) => [key, [...options]])) as SaveGame['ownedHardware'],
    collected: [...state.collected], queue: [...state.queue], jobs: state.jobs.map(job => ({ ...job })),
    events: [...state.events], settings: { ...state.settings } };
}

function addEvent(state: SaveGame, text: string, kind: 'info' | 'success' | 'warning' = 'info') {
  state.events.push({ id: state.nextEventId++, text, kind });
  if (state.events.length > 80) state.events.splice(0, state.events.length - 80);
}

function compatibilityFor(state: SaveGame, game: GameDefinition) {
  const overhead: ResourceDemand = { cpu: 1, ram: 1, gpu: 1, network: 1 };
  let ceiling = 1;
  let bottleneck: ResourceKey | null = null;
  for (const key of RESOURCE_KEYS) {
    if (game.runtime[key] <= 0 || key === 'network' && !game.online) continue;
    const available = HARDWARE[key][state.hardware[key]].capacity;
    const reference = HARDWARE[key][game.min[key]].capacity;
    const fit = Math.min(1, available / reference);
    // Compatibility workarounds consume extra resources even before the machine reaches full load.
    overhead[key] = 1 + (1 - fit) * .45;
    const limit = Math.sqrt(fit);
    if (limit < ceiling) { ceiling = limit; bottleneck = key; }
  }
  return { overhead, ceiling, bottleneck };
}

function runtimeDemand(state: SaveGame, game: GameDefinition): ResourceDemand {
  const { overhead } = compatibilityFor(state, game);
  return {
    cpu: game.runtime.cpu * overhead.cpu * (1 - HARDWARE.gpu[state.hardware.gpu].cpuRelief),
    ram: game.runtime.ram * overhead.ram,
    gpu: game.runtime.gpu * overhead.gpu,
    network: game.online ? game.runtime.network * overhead.network : 0,
  };
}

export function getSystemLoad(state: SaveGame): SystemLoad {
  const load = Object.fromEntries(RESOURCE_KEYS.map(key => [key, { demand: 0, capacity: HARDWARE[key][state.hardware[key]].capacity, ratio: 0 }])) as SystemLoad;
  for (const id of state.running) {
    const game = GAME_MAP[id];
    if (!game) continue;
    const demand = runtimeDemand(state, game);
    for (const key of RESOURCE_KEYS) load[key].demand += demand[key];
  }
  for (const job of state.jobs) {
    const game = GAME_MAP[job.gameId];
    load.ram.demand += Math.max(8, Math.min(96, game.runtime.ram * .25));
    load.cpu.demand += job.stage === 'unpack' ? load.cpu.capacity : load.cpu.capacity * (job.stage === 'verify' ? .25 : .06);
    if (job.stage === 'download') load.network.demand += load.network.capacity;
  }
  for (const key of RESOURCE_KEYS) load[key].ratio = load[key].demand / load[key].capacity;
  return load;
}

function efficiencyFor(demand: ResourceDemand, load: SystemLoad, compatibility: ReturnType<typeof compatibilityFor>): { efficiency: number; bottleneck: ResourceKey | null } {
  let efficiency = compatibility.ceiling;
  let bottleneck: ResourceKey | null = compatibility.bottleneck;
  for (const key of RESOURCE_KEYS) {
    if (demand[key] <= 0) continue;
    const factor = 1 / Math.max(1, load[key].ratio);
    if (factor < efficiency) { efficiency = factor; bottleneck = key; }
  }
  return { efficiency, bottleneck };
}

export function gamePerformance(state: SaveGame, id: string): GamePerformance {
  const game = GAME_MAP[id];
  if (!game) return { running: false, efficiency: 0, incomePerSecond: 0, baseIncome: 0, demand: { cpu: 0, ram: 0, gpu: 0, network: 0 }, bottleneck: null };
  const running = state.running.includes(id);
  const demand = runtimeDemand(state, game);
  const load = getSystemLoad(running ? state : { ...state, running: [...state.running, id] });
  const performance = efficiencyFor(demand, load, compatibilityFor(state, game));
  return { running, ...performance, incomePerSecond: running ? game.income * performance.efficiency : 0, baseIncome: game.income, demand };
}

export function hardwareMeetsRecommendation(state: SaveGame, game: GameDefinition, key: HardwareKey): boolean {
  return HARDWARE[key][state.hardware[key]].capacity >= HARDWARE[key][game.recommended[key]].capacity;
}

function incomeRates(state: SaveGame): Array<{ gameId: string; rate: number }> {
  const load = getSystemLoad(state);
  return state.running.map(gameId => ({ gameId, rate: GAME_MAP[gameId].income * efficiencyFor(runtimeDemand(state, GAME_MAP[gameId]), load, compatibilityFor(state, GAME_MAP[gameId])).efficiency }));
}

export function incomePerSecond(state: SaveGame): number {
  return incomeRates(state).reduce((total, entry) => total + entry.rate, 0);
}
export function usedSpace(state: SaveGame): number {
  return state.installed.reduce((total, id) => total + (GAME_MAP[id]?.sizeGB ?? 0), 0);
}
export function reservedSpace(state: SaveGame): number {
  return state.jobs.reduce((total, job) => total + (GAME_MAP[job.gameId]?.sizeGB ?? 0), 0);
}
export function diskCapacity(state: SaveGame): number { return HARDWARE.disk[state.hardware.disk].capacity; }
export function maxJobs(state: SaveGame): number { return state.pipeline ? HARDWARE.ram[state.hardware.ram].slots : 1; }

export function installBlockReason(state: SaveGame, definition: GameDefinition | string): string | null {
  const game = typeof definition === 'string' ? GAME_MAP[definition] : definition;
  if (!game) return '找不到这款游戏';
  if (!state.owned.includes(game.id)) return '请先购买这款游戏';
  if (state.installed.includes(game.id)) return '游戏已经安装';
  if (state.jobs.some(job => job.gameId === game.id)) return '游戏正在安装';
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
  const load = getSystemLoad(state);
  const competing = Math.max(1, state.jobs.filter(other => resource(other.stage) === key).length);
  const speed = HARDWARE[key][state.hardware[key]].installSpeed;
  const resourceShare = key === 'disk' ? 1 / competing : 1 / Math.max(1, load[key].ratio);
  const memoryShare = 1 / Math.max(1, load.ram.ratio);
  const auxiliaryCpu = key === 'cpu' ? 1 : 1 / Math.max(1, load.cpu.ratio);
  return speed * resourceShare * memoryShare * auxiliaryCpu;
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
  const previouslyUnlocked = getStoreProgress(state).unlockedCount;
  state.jobs = state.jobs.filter(other => other.id !== job.id);
  if (!state.installed.includes(game.id)) state.installed.push(game.id);
  state.installedCount++;
  if (!state.collected.includes(game.id)) {
    state.collected.push(game.id);
    state.points += game.reward;
    state.earned += game.reward;
    addEvent(state, `《${game.title}》安装完成！首装奖励 +${game.reward} 装机点`, 'success');
    const newlyUnlocked = getStoreProgress(state).unlockedCount - previouslyUnlocked;
    if (newlyUnlocked > 0) addEvent(state, `商店上新：新解锁 ${newlyUnlocked} 款游戏，快去看看。`, 'success');
  } else addEvent(state, `《${game.title}》重新安装完成，启动运行后恢复收益`, 'success');
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
    const receipts = incomeRates(state);
    const income = receipts.reduce((sum, entry) => sum + entry.rate, 0) * step;
    state.points += income;
    state.earned += income;
    if (onIncome && step > 0) {
      for (const { gameId, rate } of receipts) {
        if (rate > 0) onIncome(gameId, rate * step);
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
  if (action.type === 'run') {
    if (!state.installed.includes(action.gameId)) return fail('请先安装这款游戏');
    if (state.running.includes(action.gameId)) return fail('游戏已经在运行');
    state.running.push(action.gameId);
    addEvent(state, `启动《${GAME_MAP[action.gameId].title}》，运行收益开始结算`);
  } else if (action.type === 'stop') {
    if (!state.running.includes(action.gameId)) return fail('游戏没有在运行');
    state.running = state.running.filter(id => id !== action.gameId);
    addEvent(state, `已停止《${GAME_MAP[action.gameId].title}》，释放运行资源`);
  } else if (action.type === 'stopAll') {
    state.running = [];
    addEvent(state, '已停止全部游戏，电脑资源已释放');
  } else if (action.type === 'buy') {
    const game = GAME_MAP[action.gameId];
    if (!isGameUnlocked(state, game.id)) return fail('这款游戏尚未解锁，请先安装已揭晓的游戏');
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
    state.running = state.running.filter(id => id !== action.gameId);
    addEvent(state, `已卸载《${GAME_MAP[action.gameId].title}》，购买与收藏记录已保留`);
  } else if (action.type === 'upgrade' || action.type === 'equipHardware') {
    const current = HARDWARE[action.key][state.hardware[action.key]];
    const option = action.option ?? (current.generation < 2 ? current.generation + 1 : -1);
    const target = HARDWARE[action.key][option];
    if (!Number.isInteger(option) || !target) return fail('请选择一个有效硬件型号');
    const owned = state.ownedHardware[action.key].includes(option);
    if (action.type === 'equipHardware' && !owned) return fail('请先购买这个硬件型号');
    if (state.hardware[action.key] === option) return fail('这个硬件已经装上了');
    if (!owned && state.points + EPSILON < target.price) return fail('装机点不足');
    if (action.key === 'disk' && usedSpace(state) + reservedSpace(state) > target.capacity + EPSILON) return fail('目标硬盘容量不足，请先卸载游戏');
    if (action.key === 'ram' && state.jobs.length > (state.pipeline ? target.slots : 1)) return fail('目标内存的安装通道不足，请等待当前任务完成');
    if (!owned) {
      state.points = Math.max(0, state.points - target.price);
      state.ownedHardware[action.key].push(option);
    }
    state.hardware[action.key] = option;
    addEvent(state, `${owned ? '免费换装' : '购入并换装'}${HARDWARE_LABEL[action.key]}：${target.name}`, 'success');
  } else if (action.type === 'unlockPipeline') {
    if (state.pipeline) return fail('流水线已经解锁');
    if (HARDWARE.ram[state.hardware.ram].capacity < 512) return fail('请先配备至少 512 MB 内存');
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
