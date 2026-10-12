import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { getCelebrationPhase, getPixelCelebration, type PixelCelebrationDefinition } from './pixelCelebrationData';
import { getTransitionGeometry, TRANSITION_REVEAL_MS, REDUCED_TRANSITION_REVEAL_MS, type CompletionOrigin } from './completionTransitionTiming';
import '../ui/pixel-celebration.css';

type Props = { gameId: string; reducedMotion: boolean; onFinish: () => void; revealOrigin?: CompletionOrigin | null; startedAt?: number; interactive?: boolean; restoreFocus?: boolean };
type Ctx = CanvasRenderingContext2D;
const WHITE = '#f1fff4';
const INK = '#101a2a';
const SKIN = '#eebd92';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const fract = (value: number) => value - Math.floor(value);
const noise = (seed: number) => fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453);

function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
  for (let i = 0; i <= steps; i++) rect(c, x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, thickness, thickness, color);
}
function ring(c: Ctx, x: number, y: number, radius: number, color: string, squash = 1, size = 2, offset = 0) {
  const count = Math.max(18, Math.floor(radius * 1.9));
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2 + offset;
    rect(c, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * squash, size, size, color);
  }
}
function sword(c: Ctx, x: number, y: number, angle: number, color: string, size = 1) {
  c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(angle); c.scale(size, size);
  rect(c, -2, -28, 4, 24, color); rect(c, -1, -31, 2, 5, WHITE);
  rect(c, -1, -25, 1, 21, WHITE); rect(c, -7, -5, 14, 3, '#efc579');
  rect(c, -2, -2, 4, 8, '#334962'); rect(c, -3, 5, 6, 2, '#efc579'); c.restore();
}
function hero(c: Ctx, x: number, y: number, scene: PixelCelebrationDefinition, raised: number, wizard = false) {
  c.save(); c.translate(Math.round(x), Math.round(y));
  // Face, flowing hair, layered tunic and a moving, raised right arm.
  rect(c, -10, -78, 22, 7, INK); rect(c, -13, -73, 27, 17, INK);
  rect(c, -10, -55, 7, 26, INK); rect(c, 9, -67, 8, 37, INK);
  rect(c, -7, -70, 17, 17, SKIN); rect(c, 3, -64, 3, 2, INK);
  rect(c, -10, -72, 18, 4, INK); rect(c, -12, -54, 28, 34, scene.primary);
  rect(c, -7, -51, 17, 29, wizard ? scene.primary : WHITE);
  rect(c, -13, -24, 30, 7, scene.accent);
  rect(c, -15, -17, 34, 12, wizard ? scene.primary : WHITE);
  rect(c, -18, -7, 37, 6, scene.primary);
  rect(c, -12, -1, 11, 8, INK); rect(c, 7, -1, 14, 8, INK);
  rect(c, -23, -51, 12, 21, scene.primary); rect(c, -21, -32, 9, 7, SKIN);
  const armY = -50 - raised * 23;
  line(c, 13, -48, 26, armY, WHITE, 8); rect(c, 25, armY - 4, 8, 8, SKIN);
  if (wizard) {
    rect(c, -12, -80, 27, 5, scene.accent); rect(c, -7, -91, 16, 11, scene.primary);
    rect(c, -3, -101, 8, 11, scene.primary); rect(c, -29, -73, 3, 73, '#c49a6b');
    rect(c, -34, -83, 13, 12, scene.accent); rect(c, -30, -81, 5, 5, WHITE);
  } else {
    rect(c, -11, -74, 23, 3, scene.primary);
    line(c, -9, -71, -34 - raised * 7, -61, scene.primary, 3);
  }
  c.restore();
}
function terrain(c: Ctx, scene: PixelCelebrationDefinition, time: number, still: boolean) {
  const swords = scene.mechanism === 'swords';
  for (let i = 0; i < 15; i++) {
    const x = -176 + i * 26;
    const h = 9 + noise(i + scene.variant * 11) * 45;
    rect(c, x, 56 - h, 25, h, '#162f3c');
    if (swords) {
      rect(c, x + 6, 49 - h, 13, 8, '#24434a');
      rect(c, x + 10, 43 - h, 5, 7, '#24434a');
    }
  }
  rect(c, -178, 62, 356, 3, scene.primary);
  rect(c, -178, 65, 356, 31, scene.backdrop);
  for (let i = 0; i < 14; i++) {
    const x = -160 + i * 24;
    rect(c, x, 72 + (i % 3) * 5, 8 + (i % 4) * 7, 1, '#30424c');
  }
  c.globalAlpha = .35;
  for (let i = 0; i < 20; i++) {
    const phase = still ? .4 : time * .12;
    rect(c, -155 + noise(i * 7) * 310, 56 - fract(noise(i * 9) + phase) * 160, i % 3 ? 1 : 2, 2, scene.accent);
  }
  c.globalAlpha = 1;
}

