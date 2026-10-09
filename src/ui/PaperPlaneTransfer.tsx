import { useId, useLayoutEffect, useRef } from 'react';
import type { Stage } from '../game/types';
import { transferPlaybackRate } from './transferSpeed';
import './paper-plane-transfer.css';

type Props = { stage: Stage; reducedMotion: boolean; speed: number };

const STAGE_COPY: Record<Stage, { source: string; target: string; caption: string }> = {
  download: { source: '下载器', target: '暂存目录', caption: '把期待，一份份送到电脑里' },
  unpack: { source: '压缩包', target: '游戏目录', caption: '展开文件，也展开一个新世界' },
  write: { source: '源文件', target: '安装目录', caption: '文件正在寻找自己的位置' },
  verify: { source: '安装器', target: '校验程序', caption: '再确认一次，精彩即将就位' },
};

function Plane() {
  return <g className="paper-transfer-plane-shape">
    <path d="M-17-10 20 0-15 12-7 1Z" fill="#fff" stroke="#6091be" strokeWidth=".8" strokeLinejoin="round"/>
    <path d="M-17-10 20 0-7 1Z" fill="#d9efff"/>
    <path d="M-7 1 20 0-7 7Z" fill="#83b2dd"/>
    <path d="M-7 1-7 7-3 3" fill="#b9d8ed"/>
    <path d="m-17-10 10 11L20 0" fill="none" stroke="#f7fcff" strokeWidth=".9"/>
  </g>;
}

