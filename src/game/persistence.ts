import { createInitialState, usedSpace, reservedSpace, diskCapacity, maxJobs } from './engine';
import { GAME_MAP, HARDWARE } from './catalog';
import type { SaveGame, HardwareKey } from './types';

export const SAVE_KEY = 'install-simulator.save.v2';
const BACKUP_KEY = 'install-simulator.backup.v2';
const LEGACY_SAVE_KEY = 'install-simulator.save.v1';
const LEGACY_BACKUP_KEY = 'install-simulator.backup.v1';
const keys:HardwareKey[] = ['cpu','ram','disk','gpu','network'];
export function validateSave(value:unknown):value is SaveGame {
 if(!value||typeof value!=='object')return false;
 const s=value as SaveGame;
 if(s.version!==1||![s.points,s.earned,s.playTime,s.installedCount,s.nextEventId].every(n=>Number.isFinite(n)&&n>=0))return false;
 if(!s.hardware||!keys.every(k=>Number.isInteger(s.hardware[k])&&s.hardware[k]>=0&&s.hardware[k]<HARDWARE[k].length))return false;
 for(const field of ['owned','installed','running','collected','queue'] as const){if(!Array.isArray(s[field])||!s[field].every(id=>typeof id==='string'&&!!GAME_MAP[id])||new Set(s[field]).size!==s[field].length)return false;}
 if(!s.ownedHardware||!keys.every(k=>Array.isArray(s.ownedHardware[k])&&s.ownedHardware[k].includes(0)&&s.ownedHardware[k].includes(s.hardware[k])&&new Set(s.ownedHardware[k]).size===s.ownedHardware[k].length&&s.ownedHardware[k].every(option=>Number.isInteger(option)&&option>=0&&option<HARDWARE[k].length)))return false;
 if(!s.running.every(id=>s.installed.includes(id)))return false;
 if(!s.installed.every(id=>s.owned.includes(id)&&s.collected.includes(id))||!s.queue.every(id=>s.owned.includes(id)))return false;
 if(!Array.isArray(s.jobs)||s.jobs.length>3||!s.jobs.every(j=>j&&typeof j.id==='string'&&!!GAME_MAP[j.gameId]&&s.owned.includes(j.gameId)&&!s.installed.includes(j.gameId)&&['download','unpack','write','verify'].includes(j.stage)&&Number.isFinite(j.stageProgress)&&j.stageProgress>=0&&j.stageProgress<=1&&Number.isFinite(j.progress)&&j.progress>=0&&j.progress<=1&&Number.isFinite(j.elapsed)&&j.elapsed>=0))return false;
 if(new Set(s.jobs.map(j=>j.gameId)).size!==s.jobs.length||new Set(s.jobs.map(j=>j.id)).size!==s.jobs.length)return false;
 if(!s.collected.every(id=>s.owned.includes(id))||s.queue.some(id=>s.installed.includes(id)||s.jobs.some(j=>j.gameId===id)))return false;
 if(!s.settings||!['music','effects'].every(k=>Number.isFinite(s.settings[k as 'music'|'effects'])&&s.settings[k as 'music'|'effects']>=0&&s.settings[k as 'music'|'effects']<=1)||typeof s.settings.reducedMotion!=='boolean')return false;
 if(!['automation','pipeline','autoEnabled','won'].every(k=>typeof s[k as 'automation']==='boolean'))return false;
 if(s.jobs.length>maxJobs(s)||usedSpace(s)+reservedSpace(s)>diskCapacity(s)+1e-8)return false;
 if(!Number.isInteger(s.installedCount)||!Number.isInteger(s.nextEventId)||s.installedCount<s.collected.length)return false;
 if(s.automation&&!s.pipeline||s.autoEnabled&&!s.automation)return false;
 return Array.isArray(s.events)&&s.events.length<=120&&s.events.every(e=>typeof e.text==='string'&&e.text.length<2000&&Number.isFinite(e.id)&&['info','success','warning'].includes(e.kind));
}
export function parseSave(raw:string|null):SaveGame|null {
 try {
  const value:unknown=JSON.parse(raw??'null');
  if(!value||typeof value!=='object')return null;
  const candidate={...value} as Partial<SaveGame>;
  if(candidate.version!==1)return null;
  // v0.1 installed games earned passively. Preserve that intent as running on first migration.
  if(!Object.prototype.hasOwnProperty.call(candidate,'running')&&Array.isArray(candidate.installed))candidate.running=[...candidate.installed];
  if(!Object.prototype.hasOwnProperty.call(candidate,'ownedHardware')&&candidate.hardware){
   const equipped=candidate.hardware;
   candidate.ownedHardware=Object.fromEntries(keys.map(key=>{
    const option=equipped[key];
    const owned=Number.isInteger(option)&&option>=0&&option<=2?Array.from({length:option+1},(_,index)=>index):[0,option];
    return [key,owned];
   })) as SaveGame['ownedHardware'];
  }
  return validateSave(candidate)?candidate:null;
 }catch{return null;}
}
export function loadGame(initialSettings?:SaveGame['settings']):{state:SaveGame;notice:string|null} {
 const fresh=()=>{const state=createInitialState();return initialSettings?{...state,settings:{...initialSettings}}:state;};
 try {
  const raw=localStorage.getItem(SAVE_KEY);
  if(!raw){
   const legacy=parseSave(localStorage.getItem(LEGACY_SAVE_KEY))??parseSave(localStorage.getItem(LEGACY_BACKUP_KEY));
   return legacy?{state:legacy,notice:'已迁移经典版进度：已安装游戏保持运行，旧版存档独立保留。'}:{state:fresh(),notice:null};
  }
  const state=parseSave(raw);if(state)return {state,notice:null};
  const backup=parseSave(localStorage.getItem(BACKUP_KEY));
  return {state:backup??fresh(),notice:backup?'已恢复上一次有效存档。':'存档无法读取，已创建新会话；原始数据保留在浏览器中。'};
 }catch{return {state:fresh(),notice:'浏览器暂不允许本地存档。本次仍可游玩，请保持网页打开。'};}
}
export function saveGame(state:SaveGame):boolean {
 try {
  const previous=localStorage.getItem(SAVE_KEY);
  if(previous&&parseSave(previous))localStorage.setItem(BACKUP_KEY,previous);
  else if(previous)localStorage.setItem('install-simulator.unreadable-save.v2',previous);
  localStorage.setItem(SAVE_KEY,JSON.stringify(state));return true;
 }catch{return false;}
}
