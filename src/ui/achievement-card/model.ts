import { GAMES, HARDWARE } from '../../game/catalog';
import type { HardwareKey, SaveGame } from '../../game/types';
import { assetUrl } from '../assetUrl';
import { isCompactViewport } from '../responsive';

export interface CardGame { id: string; title: string; cover: string; focalPoint: string; }
export interface CardHardware { key: HardwareKey; label: string; name: string; }
export interface CardDesktopIcon {
  id: string; label: string; x: number; y: number; width: number; height: number;
  imageUrl?: string; svg?: string; running: boolean;
}
export interface CardDesktop { width: number; height: number; icons: CardDesktopIcon[]; compact: boolean; }
export interface AchievementSnapshot {
  collected: CardGame[]; installedCount: number; hardware: CardHardware[];
  desktop: CardDesktop; capturedAt: string;
}
export interface CardIdentity { name: string; avatarUrl: string | null; }

const HARDWARE_LABELS: Record<HardwareKey, string> = { cpu:'处理器', ram:'内存', gpu:'显卡', disk:'硬盘', network:'网络' };

/** An immutable view of real progress; purchases and hidden catalog entries are excluded. */
export function createAchievementSnapshot(state: SaveGame, desktop: CardDesktop, now = new Date()): AchievementSnapshot {
  const collected = new Set(state.collected);
  return {
    collected: GAMES.filter(game => collected.has(game.id)).map(game => ({ id:game.id, title:game.title, cover:assetUrl(game.cover), focalPoint:game.focalPoint })),
    installedCount: state.installed.length,
    hardware: (Object.keys(HARDWARE_LABELS) as HardwareKey[]).map(key => ({ key, label:HARDWARE_LABELS[key], name:HARDWARE[key][state.hardware[key]].name })),
    desktop: { ...desktop, icons:desktop.icons.map(icon=>({...icon})) },
    capturedAt: now.toLocaleDateString('zh-CN', { year:'numeric',month:'2-digit',day:'2-digit' }),
  };
}

/** Read the game's own desktop, without moving windows or writing saved icon positions. */
export function captureCardDesktop(): CardDesktop {
  const compact = isCompactViewport(window.innerWidth, window.innerHeight);
  const desktop = document.querySelector<HTMLElement>('.desktop');
  const bounds = desktop?.getBoundingClientRect();
  const width = compact ? 1366 : Math.max(1, bounds?.width || window.innerWidth);
  const height = compact ? 768 : Math.max(1, bounds?.height || window.innerHeight);
  const icons = [...document.querySelectorAll<HTMLElement>('.desktop-icons [data-desktop-icon]')].map((element,index) => {
    const rect = element.getBoundingClientRect();
    const svg = element.querySelector('svg');
    const image = element.querySelector('img');
    const label = [...element.children].find(child=>child.tagName==='SPAN')?.textContent || element.getAttribute('aria-label') || '';
    return {
      id:element.dataset.desktopIcon || '', label,
      x:compact ? 16+Math.floor(index/6)*102 : rect.left-(bounds?.left||0),
      y:compact ? 24+(index%6)*108 : rect.top-(bounds?.top||0),
      width:compact ? 84 : rect.width, height:compact ? 94 : rect.height,
      imageUrl:image?.currentSrc || image?.src || undefined,
      svg:svg ? new XMLSerializer().serializeToString(svg) : undefined,
      running:element.classList.contains('is-running'),
    };
  });
  return {width,height,icons,compact};
}

export function achievementCaption(snapshot: AchievementSnapshot, identity: CardIdentity | null): string {
  const owner = identity ? `${identity.name}的青春电脑` : '我的青春电脑';
  const games = snapshot.collected.slice(0,4).map(game=>`《${game.title}》`).join('、');
  return `${owner}｜已收藏 ${snapshot.collected.length} 款游戏，桌面上装着 ${snapshot.installedCount} 款。${games ? `我的光盘架：${games}${snapshot.collected.length>4?'……':''}。` : '第一张光盘的位置，已经留好。'}你小时候的电脑里，有哪几款？`;
}
