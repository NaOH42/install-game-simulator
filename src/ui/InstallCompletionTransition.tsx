import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { getPixelCelebration } from '../render/pixelCelebrationData';
import { getTransitionFrame, getTransitionGeometry, type CompletionOrigin } from '../render/completionTransitionTiming';
import './install-completion-transition.css';

export type { CompletionOrigin } from '../render/completionTransitionTiming';
type Props = {
  gameId: string;
  reducedMotion: boolean;
  origin: CompletionOrigin | null;
  onImpact: (elapsedSinceImpact: number) => void;
  onFinish: () => void;
  onSkip: () => void;
};
type TransitionGeometry = ReturnType<typeof getTransitionGeometry>;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** One outward impulse, never an oscillating or repeatedly flashing full-screen effect. */
function drawBurst(ctx: CanvasRenderingContext2D, geometry: TransitionGeometry, elapsed: number, width: number, height: number, primary: string, accent: string) {
  const frame = getTransitionFrame(elapsed);
  const { originX: x, originY: y, radius } = geometry;
  ctx.clearRect(0, 0, width, height);
  if (!frame.impacted) {
    const energy = frame.charge ** 2;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 25 + energy * 67);
    glow.addColorStop(0, accent); glow.addColorStop(.16, primary); glow.addColorStop(1, 'transparent');
    ctx.globalAlpha = .3 + energy * .45; ctx.fillStyle = glow;
    ctx.fillRect(x - 100, y - 100, 200, 200);
    ctx.globalAlpha = .55 + energy * .35; ctx.fillStyle = '#f7ffe4';
    ctx.fillRect(x - 2 - energy * 2, y - 8 - energy * 12, 4 + energy * 4, 16 + energy * 24);
    ctx.globalAlpha = 1;
    return;
  }
  const p = frame.burstProgress;
  const r = frame.reveal * radius;
  const exposure = Math.max(0, 1 - p / .29) ** 2;
  ctx.fillStyle = accent; ctx.globalAlpha = exposure * .38; ctx.fillRect(0, 0, width, height);
  // The edge follows the identical circle used to reveal the actual celebration.
  ctx.globalAlpha = (1 - p) ** 1.5;
  ctx.strokeStyle = primary; ctx.lineWidth = 18 * (1 - p) + 2;
  ctx.shadowColor = primary; ctx.shadowBlur = 26;
  ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#edfff0'; ctx.lineWidth = 4 * (1 - p) + 1;
  ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  // A secondary thin ring gives the release some thickness without another flash.
  ctx.globalAlpha = (1 - p) * .6; ctx.strokeStyle = accent; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, Math.max(1, r * .77), 0, Math.PI * 2); ctx.stroke();
  const travel = 1 - (1 - p) ** 2;
  for (let index = 0; index < 42; index++) {
    const angle = index * 2.399963 + .17;
    const distance = (48 + (index * 73 % 410)) * travel;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance + p * p * 28;
    const size = index % 5 === 0 ? 6 : 3;
    ctx.globalAlpha = Math.max(0, 1 - p * (1.05 + (index % 4) * .16));
    ctx.save(); ctx.translate(px, py); ctx.rotate(angle);
    ctx.fillStyle = index % 3 ? primary : accent;
    ctx.fillRect(-size, -size / 2, size * (index % 3 === 0 ? 5 : 2), size);
    ctx.restore();
  }
  // Short, directional star at the bar tip: the explosive hit is visible even on a phone.
  const core = Math.max(0, 1 - p / .4);
  ctx.globalAlpha = core * .85; ctx.fillStyle = '#f2ffe2';
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const length = (i % 2 ? 10 : i % 4 === 0 ? 112 : 60) * (.75 + p * 3);
    if (i === 0) ctx.moveTo(Math.cos(a) * length, Math.sin(a) * length);
    else ctx.lineTo(Math.cos(a) * length, Math.sin(a) * length);
  }
  ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
}

