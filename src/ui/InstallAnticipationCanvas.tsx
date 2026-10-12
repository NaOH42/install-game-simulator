import { useEffect, useLayoutEffect, useRef } from 'react';
import type { InstallAnticipationVariant } from '../render/installAnticipation';

type Props = {
  variant: InstallAnticipationVariant;
  intensity: number;
  active: boolean;
  reducedMotion: boolean;
  progress: number;
  color: string;
};
type Box = { x: number; y: number; width: number; height: number };
type Particle = { phase: number; angle: number; radius: number; size: number; speed: number; glyph: string };

const TAU = Math.PI * 2;
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const supported = (variant: InstallAnticipationVariant) => variant === 'pixel-tunnel' || variant === 'tip-gravity' || variant === 'crt-collapse';

function particles(): Particle[] {
  let seed = 0x715a203;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const glyphs = ['.dll', '0x', '>>', '.pak', '01', '/', '.bin', '[]'];
  return Array.from({ length: 68 }, (_, index) => ({
    phase: random(), angle: random() * TAU, radius: .55 + random() * .7,
    size: 1.3 + random() * 3, speed: .7 + random() * .6, glyph: glyphs[index % glyphs.length],
  }));
}

function padded(box: Box, padding: number): Box {
  return { x: box.x - padding, y: box.y - padding, width: box.width + padding * 2, height: box.height + padding * 2 };
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/** Only the current installer's already-loaded cover is sampled; this never fetches or clones the desktop. */
export default function InstallAnticipationCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef(props);
  const synchronize = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    current.current = props;
    synchronize.current?.();
  }, [props.variant, props.intensity, props.active, props.reducedMotion, props.progress, props.color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.closest<HTMLElement>('.install-experience');
    const context = canvas?.getContext('2d');
    if (!canvas || !parent || !context) return;
    const sample = document.createElement('canvas');
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    const field = particles();
    let palette: string[] = [];
    let sampleKey = '';
    let width = 1, height = 1, dpr = 1;
    let frame = 0, lastTick = 0, lastPaint = 0, motion = 0;
    let previousVariant = current.current.variant;
    let disposed = false;

    const localBox = (element: Element, canvasBounds: DOMRect): Box => {
      const bounds = element.getBoundingClientRect();
      const sx = width / Math.max(1, canvasBounds.width), sy = height / Math.max(1, canvasBounds.height);
      return { x: (bounds.left - canvasBounds.left) * sx, y: (bounds.top - canvasBounds.top) * sy, width: bounds.width * sx, height: bounds.height * sy };
    };

    const clipAway = (box: Box) => {
      context.beginPath();
      context.rect(0, 0, width, height);
      context.rect(box.x, box.y, box.width, box.height);
      context.clip('evenodd');
    };

    const sampleCover = (image: HTMLImageElement, box: Box, intensity: number) => {
      if (!sampleContext || !image.complete || !image.naturalWidth) return false;
      const cell = 5 + Math.round(Math.pow(intensity, 1.25) * 30);
      const columns = Math.max(2, Math.ceil(box.width / cell));
      const rows = Math.max(2, Math.ceil(box.height / cell));
      const key = `${image.currentSrc}|${columns}|${rows}`;
      if (key === sampleKey) return true;
      sampleKey = key;
      sample.width = columns;
      sample.height = rows;
      // Reproduce object-fit: cover and the existing card's focal point before downsampling.
      const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
      const sourceWidth = box.width / scale, sourceHeight = box.height / scale;
      const position = getComputedStyle(image).objectPosition.split(' ');
      const focal = (value: string | undefined) => value?.endsWith('%') ? clamp(parseFloat(value) / 100) : .5;
      const sourceX = (image.naturalWidth - sourceWidth) * focal(position[0]);
      const sourceY = (image.naturalHeight - sourceHeight) * focal(position[1]);
      sampleContext.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, columns, rows);
      // A small, cached palette makes peripheral blocks belong to the installed game's illustration.
      try {
        const data = sampleContext.getImageData(0, 0, columns, rows).data;
        palette = Array.from({ length: 24 }, (_, index) => {
          const offset = Math.floor(index * columns * rows / 24) * 4;
          return `rgb(${data[offset]} ${data[offset + 1]} ${data[offset + 2]})`;
        });
      } catch {
        palette = [current.current.color];
      }
      return true;
    };

    const drawPixelTunnel = (intensity: number, tip: { x: number; y: number }, clear: Box, canvasBounds: DOMRect) => {
      context.save();
      clipAway(padded(clear, 10));
      // Darkening is continuous, with a clear aperture around the real progress text and bar.
      const shade = context.createRadialGradient(tip.x, tip.y, 35, tip.x, tip.y, Math.max(width, height) * .9);
      shade.addColorStop(0, 'rgba(10,22,28,0)');
      shade.addColorStop(.4, `rgba(10,22,28,${intensity * .1})`);
      shade.addColorStop(1, `rgba(8,17,27,${intensity * .65})`);
      context.fillStyle = shade;
      context.fillRect(0, 0, width, height);
      const cover = parent.querySelector<HTMLImageElement>('.install-art > img');
      if (cover) {
        const box = localBox(cover, canvasBounds);
        if (box.width > 0 && box.height > 0 && sampleCover(cover, box, intensity)) {
          context.imageSmoothingEnabled = false;
          context.globalAlpha = intensity * .86;
          context.drawImage(sample, box.x, box.y, box.width, box.height);
          context.globalAlpha = 1;
          const artShade = context.createLinearGradient(box.x, 0, box.x + box.width, 0);
          artShade.addColorStop(0, `rgba(8,22,31,${intensity * .75})`);
          artShade.addColorStop(.7, `rgba(8,22,31,${intensity * .1})`);
          context.fillStyle = artShade;
          context.fillRect(box.x, box.y, box.width, box.height);
        }
      }
      field.slice(0, 56).forEach((particle, index) => {
        const life = (particle.phase + motion * particle.speed * .19) % 1;
        const travel = life * life;
        const sourceX = (index % 2 ? -1 : 1) * width * particle.radius + width * .5;
        const sourceY = height * (index % 3 === 0 ? -.15 : index % 3 === 1 ? .55 : 1.15);
        const x = sourceX + (tip.x - sourceX) * travel;
        const y = sourceY + (tip.y - sourceY) * travel;
        const size = (10 + particle.size * 5) * (.45 + intensity * .8) * (1 - life * .55);
        context.globalAlpha = Math.sin(life * Math.PI) * intensity * (.23 + intensity * .37);
        context.fillStyle = palette[index % Math.max(1, palette.length)] ?? current.current.color;
        context.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, size, size * (.6 + particle.phase));
        context.globalAlpha *= .35;
        context.fillStyle = '#edfff6';
        context.fillRect(x, y, size, 1);
      });
      context.restore();
    };

    const drawGravity = (intensity: number, tip: { x: number; y: number }, copy: Box, track: Box) => {
      // Let the surroundings fall into shadow while the actual progress display stays untouched.
      context.save();
      clipAway(padded(union(copy, track), 9));
      const shade = context.createRadialGradient(tip.x, tip.y, 8, tip.x, tip.y, Math.max(width, height) * .9);
      shade.addColorStop(0, `rgba(4,17,24,${intensity * .16})`);
      shade.addColorStop(.15, `rgba(4,17,24,${intensity * .55})`);
      shade.addColorStop(.5, `rgba(4,17,24,${intensity * .77})`);
      shade.addColorStop(1, `rgba(2,10,18,${intensity * .88})`);
      context.fillStyle = shade;
      context.fillRect(0, 0, width, height);
      context.restore();
      context.save();
      clipAway(padded(copy, 7));
      const reach = Math.max(width, height) * .68;
      const orbit = (particle: Particle, life: number) => {
        const radius = reach * particle.radius * Math.pow(1 - life, 1.6);
        const angle = particle.angle + life * (3.2 + intensity * 3.8);
        return { x: tip.x + Math.cos(angle) * radius, y: tip.y + Math.sin(angle) * radius * .56 };
      };
      field.forEach((particle, index) => {
        const life = (particle.phase + motion * particle.speed * .3) % 1;
        const point = orbit(particle, life);
        const trailLength = .025 + intensity * .065;
        const alpha = Math.pow(Math.sin(Math.PI * life), .65) * intensity;
        context.globalAlpha = alpha * .82;
        context.strokeStyle = index % 3 === 0 ? current.current.color : '#baffdf';
        context.lineWidth = .85 + intensity * 1.1;
        context.beginPath();
        for (let segment = 0; segment <= 5; segment++) {
          const trail = orbit(particle, Math.max(0, life - trailLength * (1 - segment / 5)));
          if (segment === 0) context.moveTo(trail.x, trail.y);
          else context.lineTo(trail.x, trail.y);
        }
        context.stroke();
        context.globalAlpha = alpha;
        context.fillStyle = index % 4 === 0 ? current.current.color : '#d7ffec';
        if (index % 5 === 0 && life < .87) {
          context.save();
          context.translate(point.x, point.y);
          context.rotate(particle.angle + life * 3);
          context.font = `600 ${9 + intensity * 3}px Consolas, monospace`;
          context.fillText(particle.glyph, 0, 0);
          context.restore();
        } else {
          const size = particle.size * (.7 + intensity * .7) * (1 - life * .3);
          context.fillRect(point.x, point.y, size, size);
        }
      });
      const breath = 1 + Math.sin(motion * 2.5) * .045;
      const radius = (23 + intensity * 67) * breath;
      const glow = context.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, radius);
      glow.addColorStop(0, `rgba(237,255,226,${.2 + intensity * .7})`);
      glow.addColorStop(.1, `rgba(190,255,185,${intensity * .74})`);
      glow.addColorStop(.4, `rgba(124,235,181,${intensity * .28})`);
      glow.addColorStop(1, 'rgba(119,200,138,0)');
      context.globalAlpha = intensity;
      context.fillStyle = glow;
      context.fillRect(tip.x - radius, tip.y - radius, radius * 2, radius * 2);
      context.strokeStyle = '#beffdb';
      context.lineWidth = 1.1;
      for (let index = 0; index < 3; index++) {
        context.globalAlpha = intensity * (.4 + index * .08);
        context.beginPath();
        context.ellipse(tip.x, tip.y, (20 + index * 16) * breath, 6 + index * 7, motion * .45 + index * 1.1, .1, TAU - .5);
        context.stroke();
      }
      context.globalAlpha = intensity * .8;
      context.fillStyle = '#f4ffd9';
      context.fillRect(tip.x - 1, tip.y - 4 - intensity * 4, 2, 8 + intensity * 8);
      context.fillRect(tip.x - 4 - intensity * 3, tip.y - .5, 8 + intensity * 6, 1);
      context.restore();
    };

    const drawTubeCompression = (intensity: number, clear: Box) => {
      context.save();
      clipAway(padded(clear, 10));
      const pressure = Math.pow(intensity, 1.4);
      const top = Math.max(0, clear.y - 14) * pressure;
      const bottom = height - Math.max(0, height - clear.y - clear.height - 14) * pressure;
      const bow = 18 * pressure;
      context.globalAlpha = intensity * .94;
      context.fillStyle = '#051018';
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(width, 0);
      context.lineTo(width, top + bow);
      context.quadraticCurveTo(width / 2, top - bow, 0, top + bow);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(0, height);
      context.lineTo(width, height);
      context.lineTo(width, bottom - bow);
      context.quadraticCurveTo(width / 2, bottom + bow, 0, bottom - bow);
      context.closePath();
      context.fill();
      const sides = context.createLinearGradient(0, 0, width, 0);
      sides.addColorStop(0, `rgba(0,5,12,${intensity * .85})`);
      sides.addColorStop(.13, 'rgba(0,5,12,0)');
      sides.addColorStop(.87, 'rgba(0,5,12,0)');
      sides.addColorStop(1, `rgba(0,5,12,${intensity * .85})`);
      context.fillStyle = sides;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = current.current.color;
      context.globalAlpha = intensity * .24;
      context.lineWidth = 1.3;
      context.beginPath();
      context.moveTo(0, top + bow);
      context.quadraticCurveTo(width / 2, top - bow, width, top + bow);
      context.moveTo(0, bottom - bow);
      context.quadraticCurveTo(width / 2, bottom + bow, width, bottom - bow);
      context.stroke();
      context.restore();
    };

    const paint = () => {
      const state = current.current;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      if (!supported(state.variant) || state.reducedMotion || state.intensity <= 0 || (!state.active && state.progress < 1)) return;
      const canvasBounds = canvas.getBoundingClientRect();
      const track = parent.querySelector('.install-main-track');
      const tipElement = parent.querySelector('.install-progress-tip');
      const copy = parent.querySelector('.install-progress-copy');
      if (!track || !tipElement || !copy || !canvasBounds.width || !canvasBounds.height) return;
      const trackBox = localBox(track, canvasBounds), copyBox = localBox(copy, canvasBounds);
      // This marker already carries the camera's transform and the animated fill position.
      const marker = localBox(tipElement, canvasBounds);
      const tip = { x: clamp(marker.x + marker.width / 2, 5, width - 5), y: clamp(marker.y + marker.height / 2, 5, height - 5) };
      const intensity = clamp(state.intensity);
      if (state.variant === 'pixel-tunnel') drawPixelTunnel(intensity, tip, union(trackBox, copyBox), canvasBounds);
      if (state.variant === 'tip-gravity') drawGravity(intensity, tip, copyBox, trackBox);
      if (state.variant === 'crt-collapse') drawTubeCompression(intensity, union(trackBox, copyBox));
    };

    const running = () => {
      const state = current.current;
      return !disposed && !document.hidden && state.active && !state.reducedMotion && state.intensity > 0 && state.progress < 1 && supported(state.variant);
    };
    const tick = (now: number) => {
      frame = 0;
      if (!running()) return;
      const delta = Math.min(.1, Math.max(0, (now - lastTick) / 1000));
      lastTick = now;
      motion += delta * (.32 + Math.pow(clamp(current.current.intensity), 1.35) * 1.7);
      if (now - lastPaint >= 1000 / 30) {
        lastPaint = now;
        paint();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (disposed) return;
      if (previousVariant !== current.current.variant) {
        previousVariant = current.current.variant;
        motion = 0;
      }
      if (!running() && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      // A hidden tab keeps the last rendered frame. Completion paints once at full intensity.
      if (!document.hidden) paint();
      if (running() && !frame) {
        lastTick = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const resize = () => {
      width = Math.max(1, parent.clientWidth);
      height = Math.max(1, parent.clientHeight);
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      sampleKey = '';
      sync();
    };
    synchronize.current = sync;
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('resize', resize);
      synchronize.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="install-anticipation-canvas" aria-hidden="true"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}/>;
}
