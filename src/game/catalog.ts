import type { GameDefinition, Genre, Hardware, HardwareKey, HardwareLevel } from './types';

export const GENRES: Record<Genre, { label: string; color: string }> = {
  strategy: { label: '即时战略', color: '#dcbf74' },
  wuxia: { label: '武侠奇缘', color: '#88c8aa' },
  racing: { label: '竞速驾驶', color: '#ed9b6a' },
  scifi: { label: '科幻冒险', color: '#88bce6' },
};

export const HARDWARE: Record<HardwareKey, HardwareLevel[]> = {
  cpu: [
    { name: '奔腾·慢半拍 800 MHz', detail: '解压速度 ×1', price: 0, value: 1 },
    { name: '速龙·双响炮 2.4 GHz', detail: '解压速度 ×3.6', price: 240, value: 3.6 },
    { name: '酷睿·四核全开', detail: '解压速度 ×12', price: 3000, value: 12 },
  ],
  ram: [
    { name: '128 MB SDRAM', detail: '1 个安装任务', price: 0, value: 1 },
    { name: '512 MB DDR', detail: '流水线支持 2 个任务', price: 260, value: 2 },
    { name: '2 GB 双通道', detail: '流水线支持 3 个任务', price: 2300, value: 3 },
  ],
  disk: [
    { name: '4.3 GB 老硬盘', detail: '4.3 GB · 写入速度 ×1', price: 0, value: 4.3 },
    { name: '20 GB 高速硬盘', detail: '20 GB · 写入速度 ×3.6', price: 300, value: 20 },
    { name: '80 GB 梦想硬盘', detail: '80 GB · 写入速度 ×12', price: 3400, value: 80 },
  ],
  gpu: [
    { name: '小彩虹 16 MB', detail: '支持经典游戏', price: 0, value: 1 },
    { name: '极光 64 MB', detail: '支持进阶游戏', price: 320, value: 2 },
    { name: '星火 256 MB', detail: '支持旗舰游戏', price: 3700, value: 3 },
  ],
  network: [
    { name: '小水管 512 K', detail: '下载速度 ×1', price: 0, value: 1 },
    { name: '小区宽带 2 M', detail: '下载速度 ×3.6', price: 220, value: 3.6 },
    { name: '独享光纤 10 M', detail: '下载速度 ×12', price: 2700, value: 12 },
  ],
};

