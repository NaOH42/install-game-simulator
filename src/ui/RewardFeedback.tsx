import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { GAME_MAP } from '../game/catalog';
import { incomePerSecond } from '../game/engine';
import type { SaveGame } from '../game/types';
import { assetUrl } from './assetUrl';
import './reward-feedback.css';

export interface IncomePulse {
  id: number;
  amount: number;
  amounts: Record<string, number>;
  gameIds: string[];
}

export interface CompletionItem {
  gameId: string;
  firstInstall: boolean;
  reward: number;
}

export interface CompletionFeedback {
  id: number;
  items: CompletionItem[];
  totalReward: number;
}

export interface GameFeedback {
  incomePulse: IncomePulse | null;
  completion: CompletionFeedback | null;
  dismissCompletion: () => void;
}

/** Presentation-only accounting: purchases change points, never earned. */
export function getFeedbackChanges(previous: SaveGame, current: SaveGame) {
  const newCollections = new Set(current.collected.filter(id => !previous.collected.includes(id)));
  const firstRewards = [...newCollections].reduce((sum, id) => sum + (GAME_MAP[id]?.reward || 0), 0);
  const earnedDelta = current.earned - previous.earned;
  if (earnedDelta < -0.000001) return { income: 0, completions: [] as CompletionItem[], reset: true };
  const income = Math.max(0, earnedDelta - firstRewards);
  const completions: CompletionItem[] = current.installed
    .filter(id => !previous.installed.includes(id) && GAME_MAP[id])
    .map(gameId => ({ gameId, firstInstall: newCollections.has(gameId), reward: newCollections.has(gameId) ? GAME_MAP[gameId].reward : 0 }));
  return { income, completions, reset: false };
}

/** Session totals are credited by the engine; no duration or proportional allocation is guessed here. */
export function getIncomeChanges(previous: Readonly<Record<string, number>>, current: Readonly<Record<string, number>>) {
  const amounts: Record<string, number> = {};
  for (const gameId of Object.keys(GAME_MAP)) {
    const before = Number.isFinite(previous[gameId]) ? previous[gameId] : 0;
    const after = Number.isFinite(current[gameId]) ? current[gameId] : 0;
    if (after < before - .000000001) return { amounts: {} as Record<string, number>, amount: 0, reset: true };
    if (after > before) amounts[gameId] = after - before;
  }
  return { amounts, amount: Object.values(amounts).reduce((sum, value) => sum + value, 0), reset: false };
}

const INCOME_INTERVAL = 3000;
const PULSE_DURATION = 2350;
const COMPLETION_DURATION = 5200;

/** Observe exact engine receipts and completion changes without changing the economy. */
export function useGameFeedback(state: SaveGame, incomeTotals: Readonly<Record<string, number>>): GameFeedback {
  const [incomePulse, setIncomePulse] = useState<IncomePulse | null>(null);
  const [completion, setCompletion] = useState<CompletionFeedback | null>(null);
  const previous = useRef(state);
  const previousIncomeTotals = useRef({ ...incomeTotals });
  const latest = useRef(state);
  latest.current = state;
  const serial = useRef(0);
  const pendingIncome = useRef<Record<string, number>>({});
  const pendingCompletions = useRef<CompletionItem[]>([]);
  const lastIncomeAt = useRef(performance.now());
  const incomeExpiry = useRef(0);
  const completionExpiry = useRef(0);
  const activeCompletion = useRef<CompletionFeedback | null>(null);

  const dismissCompletion = useCallback(() => {
    activeCompletion.current = null;
    completionExpiry.current = 0;
    setCompletion(null);
  }, []);

  const publishCompletion = useCallback((items: CompletionItem[], now: number) => {
    if (!items.length) return;
    const preceding = activeCompletion.current && now < completionExpiry.current ? activeCompletion.current.items : [];
    const merged = [...preceding, ...items];
    const next: CompletionFeedback = {
      id: ++serial.current,
      items: merged,
      totalReward: merged.reduce((sum, item) => sum + item.reward, 0),
    };
    activeCompletion.current = next;
    completionExpiry.current = now + COMPLETION_DURATION;
    setCompletion(next);
  }, []);

  useEffect(() => {
    const changes = getFeedbackChanges(previous.current, state);
    const incomeChanges = getIncomeChanges(previousIncomeTotals.current, incomeTotals);
    previous.current = state;
    previousIncomeTotals.current = { ...incomeTotals };
    if (changes.reset || incomeChanges.reset) {
      pendingIncome.current = {};
      pendingCompletions.current = [];
      incomeExpiry.current = 0;
      setIncomePulse(null);
      dismissCompletion();
      lastIncomeAt.current = performance.now();
      return;
    }
    for (const [gameId, amount] of Object.entries(incomeChanges.amounts)) {
      pendingIncome.current[gameId] = (pendingIncome.current[gameId] ?? 0) + amount;
    }
    if (changes.completions.length) {
      if (document.hidden) pendingCompletions.current.push(...changes.completions);
      else publishCompletion(changes.completions, performance.now());
    }
    // Actual past earnings stay in the total; stopped shortcuts no longer emit.
    setIncomePulse(pulse => {
      if (!pulse || pulse.gameIds.every(id => state.running.includes(id))) return pulse;
      return { ...pulse, gameIds: pulse.gameIds.filter(id => state.running.includes(id)) };
    });
  }, [state, incomeTotals, dismissCompletion, publishCompletion]);

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      const now = performance.now();
      if (pendingCompletions.current.length) {
        const items = pendingCompletions.current;
        pendingCompletions.current = [];
        publishCompletion(items, now);
      }
      if (completionExpiry.current && now >= completionExpiry.current) dismissCompletion();
      if (incomeExpiry.current && now >= incomeExpiry.current) {
        incomeExpiry.current = 0;
        setIncomePulse(null);
      }
      if (now - lastIncomeAt.current < INCOME_INTERVAL) return;
      lastIncomeAt.current = now;
      const amounts = pendingIncome.current;
      const amount = Object.values(amounts).reduce((sum, value) => sum + value, 0);
      if (amount < 0.000001) return;
      const next: IncomePulse = {
        id: ++serial.current,
        amount,
        amounts,
        gameIds: Object.keys(amounts).filter(id => latest.current.running.includes(id)),
      };
      pendingIncome.current = {};
      incomeExpiry.current = now + PULSE_DURATION;
      setIncomePulse(next);
    };
    const visibilityChanged = () => {
      if (document.hidden) {
        incomeExpiry.current = 0;
        setIncomePulse(null);
        dismissCompletion();
      }
      // A visible tick combines accumulated background income into one pulse.
      // Waiting until the next tick also lets the engine apply its catch-up step.
    };
    const timer = window.setInterval(tick, 180);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [dismissCompletion, publishCompletion]);

  return { incomePulse, completion, dismissCompletion };
}

