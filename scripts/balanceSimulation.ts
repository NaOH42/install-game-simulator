import { GAMES, GAME_MAP, HARDWARE } from '../src/game/catalog';
import { isGameUnlocked } from '../src/game/progression';
import {
  AUTOMATION_COST, PIPELINE_COST, createInitialState, dispatch, diskCapacity, gamePerformance,
  getSystemLoad, incomePerSecond, installBlockReason, jobRate, maxJobs, reservedSpace, tick, usedSpace,
} from '../src/game/engine';
import type { Action, GameDefinition, HardwareKey, InstallJob, ResourceKey, SaveGame, Stage } from '../src/game/types';

const resources: ResourceKey[] = ['cpu', 'ram', 'gpu', 'network'];
const hardwareKeys: HardwareKey[] = ['cpu', 'ram', 'disk', 'gpu', 'network'];
const stages: Stage[] = ['download', 'unpack', 'write', 'verify'];

export type StrategyName = 'balanced' | 'installer' | 'collector';
interface Strategy {
  label: string;
  options: Record<HardwareKey, [number, number]>;
  budget: Record<ResourceKey, number>;
  incomeHorizon: number;
  speedWeight: number;
  preserveInstalled: boolean;
}
export const STRATEGIES: Record<StrategyName, Strategy> = {
  balanced: {
    label: '均衡：改善实际瓶颈，兼顾收益和安装',
    options: { cpu: [1, 2], ram: [1, 2], disk: [1, 2], gpu: [1, 2], network: [1, 2] },
    budget: { cpu: .72, ram: .82, gpu: 1, network: .65 }, incomeHorizon: 180, speedWeight: .45, preserveInstalled: false,
  },
  installer: {
    label: '装机：高频处理器、突发宽带和安装通道',
    options: { cpu: [3, 2], ram: [1, 2], disk: [1, 2], gpu: [1, 2], network: [3, 2] },
    budget: { cpu: .58, ram: .78, gpu: 1, network: .5 }, incomeHorizon: 120, speedWeight: .8, preserveInstalled: false,
  },
  collector: {
    label: '收藏：大容量、多开和协处理显卡',
    options: { cpu: [1, 4], ram: [3, 4], disk: [3, 4], gpu: [3, 4], network: [1, 4] },
    budget: { cpu: .88, ram: .9, gpu: 1.05, network: .8 }, incomeHorizon: 240, speedWeight: .3, preserveInstalled: true,
  },
};

export interface BalanceMilestone {
  event: string; seconds: number; collected: number; running: number; income: number; points: number;
  key?: HardwareKey; option?: number;
}
export interface BalanceReport {
  strategy: StrategyName; label: string; complete: boolean; seconds: number;
  flagshipSeconds: number | null; firstUpgradeSeconds: number | null; pipelineSeconds: number | null; automationSeconds: number | null;
  collected: number; running: number; won: boolean; automation: boolean; income: number; points: number;
  earned: number; spent: number; passiveIncome: number; firstInstallRewards: number;
  moneyWaitSeconds: number; longestMoneyWaitSeconds: number;
  longestMoneyWait: { from: number; to: number; nextGame: string; pointsNeeded: number } | null;
  runInstallOverlapSeconds: number; installIncomeReceipts: number; installationSeconds: number;
  lowConfigInstallStarts: number; managementChanges: number;
  finalHardware: Record<HardwareKey, { option: number; name: string }>;
  hardwarePurchases: Array<{ seconds: number; key: HardwareKey; option: number; price: number; name: string }>;
  usedGB: number; capacityGB: number; milestones: BalanceMilestone[];
}

function remainingGames(state: SaveGame): GameDefinition[] {
  return GAMES.filter(game => isGameUnlocked(state, game.id) && !state.collected.includes(game.id)
    && !state.jobs.some(job => job.gameId === game.id) && !state.queue.includes(game.id));
}

/** This is a planning budget, never an installation gate. */
export function nextGameBudget(state: SaveGame): number {
  const game = remainingGames(state).find(game => !state.owned.includes(game.id));
  return game?.price ?? 0;
}

/** Greedy running set keeps headroom for the installer. */
function runningSelection(state: SaveGame, policy: Strategy): string[] {
  const idle = { ...state, running: [], jobs: [] };
  const capacity = getSystemLoad(idle);
  const rank = (id: string) => {
    const performance = gamePerformance(idle, id);
    const normalizedCost = Math.max(...resources.map(key => performance.demand[key] / capacity[key].capacity));
    return performance.baseIncome * performance.efficiency / Math.max(.01, normalizedCost);
  };
  const installed = [...state.installed].sort((a, b) => rank(b) - rank(a) || GAMES.indexOf(GAME_MAP[a]) - GAMES.indexOf(GAME_MAP[b]));
  const selected: string[] = [];
  for (const id of installed) {
    const candidate = { ...idle, running: [...selected, id] };
    const load = getSystemLoad(candidate);
    if (!selected.length || resources.every(key => load[key].ratio <= policy.budget[key])) selected.push(id);
  }
  return selected;
}

