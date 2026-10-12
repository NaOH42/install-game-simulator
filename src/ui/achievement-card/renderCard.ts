import type { AchievementSnapshot, CardDesktop, CardIdentity } from './model';

const WIDTH = 1080;
const MARGIN = 64;
const INNER = WIDTH - MARGIN * 2;
const FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';
const COLORS = { paper: '#f6f3e9', ink: '#203d5a', muted: '#758078', blue: '#1768cf', green: '#497838', line: '#d9ddce' };
type Context = CanvasRenderingContext2D;
type CardImage = { source: HTMLCanvasElement; originalWidth: number; originalHeight: number };
type Images = Map<string, CardImage | null>;

export function cardThumbnailSize(width: number, height: number) {
  const scale = Math.min(1, 512 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Relative covers and their absolute desktop URLs share one decode; at most three are live. */
export async function loadCardImageSources<T>(sources: Iterable<string>, loader: (url: string) => Promise<T>, baseUrl: string): Promise<Map<string, T>> {
  const aliases = new Map<string, string[]>();
  for (const source of sources) {
    let canonical = source;
    try { canonical = new URL(source, baseUrl).href; } catch { /* The loader supplies the normal missing-image fallback. */ }
    const group = aliases.get(canonical) || [];
    group.push(source);
    aliases.set(canonical, group);
  }
  const entries = [...aliases];
  const result = new Map<string, T>();
  let next = 0;
  async function worker() {
    while (next < entries.length) {
      const [canonical, originalSources] = entries[next++];
      const image = await loader(canonical);
      originalSources.forEach(source => result.set(source, image));
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));
  return result;
}

/** Equivalent to object-fit: cover plus the recorded CSS percentage focal point. */
export function coverSourceRect(imageWidth: number, imageHeight: number, width: number, height: number, focalPoint = '50% 50%') {
  const match = focalPoint.trim().split(/\s+/).map(value => Number.parseFloat(value) / 100);
  const clamp = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : 0.5;
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  return { x: (imageWidth - sourceWidth) * clamp(match[0]), y: (imageHeight - sourceHeight) * clamp(match[1]), width: sourceWidth, height: sourceHeight };
}

export function achievementCardLayout(collectedCount: number, desktop: Pick<CardDesktop, 'width' | 'height'>) {
  const desktopHeight = Math.round(Math.max(350, Math.min(590, INNER * desktop.height / Math.max(1, desktop.width))));
  const desktopY = 437;
  const hardwareY = desktopY + desktopHeight + 89;
  const collectionY = hardwareY + 403;
  const columns = 6;
  const cellWidth = (INNER - 20 * (columns - 1)) / columns;
  const cellHeight = Math.ceil(cellWidth * 1.5) + 82;
  const collectionHeight = collectedCount === 0 ? 180 : Math.ceil(collectedCount / columns) * cellHeight;
  return { width: WIDTH, height: Math.ceil(collectionY + collectionHeight + 220), desktopY, desktopHeight, hardwareY, collectionY, columns, cellWidth, cellHeight, collectionHeight };
}

function font(ctx: Context, size: number, weight = 400) { ctx.font = `${weight} ${size}px ${FONT}`; }
function rounded(ctx: Context, x: number, y: number, width: number, height: number, radius = 8) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
function box(ctx: Context, x: number, y: number, width: number, height: number, fill: string, stroke?: string, radius = 8) {
  rounded(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function text(ctx: Context, value: string, x: number, y: number, size: number, color = COLORS.ink, weight = 400) {
  font(ctx, size, weight);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}
function wrapped(ctx: Context, value: string, width: number, maxLines: number) {
  const letters = Array.from(value.replace(/\s+/g, ' ').trim());
  const lines: string[] = [];
  let line = '';
  for (let index = 0; index < letters.length; index++) {
    const letter = letters[index];
    if (line && ctx.measureText(line + letter).width > width) {
      lines.push(line);
      line = '';
      if (lines.length === maxLines) {
        let last = lines[maxLines - 1];
        while (last && ctx.measureText(`${last}…`).width > width) last = Array.from(last).slice(0, -1).join('');
        lines[maxLines - 1] = `${last}…`;
        return lines;
      }
    }
    line += letter;
  }
  if (line) lines.push(line);
  return lines;
}
function paragraph(ctx: Context, value: string, x: number, y: number, width: number, size: number, lineHeight: number, maxLines: number, color = COLORS.ink, weight = 400) {
  font(ctx, size, weight);
  ctx.fillStyle = color;
  const lines = wrapped(ctx, value, width, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return lines.length * lineHeight;
}
function imageCover(ctx: Context, image: CardImage, x: number, y: number, width: number, height: number, focalPoint?: string) {
  // Compute the focal crop in original coordinates, preserving its exact aspect ratio
  // even when the thumbnail's integer pixel dimensions needed rounding.
  const crop = coverSourceRect(image.originalWidth, image.originalHeight, width, height, focalPoint);
  const sx = image.source.width / image.originalWidth;
  const sy = image.source.height / image.originalHeight;
  ctx.drawImage(image.source, crop.x * sx, crop.y * sy, crop.width * sx, crop.height * sy, x, y, width, height);
}
function imageKey(icon: CardDesktop['icons'][number]) {
  return icon.imageUrl || (icon.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.svg)}` : '');
}
function loadImage(url: string, timeoutMs: number): Promise<CardImage | null> {
  if (timeoutMs <= 0) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const done = (result: CardImage | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      // Only the small canvas is retained. Release our original image reference
      // and cancel a timed-out load before the next queued image is started.
      image.removeAttribute('src');
      resolve(result);
    };
    const timeout = setTimeout(() => done(null), timeoutMs);
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (settled) return;
      if (!image.naturalWidth || !image.naturalHeight) { done(null); return; }
      const originalWidth = image.naturalWidth;
      const originalHeight = image.naturalHeight;
      const size = cardThumbnailSize(originalWidth, originalHeight);
      const source = document.createElement('canvas');
      source.width = size.width; source.height = size.height;
      const context = source.getContext('2d');
      if (!context) { done(null); return; }
      try {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, size.width, size.height);
        done({ source, originalWidth, originalHeight });
      } catch { done(null); }
    };
    image.onerror = () => done(null);
    image.src = url;
  });
}
function section(ctx: Context, number: string, title: string, y: number, note: string) {
  box(ctx, MARGIN, y - 25, 37, 30, '#e5ecdf', undefined, 3);
  text(ctx, number, MARGIN + 8, y - 3, 17, COLORS.green, 700);
  text(ctx, title, MARGIN + 51, y, 28, COLORS.ink, 700);
  ctx.textAlign = 'right';
  text(ctx, note, WIDTH - MARGIN, y - 2, 18, COLORS.muted);
  ctx.textAlign = 'left';
}

/** Reproduce the game's own wallpaper and shortcut positions, with no windows hiding them. */
function drawDesktop(ctx: Context, desktop: CardDesktop, images: Images, y: number, height: number) {
  ctx.save();
  ctx.shadowColor = '#254b7420';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  box(ctx, MARGIN - 3, y - 37, INNER + 6, height + 43, '#0754c4', undefined, 8);
  ctx.restore();
  const title = ctx.createLinearGradient(0, y - 36, 0, y);
  title.addColorStop(0, '#69a5fe'); title.addColorStop(0.18, '#1474ed'); title.addColorStop(1, '#0051c8');
  ctx.fillStyle = title;
  ctx.fillRect(MARGIN, y - 34, INNER, 34);
  text(ctx, '我的电脑  —  桌面留念', MARGIN + 13, y - 10, 18, '#fff', 700);
  for (let index = 0; index < 3; index++) {
    const x = WIDTH - MARGIN - 88 + index * 27;
    box(ctx, x, y - 28, 22, 22, index === 2 ? '#df6d51' : '#428ceb', '#c2dcff', 3);
    text(ctx, ['−', '□', '×'][index], x + 5, y - 11, 17, '#fff');
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(MARGIN, y, INNER, height); ctx.clip();
  ctx.translate(MARGIN, y);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#72abdc'); sky.addColorStop(0.73, '#bdddf4'); sky.addColorStop(1, '#a8cbee');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, INNER, height);
  for (const [cx, cy, rx, ry, alpha] of [[0.74,0.18,0.25,0.05,0.3], [0.25,0.24,0.2,0.05,0.2]]) {
    ctx.save(); ctx.translate(INNER * cx, height * cy); ctx.scale(INNER * rx, height * ry);
    const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    cloud.addColorStop(0, `rgba(255,255,255,${alpha})`); cloud.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cloud; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  }
  const hill = (cx: number, cy: number, rx: number, ry: number, angle: number, top: string, bottom: string) => {
    ctx.save(); ctx.translate(INNER * cx, height * cy); ctx.rotate(angle);
    const gradient = ctx.createLinearGradient(0, -height * ry, 0, height * ry);
    gradient.addColorStop(0, top); gradient.addColorStop(0.65, bottom);
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(0, 0, INNER * rx, height * ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  hill(0.83, 1.055, 0.7, 0.375, -13 * Math.PI / 180, '#82ba4e', '#4d8727');
  hill(0.43, 1.185, 0.78, 0.425, 7 * Math.PI / 180, '#94bd50', '#51872c');
  const taskbarHeight = 30;
  const scale = Math.min(INNER / Math.max(1, desktop.width), (height - taskbarHeight) / Math.max(1, desktop.height - 39));
  const offsetX = (INNER - desktop.width * scale) / 2;
  ctx.save(); ctx.translate(offsetX, 0); ctx.scale(scale, scale);
  for (const icon of desktop.icons) {
    const image = images.get(imageKey(icon));
    const w = icon.imageUrl ? 37 : 42;
    const h = icon.imageUrl ? 43 : 42;
    const x = icon.x + (icon.width - w) / 2;
    const iy = icon.y + 5;
    if (image) {
      ctx.save();
      ctx.shadowColor = '#18324b77'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 2;
      if (icon.imageUrl) imageCover(ctx, image, x, iy, w, h);
      else ctx.drawImage(image.source, x, iy, w, h);
      ctx.restore();
    } else {
      box(ctx, x, iy, w, h, '#e9f0e9', '#819daf', 3);
      text(ctx, '□', x + 8, iy + 28, 24, '#568ba1');
    }
    if (icon.imageUrl) {
      box(ctx, x - 3, iy + h - 10, 14, 14, '#f4f4ff', '#8196af', 0);
      text(ctx, '↗', x - 2, iy + h + 1, 14, '#0c519d', 700);
    }
    if (icon.running) { ctx.fillStyle = '#b8f187'; ctx.beginPath(); ctx.arc(x + w - 1, iy + h - 1, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.textAlign = 'center'; ctx.shadowColor = '#174560'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    paragraph(ctx, icon.label, icon.x + icon.width / 2, iy + h + 18, icon.width - 2, 12, 16, 2, '#fff');
    ctx.restore();
  }
  ctx.restore();
  const bar = ctx.createLinearGradient(0, height - taskbarHeight, 0, height);
  bar.addColorStop(0, '#4693f2'); bar.addColorStop(0.2, '#1267d6'); bar.addColorStop(1, '#0954bc');
  ctx.fillStyle = bar; ctx.fillRect(0, height - taskbarHeight, INNER, taskbarHeight);
  box(ctx, 0, height - taskbarHeight, 88, taskbarHeight + 5, '#348d2f', undefined, 9);
  text(ctx, '开始', 23, height - 8, 19, '#fff', 700);
  text(ctx, '装游戏模拟器', 108, height - 9, 14, '#e4f3ff');
  ctx.textAlign = 'right'; text(ctx, '我的青春电脑', INNER - 14, height - 9, 14, '#e4f3ff'); ctx.textAlign = 'left';
  ctx.restore();
}

function drawAvatar(ctx: Context, image: CardImage | null | undefined, x: number, y: number) {
  box(ctx, x - 4, y - 4, 84, 84, '#fffdf7', '#cad4c3', 10);
  ctx.save(); rounded(ctx, x, y, 76, 76, 7); ctx.clip();
  if (image) imageCover(ctx, image, x, y, 76, 76);
  else {
    ctx.fillStyle = '#dfebd9'; ctx.fillRect(x, y, 76, 76);
    ctx.fillStyle = '#80976e'; ctx.beginPath(); ctx.arc(x + 38, y + 29, 13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 38, y + 73, 29, 27, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** The preview and the exported PNG are this exact render, never a second capture. */
export async function renderAchievementCard(snapshot: AchievementSnapshot, identity: CardIdentity | null): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; warnings: string[] }> {
  const layout = achievementCardLayout(snapshot.collected.length, snapshot.desktop);
  const warnings: string[] = [];
  const sources = new Set(snapshot.collected.map(game => game.cover));
  snapshot.desktop.icons.forEach(icon => { const key = imageKey(icon); if (key) sources.add(key); });
  if (identity?.avatarUrl) sources.add(identity.avatarUrl);
  // A shared deadline keeps a completely offline collection from taking a
  // separate six-second timeout for each group of three images.
  const imageDeadline = performance.now() + 8000;
  const images: Images = await loadCardImageSources(sources, url => loadImage(url, Math.min(6000, imageDeadline - performance.now())), document.baseURI);
  if (snapshot.collected.some(game => !images.get(game.cover))) warnings.push('部分收藏封面暂未载入，卡片已保留游戏名称。');
  if (snapshot.desktop.icons.some(icon => imageKey(icon) && !images.get(imageKey(icon)))) warnings.push('部分桌面图标暂未载入，已保留图标位置与名称。');
  if (identity?.avatarUrl && !images.get(identity.avatarUrl)) warnings.push('头像暂未载入，卡片仍保留你的B站昵称。');
  const canvas = document.createElement('canvas');
  canvas.width = layout.width; canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器暂不支持生成图片，请换用现代浏览器重试。');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 0, WIDTH, layout.height);
  ctx.fillStyle = COLORS.blue; ctx.fillRect(0, 0, WIDTH, 12);
  ctx.fillStyle = '#ecebdd'; ctx.fillRect(0, 12, 18, layout.height - 12);
  ctx.strokeStyle = '#e9e8dc'; ctx.lineWidth = 1;
  for (let y = 58; y < layout.height; y += 32) { ctx.beginPath(); ctx.moveTo(22, y); ctx.lineTo(33, y); ctx.stroke(); }

  text(ctx, '装游戏模拟器   /   青春存档', MARGIN, 67, 19, COLORS.muted);
  ctx.textAlign = 'right'; text(ctx, snapshot.capturedAt, WIDTH - MARGIN, 67, 18, COLORS.muted); ctx.textAlign = 'left';
  text(ctx, '我的青春电脑', MARGIN - 3, 171, 82, COLORS.ink, 800);
  text(ctx, '有些快乐，连进度条都记得。', MARGIN + 2, 215, 25, '#64785e');
  ctx.strokeStyle = COLORS.line; ctx.beginPath(); ctx.moveTo(MARGIN, 244); ctx.lineTo(WIDTH - MARGIN, 244); ctx.stroke();

  drawAvatar(ctx, identity?.avatarUrl ? images.get(identity.avatarUrl) : null, MARGIN + 3, 273);
  const nameHeight = paragraph(ctx, identity?.name || '装机爱好者', MARGIN + 100, 296, 570, 29, 35, 2, COLORS.ink, 700);
  text(ctx, identity ? 'B站玩家 · 已授权署名' : '游客留念 · 第一台电脑的快乐', MARGIN + 100, 288 + nameHeight, 18, COLORS.muted);
  ctx.textAlign = 'right';
  text(ctx, String(snapshot.collected.length).padStart(2, '0'), WIDTH - MARGIN, 316, 64, COLORS.green, 700);
  text(ctx, '款游戏，装进回忆', WIDTH - MARGIN, 348, 18, COLORS.muted);
  ctx.textAlign = 'left';

  section(ctx, '01', '我的桌面', 386, `当前已安装 ${snapshot.installedCount} 款`);
  drawDesktop(ctx, snapshot.desktop, images, layout.desktopY, layout.desktopHeight);
  section(ctx, '02', '陪我装机的老伙计', layout.hardwareY, '当前使用的硬件');
  snapshot.hardware.forEach((hardware, index) => {
    const x = MARGIN + (index % 2) * (INNER / 2 + 9);
    const y = layout.hardwareY + 25 + Math.floor(index / 2) * 107;
    const width = index === snapshot.hardware.length - 1 && index % 2 === 0 ? INNER : INNER / 2 - 9;
    box(ctx, x, y, width, 94, '#fcfaf3', '#d9dfd0', 5);
    text(ctx, hardware.label, x + 18, y + 27, 17, COLORS.muted);
    paragraph(ctx, hardware.name, x + 18, y + 58, width - 36, 24, 28, 2, COLORS.ink, 600);
  });

  section(ctx, '03', '我的光盘架', layout.collectionY - 29, '装过的游戏，都会留下');
  if (!snapshot.collected.length) {
    box(ctx, MARGIN, layout.collectionY, INNER, 164, '#eeeee1', '#d8dfcf', 6);
    text(ctx, '第一张光盘的位置，已经留好。', MARGIN + 28, layout.collectionY + 68, 30, '#5a7651', 600);
    text(ctx, '去装一款游戏，把这台电脑慢慢填满。', MARGIN + 29, layout.collectionY + 111, 22, COLORS.muted);
  }
  snapshot.collected.forEach((game, index) => {
    const x = MARGIN + index % layout.columns * (layout.cellWidth + 20);
    const y = layout.collectionY + Math.floor(index / layout.columns) * layout.cellHeight;
    const coverHeight = layout.cellWidth * 1.5;
    ctx.save(); ctx.shadowColor = '#253a301f'; ctx.shadowBlur = 7; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 5;
    box(ctx, x, y, layout.cellWidth, coverHeight, '#e1e5d9', undefined, 1); ctx.restore();
    const image = images.get(game.cover);
    if (image) imageCover(ctx, image, x, y, layout.cellWidth, coverHeight, game.focalPoint);
    else {
      text(ctx, '封面暂未载入', x + 12, y + coverHeight / 2, 17, '#809075');
      text(ctx, '游戏已珍藏', x + 12, y + coverHeight / 2 + 28, 16, '#809075');
    }
    ctx.strokeStyle = '#21384c30'; ctx.strokeRect(x + 0.5, y + 0.5, layout.cellWidth - 1, coverHeight - 1);
    // The narrow translucent spine keeps the original bitmap intact.
    ctx.fillStyle = '#ffffff30'; ctx.fillRect(x + 3, y, 3, coverHeight);
    paragraph(ctx, game.title, x, y + coverHeight + 28, layout.cellWidth, 19, 26, 2, COLORS.ink, 600);
  });

  const footerY = layout.height - 156;
  ctx.strokeStyle = '#ced7c4'; ctx.beginPath(); ctx.moveTo(MARGIN, footerY); ctx.lineTo(WIDTH - MARGIN, footerY); ctx.stroke();
  text(ctx, '你小时候的电脑，装过哪几款？', MARGIN, footerY + 52, 30, COLORS.green, 700);
  text(ctx, '装游戏模拟器', MARGIN, footerY + 103, 21, COLORS.ink, 700);
  ctx.textAlign = 'right'; text(ctx, '把等待，装成一整个青春。', WIDTH - MARGIN, footerY + 103, 19, COLORS.muted); ctx.textAlign = 'left';

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('图片生成失败，请重试。')), 'image/png'));
  return { blob, dataUrl: canvas.toDataURL('image/png'), width: layout.width, height: layout.height, warnings };
}