export default function InstallCompletionTransition({ gameId, reducedMotion, origin, onImpact, onFinish, onSkip }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onImpact, onFinish, onSkip });
  callbacks.current = { onImpact, onFinish, onSkip };
  const completed = useRef(false);
  const impacted = useRef(false);
  const initialOrigin = useRef(origin);
  const scene = getPixelCelebration(gameId);

  useEffect(() => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    const previousFocus = document.activeElement;
    skipRef.current?.focus({ preventScroll: true });
    let request = 0;
    let elapsed = 0;
    let last = performance.now();
    let width = window.innerWidth;
    let height = window.innerHeight;
    let geometry = getTransitionGeometry(initialOrigin.current, width, height);
    let ctx: CanvasRenderingContext2D | null = null;
    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      geometry = getTransitionGeometry(initialOrigin.current, width, height);
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx = canvas.getContext('2d'); ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      overlay.style.setProperty('--burst-bar-x', `${geometry.barLeft}px`);
      overlay.style.setProperty('--burst-bar-y', `${geometry.barTop}px`);
      overlay.style.setProperty('--burst-bar-w', `${geometry.barWidth}px`);
      overlay.style.setProperty('--burst-bar-h', `${geometry.barHeight}px`);
      overlay.style.setProperty('--burst-x', `${geometry.originX}px`);
      overlay.style.setProperty('--burst-y', `${geometry.originY}px`);
      overlay.style.setProperty('--burst-title-x', `${Math.max(Math.min(120, width / 2), Math.min(width - Math.min(120, width / 2), geometry.originX - 55))}px`);
      overlay.style.setProperty('--burst-title-y', `${Math.max(90, Math.min(height - 100, geometry.originY - 80))}px`);
    };
    const skip = () => {
      if (completed.current) return;
      completed.current = true;
      cancelAnimationFrame(request);
      callbacks.current.onSkip();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); skip(); }
      if (event.key === 'Tab') { event.preventDefault(); event.stopImmediatePropagation(); skipRef.current?.focus({ preventScroll: true }); }
    };
    const paint = () => {
      const frame = getTransitionFrame(elapsed, reducedMotion);
      overlay.dataset.phase = frame.impacted ? 'burst' : 'charge';
      overlay.dataset.elapsed = `${Math.round(elapsed)}`;
      overlay.style.setProperty('--burst-charge', `${frame.charge}`);
      overlay.style.setProperty('--burst-progress', `${frame.burstProgress}`);
      overlay.style.setProperty('--burst-dim', `${reducedMotion ? .08 * (1 - frame.burstProgress) : frame.impacted ? .2 * (1 - frame.reveal) : frame.charge * .25}`);
      const recoil = reducedMotion || !frame.impacted ? 0 : Math.max(0, 1 - frame.burstProgress / .45);
      overlay.style.setProperty('--burst-recoil', `${recoil}`);
      if (ctx && !reducedMotion) drawBurst(ctx, geometry, elapsed, width, height, scene.primary, scene.accent);
    };
    const tick = (now: number) => {
      if (document.hidden || completed.current) return;
      elapsed += Math.max(0, now - last); last = now;
      paint();
      const frame = getTransitionFrame(elapsed, reducedMotion);
      if (frame.impacted && !impacted.current) { impacted.current = true; callbacks.current.onImpact(frame.elapsed - frame.impactMs); }
      if (frame.finished) { completed.current = true; callbacks.current.onFinish(); return; }
      request = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(request); last = performance.now();
      if (!document.hidden && !completed.current) request = requestAnimationFrame(tick);
    };
    resize(); paint();
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', keyboard, true);
    document.addEventListener('visibilitychange', visibility);
    if (!document.hidden) request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
      window.removeEventListener('resize', resize);
      document.removeEventListener('keydown', keyboard, true);
      document.removeEventListener('visibilitychange', visibility);
      // Do not steal focus from the pixel scene that is already visible underneath us.
      if ((overlay.contains(document.activeElement) || document.activeElement === document.body) && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [gameId, reducedMotion, scene.primary, scene.accent]);

  const skip = () => {
    if (completed.current) return;
    completed.current = true;
    callbacks.current.onSkip();
  };
  if (typeof document === 'undefined') return null;
  return createPortal(<div ref={overlayRef} className={`install-completion-transition${reducedMotion ? ' is-gentle' : ''}`} role="dialog" aria-modal="true" aria-label={`${scene.title}安装完成`} data-phase="charge" style={{ '--burst-primary': scene.primary, '--burst-accent': scene.accent } as CSSProperties}>
    <div className="completion-burst-dim" aria-hidden="true" />
    {!origin?.hideBar && <div className="completion-burst-bar" aria-hidden="true"><i />{!origin && <span>100%</span>}</div>}
    <canvas className="completion-burst-canvas" ref={canvasRef} aria-hidden="true" />
    <div className="completion-burst-title" aria-hidden="true"><span>100<small>%</small></span><strong>安装完成</strong></div>
    <button ref={skipRef} className="completion-burst-skip" onClick={skip}>跳过演出<span>Esc</span></button>
  </div>, document.body);
}
