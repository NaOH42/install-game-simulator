import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { getInstallFileFrame, type InstallFileEntry } from '../game/fileStream';
import { getInstallPresentation } from '../game/presentation';
import type { GameDefinition, InstallJob, Stage } from '../game/types';
import './install-file-stream.css';

type Props = { game: GameDefinition; job: InstallJob; reducedMotion: boolean };
const VISIBLE_DOM_LINES = 9;
const MAX_PENDING_LINES = 24;
const CADENCE: Record<Stage, number> = { download: 18, unpack: 24, write: 22, verify: 14 };
const STAGE_LABELS: Record<Stage, string> = { download: '接收文件', unpack: '展开资源', write: '写入磁盘', verify: '校验文件' };

export default function InstallFileStream({ game, job, reducedMotion }: Props) {
  const frame = getInstallFileFrame(game, job);
  const presentation = getInstallPresentation(game, job);
  const rootRef = useRef<HTMLDivElement>(null);
  const pending = useRef<InstallFileEntry[]>([]);
  const observed = useRef({ jobId: job.id, completed: frame.completedFiles });
  const config = useRef({ reducedMotion, stage: job.stage });
  config.current = { reducedMotion, stage: job.stage };
  const inViewport = useRef(true);
  const animation = useRef(0);
  const nextLineAt = useRef(0);
  const batchCount = useRef(0);
  const [display, setDisplay] = useState({ lines: frame.entries.slice(-VISIBLE_DOM_LINES), serial: 0, added: 0 });

  const animate = useCallback((now: number) => {
    animation.current = 0;
    if (document.hidden || !inViewport.current || config.current.reducedMotion || !pending.current.length) return;
    if (now >= nextLineAt.current) {
      // Paired records give short bursts; charging both slots preserves the average cadence.
      const batchSize = pending.current.length >= 3 && batchCount.current++ % 7 === 4 ? 2 : 1;
      const incoming = pending.current.splice(0, batchSize);
      setDisplay(previous => ({ lines: [...previous.lines, ...incoming].slice(-VISIBLE_DOM_LINES), serial: previous.serial + 1, added: incoming.length }));
      nextLineAt.current = now + 1000 / CADENCE[config.current.stage] * incoming.length;
    }
    if (pending.current.length) animation.current = requestAnimationFrame(animate);
  }, []);

  const schedule = useCallback(() => {
    if (!animation.current && pending.current.length && !document.hidden && inViewport.current && !config.current.reducedMotion) animation.current = requestAnimationFrame(animate);
  }, [animate]);

  useEffect(() => {
    if (observed.current.jobId !== job.id || frame.completedFiles < observed.current.completed) {
      pending.current = [];
      nextLineAt.current = 0;
      setDisplay(previous => ({ lines: frame.entries.slice(-VISIBLE_DOM_LINES), serial: previous.serial + 1, added: 0 }));
    } else if (reducedMotion) {
      pending.current = [];
      setDisplay(previous => ({ lines: frame.entries.slice(-VISIBLE_DOM_LINES), serial: previous.serial + 1, added: 0 }));
    } else {
      const incoming = frame.entries.filter(entry => entry.index > observed.current.completed);
      pending.current = [...pending.current, ...incoming].slice(-MAX_PENDING_LINES);
    }
    observed.current = { jobId: job.id, completed: frame.completedFiles };
    schedule();
  // Only completed work schedules new records. Elapsed time alone never feeds the queue.
  }, [job.id, frame.completedFiles, reducedMotion, schedule]);

  useEffect(() => {
    const wake = () => {
      if (document.hidden || !inViewport.current) { cancelAnimationFrame(animation.current); animation.current = 0; }
      else schedule();
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      inViewport.current = entries.some(entry => entry.isIntersecting);
      wake();
    });
    if (rootRef.current) observer?.observe(rootRef.current);
    document.addEventListener('visibilitychange', wake);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', wake); cancelAnimationFrame(animation.current); animation.current = 0; };
  }, [schedule]);

  const animationStyle = { '--stream-rise': `${display.added * 13}px` } as CSSProperties;
  return <div ref={rootRef} className={`install-file-stream${reducedMotion ? ' is-reduced' : ''}`} aria-label="安装文件日志">
    <div className="file-stream-heading"><span><i/>{STAGE_LABELS[job.stage]}</span><span>{frame.completedFiles.toLocaleString()} / {frame.totalFiles.toLocaleString()} 文件</span></div>
    <div className="file-stream-viewport" role="log" aria-live="off" aria-label="最近完成的文件路径">
      {!display.lines.length && <div className="file-stream-preparing">正在读取安装包目录…</div>}
      <div key={display.serial} className={`file-stream-lines${display.added ? ' has-new-lines' : ''}`} style={animationStyle}>
        {display.lines.map(entry => <div className="file-stream-line" key={entry.index} title={entry.path}><span className="file-stream-operation">{entry.operation}</span><span className="file-stream-path">{entry.path}</span><b>OK</b></div>)}
      </div>
    </div>
    <div className="file-stream-resource" title={presentation.fileName}><span>当前资源：{presentation.fileName.replaceAll('/', '\\')}</span><b>{Math.floor(presentation.fileProgress * 100)}%</b><i style={{ width: `${presentation.fileProgress * 100}%` }}/></div>
  </div>;
}