function useReducedFeedbackMotion(setting: boolean) {
  const [mediaReduced, setMediaReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMediaReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return setting || mediaReduced;
}

const number = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: value < 1 ? 2 : 1 });

function RewardNumber({ value, runId, reducedMotion, duration = 900 }: { value: number; runId: number; reducedMotion: boolean; duration?: number }) {
  const [displayed, setDisplayed] = useState(reducedMotion ? value : 0);
  useEffect(() => {
    if (reducedMotion) { setDisplayed(value); return; }
    let frame = 0;
    const start = performance.now();
    const update = (now: number) => {
      const ratio = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - ratio, 3);
      const next = Number.isInteger(value) ? Math.floor(value * eased) : value * eased;
      setDisplayed(next);
      if (ratio < 1) frame = requestAnimationFrame(update);
    };
    setDisplayed(0);
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value, runId, reducedMotion, duration]);
  return <>{number(displayed)}</>;
}

const PARTICLES = Array.from({ length: 48 }, (_, index) => {
  const angle = index * 2.399963;
  const radius = 340 + (index % 7) * 20;
  return {
    '--burst-x': `clamp(-44vw, ${Math.cos(angle) * radius}px, 44vw)`,
    '--burst-y': `clamp(-40vh, ${Math.sin(angle) * radius * .86 - 35}px, 40vh)`,
    '--burst-turn': `${(index % 2 ? 1 : -1) * (130 + index * 23)}deg`,
    '--burst-delay': `${(index % 7) * 24}ms`,
  } as CSSProperties;
});

