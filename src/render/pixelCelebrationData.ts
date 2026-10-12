export type PixelMechanism = 'swords' | 'assassin' | 'drift' | 'artillery' | 'spell' | 'bonfire' | 'starship' | 'civilization';
export type PixelCelebrationDefinition = {
  title: string;
  skill: string;
  mechanism: PixelMechanism;
  primary: string;
  accent: string;
  backdrop: string;
  variant: number;
};

const scene = (title: string, skill: string, mechanism: PixelMechanism, primary: string, accent: string, backdrop: string, variant = 0): PixelCelebrationDefinition => ({ title, skill, mechanism, primary, accent, backdrop, variant });

/** Stable IDs deliberately map to authored scenes, never the catalog index or an income value. */
export const PIXEL_CELEBRATIONS: Readonly<Record<string, PixelCelebrationDefinition>> = {
  'red-alert': scene('红色警戒线', '钢铁洪流', 'artillery', '#a5c977', '#ffba5c', '#112025'),
  'legend-sword': scene('仙剑与作业', '万剑归宗', 'swords', '#7ee5d0', '#e8ffff', '#092b32'),
  'need-parking': scene('极品停车位', '极限漂移入库', 'drift', '#ffe05a', '#ff8459', '#151e39'),
  'half-sleep': scene('半条命都在睡', '共振连锁反应', 'spell', '#ff9d47', '#8effc5', '#262037', 1),
  'war-canteen': scene('食堂争霸', '食堂奇观建成', 'civilization', '#e5c75b', '#c6ef8d', '#23311e', 1),
  'paladin-homework': scene('大侠请补考', '天剑破卷', 'swords', '#88c6ff', '#f4e9b6', '#152444', 1),
  'car-school': scene('驾校风云', '满分倒车入库', 'drift', '#edf1e4', '#70d2c2', '#18313a', 1),
  'star-internet': scene('星际网吧', '舰队跃迁上线', 'starship', '#70d0ff', '#d6b0ff', '#0e1840'),
  'empire-dorm': scene('宿舍帝国', '帝国时代降临', 'civilization', '#eabd69', '#fff1b8', '#2a2638'),
  'moon-blade': scene('月下折剑', '月照千刃', 'swords', '#bcaaff', '#e2f7ff', '#191539', 2),
  'midnight-taxi': scene('午夜出租', '午夜最后一单', 'drift', '#f6ca4d', '#ff7da4', '#251731', 2),
  'space-miner': scene('太空打工人', '小行星满载返航', 'starship', '#f1b462', '#adf6da', '#19293a', 1),
  'command-conquer': scene('命令与加班', '超时空火力支援', 'artillery', '#cbd99c', '#69dff3', '#172c32', 1),
  'dragon-inn': scene('龙门客栈打烊了', '大漠一剑', 'swords', '#edb46f', '#ffe5bb', '#33221e', 3),
  'rally-rain': scene('雨夜拉力', '破雨冲线', 'drift', '#67bbf0', '#edffb3', '#0b2838', 3),
  'alien-cafe': scene('异星咖啡馆', '银河手冲特调', 'spell', '#edacdf', '#99efba', '#301d40', 2),
  'world-war-lan': scene('局域网大战', '全线火力覆盖', 'artillery', '#a8cb83', '#ffc17d', '#24352b', 2),
  'immortal-exam': scene('修仙期末考', '九天雷劫', 'spell', '#baa1ff', '#faf3be', '#21153d', 3),
  'speed-horizon': scene('速度地平线', '追上地平线', 'drift', '#ff886c', '#ffe990', '#36203c', 4),
  'galaxy-odyssey': scene('银河漫游指南针', '跃迁至银河尽头', 'starship', '#bcb3ff', '#91eaff', '#141336', 2),
  'frozen-throne': scene('冰封王座坐垫', '霜之王座', 'spell', '#9ee8ff', '#e9f8ff', '#122c46', 4),
  'jade-dynasty': scene('碧玉长歌', '青云御剑', 'swords', '#a9efb2', '#e7ffc8', '#10352b', 4),
  'neon-highway': scene('霓虹高速', '霓虹氮气爆发', 'drift', '#fb7de0', '#63e7ed', '#291448', 5),
  'crisis-final': scene('显卡危机：最终章', '最大能量释放', 'spell', '#91f594', '#f3ffb6', '#112f2c', 5),
  'elder-scrollbar': scene('老头滚动条', '龙吼：不卸之力', 'spell', '#c8e3f6', '#a9d4ff', '#1b2638', 6),
  'cats-creed': scene('猫猫信条', '信仰之跃', 'assassin', '#f8f1dd', '#dfb66e', '#153048'),
  'dark-suffering': scene('黑魂受苦', '篝火已燃起', 'bonfire', '#f5a155', '#ffe3a0', '#241622'),
  'junk-collector-4': scene('捡垃圾4', '废土奇迹重建', 'civilization', '#87c697', '#f3cc69', '#23392e', 2),
  'give-him-love': scene('给他爱', '五星浪漫漂移', 'drift', '#a084ec', '#ffa8cd', '#2b1b39', 6),
  'potato-servers': scene('土豆服务器', '战术破门成功', 'artillery', '#c5b986', '#bceff2', '#203441', 3),
  'boyfriend-3': scene('男朋友3', '蓝橙战线突围', 'artillery', '#86b8d8', '#ffab61', '#142c42', 4),
  'one-more-turn': scene('文明：再来一回合', '奇观拔地而起', 'civilization', '#eac375', '#b9e8ef', '#142d39', 3),
};

const FALLBACK = scene('新游戏', '冒险即刻启程', 'starship', '#92d9ff', '#fff0b4', '#182c41');
export function getPixelCelebration(gameId: string): PixelCelebrationDefinition {
  return PIXEL_CELEBRATIONS[gameId] ?? FALLBACK;
}

export const PIXEL_CELEBRATION_DURATION = 4800;
export const REDUCED_CELEBRATION_DURATION = 1600;
export function getCelebrationPhase(elapsedMs: number, reducedMotion = false) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const duration = reducedMotion ? REDUCED_CELEBRATION_DURATION : PIXEL_CELEBRATION_DURATION;
  return {
    duration,
    progress: Math.min(1, elapsed / duration),
    phase: reducedMotion ? 'still' : elapsed < 1100 ? 'charge' : elapsed < 3400 ? 'release' : 'settle',
    opacity: Math.max(0, Math.min(1, (duration - elapsed) / (reducedMotion ? 250 : 400))),
    finished: elapsed >= duration,
  };
}
