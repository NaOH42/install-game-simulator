import type { CSSProperties } from 'react';
import './system-pressure-effects.css';

export interface PressureEffectsProps {
  cpu: number;
  ram: number;
  gpu: number;
  network: number;
  reducedMotion: boolean;
}

export default SystemPressureEffects;

/** All faults are presentation only: nothing blocks the clock or pointer input. */
export function SystemPressureEffects({ cpu, ram, gpu, network, reducedMotion }: PressureEffectsProps) {
  const cpuBusy = cpu >= .88;
  const paging = ram > 1;
  const graphics = gpu > 1;
  const congested = network > 1;
  if (!cpuBusy && !paging && !graphics && !congested) return null;
  const severity = Math.min(1, Math.max(0, gpu - .8));
  return <div className={`system-pressure-effects ${reducedMotion ? 'pressure-motion-reduced' : ''}`} aria-hidden="true">
    {graphics && <div className="legacy-display-faults" style={{ '--fault-opacity': .12 + severity * .15 } as CSSProperties}>
      <i className="fault-band fault-band-one"/><i className="fault-band fault-band-two"/>
      <div className="video-memory-tiles">{Array.from({length: 9}, (_, index) => <b key={index} style={{ '--tile': index } as CSSProperties}/>)}</div>
    </div>}
    <div className="system-pressure-signals">
      {cpuBusy && <span className="cpu-pressure-signal"><i>⌛</i> CPU 正忙</span>}
      {paging && <span className="ram-pressure-signal"><i/> 内存换页中…</span>}
      {graphics && <span>显存吃紧</span>}
      {congested && <span className="network-pressure-signal"><i/> 网络拥塞</span>}
    </div>
  </div>;
}