function withSelectedRunning(state: SaveGame, policy: Strategy): SaveGame {
  return { ...state, running: runningSelection(state, policy) };
}

/** Predicted work duration uses real resource-sharing equations, never an invented model rank. */
function plannedInstallSeconds(state: SaveGame, game: GameDefinition): number {
  const planning = { ...state, jobs: [] as InstallJob[] };
  return stages.reduce((seconds, stage) => {
    const job: InstallJob = { id: 'planning', gameId: game.id, stage, stageProgress: 0, progress: 0, elapsed: 0 };
    return seconds + game.work[stage] / jobRate({ ...planning, jobs: [job] }, job);
  }, 0);
}

/** Catalog index is an identity and never a capacity rank. */
export function chooseDiskOption(state: SaveGame, requiredGB: number, strategy: StrategyName): number | null {
  const current = HARDWARE.disk[state.hardware.disk];
  if (requiredGB <= current.capacity + 1e-8) return null;
  const preferred = STRATEGIES[strategy].options.disk;
  const candidates = HARDWARE.disk.map((model, option) => ({ model, option }))
    .filter(({ model }) => model.capacity >= requiredGB - 1e-8 && model.capacity > current.capacity);
  candidates.sort((a, b) => {
    const preferenceA = preferred.includes(a.option) ? 0 : 1;
    const preferenceB = preferred.includes(b.option) ? 0 : 1;
    return preferenceA - preferenceB || a.model.price - b.model.price || a.model.capacity - b.model.capacity || a.option - b.option;
  });
  return candidates[0]?.option ?? null;
}

