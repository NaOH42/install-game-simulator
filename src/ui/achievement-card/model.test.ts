import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../game/engine';
import { GAMES, HARDWARE } from '../../game/catalog';
import { achievementCaption, createAchievementSnapshot, type CardDesktop } from './model';

const desktop:CardDesktop={width:1366,height:768,compact:false,icons:[{id:'app:hardware',label:'我的电脑',x:290,y:32,width:84,height:94,running:false}]};

describe('achievement card progress snapshot',()=>{
  it('includes only permanent collections, not purchased or unrevealed games',()=>{
    const state=createInitialState();
    state.owned=['red-alert','legend-sword'];
    state.collected=['red-alert'];
    const before=JSON.stringify(state);
    const card=createAchievementSnapshot(state,desktop);
    expect(card.collected.map(game=>game.id)).toEqual(['red-alert']);
    expect(card.installedCount).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
    expect(JSON.stringify(card)).not.toContain('legend-sword');
  });
  it('keeps collected but uninstalled games and all 32 game covers',()=>{
    const state=createInitialState();state.collected=GAMES.map(game=>game.id);
    const card=createAchievementSnapshot(state,desktop);
    expect(card.collected).toHaveLength(32);
    expect(new Set(card.collected.map(game=>game.cover)).size).toBe(32);
    expect(card.installedCount).toBe(0);
  });
  it('uses stable equipment indices and exposes names without economic parameters',()=>{
    const state=createInitialState();state.hardware.cpu=3;
    const card=createAchievementSnapshot(state,desktop);
    expect(card.hardware[0].name).toBe(HARDWARE.cpu[3].name);
    expect(card.hardware).toHaveLength(5);
    expect(card.hardware.every(item=>Object.keys(item).sort().join(',')==='key,label,name')).toBe(true);
  });
  it('freezes the current desktop and does not mutate its position data',()=>{
    const card=createAchievementSnapshot(createInitialState(),desktop);
    card.desktop.icons[0].x=99;
    expect(desktop.icons[0].x).toBe(290);
  });
  it('handles zero collections and guest captions without fake achievements',()=>{
    const card=createAchievementSnapshot(createInitialState(),desktop);
    expect(card.collected).toEqual([]);
    expect(achievementCaption(card,null)).toContain('已收藏 0 款');
    expect(achievementCaption(card,{name:'测试玩家',avatarUrl:null})).toContain('测试玩家的青春电脑');
    expect(achievementCaption(card,null)).not.toMatch(/击败|排名|UID|收益/);
  });
});