function swordsScene(c: Ctx, s: PixelCelebrationDefinition, t: number) {
  const charge = smooth(t / 1.12);
  const release = clamp((t - 1.12) / 2.05);
  const hand = t < 3.6 ? charge : 1 - smooth((t - 3.6) / .7) * .45;
  c.globalAlpha = .35;
  ring(c, 0, 65, 76 + charge * 20, s.primary, .25, 2, t);
  ring(c, 0, 65, 58 + charge * 14, s.accent, .25, 1, -t);
  c.globalAlpha = 1;
  const halo = 14 + s.variant;
  for (let i = 0; i < halo; i++) {
    const a = i / halo * Math.PI * 2 - Math.PI / 2 + Math.min(t, 1.2) * .35;
    const radius = 44 + charge * 48 + release * 21;
    const visibility = t < 3.1 ? 1 : 1 - clamp((t - 3.1) / .6);
    c.globalAlpha = visibility;
    sword(c, Math.cos(a) * radius, -9 + Math.sin(a) * radius * .76, a + Math.PI / 2, s.primary, .62 + charge * .16);
  }
  c.globalAlpha = 1;
  if (t > 1.23 && t < 3.75) {
    for (let i = 0; i < 31; i++) {
      const p = fract((t - 1.23) * .84 + i * .173);
      const x = -148 + noise(i + s.variant * 18) * 296 + p * 25;
      const y = -166 + p * 245;
      c.globalAlpha = Math.min(1, p * 5) * (1 - smooth((t - 3.1) / .65));
      line(c, x - 8, y - 46, x, y - 12, s.primary, 1);
      sword(c, x, y, Math.PI - .25, s.accent, .65 + noise(i * 3) * .45);
    }
    c.globalAlpha = 1;
  }
  if (t > 2.45) {
    const hit = clamp((t - 2.45) / 1.2);
    c.globalAlpha = (1 - hit) * .9;
    ring(c, 0, 58, 14 + hit * 151, s.accent, .36, 3);
    ring(c, 0, 58, 7 + hit * 117, s.primary, .36, 2);
    c.globalAlpha = 1;
  }
  hero(c, 0, 53, s, hand);
  if (t > 1.1 && t < 2.1) sword(c, 32, -58, -.12, WHITE, 1.3);
}