function hardwareCandidates(state: SaveGame, policy: Strategy) {
  if (state.collected.length < 1) return [];
  const next = remainingGames(state)[0] ?? GAMES[GAMES.length - 1];
  const baseline = withSelectedRunning(state, policy);
  const beforeSeconds = plannedInstallSeconds(baseline, next);
  const beforeIncome = incomePerSecond(baseline);
  const candidates: Array<{ key: HardwareKey; option: number; score: number }> = [];
  for (const key of hardwareKeys) {
    const current = HARDWARE[key][state.hardware[key]];
    for (const option of policy.options[key]) {
      const model = HARDWARE[key][option];
      if (model.generation <= current.generation) continue;
      if (key === 'ram' && state.jobs.length > (state.pipeline ? model.slots : 1)) continue;
      if (key === 'disk' && usedSpace(state) + reservedSpace(state) > model.capacity + 1e-8) continue;
      const planned = withSelectedRunning({ ...state, hardware: { ...state.hardware, [key]: option } }, policy);
      const saved = Math.max(0, beforeSeconds - plannedInstallSeconds(planned, next));
      const incomeDelta = Math.max(0, incomePerSecond(planned) - beforeIncome);
      const canUseParallelism = state.pipeline || state.points >= model.price + nextGameBudget(state) + PIPELINE_COST;
      const parallelBenefit = canUseParallelism && key === 'ram' && model.slots > HARDWARE.ram[state.hardware.ram].slots
        ? beforeSeconds * .25 * (model.slots - HARDWARE.ram[state.hardware.ram].slots) : 0;
      const benefit = saved * policy.speedWeight + incomeDelta * policy.incomeHorizon + parallelBenefit;
      if (benefit > 1) candidates.push({ key, option, score: benefit / Math.max(1, model.price) });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || hardwareKeys.indexOf(a.key) - hardwareKeys.indexOf(b.key));
}

export function simulateBalance(strategy: StrategyName, maxSeconds = 10800): BalanceReport {
  const policy = STRATEGIES[strategy];
  let state = createInitialState();
  const startingPoints = state.points;
  const milestones: BalanceMilestone[] = [];
  const purchases: BalanceReport['hardwarePurchases'] = [];
  let firstUpgradeSeconds: number | null = null;
  let pipelineSeconds: number | null = null;
  let automationSeconds: number | null = null;
  let flagshipSeconds: number | null = null;
  let moneyWaitSeconds = 0;
  let longestMoneyWaitSeconds = 0;
  let waitStart: number | null = null;
  let waitGame = '';
  let waitNeeded = 0;
  let longestMoneyWait: BalanceReport['longestMoneyWait'] = null;
  let runInstallOverlapSeconds = 0;
  let installIncomeReceipts = 0;
  let installationSeconds = 0;
  let lowConfigInstallStarts = 0;
  let managementChanges = 0;
  let spent = 0;
  let passiveIncome = 0;
  const record = (event: string, key?: HardwareKey, option?: number) => milestones.push({
    event, seconds: Math.round(state.playTime), collected: state.collected.length, running: state.running.length,
    income: Number(incomePerSecond(state).toFixed(2)), points: Number(state.points.toFixed(2)), key, option,
  });
  const act = (action: Action) => {
    const previous = state;
    const result = dispatch(state, action);
    if (result.error) throw new Error(`${strategy}: ${JSON.stringify(action)} at ${state.playTime}: ${result.error}`);
    state = result.state;
    spent += previous.points - state.points;
    for (const job of state.jobs.filter(job => !previous.jobs.some(old => old.id === job.id))) {
      const game = GAME_MAP[job.gameId];
      if (resources.some(key => HARDWARE[key][state.hardware[key]].capacity < HARDWARE[key][game.min[key]].capacity)) lowConfigInstallStarts++;
    }
    if (action.type === 'upgrade') {
      const option = action.option!;
      const model = HARDWARE[action.key][option];
      purchases.push({ seconds: Math.round(state.playTime), key: action.key, option, price: previous.points - state.points, name: model.name });
      if (firstUpgradeSeconds === null) firstUpgradeSeconds = Math.round(state.playTime);
      record(`换装 ${action.key} ${model.name}`, action.key, option);
    }
    if (action.type === 'unlockPipeline') { pipelineSeconds = Math.round(state.playTime); record('解锁流水线'); }
    if (action.type === 'unlockAutomation') { automationSeconds = Math.round(state.playTime); record('解锁自动队列'); }
  };
  const finishWait = () => {
    if (waitStart === null) return;
    const duration = Math.round(state.playTime) - waitStart;
    if (duration > longestMoneyWaitSeconds) {
      longestMoneyWaitSeconds = duration;
      longestMoneyWait = { from: waitStart, to: Math.round(state.playTime), nextGame: waitGame, pointsNeeded: waitNeeded };
    }
    waitStart = null;
  };
  record('开机');
  for (let second = 0; second < maxSeconds && state.collected.length < GAMES.length; second++) {
    const selected = runningSelection(state, policy);
    for (const id of state.running.filter(id => !selected.includes(id))) { act({ type: 'stop', gameId: id }); managementChanges++; }
    for (const id of selected.filter(id => !state.running.includes(id))) { act({ type: 'run', gameId: id }); managementChanges++; }

    const next = remainingGames(state)[0];
    const budget = nextGameBudget(state);
    if (next) {
      const requiredGB = usedSpace(state) + reservedSpace(state) + next.sizeGB;
      const requiredDisk = chooseDiskOption(state, requiredGB, strategy);
      if (requiredDisk !== null && state.points >= HARDWARE.disk[requiredDisk].price + budget) {
        act({ type: 'upgrade', key: 'disk', option: requiredDisk });
      }
      if (requiredDisk !== null && !policy.preserveInstalled && requiredGB > diskCapacity(state) + 1e-8) {
        if (HARDWARE.disk[state.hardware.disk].generation >= 1 && state.points >= budget) {
          const dormant = [...state.installed].filter(id => !state.running.includes(id))
            .sort((a, b) => GAME_MAP[a].income / GAME_MAP[a].sizeGB - GAME_MAP[b].income / GAME_MAP[b].sizeGB);
          for (const id of dormant) {
            if (usedSpace(state) + reservedSpace(state) + next.sizeGB <= diskCapacity(state) + 1e-8) break;
            act({ type: 'uninstall', gameId: id });
          }
        }
      }
      if (!state.pipeline && state.collected.length >= 6 && HARDWARE.ram[state.hardware.ram].slots >= 2
        && HARDWARE.ram[state.hardware.ram].capacity >= 512 && state.points >= PIPELINE_COST + budget) {
        act({ type: 'unlockPipeline' });
      } else if (state.pipeline && !state.automation && state.collected.length >= 12 && state.points >= AUTOMATION_COST + budget) {
        act({ type: 'unlockAutomation' });
      } else if (state.collected.length >= 1) {
        const affordable = hardwareCandidates(state, policy).find(candidate => state.points >= HARDWARE[candidate.key][candidate.option].price + budget);
        if (affordable) act({ type: 'upgrade', key: affordable.key, option: affordable.option });
      }
      // Funds, storage and task slots are the only gates; low configuration still starts a real task.
      for (const game of remainingGames(state)) {
        if (state.jobs.length + state.queue.length >= maxJobs(state) + (state.automation ? 1 : 0)) break;
        const queuedGB = state.queue.reduce((sum, id) => sum + GAME_MAP[id].sizeGB, 0);
        if (usedSpace(state) + reservedSpace(state) + queuedGB + game.sizeGB > diskCapacity(state) + 1e-8) break;
        if (!state.owned.includes(game.id)) {
          if (state.points < game.price) break;
          act({ type: 'buy', gameId: game.id });
        }
        if (state.automation) act({ type: 'queue', gameId: game.id });
        else if (!installBlockReason(state, game)) act({ type: 'install', gameId: game.id });
      }
    }

    const previous = state;
    const earning = incomePerSecond(state);
    if (state.jobs.length) installationSeconds++;
    if (state.jobs.length && earning > 0) runInstallOverlapSeconds++;
    if (!state.jobs.length && next) {
      const capacityRequired = usedSpace(state) + next.sizeGB;
      const disk = chooseDiskOption(state, capacityRequired, strategy);
      const needed = (state.owned.includes(next.id) ? 0 : next.price) + (disk === null ? 0 : HARDWARE.disk[disk].price);
      if (state.points + 1e-8 < needed) {
        moneyWaitSeconds++;
        if (waitStart === null) { waitStart = Math.round(state.playTime); waitGame = next.title; waitNeeded = Number((needed - state.points).toFixed(2)); }
      } else finishWait();
    } else finishWait();
    state = tick(state, 1, (_id, amount) => {
      passiveIncome += amount;
      if (previous.jobs.length) installIncomeReceipts += amount;
    });
    for (const job of state.jobs.filter(job => !previous.jobs.some(old => old.id === job.id))) {
      const game = GAME_MAP[job.gameId];
      if (resources.some(key => HARDWARE[key][state.hardware[key]].capacity < HARDWARE[key][game.min[key]].capacity)) lowConfigInstallStarts++;
    }
    for (const id of state.collected.filter(id => !previous.collected.includes(id))) {
      if (id === 'crisis-final') flagshipSeconds = Math.round(state.playTime);
      record(`安装 ${GAME_MAP[id].title}`);
    }
    const rewards = state.collected.reduce((sum, id) => sum + GAME_MAP[id].reward, 0);
    if (state.points < -1e-6 || Math.abs(state.points - (startingPoints + rewards + passiveIncome - spent)) > 1e-5
      || Math.abs(state.earned - (startingPoints + rewards + passiveIncome)) > 1e-5
      || usedSpace(state) + reservedSpace(state) > diskCapacity(state) + 1e-6
      || new Set(state.collected).size !== state.collected.length) throw new Error(`${strategy}: Economy/capacity/reward invariant failed at ${state.playTime}`);
    for (const job of state.jobs) {
      const old = previous.jobs.find(candidate => candidate.id === job.id);
      if (old && job.progress < old.progress - 1e-8) throw new Error(`${strategy}: progress moved backwards`);
    }
  }
  finishWait();
  return {
    strategy, label: policy.label, complete: state.collected.length === GAMES.length,
    seconds: Math.round(state.playTime), flagshipSeconds, firstUpgradeSeconds, pipelineSeconds, automationSeconds,
    collected: state.collected.length, running: state.running.length, won: state.won, automation: state.automation,
    income: Number(incomePerSecond(state).toFixed(2)), points: Number(state.points.toFixed(2)), earned: Number(state.earned.toFixed(2)),
    spent: Number(spent.toFixed(2)), passiveIncome: Number(passiveIncome.toFixed(2)),
    firstInstallRewards: state.collected.reduce((sum, id) => sum + GAME_MAP[id].reward, 0),
    moneyWaitSeconds, longestMoneyWaitSeconds, longestMoneyWait,
    runInstallOverlapSeconds, installIncomeReceipts: Number(installIncomeReceipts.toFixed(2)), installationSeconds,
    lowConfigInstallStarts, managementChanges,
    finalHardware: Object.fromEntries(hardwareKeys.map(key => [key, { option: state.hardware[key], name: HARDWARE[key][state.hardware[key]].name }])) as BalanceReport['finalHardware'],
    hardwarePurchases: purchases, usedGB: Number(usedSpace(state).toFixed(2)), capacityGB: diskCapacity(state), milestones,
  };
}

export function measureEarlyInstall(): number {
  const state = createInitialState();
  state.hardware = { cpu: 2, ram: 2, disk: 2, gpu: 2, network: 2 };
  let installing = dispatch(state, { type: 'install', gameId: 'red-alert' }).state;
  let seconds = 0;
  while (!installing.installed.length && seconds < 20) { installing = tick(installing, .01); seconds += .01; }
  return Number(seconds.toFixed(2));
}
