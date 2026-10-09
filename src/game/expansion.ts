import type { GameDefinition, Genre, ResourceDemand } from './types';
import { GAME_DESCRIPTIONS } from './descriptions';

type ExpansionRow = {
  id: string; title: string; subtitle: string; genre: Genre; year: string;
  tagline: string; sizeGB: number; price: number;
  reward: number; income: number; duration: number; runtime: ResourceDemand;
  online: boolean;
};

const rows: ExpansionRow[] = [
  {
    id: 'elder-scrollbar', title: '老头滚动条', subtitle: 'THE ELDER SCROLLBARS', genre: 'wuxia', year: '2011',
    tagline: '膝盖中了一箭，滚动条还没到底。',
    sizeGB: 6.8, price: 6600, reward: 7420, income: 18, duration: 1620,
    runtime: { cpu: 230, ram: 420, gpu: 125, network: 0 }, online: false,
  },
  {
    id: 'cats-creed', title: '猫猫信条', subtitle: "CAT'S CREED", genre: 'wuxia', year: '2007',
    tagline: '万物皆虚，罐头皆允。',
    sizeGB: 5.4, price: 6100, reward: 6800, income: 16, duration: 1680,
    runtime: { cpu: 120, ram: 180, gpu: 310, network: 0 }, online: false,
  },
  {
    id: 'dark-suffering', title: '黑魂受苦', subtitle: 'DARK SUFFERING', genre: 'wuxia', year: '2011',
    tagline: '你已倒下。硬盘还在坚持。',
    sizeGB: 6.2, price: 7000, reward: 7860, income: 20, duration: 1740,
    runtime: { cpu: 190, ram: 200, gpu: 230, network: 0 }, online: false,
  },
  {
    id: 'junk-collector-4', title: '捡垃圾4', subtitle: 'JUNK COLLECTOR IV', genre: 'scifi', year: '2015',
    tagline: '孩子可以等，这个风扇必须带走。',
    sizeGB: 8.6, price: 7600, reward: 8480, income: 24, duration: 1900,
    runtime: { cpu: 240, ram: 450, gpu: 170, network: 0 }, online: false,
  },
  {
    id: 'give-him-love', title: '给他爱', subtitle: 'GIVE HIM LOVE', genre: 'racing', year: '2013',
    tagline: '自由之城，今天也要好好送花。',
    sizeGB: 9.2, price: 8100, reward: 9040, income: 26, duration: 2040,
    runtime: { cpu: 250, ram: 320, gpu: 270, network: 160 }, online: true,
  },
  {
    id: 'potato-servers', title: '土豆服务器', subtitle: 'POTATO SIX: RECONNECT', genre: 'scifi', year: '2015',
    tagline: '战术已经部署，连接正在重试。',
    sizeGB: 7.6, price: 7400, reward: 8280, income: 22, duration: 1820,
    runtime: { cpu: 155, ram: 220, gpu: 185, network: 300 }, online: true,
  },
  {
    id: 'boyfriend-3', title: '男朋友3', subtitle: 'BOYFRIEND 3', genre: 'scifi', year: '2011',
    tagline: '穿过蓝橙战场，只为送你一束花。',
    sizeGB: 8.4, price: 8700, reward: 9680, income: 28, duration: 2180,
    runtime: { cpu: 210, ram: 280, gpu: 350, network: 220 }, online: true,
  },
  {
    id: 'one-more-turn', title: '文明：再来一回合', subtitle: 'JUST ONE MORE TURN', genre: 'strategy', year: '2010',
    tagline: '只再来一回合。天怎么亮了？',
    sizeGB: 7.8, price: 9600, reward: 10700, income: 32, duration: 2400,
    runtime: { cpu: 300, ram: 380, gpu: 80, network: 0 }, online: false,
  },
];

const colors: Record<Genre, string> = { strategy: '#dcbf74', wuxia: '#88c8aa', racing: '#ed9b6a', scifi: '#88bce6' };

/** Fictional hardware requirements balance the simulator; they are not the originals' PC specifications. */
export const EXPANSION_GAMES: GameDefinition[] = rows.map(({ duration, ...game }) => ({
  ...game,
  description: GAME_DESCRIPTIONS[game.id],
  tier: 3,
  downloadMB: Math.round(game.sizeGB * 640),
  min: { cpu: 1, ram: 1, disk: 1, gpu: 1, network: game.online ? 1 : 0 },
  recommended: { cpu: 2, ram: 2, disk: 2, gpu: 2, network: game.online ? 2 : 0 },
  work: { download: duration * .4, unpack: duration * .3, write: duration * .22, verify: duration * .08 },
  cover: `/assets/covers/${game.id}.png`,
  focalPoint: '50% 45%',
  color: colors[game.genre],
}));
