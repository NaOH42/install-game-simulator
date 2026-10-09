import { GAMES, HARDWARE } from '../src/game/catalog';
import { AUTOMATION_COST, PIPELINE_COST, createInitialState, dispatch, diskCapacity, incomePerSecond, installBlockReason, maxJobs, reservedSpace, tick, usedSpace } from '../src/game/engine';
import type { Action, HardwareKey, SaveGame } from '../src/game/types';

let state = createInitialState();
const milestones: { event: string; seconds: number; points: number; installed: number; income: number }[] = [];
let firstUpgrade = false;
const record = (event: string) => milestones.push({ event, seconds: Math.round(state.playTime), points: Math.round(state.points), installed: state.collected.length, income: Number(incomePerSecond(state).toFixed(2)) });
function act(action: Action) {
  const result = dispatch(state, action);
  if (result.error) throw new Error(`Policy attempted invalid action ${JSON.stringify(action)}: ${result.error}`);
  state = result.state;
}

const upgradeOrder: HardwareKey[] = ['network', 'cpu', 'disk', 'ram', 'gpu'];
const MAX_SECONDS = 7200;
record('开机');
for (let second = 0; second < MAX_SECONDS && !state.won; second++) {
  const next = GAMES.find(game => !state.collected.includes(game.id) && !state.jobs.some(job => job.gameId === game.id));
  if (next) {
    const tierLevel = next.tier - 1;
    if (!firstUpgrade && state.collected.length >= 2 && state.points >= HARDWARE.cpu[1].price) {
      act({ type: 'upgrade', key: 'cpu' });
      firstUpgrade = true;
      record('首次硬件升级');
    }
    // Finish the current shelf before moving to the next generation; prioritize required hardware.
    const diskFull = usedSpace(state) + reservedSpace(state) + next.sizeGB > diskCapacity(state) + 1e-6;
    const missing = diskFull && state.hardware.disk < 2 ? 'disk' : upgradeOrder.find(key => state.hardware[key] < tierLevel);
    if (missing && state.points >= HARDWARE[missing][state.hardware[missing] + 1].price) {
      act({ type: 'upgrade', key: missing });
      record(`升级 ${missing} 至 ${state.hardware[missing]}`);
    }
    if (!missing && !state.pipeline && state.hardware.ram >= 1 && state.points >= PIPELINE_COST + next.price) {
      act({ type: 'unlockPipeline' });
      record('解锁流水线');
    }
    if (!missing && state.pipeline && !state.automation && state.collected.length >= 12 && state.points >= AUTOMATION_COST + next.price) {
      act({ type: 'unlockAutomation' });
      record('解锁自动队列');
    }
    if (!missing) {
      for (const game of GAMES.filter(game => game.tier === next.tier)) {
        if (state.collected.includes(game.id) || state.jobs.some(job => job.gameId === game.id) || state.queue.includes(game.id)) continue;
        if (state.jobs.length >= maxJobs(state) && !state.automation) break;
        if (!state.owned.includes(game.id)) {
          if (state.points < game.price) break;
          act({ type: 'buy', gameId: game.id });
        }
        if (state.automation) act({ type: 'queue', gameId: game.id });
        else if (!installBlockReason(state, game)) act({ type: 'install', gameId: game.id });
      }
    }
  }
  const previous = state;
  state = tick(state, 1);
  if (state.collected.length !== previous.collected.length) {
    for (const id of state.collected.filter(id => !previous.collected.includes(id))) record(`安装 ${GAMES.find(game => game.id === id)!.title}`);
  }
  if (state.points < -1e-6 || usedSpace(state) + reservedSpace(state) > diskCapacity(state) + 1e-6) throw new Error('Economy/capacity invariant failed');
}
const upgraded = { ...createInitialState(), hardware: { cpu: 2, ram: 2, disk: 2, gpu: 2, network: 2 } } satisfies SaveGame;
let oldGame = dispatch(upgraded, { type: 'install', gameId: 'red-alert' }).state;
let oldGameTime = 0;
while (!oldGame.installed.length && oldGameTime < 30) { oldGame = tick(oldGame, .01); oldGameTime += .01; }
console.table(milestones);
console.log(JSON.stringify({ success: state.won, seconds: Math.round(state.playTime), minutes: Number((state.playTime / 60).toFixed(2)), collected: state.collected.length, hardware: state.hardware, pipeline: state.pipeline, automation: state.automation, income: incomePerSecond(state), earliestGameAtMaxHardwareSeconds: Number(oldGameTime.toFixed(2)), usedGB: usedSpace(state) }, null, 2));
if (!state.won || state.playTime < 1200 || state.playTime > 1800 || !state.automation || state.collected.length !== 24 || oldGameTime >= 10) throw new Error('Balance target not met');
