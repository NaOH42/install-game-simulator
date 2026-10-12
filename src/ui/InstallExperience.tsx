import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { GAME_MAP } from '../game/catalog';
import { jobRate } from '../game/engine';
import { getInstallPresentation } from '../game/presentation';
import type { InstallJob, SaveGame, Stage } from '../game/types';
import InstallerScene from '../render/AsyncInstallerScene';
import { getInstallIntensity } from '../render/installIntensity';
import { getAnticipationIntensity, type InstallAnticipationVariant } from '../render/installAnticipation';
import InstallAnticipationCanvas from './InstallAnticipationCanvas';
import InstallFileStream from './InstallFileStream';
import PaperPlaneTransfer from './PaperPlaneTransfer';
import { assetUrl } from './assetUrl';
import './installer-focus.css';
import './install-anticipation.css';

const STAGES: Record<Stage, string> = { download: '正在下载', unpack: '正在展开', write: '正在写入', verify: '马上就好' };

export default function InstallExperience({ state, job, active, reducedMotion, variant }: {
  state: SaveGame; job: InstallJob; active: boolean; reducedMotion: boolean; variant: InstallAnticipationVariant;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [dimensions, setDimensions] = useState({ width: 640, height: 470 });
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const changed = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  const game = GAME_MAP[job.gameId];
  const presentation = getInstallPresentation(game, job);
  const complete = job.progress >= 1;
  const currentIntensity = getInstallIntensity(job.progress);
  const currentAnticipation = getAnticipationIntensity(job.progress);
  const lastVisible = useRef({ intensity: currentIntensity, anticipation: currentAnticipation });
  if (active && pageVisible && !complete) lastVisible.current = { intensity: currentIntensity, anticipation: currentAnticipation };
  const intensity = !reducedMotion ? lastVisible.current.intensity : 0;
  const anticipation = !reducedMotion ? lastVisible.current.anticipation : 0;
  const shaking = variant === 'system-fault' ? anticipation * .6 : anticipation * .25;
  const rotation = variant === 'gravity-flip' ? 180 * Math.pow(anticipation, 1.65) : 0;
  const radians = rotation * Math.PI / 180;
  // A portrait frame and a wide desktop frame must both keep the rotating bar in view.
  const rotatedWidth = Math.abs(Math.cos(radians)) * dimensions.width + Math.abs(Math.sin(radians)) * dimensions.height;
  const rotatedHeight = Math.abs(Math.sin(radians)) * dimensions.width + Math.abs(Math.cos(radians)) * dimensions.height;
  const rotationFit = Math.min(1, dimensions.width / rotatedWidth, dimensions.height / rotatedHeight);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const camera = root.querySelector<HTMLElement>('.install-camera');
      const width = camera?.offsetWidth || root.clientWidth;
      const height = camera?.offsetHeight || root.clientHeight;
      if (width && height) setDimensions(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    measure();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const nodes = rootRef.current?.querySelectorAll<HTMLElement>('[data-anticipation-transform]');
    if (!nodes) return;
    // Capture the visible, interpolated matrices before the completion overlay measures
    // the bar. Its 300 ms hold must not keep rotating underneath the new shockwave.
    if ((!active || !pageVisible || complete) && !reducedMotion) {
      const frames = Array.from(nodes, node => {
        const computed = getComputedStyle(node);
        return { transform: computed.transform, filter: computed.filter, opacity: computed.opacity };
      });
      nodes.forEach((node, index) => Object.assign(node.style, frames[index]));
    } else nodes.forEach(node => {
      node.style.removeProperty('transform');
      node.style.removeProperty('filter');
      node.style.removeProperty('opacity');
    });
  }, [active, pageVisible, complete, reducedMotion]);

  const style = {
    '--install-intensity': intensity,
    '--install-scale': 1 + intensity * .07,
    '--install-shake': `${shaking * 2.6}px`,
    '--install-shake-time': `${430 - anticipation * 180}ms`,
    '--anticipation': anticipation,
    '--anticipation-rotation': `${rotation}deg`,
    '--anticipation-counter-rotation': `${-rotation}deg`,
    '--anticipation-fit': rotationFit,
    '--anticipation-blur': `${anticipation * 8}px`,
    '--anticipation-crt-squeeze': 1 - anticipation * .82,
    '--anticipation-fault-offset': `${anticipation * 7}px`,
    '--game-color': game.color,
    '--install-progress': `${presentation.displayProgress * 100}%`,
  } as CSSProperties;
  return <section ref={rootRef} data-install-game-id={game.id} data-anticipation={variant} data-anticipation-intensity={anticipation.toFixed(4)} className={`install-experience${pageVisible && active && !complete ? ' is-playing' : ''}${reducedMotion ? ' is-gentle' : ''}${complete ? ' is-complete' : ''}`} style={style} aria-label={`${game.title}${complete ? '安装完成' : '安装中'}`}>
    <div className="install-camera" data-anticipation-transform>
      <div className="install-camera-shake">
        <div className="install-art" data-anticipation-transform>
          <img src={assetUrl(game.cover)} alt="" style={{ objectPosition: game.focalPoint }}/>
          <div className="install-art-shade"/>
          {variant === 'system-fault' && <div className="install-fault-echoes" aria-hidden="true">
            {['cyan', 'rose', 'slice-high', 'slice-low'].map(layer => <img key={layer} className={`install-fault-${layer}`} src={assetUrl(game.cover)} alt="" style={{ objectPosition: game.focalPoint }}/>) }
          </div>}
          <InstallerScene genre={game.genre} color={game.color} progress={job.progress} active={active && pageVisible} reducedMotion={reducedMotion}/>
          <div className="install-game-name"><span>正在把快乐装进硬盘</span><h1>{game.title}</h1></div>
        </div>
        <div className="install-flight" data-anticipation-transform><PaperPlaneTransfer stage={job.stage} speed={jobRate(state, job)} reducedMotion={reducedMotion || !active || !pageVisible || complete}/></div>
        <div className="install-progress-focus">
          <div className="install-progress-copy"><span>{complete ? '安装完成' : job.progress >= .93 ? '就差最后一点…' : STAGES[job.stage]}</span><strong data-anticipation-transform>{Math.floor(presentation.displayProgress * 100)}<small>%</small></strong></div>
          <div className="install-main-track" role="progressbar" aria-label={`${game.title}安装进度`} aria-valuenow={Math.floor(presentation.displayProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="install-main-fill"/><i className="install-progress-tip" aria-hidden="true"/><i className="install-finish-line" aria-hidden="true"/>
          </div>
          <div className="install-end-glow" aria-hidden="true"/>
        </div>
        <div className="install-ambient-log" data-anticipation-transform aria-hidden="true"><InstallFileStream game={game} job={job} reducedMotion={reducedMotion || !active || !pageVisible || complete}/></div>
      </div>
    </div>
    <InstallAnticipationCanvas variant={variant} intensity={anticipation} active={active && pageVisible && !complete} reducedMotion={reducedMotion} progress={presentation.displayProgress} color={game.color}/>
    <div className="install-vignette" aria-hidden="true"/>
  </section>;
}