function cat(c: Ctx, x: number, y: number, s: PixelCelebrationDefinition, leap: boolean) {
  c.save(); c.translate(Math.round(x), Math.round(y));
  rect(c, -15, -42, 30, 20, s.primary); rect(c, -18, -33, 36, 11, s.primary);
  rect(c, -13, -51, 9, 13, s.primary); rect(c, 7, -51, 9, 13, s.primary);
  rect(c, -10, -36, 21, 17, '#c79b74'); rect(c, -5, -32, 4, 3, '#94e0a8'); rect(c, 6, -32, 4, 3, '#94e0a8');
  rect(c, 0, -24, 4, 3, INK); rect(c, -13, -19, 28, 30, s.primary);
  rect(c, -14, -3, 31, 5, '#963e3f'); rect(c, -12, 11, 11, 8, '#796b65'); rect(c, 5, 11, 12, 8, '#796b65');
  line(c, -12, -12, leap ? -33 : -18, leap ? -26 : 4, s.primary, 7);
  line(c, 13, -12, leap ? 34 : 20, leap ? -26 : 4, s.primary, 7);
  line(c, 14, 5, 30, -3, '#bd956f', 4); c.restore();
}
function assassinScene(c: Ctx, s: PixelCelebrationDefinition, t: number) {
  rect(c, -118, 5, 64, 60, '#4f6680'); rect(c, -124, 0, 76, 8, '#aac3d0');
  for (let i = 0; i < 4; i++) rect(c, -110 + i * 14, 14, 7, 13, '#273e54');
  for (let row = 0; row < 6; row++) rect(c, 46 - row * 3, 61 - row * 5, 77 + row * 6, 5, row % 2 ? '#a98449' : s.accent);
  const p = smooth((t - 1.0) / 1.75);
  const x = -83 + p * 170;
  const y = -9 + p * 43 - Math.sin(p * Math.PI) * 99;
  if (p < .98) cat(c, x, y, s, p > .03);
  if (t > 2.55) {
    const impact = clamp((t - 2.55) / .9);
    for (let i = 0; i < 24; i++) {
      const vx = (noise(i) - .5) * 128;
      const vy = noise(i + 10) * -74;
      c.globalAlpha = 1 - impact;
      rect(c, 84 + vx * impact, 47 + vy * impact + impact * impact * 48, 4, 2, s.accent);
    }
    c.globalAlpha = 1;
    if (t > 3.05) { rect(c, 72, 29, 9, 12, s.primary); rect(c, 87, 29, 9, 12, s.primary); rect(c, 73, 39, 23, 9, s.primary); }
  }
  const eagleX = -160 + t * 59;
  line(c, eagleX - 12, -98, eagleX, -91, WHITE, 2); line(c, eagleX, -91, eagleX + 12, -99, WHITE, 2);
}

function driftScene(c: Ctx, s: PixelCelebrationDefinition, t: number) {
  rect(c, -171, -15, 342, 76, '#253045');
  for (let i = 0; i < 12; i++) rect(c, -165 + i * 30 - (t * 40 % 30), 20, 17, 2, '#b5bdb5');
  for (let i = 0; i < 10; i++) rect(c, 121 + (i % 2) * 8, -13 + Math.floor(i / 2) * 15, 8, 15, i % 2 === Math.floor(i / 2) % 2 ? WHITE : INK);
  const p = smooth((t - .75) / 2.3);
  const x = -105 + p * 197;
  const y = 25 - Math.sin(p * Math.PI) * 25;
  for (let i = 0; i < 36; i++) {
    const q = Math.max(0, p - i / 120);
    rect(c, -105 + q * 197 - 18, 17 - Math.sin(q * Math.PI) * 25, 3, 3, '#111d2b');
    rect(c, -105 + q * 197 - 18, 38 - Math.sin(q * Math.PI) * 25, 3, 3, '#111d2b');
  }
  for (let i = 0; i < 12; i++) {
    const phase = fract(t * 1.8 + i * .131);
    c.globalAlpha = (1 - phase) * .5 * Math.sin(p * Math.PI);
    rect(c, x - 30 - phase * 69, y + (noise(i) - .5) * 31, 9 + phase * 13, 8 + phase * 9, '#dbe3da');
  }
  c.globalAlpha = 1;
  c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(-Math.sin(p * Math.PI) * .45);
  rect(c, -29, -14, 51, 30, INK); rect(c, -30, -9, 62, 21, s.primary);
  rect(c, -14, -13, 34, 26, s.primary); rect(c, -4, -10, 17, 21, '#a5dae7');
  rect(c, -1, -7, 10, 15, '#4b7189'); rect(c, -25, -17, 13, 6, INK); rect(c, -25, 12, 13, 6, INK);
  rect(c, 13, -17, 13, 6, INK); rect(c, 13, 12, 13, 6, INK);
  rect(c, 29, -8, 5, 5, WHITE); rect(c, 29, 5, 5, 5, WHITE);
  if (t > 1.1 && t < 3.0) { rect(c, -45, -4, 15, 10, s.accent); rect(c, -54, -1, 12, 4, WHITE); }
  c.restore();
  if (s.variant === 3) for (let i = 0; i < 42; i++) line(c, -170 + noise(i) * 340, -105 + fract(t * 1.3 + noise(i * 3)) * 160, -166 + noise(i) * 340, -90 + fract(t * 1.3 + noise(i * 3)) * 160, '#7396b2');
}

