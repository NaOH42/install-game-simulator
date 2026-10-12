import { GAMES, HARDWARE } from '../src/game/catalog';
import { AUTOMATION_COST, PIPELINE_COST } from '../src/game/engine';
import { measureEarlyInstall, simulateBalance, STRATEGIES, type StrategyName } from './balanceSimulation';

const argument = process.argv.find(value => value.startsWith('--strategy='));
const names = argument ? [argument.slice('--strategy='.length) as StrategyName] : Object.keys(STRATEGIES) as StrategyName[];
if (names.some(name => !(name in STRATEGIES))) throw new Error(`Unknown strategy: ${argument}`);
const reports = names.map(name => simulateBalance(name));
const earliestGameAtFastHardwareSeconds = measureEarlyInstall();
const report = {
  version: 2, tickSeconds: 1, games: GAMES.length,
  prices: Object.fromEntries(Object.entries(HARDWARE).map(([key, choices]) => [key, choices.map((choice, option) => ({ option, name: choice.name, price: choice.price }))])),
  features: { pipeline: PIPELINE_COST, automation: AUTOMATION_COST },
  assumptions: [
    '真实 dispatch 操作与固定每秒 tick；不发放额外装机点，不跳过安装阶段。',
    '策略为理想及时操作，不计玩家查看档案、理解界面或欣赏完成演出的操作延迟。',
    '游戏依商店顺序购买；低配也可安装，推荐配置从不成为模拟的硬门槛。',
    '首装后即可评估硬件；每次升级预留下一款未购游戏的预算。',
    '按实际安装时长、运行收益改善和容量选择硬件；不同策略使用不同侧重的型号。',
    '运行组合保留安装资源余量；需要时换停低效游戏。不强制买齐同代配件。',
    '硬盘按实际容量选择；普通策略可卸载低效收藏腾空间，收藏策略尽量保留全部安装。',
    '空等指尚未集齐时没有安装任务、只能等待装机点；安装期间攒点单独计入重叠。',
  ],
  targets: { firstUpgradeMinutes: [1, 4], flagshipMinutes: [25, 35], earlyReplayUnderSeconds: 10 },
  targetAssessment: reports.map(item => ({
    strategy: item.strategy,
    firstUpgradeInRange: item.firstUpgradeSeconds !== null && item.firstUpgradeSeconds >= 60 && item.firstUpgradeSeconds <= 240,
    flagshipInReferenceRange: item.flagshipSeconds !== null && item.flagshipSeconds >= 1500 && item.flagshipSeconds <= 2100,
    allGamesComplete: item.complete,
  })),
  earliestGameAtFastHardwareSeconds, strategies: reports,
};
if (!process.argv.includes('--json')) {
  console.table(reports.map(item => ({
    strategy: item.strategy,
    firstUpgradeMinutes: item.firstUpgradeSeconds === null ? null : Number((item.firstUpgradeSeconds / 60).toFixed(2)),
    pipelineMinutes: item.pipelineSeconds === null ? null : Number((item.pipelineSeconds / 60).toFixed(2)),
    automationMinutes: item.automationSeconds === null ? null : Number((item.automationSeconds / 60).toFixed(2)),
    flagshipMinutes: item.flagshipSeconds === null ? null : Number((item.flagshipSeconds / 60).toFixed(2)),
    allGamesMinutes: Number((item.seconds / 60).toFixed(2)),
    pureMoneyWaitSeconds: item.moneyWaitSeconds,
    longestMoneyWaitSeconds: item.longestMoneyWaitSeconds,
    installIncomeOverlapSeconds: item.runInstallOverlapSeconds,
  })));
}
console.log(JSON.stringify(report, null, 2));
for (const item of reports) {
  if (!item.complete || item.collected !== GAMES.length || !item.won || !item.automation || item.firstUpgradeSeconds === null) {
    throw new Error(`Strategy failed to finish: ${item.strategy}; ${JSON.stringify(item.finalHardware)}; collected ${item.collected}, points ${item.points}`);
  }
}
if (earliestGameAtFastHardwareSeconds >= 10) throw new Error('Early game did not become a sub-ten-second install');