function CompletionCard({ data, reducedMotion, onDismiss, onOpenCollection }: {
  data: CompletionFeedback;
  reducedMotion: boolean;
  onDismiss: () => void;
  onOpenCollection: () => void;
}) {
  const firstCount = data.items.filter(item => item.firstInstall).length;
  const reinstallCount = data.items.length - firstCount;
  const latestItems = data.items.slice(-3);
  const single = data.items.length === 1;
  const mainGame = GAME_MAP[data.items[data.items.length - 1].gameId];
  const title = single ? (firstCount ? '安装完成！' : '重装完成！') : `${data.items.length} 款游戏，安装完成！`;
  const subtitle = firstCount ? '又一份快乐，正式住进你的硬盘。' : '熟悉的游戏，随时可以再回来。';
  return <div className="completion-stage" key={data.id}>
    <div className="reward-feedback-announcement" role="status" aria-live="polite" aria-atomic="true">{single ? `${mainGame.title}安装完成。` : `${data.items.length}款游戏安装完成。`}{data.totalReward > 0 ? `首装奖励 ${number(data.totalReward)} 装机点已到账。` : '本次为重新安装，首装奖励 0 点。'}启动游戏后开始产生运行收益。</div>
    {!reducedMotion && <div className="reward-burst" aria-hidden="true"><i className="reward-shockwave"/><i className="reward-shockwave second"/>{PARTICLES.map((style, index) => <i key={index} style={style} className={`reward-particle particle-${index % 4} ${index % 5 === 0 ? 'particle-coin' : ''}`}>{index % 5 === 0 ? 'G' : ''}</i>)}</div>}
    <section className="completion-card" aria-label={title}>
      <div className="completion-titlebar"><span className="completion-status-dot"/>安装向导 · 任务成功<button aria-label="关闭安装完成反馈" onClick={onDismiss}>×</button></div>
      <div className="completion-content">
        <div className="completion-celebration-mark" aria-hidden="true"><span>✓</span><i/><i/><i/></div>
        <div className="completion-eyebrow">MISSION INSTALLED</div>
        <h2>{title}</h2>
        <p className="completion-subtitle">{subtitle}</p>
        <div className="completion-game-panel">
          <div className={`completion-covers ${single ? 'single' : ''}`} aria-hidden="true">{latestItems.map((item, index) => {
            const game = GAME_MAP[item.gameId];
            return <img key={`${item.gameId}-${index}`} src={assetUrl(game.cover)} alt="" style={{ objectPosition: game.focalPoint, '--cover-index': index, '--cover-count': latestItems.length } as CSSProperties}/>;
          })}</div>
          <div className="completion-game-info"><div className="completion-percentage">100<span>%</span><b>COMPLETE</b></div><h3>{single ? mainGame.title : latestItems.map(item => GAME_MAP[item.gameId].title).join(' · ')}</h3><p>{single ? '文件校验成功 · 桌面快捷方式已创建' : `${firstCount} 款首次安装${reinstallCount ? ` · ${reinstallCount} 款重新安装` : ''} · 全部就绪`}</p><div className="completion-full-progress"><i/></div></div>
        </div>
        <div className={`completion-reward ${data.totalReward === 0 ? 'reinstall' : ''}`}>
          <div className="reward-medallion" aria-hidden="true">G</div>
          <div><span>{data.totalReward > 0 ? '首次安装奖励已到账' : '游戏已准备就绪'}</span>{data.totalReward > 0 ? <strong aria-label={`获得 ${number(data.totalReward)} 装机点`}>+<RewardNumber value={data.totalReward} runId={data.id} reducedMotion={reducedMotion}/><small>装机点</small></strong> : <strong className="reinstall-message">欢迎回来<small>本次首装奖励 0 点</small></strong>}</div>
          {data.totalReward > 0 && <span className="reward-arrival-stamp">到账<br/><b>RECEIVED</b></span>}
        </div>
        <div className="completion-bottom"><span>{firstCount ? '去收藏中启动游戏，让空闲资源带来收益。' : '购买与收藏记录保留，首装奖励不重复发放。'}</span><button onClick={() => { onOpenCollection(); onDismiss(); }}>前往启动 <b>→</b></button></div>
      </div>
      <div className="completion-lifetime" aria-hidden="true"><i/></div>
    </section>
    <p className="completion-nonblocking-hint">安装任务继续运行 · 你可以继续操作</p>
  </div>;
}

export function RewardFeedback({ state, feedback, onOpenCollection }: {
  state: SaveGame;
  feedback: GameFeedback;
  onOpenCollection: () => void;
}) {
  const reducedMotion = useReducedFeedbackMotion(state.settings.reducedMotion);
  const rate = incomePerSecond(state) * 60;
  const pulse = feedback.incomePulse;
  return <div className={`reward-feedback ${reducedMotion ? 'feedback-reduced-motion' : ''}`}>
    <aside className={`passive-income-tray ${rate > 0 ? 'is-earning' : ''} ${pulse ? 'has-income-pulse' : ''}`} aria-label={`运行收益每分钟 ${number(rate)} 装机点`}>
      <div className="income-tray-medallion" aria-hidden="true"><span>G</span><i/></div>
      <div className="income-tray-copy"><div><b>运行收益</b><small>{state.running.length} 款运行中</small></div><p><strong>{number(rate)}</strong><span>点 / 分钟</span></p></div>
      <div className="income-flow-indicator" aria-hidden="true"><i/><i/><i/></div>
      {pulse && <div className="income-pop" key={pulse.id} aria-hidden="true"><span className="income-pop-coin">G</span><strong>+<RewardNumber value={pulse.amount} runId={pulse.id} reducedMotion={reducedMotion} duration={650}/></strong><span>装机点</span>{!reducedMotion && <div className="income-mini-coins">{[0, 1, 2, 3, 4].map(index => <i key={index} style={{ '--coin-index': index } as CSSProperties}>G</i>)}</div>}</div>}
      {!rate && <span className="income-empty-hint">启动已安装游戏，开始积累快乐。</span>}
    </aside>
    {feedback.completion && <CompletionCard key={feedback.completion.id} data={feedback.completion} reducedMotion={reducedMotion} onDismiss={feedback.dismissCompletion} onOpenCollection={onOpenCollection}/>}
  </div>;
}

export default RewardFeedback;