function tank(c: Ctx, x: number, y: number, s: PixelCelebrationDefinition, size: number, recoil: number) {
  c.save(); c.translate(x, y); c.scale(size, size);
  rect(c, -29, -2, 59, 17, INK); rect(c, -25, 0, 51, 11, '#5c6871');
  for (let i = 0; i < 5; i++) rect(c, -22 + i * 10, 1, 7, 9, '#222c39');
  rect(c, -25, -13, 51, 17, s.primary); rect(c, -13, -26, 28, 16, s.primary);
  rect(c, -5, -31, 12, 6, '#d0ddb4'); rect(c, 7 - recoil, -25, 38, 6, s.primary);
  rect(c, 39 - recoil, -26, 7, 8, '#3f5446'); rect(c, -17, -11, 11, 3, s.accent); c.restore();
}
function artilleryScene(c: Ctx, s: PixelCelebrationDefinition, t: number) {
  tank(c, -89, 32, s, .62, 0); tank(c, 36, 48, s, .73, 0);
  const fire = t > 1.1 && t < 3.25;
  const beat = fract((t - 1.1) * 2.0);
  tank(c, -26, 29, s, 1.55, fire && beat < .18 ? 4 : 0);
  if (fire) {
    const muzzleX = 45;
    if (beat < .26) { rect(c, muzzleX, -16, 17, 10, s.accent); rect(c, muzzleX + 13, -12, 18, 3, WHITE); rect(c, muzzleX + 6, -23, 6, 22, s.accent); }
    for (let i = 0; i < 3; i++) {
      const q = fract(beat + i / 3);
      rect(c, 44 + q * 112, -9 - i * 14, 11, 3, s.accent);
      line(c, 37 + q * 112, -8 - i * 14, 44 + q * 112, -8 - i * 14, WHITE);
    }
  }
  if (t > 1.6) {
    const q = t < 3.25 ? fract((t - 1.6) * 1.8) : clamp((t - 3.25) / .9);
    c.globalAlpha = 1 - q;
    for (let i = 0; i < 14; i++) {
      const a = i * 2.399;
      rect(c, 111 + Math.cos(a) * q * 44, -3 + Math.sin(a) * q * 41, 9 - q * 5, 9 - q * 5, i % 3 ? s.accent : WHITE);
    }
    c.globalAlpha = 1;
  }
}

function spellScene(c: Ctx, s: PixelCelebrationDefinition, t: number) {
  const p = smooth(t / 1.2);
  const burst = clamp((t - 1.25) / 2.0);
  hero(c, -6, 54, s, p, s.variant !== 6 && s.variant !== 5);
  if (s.variant === 6) {
    for (let i = 0; i < 4; i++) {
      const q = clamp((t - 1.15 - i * .22) / 1.3);
      if (q <= 0 || q >= 1) continue;
      c.globalAlpha = 1 - q;
      ring(c, 14 + q * 151, -7, 12 + q * 61, s.accent, 1.4, 4);
    }
  } else {
    c.globalAlpha = .55;
    ring(c, 0, -35, 35 + p * 19, s.primary, 1, 2, t);
    ring(c, 0, -35, 44 + p * 27, s.accent, 1, 1, -t);
    c.globalAlpha = 1;
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + t * .65;
      const radius = 42 + p * 19 + burst * 28;
      const x = Math.cos(a) * radius, y = -35 + Math.sin(a) * radius;
      rect(c, x - 3, y - 5, 6, 10, s.primary); rect(c, x - 5, y - 2, 10, 4, s.accent);
    }
    if (t > 1.25) {
      c.globalAlpha = (1 - burst) * .75;
      ring(c, 0, -28, 14 + burst * 140, s.primary, .8, 4);
      ring(c, 0, -28, 8 + burst * 110, s.accent, .8, 2);
    }
    if (s.variant === 3 && t > 1.4 && t < 3.2) {
      c.globalAlpha = .7;
      for (let i = 0; i < 4; i++) {
        const x = -100 + i * 64;
        line(c, x, -132, x + 12, -95, WHITE, 2); line(c, x + 12, -95, x - 6, -81, WHITE, 2); line(c, x - 6, -81, x + 16, 47, s.accent, 3);
      }
    }
  }
  c.globalAlpha = 1;
  if (s.variant === 2) {
    rect(c, 22, -73, 21, 23, WHITE); rect(c, 42, -69, 9, 14, s.accent); rect(c, 24, -73, 17, 4, '#8f624b');
    for (let i = 0; i < 3; i++) rect(c, 26 + i * 6, -82 - Math.sin(t * 2 + i) * 6, 3, 6, s.primary);
  }
}

