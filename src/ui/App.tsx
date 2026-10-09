import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GAMES, GAME_MAP, HARDWARE, GENRES } from '../game/catalog';
import { incomePerSecond, usedSpace, reservedSpace, diskCapacity, maxJobs, installBlockReason, jobRate, PIPELINE_COST, AUTOMATION_COST } from '../game/engine';
import type { Action, GameDefinition, Genre, HardwareKey, InstallJob, SaveGame, Stage } from '../game/types';
import { getInstallPresentation } from '../game/presentation';
import InstallerScene from '../render/AsyncInstallerScene';
import RewardFeedback, { useGameFeedback } from './RewardFeedback';
import InstallFileStream from './InstallFileStream';
import PaperPlaneTransfer from './PaperPlaneTransfer';
import DesktopIcon from './DesktopIcon';
import './styles.css';

type WindowId = 'store' | 'hardware' | 'collection' | 'installer' | 'settings' | 'detail';
type IconName = WindowId | 'folder' | 'disc' | 'sound' | 'network';
type WindowState = { id: WindowId; x: number; y: number; z: number; minimized: boolean };
interface Props { state: SaveGame; incomeTotals: Readonly<Record<string, number>>; onAction: (action: Action) => void; notice: string | null; onDismissNotice: () => void; }
const TITLES: Record<WindowId, string> = { store: '世纪游戏站 — 游戏商店', hardware: '我的电脑 — 硬件升级', collection: '我的游戏收藏', installer: '安装管理器', settings: '声音和游戏设置', detail: '游戏说明' };
const LABELS: Record<HardwareKey, string> = { cpu: '处理器', ram: '内存', disk: '硬盘', gpu: '显卡', network: '网络' };
const HARDWARE_KEYS: HardwareKey[] = ['cpu', 'ram', 'disk', 'gpu', 'network'];
const STAGES: Stage[] = ['download', 'unpack', 'write', 'verify'];
const STAGE_LABELS: Record<Stage, string> = { download: '下载文件', unpack: '解压资源', write: '写入磁盘', verify: '校验安装' };
const format = (n: number, digits = 0) => n.toLocaleString('zh-CN', { maximumFractionDigits: digits });
const level = (n: number) => ['经典', '进阶', '旗舰'][n] || '经典';

function Icon({ name, size = 26 }: { name: IconName; size?: number }) {
  if (name === 'sound') return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><path fill="#e2b744" stroke="#735616" d="M4 12h6l8-7v22l-8-7H4z"/><path fill="none" stroke="#237bcc" strokeWidth="2.5" d="M22 10q6 6 0 12m4-17q11 11 0 22"/></svg>;
  if (name === 'disc' || name === 'collection') return <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id={`disc-${size}`} x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".3" stopColor="#bedafb"/><stop offset=".6" stopColor="#c7eed2"/><stop offset="1" stopColor="#d5bef6"/></linearGradient></defs><path fill="#255eb0" stroke="#133d8c" d="M3 6h23v30H3z"/><path fill="#80b8eb" d="M5 8h19v6H5z"/><circle cx="25" cy="24" r="13" fill={`url(#disc-${size})`} stroke="#638ab3"/><circle cx="25" cy="24" r="4" fill="#faf9ec" stroke="#91a2a7"/><path d="m28 12 3 6m-18 8 7-1" stroke="#fff" strokeWidth="3"/></svg>;
  if (name === 'folder' || name === 'store') return <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><path fill="#edb334" stroke="#9e6e1d" d="M3 9h14l4 4h16v22H3z"/><path fill="#ffe487" stroke="#b88720" d="m2 17 36-1-5 19H4z"/><path fill="#fff5b9" d="M4 18h31v3H4z"/><path fill="#287ed5" stroke="#1558a3" d="M14 4h15v21H14z"/><path fill="#a7d6fa" d="M16 6h11v9H16z"/><path fill="#fff" d="m20 8 5 3-5 3z"/><path fill="#fff4ba" d="m2 20 36-2-5 17H4z"/></svg>;
  if (name === 'installer') return <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><path fill="#bdd0e0" stroke="#547290" d="M5 25h31v12H5z"/><path fill="#f6fcff" d="M6 26h28l-4 4H6z"/><path fill="#6da34a" stroke="#346c27" d="M16 3h11v14h8L21 29 8 17h8z"/><path fill="#bae694" d="M17 4h4v16l-5-3h1z"/><circle cx="31" cy="33" r="1.5" fill="#53cf60"/></svg>;
  if (name === 'settings') return <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><path fill="#d2dbe5" stroke="#637f9a" strokeWidth="2" d="m17 3 7 1 1 6 5 3 5-2 3 7-5 4-1 5 3 5-6 5-5-4-5 1-4 5-7-4 1-6-3-4-6-1 1-8 6-1 4-4z" transform="scale(.88) translate(3 2)"/><circle cx="20" cy="20" r="7" fill="#428acd" stroke="#1c5593" strokeWidth="2"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><path fill="#dce6ef" stroke="#6a87a5" d="M3 4h30v24H3z"/><path fill="#073f93" d="M6 7h24v17H6z"/><path fill="#68beed" d="M7 8h22v6L7 23z"/><path fill="#b4c5d5" stroke="#647e94" d="M14 28h10v5H14zm-7 5h27v4H7z"/><path fill="#fcfcff" d="M4 5h28v2H4z"/><circle cx="29" cy="26" r="1" fill="#55c154"/>{name === 'network' && <path d="M29 5v20m-6-14h13m-13 8h13" stroke="#6ed94d" strokeWidth="3"/>}</svg>;
}

