import { createInitialState, usedSpace, reservedSpace, diskCapacity, maxJobs } from './engine';
import { GAME_MAP } from './catalog';
import type { SaveGame, HardwareKey } from './types';

export const SAVE_KEY = 'install-simulator.save.v1';
const BACKUP_KEY = 'install-simulator.backup.v1';
const keys:HardwareKey[] = ['cpu','ram','disk','gpu','network'];
export function validateSave(value:unknown):value is SaveGame {
 if(!value||typeof value!=='object')return false;
 const s=value as SaveGame;
 if(s.version!==1||![s.points,s.earned,s.playTime,s.installedCount,s.nextEventId].every(n=>Number.isFinite(n)&&n>=0))return false;
 if(!s.hardware||!keys.every(k=>Number.isInteger(s.hardware[k])&&s.hardware[k]>=0&&s.hardware[k]<=2))return false;
 for(const field of ['owned','installed','collected','queue'] as const){if(!Array.isArray(s[field])||!s[field].every(id=>typeof id==='string'&&!!GAME_MAP[id])||new Set(s[field]).size!==s[field].length)return false;}
 if(!s.installed.every(id=>s.owned.includes(id)&&s.collected.includes(id))||!s.queue.every(id=>s.owned.includes(id)))return false;
 if(!Array.isArray(s.jobs)||s.jobs.length>3||!s.jobs.every(j=>j&&typeof j.id==='string'&&!!GAME_MAP[j.gameId]&&s.owned.includes(j.gameId)&&!s.installed.includes(j.gameId)&&['download','unpack','write','verify'].includes(j.stage)&&Number.isFinite(j.stageProgress)&&j.stageProgress>=0&&j.stageProgress<=1&&Number.isFinite(j.progress)&&j.progress>=0&&j.progress<=1&&Number.isFinite(j.elapsed)&&j.elapsed>=0))return false;
 if(new Set(s.jobs.map(j=>j.gameId)).size!==s.jobs.length||new Set(s.jobs.map(j=>j.id)).size!==s.jobs.length)return false;
 if(!s.collected.every(id=>s.owned.includes(id))||s.queue.some(id=>s.installed.includes(id)||s.jobs.some(j=>j.gameId===id)))return false;
 if(!s.settings||!['music','effects'].every(k=>Number.isFinite(s.settings[k as 'music'|'effects'])&&s.settings[k as 'music'|'effects']>=0&&s.settings[k as 'music'|'effects']<=1)||typeof s.settings.reducedMotion!=='boolean')return false;
 if(!['automation','pipeline','autoEnabled','won'].every(k=>typeof s[k as 'automation']==='boolean'))return false;
 if(s.jobs.length>maxJobs(s)||usedSpace(s)+reservedSpace(s)>diskCapacity(s)+1e-8)return false;
 if(!Number.isInteger(s.installedCount)||!Number.isInteger(s.nextEventId)||s.installedCount<s.collected.length)return false;
 if(s.automation&&!s.pipeline||s.autoEnabled&&!s.automation)return false;
 if(s.jobs.some(j=>keys.some(k=>s.hardware[k]<GAME_MAP[j.gameId].min[k])))return false;
 return Array.isArray(s.events)&&s.events.length<=120&&s.events.every(e=>typeof e.text==='string'&&e.text.length<2000&&Number.isFinite(e.id)&&['info','success','warning'].includes(e.kind));
}
export function parseSave(raw:string|null):SaveGame|null {try{const parsed:unknown=JSON.parse(raw??'null');return validateSave(parsed)?parsed:null;}catch{return null;}}
export function loadGame():{state:SaveGame;notice:string|null} {
 try {
  const raw=localStorage.getItem(SAVE_KEY);if(!raw)return {state:createInitialState(),notice:null};
  const state=parseSave(raw);if(state)return {state,notice:null};
  const backup=parseSave(localStorage.getItem(BACKUP_KEY));
  return {state:backup??createInitialState(),notice:backup?'已恢复上一次有效存档。':'存档无法读取，已创建新会话；原始数据保留在浏览器中。'};
 }catch{return {state:createInitialState(),notice:'浏览器暂不允许本地存档。本次仍可游玩，请保持网页打开。'};}
}
export function saveGame(state:SaveGame):boolean {
 try {
  const previous=localStorage.getItem(SAVE_KEY);
  if(previous&&parseSave(previous))localStorage.setItem(BACKUP_KEY,previous);
  else if(previous)localStorage.setItem('install-simulator.unreadable-save',previous);
  localStorage.setItem(SAVE_KEY,JSON.stringify(state));return true;
 }catch{return false;}
}