function bonfireScene(c: Ctx, s: PixelCelebrationDefinition, t: number) {
  const warmth = smooth((t - .7) / 1.8);
  c.globalAlpha = warmth * .15;
  for (let r = 100; r > 12; r -= 8) ring(c, 18, 42, r, s.accent, .65, 9);
  c.globalAlpha = 1;
  rect(c, -48, -5, 21, 22, '#65717d'); rect(c, -52, 16, 30, 27, '#586774');
  rect(c, -52, 39, 43, 12, '#3c4c5a'); rect(c, -55, -10, 34, 9, '#859299');
  rect(c, -44, 0, 12, 3, s.accent); line(c, -25, 19, -8, 30, '#71818a', 7);
  for (let i = 0; i < 6; i++) rect(c, -2 + i * 7, 52 + (i % 2) * 4, 9, 7, '#586071');
  sword(c, 20, 26, Math.PI + .12, '#a6b8c9', 1.05);
  for (let i = 0; i < 8; i++) {
    const x = 3 + i * 4;
    const h = warmth * (19 + Math.sin(t * 6 + i * 1.9) * 10 + (i > 1 && i < 6 ? 18 : 0));
    rect(c, x, 53 - h, 6, h, i % 2 ? '#e67139' : s.primary);
    rect(c, x + 1, 54 - h * .5, 3, h * .5, s.accent);
  }
  for (let i = 0; i < 22; i++) {
    const q = fract(t * .43 + noise(i));
    c.globalAlpha = warmth * (1 - q);
    rect(c, 20 + Math.sin(i + q * 4) * (8 + q * 52), 37 - q * 116, 2, 3, s.accent);
  }
  c.globalAlpha = 1;
}

function ship(c: Ctx, x: number, y: number, s: PixelCelebrationDefinition, scale: number, thrust: number) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  rect(c, -8, -37, 16, 61, s.primary); rect(c, -4, -45, 8, 12, s.accent);
  rect(c, -15, -15, 30, 35, s.primary); rect(c, -30, 4, 60, 19, s.primary);
  rect(c, -36, 17, 12, 11, s.accent); rect(c, 24, 17, 12, 11, s.accent);
  rect(c, -5, -21, 10, 18, '#142f4c'); rect(c, -3, -20, 5, 12, WHITE);
  rect(c, -12, 21, 8, 9 + thrust * 33, s.accent); rect(c, 5, 21, 8, 9 + thrust * 33, s.accent);
  rect(c, -9, 24, 3, 6 + thrust * 27, WHITE); rect(c, 7, 24, 3, 6 + thrust * 27, WHITE); c.restore();
}
function starshipScene(c: Ctx, s: PixelCelebrationDefinition, t: number) {
  const jump = smooth((t - 1.25) / 1.8);
  c.globalAlpha = .8;
  for (let i = 0; i < 46; i++) {
    const a = noise(i) * Math.PI * 2;
    const distance = 25 + fract(noise(i + 22) + t * (.08 + jump * .6)) * 177;
    const length = 1 + jump * 29;
    line(c, Math.cos(a) * distance, -20 + Math.sin(a) * distance, Math.cos(a) * (distance + length), -20 + Math.sin(a) * (distance + length), i % 4 ? s.primary : WHITE);
  }
  c.globalAlpha = 1;
  ring(c, 0, -18, 76 + jump * 49, s.accent, .68, 2);
  ship(c, -81, 28 - jump * 45, s, .55, jump); ship(c, 83, 28 - jump * 45, s, .55, jump);
  ship(c, 0, 10 - jump * 26, s, 1.18 - jump * .15, clamp(t / 1.4));
  if (s.variant === 1) for (let i = 0; i < 6; i++) rect(c, -117 + i * 45, 52 + Math.sin(i + t) * 10, 8, 7, '#a7a092');
}

