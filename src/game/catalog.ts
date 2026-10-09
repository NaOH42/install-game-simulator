import type { GameDefinition, Genre, Hardware, HardwareKey, HardwareLevel, ResourceDemand } from './types';
import { EXPANSION_GAMES } from './expansion';
import { GAME_DESCRIPTIONS } from './descriptions';

export const GENRES: Record<Genre, { label: string; color: string }> = {
  strategy: { label: '即时战略', color: '#dcbf74' },
  wuxia: { label: '武侠奇缘', color: '#88c8aa' },
  racing: { label: '竞速驾驶', color: '#ed9b6a' },
  scifi: { label: '科幻冒险', color: '#88bce6' },
};

function model(name: string, detail: string, price: number, value: number, generation: 0 | 1 | 2, capacity: number, installSpeed: number, slots: number, focus: string, cpuRelief = 0): HardwareLevel {
  return { name, detail, price, value, generation, capacity, installSpeed, slots, focus, cpuRelief };
}

// Indices 0/1/2 keep the v0.1 model identities. New choices append at 3/4; indices are never ranks.
export const HARDWARE: Record<HardwareKey, HardwareLevel[]> = {
  cpu: [
    model('奔腾·慢半拍 800 MHz', '100 算力 · 解压 ×1', 0, 1, 0, 100, 1, 1, '入门'),
    model('速龙·双响炮 2.4 GHz', '360 算力 · 解压 ×3.6', 240, 3.6, 1, 360, 3.6, 1, '均衡'),
    model('酷睿·四核全开', '1200 算力 · 解压 ×12', 3000, 12, 2, 1200, 12, 1, '高速均衡'),
    model('奔腾·高频单核', '200 算力 · 解压 ×5 · 安装快，多开弱', 220, 5, 1, 200, 5, 1, '高频解压'),
    model('至强·多开工作站', '2400 算力 · 解压 ×8.5 · 容纳更多运行游戏', 3400, 8.5, 2, 2400, 8.5, 1, '多开运行'),
  ],
  ram: [
    model('128 MB SDRAM', '128 MB · 1 个安装任务', 0, 1, 0, 128, 1, 1, '入门'),
    model('512 MB DDR', '512 MB · 流水线 2 个任务', 260, 2, 1, 512, 1, 2, '并行安装'),
    model('2 GB 双通道', '2048 MB · 流水线 3 个任务', 2300, 3, 2, 2048, 1, 3, '均衡'),
    model('1 GB 大容量单通道', '1024 MB · 1 个安装任务 · 多开余量更大', 270, 1, 1, 1024, 1, 1, '运行容量'),
    model('4 GB 海量内存', '4096 MB · 流水线 2 个任务 · 运行容量优先', 2700, 2, 2, 4096, 1, 2, '海量多开'),
  ],
  disk: [
    model('4.3 GB 老硬盘', '4.3 GB · 写入 ×1', 0, 4.3, 0, 4.3, 1, 1, '入门'),
    model('20 GB 高速硬盘', '20 GB · 写入 ×3.6', 300, 20, 1, 20, 3.6, 1, '写入速度'),
    model('80 GB 梦想硬盘', '80 GB · 写入 ×12', 3400, 80, 2, 80, 12, 1, '高速写入'),
    model('40 GB 仓库硬盘', '40 GB · 写入 ×2.2 · 空间翻倍', 320, 40, 1, 40, 2.2, 1, '收藏容量'),
    model('160 GB 收藏仓库', '160 GB · 写入 ×7.5 · 容量优先', 3600, 160, 2, 160, 7.5, 1, '海量收藏'),
  ],
  gpu: [
    model('小彩虹 16 MB', '100 图形算力', 0, 1, 0, 100, 1, 1, '入门'),
    model('极光 64 MB', '360 图形算力 · 图形优先', 320, 2, 1, 360, 1, 1, '图形性能'),
    model('星火 256 MB', '1200 图形算力 · 高画面负载', 3700, 3, 2, 1200, 1, 1, '高画质运行'),
    model('幻影·硬件加速卡', '240 图形算力 · 运行 CPU 占用降低 35%', 300, 2, 1, 240, 1, 1, '处理器减负', .35),
    model('矩阵·协处理显卡', '800 图形算力 · 运行 CPU 占用降低 50%', 3500, 3, 2, 800, 1, 1, '多开协处理', .5),
  ],
  network: [
    model('小水管 512 K', '100 带宽 · 下载 ×1', 0, 1, 0, 100, 1, 1, '入门'),
    model('小区宽带 2 M', '360 带宽 · 下载 ×3.6', 220, 3.6, 1, 360, 3.6, 1, '均衡'),
    model('独享光纤 10 M', '1200 带宽 · 下载 ×12', 2700, 12, 2, 1200, 12, 1, '高速下载'),
    model('突发加速宽带', '200 带宽 · 下载 ×5 · 联网多开弱', 230, 5, 1, 200, 5, 1, '下载加速'),
    model('双线游戏专网', '2400 带宽 · 下载 ×8.5 · 联网游戏余量更大', 2800, 8.5, 2, 2400, 8.5, 1, '联网多开'),
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

const CLASSIC_GAMES: GameDefinition[] = rows.map((row, index) => {
  const [id, title, subtitle, tagline, sizeGB, price, reward, income, duration] = row;
  const tier = Math.floor(index / 8) + 1;
  const level = tier - 1;
  const genre = genres[index % 4];
  const min: Hardware = { cpu: level, ram: level, disk: level, gpu: level, network: 0 };
  const online = ['star-internet', 'empire-dorm', 'command-conquer', 'alien-cafe', 'world-war-lan', 'galaxy-odyssey', 'neon-highway'].includes(id);
  const recommended: Hardware = { ...min, network: online ? level : 0 };
  const demands: Record<Genre, ResourceDemand> = { strategy: { cpu: 18, ram: 20, gpu: 9, network: 12 }, wuxia: { cpu: 12, ram: 18, gpu: 13, network: 10 }, racing: { cpu: 10, ram: 22, gpu: 22, network: 16 }, scifi: { cpu: 15, ram: 26, gpu: 18, network: 18 } };
  const runtime = Object.fromEntries(Object.entries(demands[genre]).map(([key, value]) => [key, key === 'network' && !online ? 0 : Math.round(value * [1, 3.5, 11][level] * (.9 + (index % 8) * .06))])) as ResourceDemand;
  const adjustedDuration = tier === 1 ? [85, 95, 100, 110, 98, 105, 108, 110][index] : duration * (tier === 2 ? 1.25 : .85);
  // Runtime work units are deliberately independent of the visual file sizes.
  const work = { download: adjustedDuration * .4, unpack: adjustedDuration * .3, write: adjustedDuration * .22, verify: adjustedDuration * .08 };
  return {
    id, title, subtitle, genre, tier, runtime, online, year: String(2000 + Math.floor(index / 4)),
    tagline, description: GAME_DESCRIPTIONS[id],
    sizeGB, downloadMB: Math.round(sizeGB * 640), price, reward, income: income * 2, min, recommended, work,
    cover: `/assets/covers/${id}.png`, focalPoint: id === 'dragon-inn' ? '40% 45%' : id === 'galaxy-odyssey' ? '50% 35%' : '50% 45%', color: GENRES[genre].color,
    featured: id === 'red-alert' || id === 'crisis-final',
  };
});

export const GAMES: GameDefinition[] = [...CLASSIC_GAMES, ...EXPANSION_GAMES.map(game => ({
  ...game,
  work: Object.fromEntries(Object.entries(game.work).map(([stage, work]) => [stage, work * .8])) as GameDefinition['work'],
}))];

export const GAME_MAP: Record<string, GameDefinition> = Object.fromEntries(GAMES.map(game => [game.id, game]));