function Cover({ game, className = '' }: { game: GameDefinition; className?: string }) {
  return <img className={`game-cover ${className}`} src={game.cover} alt={`${game.title} 游戏封面`} style={{ objectPosition: game.focalPoint }} loading="lazy"/>;
}

function Progress({ value, label }: { value: number; label?: string }) {
  return <div className="progress-wrap"><div className="xp-progress" role="progressbar" aria-label={label || '安装进度'} aria-valuenow={Math.floor(value * 100)} aria-valuemin={0} aria-valuemax={100}><div className="xp-progress-fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}/></div></div>;
}

export default function App({ state, incomeTotals, onAction, notice, onDismissNotice }: Props) {
  const initialX = Math.max(82, (window.innerWidth - 1148) / 2);
  const [windows, setWindows] = useState<WindowState[]>([{ id: 'store', x: initialX, y: window.innerHeight > 850 ? 62 : 28, z: 2, minimized: false }]);
  const zRef = useRef(3);
  const [selectedGameId, setSelectedGameId] = useState(GAMES[0].id);
  const [filter, setFilter] = useState<Genre | 'all'>('all');
  const [search, setSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<'installed' | 'collected' | 'owned'>('installed');
  const [startOpen, setStartOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [eventToast, setEventToast] = useState<string | null>(null);
  const lastEvent = useRef(state.nextEventId);
  const previousJobs = useRef(new Set(state.jobs.map(j => j.id)));
  const selectedGame = GAME_MAP[selectedGameId] || GAMES[0];
  const activeJob = state.jobs.find(j => j.id === activeJobId) || state.jobs[0];
  const focused = windows.filter(w => !w.minimized).sort((a, b) => b.z - a.z)[0]?.id;
  const moneyRate = incomePerSecond(state);
  const feedback = useGameFeedback(state, incomeTotals);
  const capacity = diskCapacity(state);
  const occupied = usedSpace(state);
  const reserved = reservedSpace(state);
  const available = Math.max(0, capacity - occupied - reserved);

  const focusWindow = (id: WindowId) => setWindows(ws => {
    const current = ws.find(w => w.id === id);
    const topZ = Math.max(0, ...ws.filter(w => !w.minimized).map(w => w.z));
    if (current && !current.minimized && current.z >= topZ) return ws;
    return ws.map(w => w.id === id ? { ...w, z: ++zRef.current, minimized: false } : w);
  });
  function openWindow(id: WindowId) {
    setStartOpen(false);
    setWindows(ws => {
      if (ws.some(w => w.id === id)) return ws.map(w => w.id === id ? { ...w, minimized: false, z: ++zRef.current } : w);
      const width = id === 'detail' ? 820 : id === 'settings' ? 510 : id === 'installer' ? 920 : id === 'hardware' ? 850 : id === 'collection' ? 970 : 1148;
      return [...ws, { id, x: Math.max(20, (window.innerWidth - Math.min(width, window.innerWidth - 32)) / 2) + (id === 'detail' ? 15 : 0), y: Math.max(20, Math.min(62, (window.innerHeight - 630) / 2)), z: ++zRef.current, minimized: false }];
    });
  }
  const closeWindow = (id: WindowId) => setWindows(ws => ws.filter(w => w.id !== id));
  const showGame = (game: GameDefinition) => { setSelectedGameId(game.id); openWindow('detail'); };

  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const fitWindows = () => setWindows(ws => ws.map(win => {
      const element = document.querySelector<HTMLElement>(`.window-${win.id}`);
      const width = element?.getBoundingClientRect().width || Math.min(820, window.innerWidth - 32);
      const height = element?.getBoundingClientRect().height || Math.min(600, window.innerHeight - 69);
      return { ...win, x: Math.max(8, Math.min(win.x, window.innerWidth - width - 12)), y: Math.max(5, Math.min(win.y, window.innerHeight - height - 47)) };
    }));
    window.addEventListener('resize', fitWindows);
    return () => window.removeEventListener('resize', fitWindows);
  }, []);
  useEffect(() => {
    const fresh = state.jobs.find(j => !previousJobs.current.has(j.id));
    if (fresh) { setActiveJobId(fresh.id); openWindow('installer'); }
    previousJobs.current = new Set(state.jobs.map(j => j.id));
  }, [state.jobs]);
  useEffect(() => {
    const latest = state.events.filter(event => event.id >= lastEvent.current && event.kind === 'success' && !event.text.includes('安装完成') && !event.text.includes('旗舰游戏安装成功')).at(-1);
    if (latest && latest.id >= lastEvent.current && latest.kind === 'success') setEventToast(latest.text);
    lastEvent.current = state.nextEventId;
  }, [state.nextEventId, state.events]);
  useEffect(() => { if (!eventToast) return; const timer = window.setTimeout(() => setEventToast(null), 6500); return () => window.clearTimeout(timer); }, [eventToast]);

  function beginDrag(e: React.PointerEvent, win: WindowState) {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const offsetX = e.clientX - win.x, offsetY = e.clientY - win.y;
    const elementWidth = e.currentTarget.parentElement?.getBoundingClientRect().width || 600;
    const move = (ev: PointerEvent) => setWindows(ws => ws.map(w => w.id === win.id ? { ...w, x: Math.min(window.innerWidth - 140, Math.max(100 - elementWidth, ev.clientX - offsetX)), y: Math.max(0, Math.min(window.innerHeight - 85, ev.clientY - offsetY)) } : w));
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop);
  }

  function status(game: GameDefinition) {
    if (state.installed.includes(game.id)) return '已安装';
    if (state.jobs.some(j => j.gameId === game.id)) return '安装中';
    if (state.queue.includes(game.id)) return '已加入队列';
    if (state.owned.includes(game.id)) return '已购买';
    return game.price === 0 ? '免费游戏' : `${format(game.price)} 点`;
  }

  function renderActionButtons(game: GameDefinition, compact = false) {
    const installed = state.installed.includes(game.id), running = state.jobs.some(j => j.gameId === game.id), queued = state.queue.includes(game.id), owned = state.owned.includes(game.id);
    const reason = owned && !installed && !running ? installBlockReason(state, game.id) : undefined;
    return <div className={`game-actions ${compact ? 'compact' : ''}`}>
      {installed ? <><button className="xp-button primary" onClick={() => compact ? showGame(game) : openWindow('collection')}>{compact ? '查看详情' : '查看收藏'}</button>{!compact && <button className="xp-button" onClick={() => onAction({ type: 'uninstall', gameId: game.id })}>卸载 · 释放 {game.sizeGB} GB</button>}</> : running ? <button className="xp-button primary" onClick={() => openWindow('installer')}>查看安装进度</button> : !owned ? <button className="xp-button primary" disabled={state.points < game.price} onClick={() => onAction({ type: 'buy', gameId: game.id })}>{game.price ? `购买游戏 · ${format(game.price)} 点` : '免费领取'}</button> : <><button className="xp-button primary" disabled={!!reason} title={reason || '立即开始下载和安装'} onClick={() => onAction({ type: 'install', gameId: game.id })}>开始安装</button>{!compact && <button className="xp-button" onClick={() => onAction({ type: queued ? 'removeQueue' : 'queue', gameId: game.id })}>{queued ? '移出队列' : '加入安装队列'}</button>}</>}
      {!compact && installed && <p className="uninstall-impact">卸载后收藏收益减少 {format(game.income * 60, 1)} 点/分，购买与收藏记录保留。</p>}
      {!compact && reason && <p className="block-reason"><span>!</span> {reason}</p>}
      {!compact && !owned && state.points < game.price && <p className="block-reason">还需要 {format(game.price - state.points)} 装机点，已安装的游戏会持续产出。</p>}
    </div>;
  }

  function renderStore() {
    const featured = GAMES.find(g => g.featured) || GAMES[0];
    const games = GAMES.filter(g => (filter === 'all' || g.genre === filter) && `${g.title}${g.subtitle}${GENRES[g.genre].label}`.toLowerCase().includes(search.toLowerCase()));
    return <div className="store-layout">
      <nav className="store-sidebar" aria-label="游戏分类">
        <div className="sidebar-label">浏览游戏</div>
        <button className={`category ${filter === 'all' ? 'selected' : ''}`} onClick={() => setFilter('all')}><span className="category-symbol">▦</span>全部游戏 <small>24</small></button>
        {(Object.keys(GENRES) as Genre[]).map(genre => <button key={genre} className={`category ${filter === genre ? 'selected' : ''}`} onClick={() => setFilter(genre)}><span className="genre-dot" style={{ background: GENRES[genre].color }}/>{GENRES[genre].label}<small>{GAMES.filter(g => g.genre === genre).length}</small></button>)}
        <div className="sidebar-rule"/><div className="sidebar-label">我的空间</div>
        <button className="category" onClick={() => openWindow('collection')}><Icon name="collection" size={19}/>我的收藏 <small>{state.collected.length}</small></button>
        <button className="category" onClick={() => openWindow('installer')}><Icon name="installer" size={19}/>安装任务 <small>{state.jobs.length}</small></button>
        <div className="pc-summary"><div className="pc-summary-title"><Icon name="hardware" size={27}/><strong>我的电脑</strong><span className="online-dot"/></div><p className="pc-name">{state.hardware.cpu === 0 ? '家用多媒体电脑' : state.hardware.cpu === 1 ? '高性能装机平台' : '终极游戏工作站'}</p>{(['cpu', 'ram', 'gpu'] as HardwareKey[]).map(key => <div className="pc-spec" key={key}><span>{LABELS[key]}</span><b>{HARDWARE[key][state.hardware[key]].name}</b></div>)}<div className="storage-label"><span>本地磁盘 (C:)</span><b>{format(available, 1)} GB 可用</b></div><div className="storage-bar"><i style={{ width: `${Math.min(100, (occupied + reserved) / capacity * 100)}%` }}/></div><button className="sidebar-link" onClick={() => openWindow('hardware')}>升级电脑配置 <span>→</span></button></div>
        <div className="sidebar-note"><span>✦</span> 装好一款，再装亿款。<br/><small>进度条的尽头，还有进度条。</small></div>
      </nav>
      <section className="store-main">
        <header className="store-header"><div><div className="eyebrow">YOUR NEXT GREAT INSTALL</div><h1>好游戏，从安装开始<span>®</span></h1><p>挑一款心动的游戏，把期待装进硬盘。</p></div><label className="search-box"><span>⌕</span><input aria-label="搜索游戏" placeholder="搜索游戏…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="清除搜索" onClick={() => setSearch('')}>×</button>}</label></header>
        {filter === 'all' && !search && <div className="store-features"><button className="featured-banner" onClick={() => showGame(featured)} style={{ '--game-color': featured.color } as CSSProperties}><Cover game={featured}/><div className="featured-shade"/><div className="featured-copy"><span className="featured-kicker">本周编辑推荐 <span>EDITOR'S PICK</span></span><h2>{featured.title}</h2><p>{featured.tagline}</p><span className="featured-button">查看游戏 <span>→</span></span></div><div className="feature-disc"><Icon name="disc" size={48}/></div></button><div className="journey-card"><div className="journey-top"><Icon name="installer" size={29}/><span>装机之旅</span><b>{String(state.collected.length).padStart(2, '0')}<small> / 24</small></b></div><h3>{state.won ? '旗舰已就位。继续收藏！' : state.collected.length === 0 ? '第一款游戏，永远难忘。' : '把硬盘装满，把快乐加满。'}</h3><p>{state.collected.length === 0 ? '免费领取一款经典，开始你的装机生涯。' : `收藏带来每分钟 ${format(moneyRate * 60, 1)} 点收益，下一次升级正在靠近。`}</p><div className="journey-progress"><i style={{ width: `${state.collected.length / 24 * 100}%` }}/></div><span className="journey-foot">{state.won ? '已达成旗舰安装目标' : '终极目标：装下旗舰大作'} <span>✧</span></span></div></div>}
        <div className="catalog-heading"><div><h2>{search ? '搜索结果' : filter === 'all' ? '游戏陈列架' : GENRES[filter].label}</h2><span>{games.length} 款可收藏</span></div><span className="catalog-hint"><i/>正版快乐 · 虚构游戏</span></div>
        <div className="game-grid">{games.map(game => <button className="game-card" key={game.id} onClick={() => showGame(game)} aria-label={`查看${game.title}`}><div className="cover-wrap"><Cover game={game}/><span className="cover-topline">PC · CD-ROM</span>{game.price === 0 ? <span className="cover-ribbon">入门免费</span> : state.installed.includes(game.id) ? <span className="cover-ribbon installed">已安装 ✓</span> : <span className="cover-tier">{level(game.tier - 1)}配置</span>}<div className="cover-bottom"><span>{game.year}</span><span>{game.sizeGB} GB</span></div></div><div className="game-card-info"><h3>{game.title}</h3><p>{GENRES[game.genre].label}<span>·</span>{game.subtitle}</p><div className="game-card-foot"><b className={game.price === 0 || state.installed.includes(game.id) ? 'green' : ''}>{status(game)}</b><span>查看 <span>›</span></span></div></div></button>)}</div>
        {!games.length && <div className="empty-state"><Icon name="folder" size={48}/><h3>没有找到这款游戏</h3><p>试试其他名字，或清除搜索看看全部游戏。</p><button className="xp-button" onClick={() => { setSearch(''); setFilter('all'); }}>显示全部游戏</button></div>}
        <footer className="catalog-footer"><span>世纪游戏站 · 让每一次等待都有回报</span><span>本地模拟体验 / 2004 EDITION</span></footer>
      </section>
    </div>;
  }

  function renderDetail() {
    const g = selectedGame;
    return <div className="detail-content"><div className="detail-art"><Cover game={g}/><span className="detail-disc-label">PC CD-ROM · {g.year}</span><div className="detail-art-caption">{GENRES[g.genre].label} / {level(g.tier - 1)}配置</div></div><div className="detail-main"><div className="detail-scroll"><div className="eyebrow">世纪游戏站 / 游戏档案</div><h1>{g.title}</h1><p className="detail-subtitle">{g.subtitle}</p><p className="detail-description">{g.description}</p><div className="detail-metrics"><div><small>下载大小</small><b>{g.downloadMB >= 1000 ? `${format(g.downloadMB / 1000, 2)} GB` : `${g.downloadMB} MB`}</b></div><div><small>磁盘占用</small><b>{g.sizeGB} GB</b></div><div><small>首次安装奖励</small><b className="green">+{format(g.reward)} 点</b></div><div><small>安装后收藏收益</small><b>+{format(g.income * 60, 1)} 点/分</b></div></div><div className="section-caption">运行配置对照<span>当前配置 / 最低要求 / 推荐配置</span></div><table className="requirements"><thead><tr><th>硬件</th><th>我的电脑</th><th>最低</th><th>推荐</th></tr></thead><tbody>{HARDWARE_KEYS.map(key => { const meets = state.hardware[key] >= g.min[key]; return <tr key={key}><th>{LABELS[key]}</th><td className={meets ? 'requirement-pass' : 'requirement-fail'}><span>{meets ? '✓' : '!'}</span> {HARDWARE[key][state.hardware[key]].name}</td><td title={HARDWARE[key][g.min[key]].name}>{HARDWARE[key][g.min[key]].name}</td><td title={HARDWARE[key][g.recommended[key]].name}>{HARDWARE[key][g.recommended[key]].name}</td></tr>; })}</tbody></table></div><div className="detail-action-footer">{renderActionButtons(g)}<div className="detail-note">{state.collected.includes(g.id) ? '这款游戏已记入永久收藏。重装不会重复获得首装奖励。' : '购买后永久拥有。安装完成获得奖励，保留安装持续产生收藏收益。'}</div></div></div></div>;
  }

  function renderHardware() {
    return <div className="hardware-content"><header className="panel-heading"><Icon name="hardware" size={52}/><div><div className="eyebrow">SYSTEM PROPERTIES</div><h1>让等待，越来越快。</h1><p>升级硬件，装下更大的世界。</p></div><div className="panel-balance"><small>可用装机点</small><b>{format(state.points)}</b></div></header><div className="hardware-grid">{HARDWARE_KEYS.map(key => { const current = HARDWARE[key][state.hardware[key]], next = HARDWARE[key][state.hardware[key] + 1]; return <section className="hardware-card" key={key}><div className={`hardware-badge ${key}`}><Icon name={key === 'network' ? 'network' : key === 'disk' ? 'installer' : 'hardware'} size={37}/></div><div className="hardware-info"><span className="hardware-type">{LABELS[key]}<small>{state.hardware[key] + 1} / 3</small></span><h3>{current.name}</h3><p>{current.detail}</p>{next && <div className="next-hardware">下一档 <b>{next.name}</b><span>{next.detail}</span></div>}</div><div className="hardware-buy">{next ? <button className="xp-button" disabled={state.points < next.price} onClick={() => onAction({ type: 'upgrade', key })}>升级 · {format(next.price)} 点</button> : <span className="upgrade-complete">✓ 已是旗舰配置</span>}</div></section>; })}</div><div className="automation-grid"><section className="automation-card"><Icon name="network" size={34}/><div><h3>下载 / 安装流水线 {state.pipeline && <span>已解锁</span>}</h3><p>让多个任务交叠执行。配合内存升级，最多同时运行 3 个任务。</p></div><button className="xp-button" disabled={state.pipeline || state.points < PIPELINE_COST} onClick={() => onAction({ type: 'unlockPipeline' })}>{state.pipeline ? '已开启' : `${format(PIPELINE_COST)} 点解锁`}</button></section><section className="automation-card"><Icon name="installer" size={34}/><div><h3>自动安装队列 {state.automation && <span>已解锁</span>}</h3><p>自动启动队列中满足条件的游戏，跳过暂时受阻的任务。</p></div><button className="xp-button" disabled={state.automation || state.points < AUTOMATION_COST} onClick={() => onAction({ type: 'unlockAutomation' })}>{state.automation ? '已解锁' : `${format(AUTOMATION_COST)} 点解锁`}</button></section></div><div className="hardware-footer"><span>可同时执行：{maxJobs(state)} 个任务</span><span>磁盘 {format(occupied, 1)} / {capacity} GB · 预留 {format(reserved, 1)} GB</span></div></div>;
  }

  function renderCollection() {
    const list = GAMES.filter(g => state[collectionFilter].includes(g.id));
    return <div className="collection-content"><header className="panel-heading"><Icon name="collection" size={48}/><div><div className="eyebrow">MY GAME COLLECTION</div><h1>每一次等待，都留下了什么。</h1><p>已收集 {state.collected.length} / 24 款 · 当前收益 {format(moneyRate * 60, 1)} 点/分</p></div></header><div className="xp-tabs">{([['installed', '已安装'], ['collected', '永久收藏'], ['owned', '已购买']] as const).map(([id, label]) => <button key={id} className={collectionFilter === id ? 'active' : ''} onClick={() => setCollectionFilter(id)}>{label} ({state[id].length})</button>)}</div>{!list.length ? <div className="empty-state"><Icon name="collection" size={64}/><h3>书架上的第一个位置，为你留着。</h3><p>从商店选一款游戏。安装完成后，它会出现在这里。</p><button className="xp-button primary" onClick={() => openWindow('store')}>逛逛游戏商店</button></div> : <div className="collection-grid">{list.map(g => <div className="collection-item" key={g.id}><button className="collection-cover" onClick={() => showGame(g)}><Cover game={g}/></button><div><h3><button className="text-button" onClick={() => showGame(g)}>{g.title}</button></h3><p>{GENRES[g.genre].label} · {g.sizeGB} GB</p><p className={state.installed.includes(g.id) ? 'green collection-earning' : 'muted'}>{state.installed.includes(g.id) ? `● 运行中 · +${format(g.income * 60, 1)} 点/分` : state.collected.includes(g.id) ? '已收藏 · 当前未安装' : '尚未安装'}</p>{renderActionButtons(g, true)}</div></div>)}</div>}<div className="collection-note">永久收藏记录不会因卸载而消失。只有当前已安装的游戏产生收益。</div></div>;
  }

  function renderJob(job: InstallJob) {
    const game = GAME_MAP[job.gameId];
    const presentation = getInstallPresentation(game, job);
    return <div className="installer-current">
      <div className="installer-hero" style={{ '--game-color': game.color } as CSSProperties}>
        <Cover game={game}/><div className="installer-hero-shade"/>
        <InstallerScene genre={game.genre} color={game.color} progress={job.progress} active={true} reducedMotion={state.settings.reducedMotion}/>
        <div className="installer-hero-copy"><span>{GENRES[game.genre].label} · INSTALLATION WIZARD</span><h1>{game.title}</h1><p>{game.tagline}</p></div>
        <div className="installer-hero-badge"><span>世纪软件</span><b>SETUP</b></div>
      </div>
      <PaperPlaneTransfer stage={job.stage} speed={jobRate(state, job)} reducedMotion={state.settings.reducedMotion}/>
      <div className="installer-progress">
        <div className="install-status"><div><i className="activity-light"/>正在{STAGE_LABELS[job.stage]}<span>请稍候，精彩正在就位…</span></div><strong>{Math.floor(presentation.displayProgress * 100)}<small>%</small></strong></div>
        <Progress value={presentation.displayProgress} label={game.title + '安装进度'}/>
        <div className="stage-steps">{STAGES.map((s, i) => <span key={s} className={s === job.stage ? 'current' : i < STAGES.indexOf(job.stage) ? 'done' : ''}><b>{i < STAGES.indexOf(job.stage) ? '✓' : '0' + (i + 1)}</b>{STAGE_LABELS[s]}</span>)}</div>
        <InstallFileStream key={job.id} game={game} job={job} reducedMotion={state.settings.reducedMotion}/>
        <div className="install-bottom"><span>{job.stage === 'download' ? '下载速度' : job.stage === 'unpack' ? '解压速度' : job.stage === 'write' ? '写入速度' : '校验速度'}：{format(jobRate(state, job) * (job.stage === 'download' ? game.downloadMB : game.sizeGB * 1024) / game.work[job.stage], 1)} MB/s</span><span>资源包 {presentation.completedFiles} / {presentation.totalFiles}</span><span>已用时 {Math.floor(job.elapsed / 60)}分 {Math.floor(job.elapsed) % 60}秒</span></div>
      </div>
    </div>;
  }

  function renderInstaller() {
    return <div className="installer-layout"><div className="installer-left">{state.jobs.length > 1 && <div className="job-tabs">{state.jobs.map(j => <button key={j.id} className={activeJob?.id === j.id ? 'active' : ''} onClick={() => setActiveJobId(j.id)}><span>{GAME_MAP[j.gameId].title}</span><b>{Math.floor(getInstallPresentation(GAME_MAP[j.gameId], j).displayProgress * 100)}%</b></button>)}</div>}{activeJob ? renderJob(activeJob) : <div className="installer-idle"><Icon name="installer" size={77}/><div className="eyebrow">READY FOR THE NEXT INSTALL</div><h1>{state.collected.length ? '安装完成。下一款呢？' : '好戏，在进度条之后。'}</h1><p>选择一款游戏，听硬盘转起来。<br/>你可以关闭这个窗口，任务仍会继续。</p><button className="xp-button primary" onClick={() => openWindow('store')}>打开游戏商店</button>{state.collected.length > 0 && <button className="text-button" onClick={() => openWindow('collection')}>查看我的收藏 →</button>}</div>}<div className="installer-window-footer"><Icon name="hardware" size={19}/><span>{state.jobs.length} / {maxJobs(state)} 任务运行 · 磁盘可用 {format(available, 1)} GB</span><button className="text-button" onClick={() => openWindow('hardware')}>硬件升级</button></div></div><aside className="queue-panel"><div className="queue-heading"><h3>安装队列 <span>{state.queue.length}</span></h3><p>把下一份期待排好。</p></div><div className="auto-control">{state.automation ? <label><input type="checkbox" checked={state.autoEnabled} onChange={() => onAction({ type: 'toggleAuto' })}/> 自动开始可执行的任务</label> : <button onClick={() => openWindow('hardware')}><span>▣</span> 解锁自动队列 <span>→</span></button>}</div><div className="queue-list">{state.queue.length ? state.queue.map((id, index) => { const g = GAME_MAP[id], reason = installBlockReason(state, id); return <div className="queue-item" key={id}><div className="queue-item-top"><span className="queue-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{g.title}</strong><small>{reason || (state.autoEnabled && state.automation ? '等待自动启动' : '准备就绪')}</small></div><button className="icon-button" aria-label={`移出队列：${g.title}`} onClick={() => onAction({ type: 'removeQueue', gameId: id })}>×</button></div><div className="queue-item-controls"><button disabled={index === 0} aria-label={`上移：${g.title}`} onClick={() => onAction({ type: 'moveQueue', gameId: id, direction: -1 })}>↑</button><button disabled={index === state.queue.length - 1} aria-label={`下移：${g.title}`} onClick={() => onAction({ type: 'moveQueue', gameId: id, direction: 1 })}>↓</button><button disabled={!!reason} onClick={() => onAction({ type: 'install', gameId: id })}>立即安装</button></div></div>; }) : <div className="queue-empty"><Icon name="folder" size={45}/><p>队列还空着</p><span>在已购买的游戏详情中<br/>选择「加入安装队列」。</span></div>}</div><div className="queue-tip"><b>小提示</b><p>并行任务共享电脑性能。升级网络、处理器与硬盘，让每根进度条都更快。</p></div></aside></div>;
  }

  function renderSettings() {
    return <div className="settings-content"><div className="settings-heading"><Icon name="sound" size={46}/><div><h2>熟悉的声音，回来了。</h2><p>让电脑陪你一起等待。</p></div></div><fieldset><legend>声音</legend><label className="slider-label"><span>循环音乐</span><input type="range" aria-label="循环音乐音量" min="0" max="1" step="0.05" value={state.settings.music} onChange={e => onAction({ type: 'settings', settings: { music: Number(e.target.value) } })}/><b>{Math.round(state.settings.music * 100)}%</b></label><label className="slider-label"><span>风扇、硬盘与提示音</span><input type="range" aria-label="音效音量" min="0" max="1" step="0.05" value={state.settings.effects} onChange={e => onAction({ type: 'settings', settings: { effects: Number(e.target.value) } })}/><b>{Math.round(state.settings.effects * 100)}%</b></label></fieldset><fieldset><legend>画面</legend><label className="checkbox-label"><input type="checkbox" checked={state.settings.reducedMotion} onChange={e => onAction({ type: 'settings', settings: { reducedMotion: e.target.checked } })}/>减少安装器动画</label></fieldset><div className="settings-guide"><h3>关于你的装机旅程</h3><p>① 领取免费游戏，打开详情开始安装。<br/>② 首次安装获得装机点；保持安装持续收益。<br/>③ 升级硬件，解锁大作与自动安装队列。</p><p>进度自动保存在本机浏览器。关闭网页后暂停；切换到其他标签页时继续。不要清除浏览器网站数据，以免丢失存档。</p><span>装游戏模拟器 · 本地体验版 1.0</span></div></div>;
  }

  function windowContent(id: WindowId): ReactNode {
    if (id === 'store') return renderStore();
    if (id === 'detail') return renderDetail();
    if (id === 'hardware') return renderHardware();
    if (id === 'collection') return renderCollection();
    if (id === 'installer') return renderInstaller();
    return renderSettings();
  }

  return <main className={`desktop ${state.settings.reducedMotion ? 'reduced-motion' : ''}`} onPointerDown={e => { if (!(e.target as HTMLElement).closest('.start-menu, .start-button')) setStartOpen(false); }}>
    <div className="desktop-sky"/><div className="desktop-hill far"/><div className="desktop-hill near"/><div className="desktop-grain"/>
    <div className="desktop-icons">
      {(['hardware', 'store', 'collection', 'installer'] as WindowId[]).map((id, index) => <DesktopIcon key={id} id={'app:' + id} index={index} onOpen={() => openWindow(id)}><Icon name={id} size={43}/><span>{id === 'hardware' ? '我的电脑' : id === 'store' ? '世纪游戏站' : id === 'collection' ? '我的游戏' : '安装管理器'}</span></DesktopIcon>)}
      {state.installed.map((id, index) => <DesktopIcon key={id} id={'game:' + id} index={index + 4} className="installed-shortcut" onOpen={() => showGame(GAME_MAP[id])}>
        <div className="shortcut-image"><Cover game={GAME_MAP[id]}/><span>↗</span><i className="shortcut-running-led"/>
          {feedback.incomePulse?.gameIds.includes(id) && <b key={feedback.incomePulse.id} className="shortcut-income-pop">+{format(feedback.incomePulse.amounts[id] || 0, 2)}</b>}
        </div>
        <span>{GAME_MAP[id].title}</span><small className="shortcut-running-label">运行中</small>
      </DesktopIcon>)}
    </div>
    <div className="desktop-watermark"><span>装游戏模拟器</span><small>一些快乐，值得再等一次。</small></div>
    {windows.filter(w => !w.minimized).map(win => <section key={win.id} className={`xp-window window-${win.id} ${focused === win.id ? 'focused' : ''}`} style={{ left: win.x, top: win.y, zIndex: win.z }} onPointerDown={() => focusWindow(win.id)} aria-label={TITLES[win.id]}><header className="window-titlebar" onPointerDown={e => beginDrag(e, win)}><Icon name={win.id} size={20}/><span>{win.id === 'detail' ? `${selectedGame.title} — 游戏说明` : TITLES[win.id]}</span><div className="window-controls"><button aria-label={`最小化${TITLES[win.id]}`} onClick={() => setWindows(ws => ws.map(w => w.id === win.id ? { ...w, minimized: true } : w))}><i className="minimize-icon"/></button><button className="close-button" aria-label={`关闭${TITLES[win.id]}`} onClick={() => closeWindow(win.id)}>×</button></div></header>{win.id === 'store' && <><nav className="window-menubar"><button onClick={() => { setFilter('all'); setSearch(''); }}>商店首页<span>(S)</span></button><button onClick={() => openWindow('collection')}>我的收藏<span>(C)</span></button><button onClick={() => openWindow('hardware')}>电脑配置<span>(P)</span></button><button onClick={() => openWindow('settings')}>设置<span>(O)</span></button><span className="menubar-brand">CENTURY GAMES</span></nav><div className="store-addressbar"><span className="address-label">地址</span><div className="address-path"><Icon name="store" size={17}/><span>世纪游戏站<span className="path-separator">›</span>{filter === 'all' ? '发现游戏' : GENRES[filter].label}</span><span className="address-arrow">▾</span></div><div className="wallet"><span key={feedback.incomePulse?.id || 0} className={`coin ${feedback.incomePulse ? 'wallet-income-coin' : ''}`}>G</span><strong>{format(state.points)}</strong><span>装机点</span><small>+{format(moneyRate * 60, 1)}/分</small></div></div></>}<div className="window-body">{windowContent(win.id)}</div>{win.id === 'store' && <footer className="window-statusbar"><span><i className="online-dot"/>游戏站已就绪</span><span>{state.jobs.length > 0 ? `${state.jobs.length} 个安装任务正在运行` : '安装好心情，从这里开始'}</span><span><Icon name="hardware" size={15}/>我的电脑</span></footer>}</section>)}
    <RewardFeedback state={state} feedback={feedback} onOpenCollection={() => openWindow('collection')}/>
    {(notice || eventToast) && <div className={`desktop-notice ${notice ? 'warning' : ''}`} role="status"><Icon name={notice ? 'settings' : 'installer'} size={30}/><div><strong>{notice ? '操作提示' : '装机小助手'}</strong><p>{notice || eventToast}</p></div><button aria-label="关闭通知" onClick={() => { onDismissNotice(); setEventToast(null); }}>×</button></div>}
    {startOpen && <div className="start-menu"><header><Icon name="hardware" size={42}/><div><b>装机爱好者</b><small>欢迎回来，准备装点什么？</small></div></header><div className="start-menu-content">{(['store', 'installer', 'collection', 'hardware', 'settings'] as WindowId[]).map(id => <button key={id} onClick={() => openWindow(id)}><Icon name={id} size={29}/><span>{TITLES[id].split(' — ')[0]}</span></button>)}</div><footer><span>进度已自动保存在此浏览器</span><span>●</span></footer></div>}
    <footer className="taskbar"><button className={`start-button ${startOpen ? 'active' : ''}`} onClick={() => setStartOpen(v => !v)}><span className="start-mark"><i/><i/><i/><i/></span><b>开始</b></button><div className="quick-launch"><button title="游戏商店" onClick={() => openWindow('store')}><Icon name="store" size={24}/></button><button title="安装管理" onClick={() => openWindow('installer')}><Icon name="installer" size={23}/></button></div><div className="taskbar-windows">{windows.map(win => <button key={win.id} className={!win.minimized && focused === win.id ? 'active' : ''} onClick={() => { if (focused === win.id && !win.minimized) setWindows(ws => ws.map(w => w.id === win.id ? { ...w, minimized: true } : w)); else focusWindow(win.id); }}><Icon name={win.id} size={20}/><span>{win.id === 'detail' ? selectedGame.title : TITLES[win.id].split(' — ')[0]}</span>{win.id === 'installer' && state.jobs.length > 0 && <b>{state.jobs.length}</b>}</button>)}</div><div className="system-tray"><button aria-label="声音设置" onClick={() => openWindow('settings')}><Icon name="sound" size={21}/></button><Icon name="network" size={21}/><time title={clock.toLocaleDateString('zh-CN')}>{clock.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</time></div></footer>
  </main>;
}