function civilizationScene(c: Ctx, s: PixelCelebrationDefinition, t: number) {
  const growth = smooth((t - .55) / 2.3);
  for (let row = 0; row < 5; row++) rect(c, -118 + row * 15, 51 + row * 5, 236 - row * 30, 6, row % 2 ? '#537662' : '#476752');
  for (let i = 0; i < 7; i++) {
    const p = smooth((growth - i * .06) / .6);
    const x = -110 + i * 31;
    const height = (24 + noise(i + s.variant * 9) * 31) * p;
    rect(c, x, 50 - height, 25, height, i % 2 ? '#829a8d' : '#697f7d');
    for (let win = 0; win < 3; win++) if (height > 14 + win * 11) rect(c, x + 6, 43 - height + win * 11, 4, 5, s.accent);
  }
  const top = 48 - growth * 122;
  rect(c, -43, top + 20, 86, 7, s.accent); rect(c, -49, 49, 98, 8, s.primary);
  for (let i = 0; i < 5; i++) rect(c, -39 + i * 17, top + 27, 10, Math.max(2, 23 - top), s.primary);
  for (let i = 0; i < 5; i++) rect(c, -45 + i * 9, top + 16 - i * 5, 90 - i * 18, 5, s.accent);
  rect(c, -5, top + 33, 10, 14, '#f8f0bd');
  if (t > 2.45) {
    const sun = smooth((t - 2.45) / .85);
    c.globalAlpha = sun;
    ring(c, 0, top - 17, 10, s.accent, 1, 3);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; line(c, Math.cos(a) * 18, top - 17 + Math.sin(a) * 18, Math.cos(a) * 28, top - 17 + Math.sin(a) * 28, s.accent, 2); }
    c.globalAlpha = 1;
  }
}

/** Low-resolution frame renderer; exported to make visual inspection deterministic without changing saves. */
export function drawPixelCelebrationFrame(c: Ctx, width: number, height: number, scene: PixelCelebrationDefinition, elapsedMs: number, reducedMotion = false) {
  const time = reducedMotion ? 2.38 : elapsedMs / 1000;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, width, height);
  rect(c, 0, 0, width, height, scene.backdrop);
  for (let i = 0; i < 55; i++) {
    c.globalAlpha = .2 + noise(i + scene.variant) * .45;
    const x = noise(i * 11 + scene.variant) * width;
    const y = noise(i * 13 + 9) * height;
    rect(c, x, y, i % 11 ? 1 : 2, 1, scene.primary);
  }
  c.globalAlpha = 1;
  const scale = Math.min(width / 320, height / 240);
  c.translate(Math.round(width / 2), Math.round(height * .54)); c.scale(scale, scale);
  terrain(c, scene, time, reducedMotion);
  switch (scene.mechanism) {
    case 'swords': swordsScene(c, scene, time); break;
    case 'assassin': assassinScene(c, scene, time); break;
    case 'drift': driftScene(c, scene, time); break;
    case 'artillery': artilleryScene(c, scene, time); break;
    case 'spell': spellScene(c, scene, time); break;
    case 'bonfire': bonfireScene(c, scene, time); break;
    case 'starship': starshipScene(c, scene, time); break;
    case 'civilization': civilizationScene(c, scene, time); break;
  }
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
}