type GameRow = [id: string, title: string, subtitle: string, tagline: string, size: number, price: number, reward: number, income: number, duration: number];
const rows: GameRow[] = [
  ['red-alert', '红色警戒线', 'RED LINE: AFTER SCHOOL', '基地已就绪，就差你点下一步。', .35, 0, 160, .10, 30],
  ['legend-sword', '仙剑与作业', 'SWORD & HOMEWORK', '仗剑走天涯，记得周一交作业。', .48, 70, 200, .16, 36],
  ['need-parking', '极品停车位', 'NEED FOR PARKING', '速度只是过程，车位才是终点。', .65, 100, 170, .22, 42],
  ['half-sleep', '半条命都在睡', 'HALF ASLEEP', '实验室停电之后，闹钟还在响。', .75, 150, 220, .30, 48],
  ['war-canteen', '食堂争霸', 'WAR OF CANTEENS', '集结你的饭卡，守住最后一只鸡腿。', .45, 180, 260, .38, 46],
  ['paladin-homework', '大侠请补考', 'PALADIN: SECOND CHANCE', '武功再高，也怕挂科。', .72, 210, 300, .45, 51],
  ['car-school', '驾校风云', 'DRIVING SCHOOL LEGENDS', '倒车入库，也是江湖。', .82, 250, 340, .55, 55],
  ['star-internet', '星际网吧', 'STAR INTERNET CAFE', '整个宇宙都在等一个空机位。', .95, 300, 390, .70, 60],
  ['empire-dorm', '宿舍帝国', 'AGE OF DORMITORIES', '从一张上下铺开始你的文明。', 1.1, 420, 530, 1.0, 245],
  ['moon-blade', '月下折剑', 'BLADE UNDER THE MOON', '一封旧信，一场未赴的约。', 1.4, 520, 660, 1.2, 270],
  ['midnight-taxi', '午夜出租', 'MIDNIGHT TAXI', '最后一位乘客，要去城市尽头。', 1.5, 650, 790, 1.5, 295],
  ['space-miner', '太空打工人', 'SPACE MINER', '引力可以消失，工期不会。', 1.8, 760, 920, 1.8, 320],
  ['command-conquer', '命令与加班', 'COMMAND & OVERTIME', '资源不足，请申请预算。', 1.4, 900, 1080, 2.1, 345],
  ['dragon-inn', '龙门客栈打烊了', 'THE LAST DRAGON INN', '刀光落定，掌柜开始算账。', 1.9, 1040, 1220, 2.5, 370],
  ['rally-rain', '雨夜拉力', 'RALLY IN THE RAIN', '每一道车灯，都是冲出雨幕的答案。', 2.2, 1200, 1400, 2.9, 395],
  ['alien-cafe', '异星咖啡馆', 'ALIEN CAFE', '欢迎光临。人类顾客请坐无重力区。', 2.4, 1400, 1610, 3.4, 420],
  ['world-war-lan', '局域网大战', 'WORLD WAR: LAN', '全寝室的网线，都通向这场战役。', 4.0, 2400, 2640, 4.2, 960],
  ['immortal-exam', '修仙期末考', 'IMMORTAL EXAM', '三千大道，选修两门。', 4.6, 2800, 3060, 4.8, 1020],
  ['speed-horizon', '速度地平线', 'SPEED HORIZON', '公路没有尽头，油箱还有半格。', 5.1, 3200, 3500, 5.5, 1080],
  ['galaxy-odyssey', '银河漫游指南针', 'GALAXY ODYSSEY', '你的导航已偏离航线四十光年。', 5.5, 3700, 4010, 6.3, 1140],
  ['frozen-throne', '冰封王座坐垫', 'THE FROZEN SEAT', '王国可以等，先给王座加个垫子。', 4.8, 4200, 4540, 7.2, 1200],
  ['jade-dynasty', '碧玉长歌', 'JADE DYNASTY', '飞过十万青山，去见一位故人。', 5.8, 4700, 5070, 8.2, 1260],
  ['neon-highway', '霓虹高速', 'NEON HIGHWAY', '黎明之前，跑完最后一圈。', 6.3, 5400, 5800, 9.4, 1320],
  ['crisis-final', '显卡危机：最终章', 'THE FINAL GRAPHICS CRISIS', '这一次，你的电脑终于带得动了。', 7.2, 6300, 7200, 12, 1500],
];
const genres: Genre[] = ['strategy', 'wuxia', 'racing', 'scifi'];

export const GAMES: GameDefinition[] = rows.map((row, index) => {
  const [id, title, subtitle, tagline, sizeGB, price, reward, income, duration] = row;
  const tier = Math.floor(index / 8) + 1;
  const level = tier - 1;
  const genre = genres[index % 4];
  const min: Hardware = { cpu: level, ram: level, disk: level, gpu: level, network: 0 };
  const recommended: Hardware = { ...min, network: level };
  // Runtime work units are deliberately independent of the visual file sizes.
  const work = { download: duration * .4, unpack: duration * .3, write: duration * .22, verify: duration * .08 };
  return {
    id, title, subtitle, genre, tier, year: String(2000 + Math.floor(index / 4)),
    tagline, description: `${tagline} 一款来自${tier === 1 ? '经典光盘' : tier === 2 ? '宽带黄金' : '硬件飞跃'}年代的${GENRES[genre].label}游戏。装好它，让桌面上再多一个舍不得删除的图标。`,
    sizeGB, downloadMB: Math.round(sizeGB * 640), price, reward, income: income * 2, min, recommended, work,
    cover: `/assets/covers/${id}.png`, focalPoint: id === 'dragon-inn' ? '40% 45%' : id === 'galaxy-odyssey' ? '50% 35%' : '50% 45%', color: GENRES[genre].color,
    featured: id === 'red-alert' || id === 'crisis-final',
  };
});

export const GAME_MAP: Record<string, GameDefinition> = Object.fromEntries(GAMES.map(game => [game.id, game]));
