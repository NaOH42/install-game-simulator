import { useEffect, useRef, useState } from 'react';
import { GAME_MAP, GAMES, HARDWARE, GENRES } from '../game/catalog';
import { AUTOMATION_COST, PIPELINE_COST, diskCapacity, gamePerformance, getSystemLoad, hardwareMeetsRecommendation, incomePerSecond, jobRate, maxJobs, reservedSpace, usedSpace } from '../game/engine';
import type { Action, GameDefinition, HardwareKey, ResourceKey, SaveGame } from '../game/types';

const RESOURCE_KEYS: ResourceKey[] = ['cpu', 'ram', 'gpu', 'network'];
const HARDWARE_KEYS: HardwareKey[] = ['cpu', 'ram', 'disk', 'gpu', 'network'];
const LABELS: Record<HardwareKey, string> = { cpu: '处理器', ram: '内存', disk: '硬盘', gpu: '显卡', network: '网络' };
const SHORT_LABELS: Record<ResourceKey, string> = { cpu: 'CPU', ram: 'RAM', gpu: 'GPU', network: 'NET' };
const fmt = (n: number, decimals = 1) => n.toLocaleString('zh-CN', { maximumFractionDigits: decimals });
const percent = (n: number) => `${fmt(n * 100, 0)}%`;
const pressureClass = (ratio: number) => ratio > 1 ? 'overloaded' : ratio >= .8 ? 'busy' : 'healthy';

export function SystemLoadMeters({ state, compact = false }: { state: SaveGame; compact?: boolean }) {
  const load = getSystemLoad(state);
  return <div className={`system-load-meters ${compact ? 'compact-meters' : ''}`}>
    {RESOURCE_KEYS.map(key => <div key={key} className={`system-load-meter ${pressureClass(load[key].ratio)}`}>
      <div><span>{SHORT_LABELS[key]}</span><b>{percent(load[key].ratio)}</b></div>
      <div className="load-meter-track"><i style={{ width: `${Math.min(100, load[key].ratio * 100)}%` }}/></div>
      {!compact && <small>{fmt(load[key].demand)} / {fmt(load[key].capacity)} {key === 'ram' ? 'MB' : key === 'network' ? '带宽' : '算力'}</small>}
    </div>)}
  </div>;
}

export function GameRuntimeSummary({ state, game, compact = false }: { state: SaveGame; game: GameDefinition; compact?: boolean }) {
  const performance = gamePerformance(state, game.id);
  const actualRate = performance.incomePerSecond * 60;
  const predictedRate = performance.baseIncome * performance.efficiency * 60;
  const belowMinimum = RESOURCE_KEYS.filter(key => (key !== 'network' || game.online) && HARDWARE[key][state.hardware[key]].capacity < HARDWARE[key][game.min[key]].capacity);
  if (compact) return <div className={`runtime-compact ${performance.running ? 'is-running' : 'is-stopped'} ${performance.efficiency < .7 ? 'reduced-efficiency' : ''}`}>
    <span><i/>{performance.running ? '运行中' : '已停止'}</span>
    <b>{performance.running ? `+${fmt(actualRate)} 点/分` : '0 点/分'}</b>
    <small>{performance.running ? '当前效率' : '启动预估'} {percent(performance.efficiency)}</small>
  </div>;
  return <div className={`game-runtime-summary ${performance.running ? 'is-running' : 'is-stopped'}`}>
    <div className="runtime-summary-heading"><strong><i/>{performance.running ? '正在这台电脑上运行' : '启动之后，才会产生收益'}</strong><span>{game.online ? '联网游戏' : '单机游戏'}</span></div>
    <div className="runtime-summary-values"><div><small>{performance.running ? '当前实际收益' : '启动后预估收益'}</small><b>+{fmt(performance.running ? actualRate : predictedRate)}<em>点/分</em></b></div><div><small>{performance.running ? '当前运行效率' : '当前配置预估效率'}</small><b className={performance.efficiency < .7 ? 'efficiency-warning' : ''}>{percent(performance.efficiency)}</b></div><div><small>满效率收益</small><b className="muted">{fmt(performance.baseIncome * 60)}<em>点/分</em></b></div></div>
    <p>{belowMinimum.length ? `${belowMinimum.map(key => LABELS[key]).join('、')}低于入门参考，兼容运行会增加资源开销并限制产出。升级对应硬件可解除这部分限制。` : performance.bottleneck ? `${LABELS[performance.bottleneck]}正在限制效率。停止其他游戏或换装合适硬件，可重新分配资源。` : '当前资源足够。多开游戏或同时安装时，实际收益会随资源竞争变化。'}{!game.online && ' 单机游戏不受网络占用影响。'}</p>
  </div>;
}