export default function PixelCelebration({ gameId, reducedMotion, onFinish, revealOrigin, startedAt, interactive = true, restoreFocus = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const onFinishRef = useRef(onFinish);
  const finishedRef = useRef(false);
  onFinishRef.current = onFinish;
  const scene = getPixelCelebration(gameId);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinishRef.current();
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    skipRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); }
      if (event.key === 'Tab') { event.preventDefault(); skipRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [interactive, finish, restoreFocus]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const context = canvas.getContext('2d', { alpha: false });
    finishedRef.current = false;
    let frame = 0;
    let elapsed = startedAt === undefined ? 0 : Math.max(0, performance.now() - startedAt);
    let previous: number | null = startedAt === undefined ? null : performance.now();
    let disposed = false;
    let entryGeometry = getTransitionGeometry(revealOrigin ?? null, innerWidth, innerHeight);
    const redraw = () => {
      if (context) drawPixelCelebrationFrame(context, canvas.width, canvas.height, scene, elapsed, reducedMotion);
    };
    const resize = () => {
      const box = root.getBoundingClientRect();
      entryGeometry = getTransitionGeometry(revealOrigin ?? null, box.width, box.height);
      const pixelSize = Math.max(2, Math.round(Math.min(box.width / 320, box.height / 240)));
      canvas.width = Math.max(1, Math.ceil(box.width / pixelSize));
      canvas.height = Math.max(1, Math.ceil(box.height / pixelSize));
      redraw();
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed || finishedRef.current || document.hidden) { previous = null; return; }
      if (previous !== null) elapsed += Math.max(0, now - previous);
      previous = now;
      const phase = getCelebrationPhase(elapsed, reducedMotion);
      const reveal = revealOrigin === undefined ? 1 : clamp(elapsed / (reducedMotion ? REDUCED_TRANSITION_REVEAL_MS : TRANSITION_REVEAL_MS));
      const entry = 1 - (1 - reveal) ** 3;
      root.style.opacity = String(phase.opacity * (reducedMotion ? entry : 1));
      root.style.clipPath = !reducedMotion && reveal < 1 ? `circle(${entryGeometry.radius * entry}px at ${entryGeometry.originX}px ${entryGeometry.originY}px)` : 'none';
      root.style.setProperty('--pixel-entry', String(entry));
      root.style.setProperty('--pixel-progress', String(phase.progress));
      root.dataset.phase = phase.phase;
      if (!reducedMotion) redraw();
      if (phase.finished) { finish(); return; }
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; previous = null;
      if (!document.hidden && !finishedRef.current && !disposed) frame = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root); resize();
    document.addEventListener('visibilitychange', visibility);
    if (!document.hidden) frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [gameId, reducedMotion, scene, finish, revealOrigin, startedAt]);

  if (typeof document === 'undefined') return null;
  const sceneStyle: CSSProperties & Record<`--pixel-${string}`, string> = {
    '--pixel-primary': scene.primary, '--pixel-accent': scene.accent, '--pixel-backdrop': scene.backdrop,
    ...(revealOrigin !== undefined ? reducedMotion ? { opacity: 0 } : { clipPath: 'circle(0px)' } : {}),
  };
  return createPortal(
    <section className={`pixel-celebration${reducedMotion ? ' is-reduced' : ''}`} ref={rootRef}
      style={sceneStyle}
      aria-hidden={!interactive || undefined} role={interactive ? 'dialog' : undefined} aria-modal={interactive || undefined} aria-labelledby="pixel-celebration-title" aria-describedby="pixel-celebration-skill">
      <canvas className="pixel-celebration-canvas" ref={canvasRef} aria-hidden="true" />
      <div className="pixel-celebration-vignette" aria-hidden="true" />
      <header className="pixel-celebration-heading">
        <p>安装完成 <span>INSTALLATION COMPLETE</span></p>
        <h2 id="pixel-celebration-title">{scene.title}</h2>
        <strong id="pixel-celebration-skill">{scene.skill}</strong>
      </header>
      <button className="pixel-celebration-skip" ref={skipRef} onClick={finish} disabled={!interactive} style={{ visibility: interactive ? 'visible' : 'hidden' }}>跳过演出 <span>Esc</span></button>
      <div className="pixel-celebration-time" aria-hidden="true"><i /></div>
    </section>, document.body,
  );
}
