import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { GAME_MAP } from '../game/catalog';
import { incomePerSecond } from '../game/engine';
import type { SaveGame } from '../game/types';
import PixelCelebration from '../render/PixelCelebration';
import InstallCompletionTransition from './InstallCompletionTransition';
import type { CompletionOrigin } from '../render/completionTransitionTiming';
import { advanceCompletionQueue, claimCompletionStart, createCompletionQueue, enqueueCompletions, finishCompletion, resetCompletionQueue, type CompletionFeedback, type CompletionItem } from './completionQueue';
import './reward-feedback.css';

export type { CompletionFeedback, CompletionItem } from './completionQueue';

export interface IncomePulse {
  id: number;
  amount: number;
  amounts: Record<string, number>;
  gameIds: string[];
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
  const completionQueue = useRef(createCompletionQueue());
  const lastIncomeAt = useRef(performance.now());
  const incomeExpiry = useRef(0);

  const dismissCompletion = useCallback(() => {
    if (!completion) return;
    const previousQueue = completionQueue.current;
    const nextQueue = finishCompletion(previousQueue, completion.id, !document.hidden);
    if (nextQueue === previousQueue) return;
    completionQueue.current = nextQueue;
    window.dispatchEvent(new CustomEvent('install-celebration-end', { detail: { gameId: completion.items[0].gameId } }));
    setCompletion(nextQueue.active);
  }, [completion]);

  useLayoutEffect(() => {
    const changes = getFeedbackChanges(previous.current, state);
    const incomeChanges = getIncomeChanges(previousIncomeTotals.current, incomeTotals);
    previous.current = state;
    previousIncomeTotals.current = { ...incomeTotals };
    if (changes.reset || incomeChanges.reset) {
      pendingIncome.current = {};
      completionQueue.current = resetCompletionQueue(completionQueue.current);
      incomeExpiry.current = 0;
      setIncomePulse(null);
      setCompletion(null);
      lastIncomeAt.current = performance.now();
      return;
    }
    for (const [gameId, amount] of Object.entries(incomeChanges.amounts)) {
      pendingIncome.current[gameId] = (pendingIncome.current[gameId] ?? 0) + amount;
    }
    if (changes.completions.length) {
      completionQueue.current = enqueueCompletions(completionQueue.current, changes.completions, !document.hidden);
      setCompletion(completionQueue.current.active);
    }
    // Actual past earnings stay in the total; stopped shortcuts no longer emit.
    setIncomePulse(pulse => {
      if (!pulse || pulse.gameIds.every(id => state.running.includes(id))) return pulse;
      return { ...pulse, gameIds: pulse.gameIds.filter(id => state.running.includes(id)) };
    });
  }, [state, incomeTotals]);

  useEffect(() => {
    if (!completion) return;
    const announceVisibleScene = () => {
      const started = claimCompletionStart(completionQueue.current, completion.id, !document.hidden);
      completionQueue.current = started.queue;
      if (started.item) window.dispatchEvent(new CustomEvent('install-celebration-start', { detail: { gameId: started.item.gameId, transition: true } }));
    };
    announceVisibleScene();
    document.addEventListener('visibilitychange', announceVisibleScene);
    return () => document.removeEventListener('visibilitychange', announceVisibleScene);
  }, [completion]);

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      const now = performance.now();
      completionQueue.current = advanceCompletionQueue(completionQueue.current, true);
      setCompletion(completionQueue.current.active);
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
  }, []);

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

function CompletionScene({ data, reducedMotion, onDismiss }: {
  data: CompletionFeedback;
  reducedMotion: boolean;
  onDismiss: () => void;
}) {
  const item = data.items[0];
  const game = GAME_MAP[item.gameId];
  const [origin, setOrigin] = useState<CompletionOrigin | null | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [revealedAt, setRevealedAt] = useState<number | undefined>();
  const [transitioning, setTransitioning] = useState(true);
  const impact = useCallback((elapsedSinceImpact: number) => { setRevealedAt(performance.now() - elapsedSinceImpact); setRevealed(true); }, []);
  const transitioned = useCallback(() => setTransitioning(false), []);
  useLayoutEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => { if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, []);
  useLayoutEffect(() => {
    // Read the held 100% bar after the completion commit. Never use a cached rect
    // from a closed/minimized window or a different game completing in the queue.
    const installer = document.querySelector<HTMLElement>('.window-installer.focused:not([hidden])');
    const experience = installer?.querySelector<HTMLElement>('.install-experience');
    const track = experience?.dataset.installGameId === item.gameId ? experience.querySelector<HTMLElement>('.install-main-track') : null;
    const box = track?.getBoundingClientRect();
    const tip = track?.querySelector('.install-finish-line')?.getBoundingClientRect();
    const clip = experience?.getBoundingClientRect();
    // Camera zoom may put the track outside the installer's overflow clip. Only
    // carry its actually visible area into the full-screen overlay.
    const left = Math.max(0, box?.left ?? 0, clip?.left ?? 0);
    const top = Math.max(0, box?.top ?? 0, clip?.top ?? 0);
    const right = Math.min(innerWidth, box?.right ?? 0, clip?.right ?? 0);
    const bottom = Math.min(innerHeight, box?.bottom ?? 0, clip?.bottom ?? 0);
    const transformed = experience?.dataset.anticipation === 'gravity-flip' || experience?.dataset.anticipation === 'crt-collapse';
    setOrigin(box && right > left && bottom > top ? {
      left, top, width: right - left, height: bottom - top,
      ...(tip ? { tipX: Math.max(left, Math.min(right, tip.left + tip.width / 2)), tipY: Math.max(top, Math.min(bottom, tip.top + tip.height / 2)) } : {}),
      hideBar: transformed && !reducedMotion,
    } : null);
  }, [item.gameId, reducedMotion]);
  return <>
    {origin !== undefined && transitioning && <InstallCompletionTransition gameId={item.gameId} reducedMotion={reducedMotion} origin={origin} onImpact={impact} onFinish={transitioned} onSkip={onDismiss}/>}
    {revealed && <PixelCelebration gameId={item.gameId} reducedMotion={reducedMotion} revealOrigin={origin ?? null} startedAt={revealedAt} interactive={!transitioning} restoreFocus={false} onFinish={onDismiss}/>}
    {revealed && !transitioning && createPortal(<div className="pixel-completion-reward">
      <div role="status" aria-live="polite" aria-atomic="true">
        <span>{game.title} · {item.firstInstall ? '首次安装完成' : '重新安装完成'}</span>
        <strong>{item.firstInstall && item.reward > 0 ? `+${number(item.reward)} 装机点已到账` : '欢迎回来，收藏已保留'}</strong>
      </div>
    </div>, document.body)}
  </>;
}

export function RewardFeedback({ state, feedback }: {
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
    {feedback.completion && <CompletionScene key={feedback.completion.id} data={feedback.completion} reducedMotion={reducedMotion} onDismiss={feedback.dismissCompletion}/>}
  </div>;
}

export default RewardFeedback;