export function GameConfiguration({ state, game }: { state: SaveGame; game: GameDefinition }) {
  const performance = gamePerformance(state, game.id);
  const lacking = HARDWARE_KEYS.filter(key => !hardwareMeetsRecommendation(state, game, key));
  return <div className="game-configuration">
    <div className="section-caption">配置建议<span>可低配安装，运行效率会下降</span></div>
    <table className="requirements"><thead><tr><th>硬件</th><th>我的电脑</th><th>入门参考</th><th>推荐型号</th></tr></thead><tbody>{HARDWARE_KEYS.map(key => {
      const current = HARDWARE[key][state.hardware[key]];
      const adequate = hardwareMeetsRecommendation(state, game, key);
      return <tr key={key}><th>{LABELS[key]}</th><td className={adequate ? 'requirement-pass' : 'requirement-fail'}><span>{adequate ? '✓' : '△'}</span> {current.name}</td><td>{HARDWARE[key][game.min[key]].name}</td><td>{HARDWARE[key][game.recommended[key]].name}</td></tr>;
    })}</tbody></table>
    <p className={`configuration-advice ${lacking.length ? 'has-shortfall' : ''}`}>{lacking.length ? `${lacking.map(key => LABELS[key]).join('、')}低于推荐配置，仍可安装与运行。当前启动预估效率 ${percent(performance.efficiency)}。` : '配置达到推荐水平，仍需留意同时运行游戏的资源占用。'} 磁盘须留出 {game.sizeGB} GB 实际空间。</p>
  </div>;
}

export function TaskManager({ state, onAction, onOpenHardware, onOpenGame }: { state: SaveGame; onAction: (action: Action) => void; onOpenHardware: () => void; onOpenGame: (game: GameDefinition) => void }) {
  const load = getSystemLoad(state);
  const [tab, setTab] = useState<'processes' | 'performance'>('processes');
  const [history, setHistory] = useState<Record<ResourceKey, number[]>>({ cpu: [], ram: [], gpu: [], network: [] });
  const lastSample = useRef(-Infinity);
  useEffect(() => {
    if (state.playTime - lastSample.current < 1) return;
    lastSample.current = state.playTime;
    const snapshot = getSystemLoad(state);
    setHistory(previous => Object.fromEntries(RESOURCE_KEYS.map(key => [key, [...previous[key], snapshot[key].ratio].slice(-36)])) as Record<ResourceKey, number[]>);
  }, [state]);
  const maxLoad = Math.max(...RESOURCE_KEYS.map(key => load[key].ratio));
  const runningGames = state.running.map(id => GAME_MAP[id]).filter(Boolean);
  return <div className="task-manager-panel">
    <header className="task-manager-heading"><div><div className="eyebrow">WINDOWS TASK MANAGER</div><h1>让每一点算力，都用在刀刃上。</h1><p>{runningGames.length} 款游戏运行中 · 实际收益 <b>{fmt(incomePerSecond(state) * 60)} 点/分</b></p></div><button className="xp-button danger-button" disabled={!runningGames.length} onClick={() => onAction({ type: 'stopAll' })}>立即停止全部</button></header>
    <SystemLoadMeters state={state}/>
    <div className={`system-pressure-note ${maxLoad > 1 ? 'is-overloaded' : ''}`}><span>{maxLoad > 1 ? '⚠' : '●'}</span><p><b>{maxLoad > 1 ? '资源需求已超过这台电脑的承受能力。' : '电脑正在按实际资源分配工作。'}</b> {maxLoad > 1 ? '高占用会降低收益并拖慢安装。画面卡顿与残影是模拟系统负载，停止操作始终即时响应。' : '已安装的游戏可以随时启动或停止。停止释放资源，保留游戏和收藏。'}</p><button className="text-button" onClick={onOpenHardware}>换装硬件 →</button></div>
    <div className="xp-tabs task-manager-tabs"><button className={tab === 'processes' ? 'active' : ''} onClick={() => setTab('processes')}>游戏进程 ({runningGames.length})</button><button className={tab === 'performance' ? 'active' : ''} onClick={() => setTab('performance')}>性能记录</button></div>
    {tab === 'processes' ? <div className="process-table-scroll"><table className="process-table"><thead><tr><th>正在运行的游戏</th><th>CPU 需求</th><th>内存需求</th><th>GPU 需求</th><th>网络需求</th><th>效率</th><th>实际收益</th><th/></tr></thead><tbody>{runningGames.map(game => {
      const performance = gamePerformance(state, game.id);
      return <tr key={game.id}><td><button className="process-game-name" onClick={() => onOpenGame(game)}><img src={game.cover} alt="" style={{ objectPosition: game.focalPoint }}/><span><b>{game.title}</b><small>{game.online ? '联网' : '单机'} · {GENRES[game.genre].label}</small></span></button></td>{RESOURCE_KEYS.map(key => <td key={key} className={performance.demand[key] / load[key].capacity > .7 ? 'resource-cell-warning' : ''}>{key === 'ram' ? `${fmt(performance.demand[key], 0)} MB` : key === 'network' && !game.online ? '—' : percent(performance.demand[key] / load[key].capacity)}</td>)}<td><span className={`process-efficiency ${performance.efficiency < .7 ? 'low' : ''}`}>{percent(performance.efficiency)}</span></td><td className="process-income">+{fmt(performance.incomePerSecond * 60)}<small>点/分</small></td><td><button className="xp-button stop-process" onClick={() => onAction({ type: 'stop', gameId: game.id })}>停止</button></td></tr>;
    })}</tbody></table>{!runningGames.length && <div className="empty-state"><span className="idle-process-icon">▥</span><h3>风扇终于可以歇一会儿了。</h3><p>当前没有运行游戏，也没有游戏收益。<br/>在游戏详情或收藏库里点击「运行游戏」即可启动。</p></div>}</div> : <div className="performance-history-grid">{RESOURCE_KEYS.map(key => {
      const values = history[key];
      const max = Math.max(1.2, ...values);
      const points = values.map((value, index) => `${index / 35 * 300},${80 - value / max * 72}`).join(' ');
      return <div className="performance-history" key={key}><div><b>{LABELS[key]}</b><strong className={load[key].ratio > 1 ? 'efficiency-warning' : ''}>{percent(load[key].ratio)}</strong></div><svg viewBox="0 0 300 86" role="img" aria-label={`${LABELS[key]}最近 ${values.length} 秒占用记录`}><defs><pattern id={`history-grid-${key}`} width="25" height="20" patternUnits="userSpaceOnUse"><path d="M25 0H0V20" fill="none" stroke="#d2dec0" strokeWidth=".6"/></pattern></defs><rect width="300" height="86" fill="url(#history-grid-${key})"/><line x1="0" x2="300" y1={80 - 1 / max * 72} y2={80 - 1 / max * 72} stroke="#c49953" strokeDasharray="3 4"/><polyline points={points} fill="none" stroke={load[key].ratio > 1 ? '#b37a34' : '#689346'} strokeWidth="2"/></svg><p>{values.length ? `最近 ${values.length} 秒实测 · 虚线为满载` : '正在采样…'}</p></div>;
    })}</div>}
    <footer className="task-manager-footer"><span>安装任务 {state.jobs.length} · 运行游戏 {runningGames.length} · 已安装 {state.installed.length}</span><span>CPU / GPU / 网络需求按本机容量计；内存为实际 MB。</span></footer>
  </div>;
}