export default function PaperPlaneTransfer({ stage, reducedMotion, speed }: Props) {
  const id = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef({ speed, reducedMotion });
  const syncRef = useRef<(() => void) | null>(null);
  controlsRef.current = { speed, reducedMotion };
  const copy = STAGE_COPY[stage];
  const titleGradient = `${id}-title`;
  const paneGradient = `${id}-pane`;
  const folderGradient = `${id}-folder`;
  const processingSpeed = Number.isFinite(speed) && speed > 0 ? speed : 0;
  const speedLabel = processingSpeed > 0
    ? `处理速度 ×${processingSpeed.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
    : '等待处理';

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let intersecting = true;
    let rememberedPhase: number | null = null;
    const knownAnimations = new WeakSet<Animation>();

    const synchronize = () => {
      const animations = root.getAnimations({ subtree: true });
      const rate = transferPlaybackRate(controlsRef.current.speed);
      const paused = rate === 0 || controlsRef.current.reducedMotion || motionPreference.matches
        || document.hidden || !intersecting;
      // CSS supplies one shared cycle; changing playback rate preserves its current phase.
      const existing = animations.find(animation => knownAnimations.has(animation));
      if (existing && typeof existing.currentTime === 'number') rememberedPhase = existing.currentTime;
      for (const animation of animations) {
        if (!knownAnimations.has(animation)) {
          if (rememberedPhase !== null) animation.currentTime = rememberedPhase;
          knownAnimations.add(animation);
        }
        if (rate > 0) animation.updatePlaybackRate(rate);
        if (paused) animation.pause();
        else if (animation.playState !== 'running') animation.play();
      }
    };

    syncRef.current = synchronize;
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      synchronize();
    });
    visibilityObserver.observe(root);
    document.addEventListener('visibilitychange', synchronize);
    motionPreference.addEventListener('change', synchronize);
    synchronize();
    return () => {
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', synchronize);
      motionPreference.removeEventListener('change', synchronize);
      syncRef.current = null;
      root.getAnimations({ subtree: true }).forEach(animation => animation.pause());
    };
  }, []);

  useLayoutEffect(() => { syncRef.current?.(); }, [speed, reducedMotion]);

  const program = (side: 'source' | 'target', label: string) => <g className={`paper-transfer-program paper-transfer-program--${side}`}>
    <rect className="paper-transfer-receive-glow" x="-5" y="-4" width="76" height="48" rx="9" fill="#a9dd5f"/>
    <rect x="2" y="3" width="65" height="39" rx="3" fill="#7195b0" opacity=".22"/>
    <rect width="65" height="39" rx="3" fill={`url(#${paneGradient})`} stroke="#5384bc"/>
    <path d="M3 0h59a3 3 0 0 1 3 3v8H0V3a3 3 0 0 1 3-3Z" fill={`url(#${titleGradient})`}/>
    <path d="M3 1h59" stroke="#9fcbff" opacity=".8"/>
    <rect x="4" y="3" width="5" height="5" rx=".5" fill="#fbf2b8"/>
    <text x="12" y="8.1" fill="white" fontSize="6.4" fontWeight="700">{label}</text>
    <rect x="55" y="2.5" width="7" height="6.5" rx="1" fill="#79ace9" stroke="#c2def9" strokeWidth=".6"/>
    <path d="m57 4 3 3m0-3-3 3" stroke="#fff" strokeWidth=".7"/>
    <path d="M10 19v-4h12l4 4h25v15H10Z" fill="#d9a841" stroke="#b39032" strokeWidth=".7"/>
    <path d="M10 21h18l3-3h21l-3 16H8Z" fill={`url(#${folderGradient})`} stroke="#c19d40" strokeWidth=".7"/>
    <path d="M11 23h18l3-3h17" fill="none" stroke="#fff4b5"/>
    <rect x="20" y="12" width="12" height="13" rx=".5" fill="#fbfdff" stroke="#8cb0cd" strokeWidth=".6"/>
    <path d="M23 16h6m-6 3h6m-6 3h4" stroke="#a6c3da" strokeWidth=".8"/>
    <path d="M10 25h38l-1 9H8Z" fill={`url(#${folderGradient})`}/>
    <rect x="53" y="29" width="5" height="5" rx="1" fill="#76ba36" stroke="#539c2c" strokeWidth=".5"/>
    <path d="m54 31.5 1 1 2-2" stroke="#fff" fill="none" strokeWidth=".7"/>
  </g>;

  return <div ref={rootRef} className={`paper-transfer${reducedMotion ? ' paper-transfer--reduced' : ''}`} role="img" aria-label={`${copy.source}与${copy.target}之间的纸飞机文件传输动画，${speedLabel}`}>
    <svg viewBox="0 0 500 62" className="paper-transfer-svg" aria-hidden="true">
      <defs>
        <linearGradient id={titleGradient} x2="0" y2="1">
          <stop stopColor="#69a6ff"/><stop offset=".3" stopColor="#3678db"/><stop offset="1" stopColor="#1554b7"/>
        </linearGradient>
        <linearGradient id={paneGradient} x2="0" y2="1">
          <stop stopColor="#fff"/><stop offset="1" stopColor="#e2e9df"/>
        </linearGradient>
        <linearGradient id={folderGradient} x2="0" y2="1">
          <stop stopColor="#ffe9a0"/><stop offset=".3" stopColor="#f7d47b"/><stop offset="1" stopColor="#dfb552"/>
        </linearGradient>
      </defs>

      <path className="paper-transfer-route" d="M91 36Q250 2 409 36" fill="none" stroke="#c9d7db" strokeWidth="1" strokeDasharray="2 7"/>
      <path className="paper-transfer-route paper-transfer-route--back" d="M409 39Q250 61 91 39" fill="none" stroke="#d7e0d3" strokeWidth="1" strokeDasharray="2 8"/>
      <ellipse cx="250" cy="42" rx="126" ry="4" fill="#83aabd" opacity=".055"/>

      <g transform="translate(20 12)">{program('source', copy.source)}</g>
      <g transform="translate(415 12)">{program('target', copy.target)}</g>

      <g transform="translate(92 35)">
        <g className="paper-transfer-flight paper-transfer-flight--out">
          <g className="paper-transfer-trails"><path d="M-25 0h-17m13-4h-10m13 8h-16"/><circle cx="-47" cy="0" r="1"/></g>
          <Plane/>
        </g>
      </g>
      <g transform="translate(408 38)">
        <g className="paper-transfer-flight paper-transfer-flight--back">
          <g transform="scale(-1 1)"><g className="paper-transfer-trails"><path d="M-25 0h-17m13-4h-10m13 8h-16"/><circle cx="-47" cy="0" r="1"/></g><Plane/></g>
        </g>
      </g>
      <g transform="translate(97 35)"><g className="paper-transfer-loose-sheet paper-transfer-loose-sheet--out"><path d="M-3-4h6v8h-6Z" fill="white" stroke="#8fb2ca" strokeWidth=".6"/><path d="M-1-1h3m-3 2h3" stroke="#bad1df" strokeWidth=".7"/></g></g>
      <g transform="translate(403 38)"><g className="paper-transfer-loose-sheet paper-transfer-loose-sheet--back"><path d="M-3-4h6v8h-6Z" fill="white" stroke="#8fb2ca" strokeWidth=".6"/><path d="M-1-1h3m-3 2h3" stroke="#bad1df" strokeWidth=".7"/></g></g>

      <text className="paper-transfer-caption" x="250" y="57" textAnchor="middle">{copy.caption}<tspan className="paper-transfer-speed">　·　{speedLabel}</tspan></text>
    </svg>
  </div>;
}