export function HardwareMarketplace({ state, onAction, onOpenTaskManager }: { state: SaveGame; onAction: (action: Action) => void; onOpenTaskManager: () => void }) {
  const [key, setKey] = useState<HardwareKey>('cpu');
  const [selection, setSelection] = useState(state.hardware.cpu);
  const current = HARDWARE[key][state.hardware[key]];
  const selected = HARDWARE[key][selection] || current;
  const preview: SaveGame = { ...state, hardware: { ...state.hardware, [key]: selection } };
  const previewLoad = getSystemLoad(preview);
  const currentLoad = getSystemLoad(state);
  const currentRate = incomePerSecond(state) * 60;
  const nextRate = incomePerSecond(preview) * 60;
  const owned = state.ownedHardware[key].includes(selection);
  const equipped = state.hardware[key] === selection;
  const diskConflict = key === 'disk' && selected.capacity < usedSpace(state) + reservedSpace(state);
  const focusedResources: ResourceKey[] = key === 'disk' ? ['ram', 'cpu'] : key === 'gpu' ? ['gpu', 'cpu'] : [key as ResourceKey];
  const installationSpeed = state.jobs.length ? state.jobs.reduce((sum, job) => sum + jobRate(state, job), 0) : 0;
  const nextInstallationSpeed = state.jobs.length ? state.jobs.reduce((sum, job) => sum + jobRate(preview, job), 0) : 0;
  return <div className="hardware-marketplace"><header className="panel-heading"><div className="hardware-shop-mark">▣</div><div><div className="eyebrow">COMPUTER PARTS & UPGRADES</div><h1>合适的搭配，比一味堆料更重要。</h1><p>买下的硬件永久保留，随时免费换回。</p></div><div className="panel-balance"><small>可用装机点</small><b>{fmt(state.points, 0)}</b></div></header>
    <div className="hardware-category-tabs">{HARDWARE_KEYS.map(item => <button key={item} className={key === item ? 'selected' : ''} onClick={() => { setKey(item); setSelection(state.hardware[item]); }}><span>{LABELS[item]}</span><small>{HARDWARE[item][state.hardware[item]].name}</small></button>)}</div>
    <div className="hardware-market-content"><div className="hardware-options-heading"><h2>{LABELS[key]}型号</h2><span>选择一个型号，查看换装预估</span></div><div className="hardware-options">{HARDWARE[key].map((model, option) => <button key={model.name} className={`hardware-option ${selection === option ? 'selected' : ''} ${state.hardware[key] === option ? 'equipped' : ''}`} onClick={() => setSelection(option)}><div className="model-option-top"><span className="model-selection-dot"/><b>{model.name}</b><span className="model-ownership">{state.hardware[key] === option ? '使用中' : state.ownedHardware[key].includes(option) ? '已拥有' : `${fmt(model.price, 0)} 点`}</span></div><span className="model-focus">{model.focus}</span><p>{model.detail}</p><div className="model-facts"><span>{key === 'disk' ? '容量' : key === 'ram' ? '内存' : '资源容量'} <b>{fmt(model.capacity)}{key === 'ram' ? ' MB' : key === 'disk' ? ' GB' : ''}</b></span><span>安装速度 <b>×{fmt(model.installSpeed)}</b></span>{key === 'ram' && <span>并行支持 <b>{model.slots} 任务</b></span>}{key === 'gpu' && model.cpuRelief > 0 && <span>CPU 分担 <b>{percent(model.cpuRelief)}</b></span>}</div></button>)}</div></div>
    <div className="hardware-preview"><div className="preview-heading"><div><small>从 {current.name}</small><h3>换为 {selected.name}</h3></div><button className="text-button" onClick={onOpenTaskManager}>查看当前进程 →</button></div><div className="hardware-impact-grid"><div><small>当前运行组合收益</small><p>{fmt(currentRate)} <span>→</span> <b className={nextRate + .001 < currentRate ? 'efficiency-warning' : 'green'}>{fmt(nextRate)}</b><em>点/分</em></p></div>{focusedResources.map(resource => <div key={resource}><small>{LABELS[resource]}总需求 / 容量</small><p>{percent(currentLoad[resource].ratio)} <span>→</span> <b className={previewLoad[resource].ratio > 1 ? 'efficiency-warning' : ''}>{percent(previewLoad[resource].ratio)}</b></p></div>)}{key === 'disk' && <div><small>磁盘容量</small><p>{fmt(current.capacity)} <span>→</span> <b>{fmt(selected.capacity)}</b><em>GB</em></p></div>}{state.jobs.length > 0 && <div><small>当前安装任务总吞吐</small><p>100% <span>→</span> <b>{percent(installationSpeed ? nextInstallationSpeed / installationSpeed : 1)}</b></p></div>}</div><div className="hardware-checkout"><p>{diskConflict ? `已安装与预留空间合计 ${fmt(usedSpace(state) + reservedSpace(state))} GB，须先腾出空间再换这块硬盘。` : state.running.length ? '预估使用当前运行游戏和安装任务，不改变任务状态。' : '目前没有运行游戏，收益预估为 0。启动游戏后可比较真实收益。'}</p><button className="xp-button primary" disabled={equipped || diskConflict || (!owned && state.points < selected.price)} onClick={() => onAction(owned ? { type: 'equipHardware', key, option: selection } : { type: 'upgrade', key, option: selection })}>{equipped ? '当前使用中' : owned ? '免费换装' : `购入并换装 · ${fmt(selected.price, 0)} 点`}</button></div></div>
    <div className="automation-grid"><section className="automation-card"><div className="automation-glyph">⇉</div><div><h3>下载 / 安装流水线 {state.pipeline && <span>已解锁</span>}</h3><p>让安装任务交叠执行，并行数量由当前内存支持能力决定。</p></div><button className="xp-button" disabled={state.pipeline || state.points < PIPELINE_COST} onClick={() => onAction({ type: 'unlockPipeline' })}>{state.pipeline ? '已开启' : `${fmt(PIPELINE_COST, 0)} 点解锁`}</button></section><section className="automation-card"><div className="automation-glyph">▤</div><div><h3>自动安装队列 {state.automation && <span>已解锁</span>}</h3><p>自动开始队列里的安装，不自动运行游戏、购买或卸载。</p></div><button className="xp-button" disabled={state.automation || state.points < AUTOMATION_COST} onClick={() => onAction({ type: 'unlockAutomation' })}>{state.automation ? '已解锁' : `${fmt(AUTOMATION_COST, 0)} 点解锁`}</button></section></div><div className="hardware-footer"><span>安装并行上限 {maxJobs(state)} · 已安装 {state.installed.length} / {GAMES.length} 款</span><span>磁盘 {fmt(usedSpace(state))} / {diskCapacity(state)} GB · 预留 {fmt(reservedSpace(state))} GB</span></div>
  </div>;
}
