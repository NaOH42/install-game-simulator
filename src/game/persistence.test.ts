import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, dispatch, tick } from './engine';
import { GAME_MAP } from './catalog';
import { loadGame, saveGame, SAVE_KEY, parseSave, validateSave } from './persistence';

const starterDuration=Object.values(GAME_MAP['red-alert'].work).reduce((sum,value)=>sum+value,0);
afterEach(()=>vi.unstubAllGlobals());

describe('local save contract and legacy migration',()=>{
 it('roundtrips a partially installed task without granting offline progress',()=>{
  const state=tick(dispatch(createInitialState(),{type:'install',gameId:'red-alert'}).state,7.5);
  const restored=parseSave(JSON.stringify(state));
  expect(restored).toEqual(state);
  expect(restored?.jobs[0].stageProgress).toBeGreaterThan(0);
  expect(restored?.playTime).toBe(7.5);
 });
 it('preserves running state, purchases and first-install history after reload',()=>{
  const finished=tick(dispatch(createInitialState(),{type:'install',gameId:'red-alert'}).state,starterDuration);
  const active=dispatch(finished,{type:'run',gameId:'red-alert'}).state;
  expect(parseSave(JSON.stringify(active))?.running).toEqual(['red-alert']);
  const uninstalled=dispatch(active,{type:'uninstall',gameId:'red-alert'}).state;
  const restored=parseSave(JSON.stringify(uninstalled))!;
  expect(restored.running).toEqual([]);
  expect(restored.collected).toContain('red-alert');
  const reinstalled=tick(dispatch(restored,{type:'install',gameId:'red-alert'}).state,starterDuration);
  expect(reinstalled.points).toBeCloseTo(restored.points,6);
  expect(reinstalled.collected).toEqual(['red-alert']);
 });
 it('migrates v0.1 installed games to running and reconstructs already purchased old hardware',()=>{
  const current={...createInitialState(),hardware:{cpu:2,ram:1,disk:2,gpu:1,network:0},installed:['red-alert'],collected:['red-alert'],installedCount:1,points:777,earned:888,playTime:999};
  const {running,ownedHardware,...legacy}=current;
  const raw=JSON.stringify(legacy);
  const migrated=parseSave(raw)!;
  expect(migrated.running).toEqual(['red-alert']);
  expect(migrated.ownedHardware.cpu).toEqual([0,1,2]);
  expect(migrated.ownedHardware.ram).toEqual([0,1]);
  expect(migrated.hardware).toEqual(legacy.hardware);
  expect(migrated.points).toBe(777);
  expect(migrated.playTime).toBe(999);
  expect(JSON.stringify(legacy)).toBe(raw);
 });
 it('uses an independent v2 storage key and never overwrites the classic raw save',()=>{
  const {running,ownedHardware,...legacy}=createInitialState();
  const legacyRaw=JSON.stringify(legacy);
  const storage=new Map([['install-simulator.save.v1',legacyRaw]]);
  vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
  const loaded=loadGame();
  expect(loaded.notice).toContain('迁移');
  expect(saveGame(loaded.state)).toBe(true);
  expect(SAVE_KEY).toBe('install-simulator.save.v2');
  expect(parseSave(storage.get(SAVE_KEY)!)).toEqual(loaded.state);
  expect(storage.get('install-simulator.save.v1')).toBe(legacyRaw);
 });
 it('keeps purchased alternative models and rejects forged ownership or running records',()=>{
  let state=createInitialState();state.points=1000;
  state=dispatch(state,{type:'upgrade',key:'cpu',option:3}).state;
  expect(parseSave(JSON.stringify(state))).toEqual(state);
  expect(validateSave({...state,ownedHardware:{...state.ownedHardware,cpu:[0]}})).toBe(false);
  expect(validateSave({...state,running:['red-alert']})).toBe(false);
  expect(validateSave({...state,running:['red-alert','red-alert']})).toBe(false);
 });
 it('rejects corrupt values, conflicting tasks, and impossible disk reservations',()=>{
  expect(parseSave('{broken')).toBeNull();
  expect(validateSave({...createInitialState(),version:2})).toBe(false);
  expect(validateSave({...createInitialState(),points:Infinity})).toBe(false);
  expect(validateSave({...createInitialState(),hardware:{cpu:7}})).toBe(false);
  const job=dispatch(createInitialState(),{type:'install',gameId:'red-alert'}).state;
  expect(validateSave({...job,queue:['red-alert']})).toBe(false);
  const conflict={...job,pipeline:true,hardware:{...job.hardware,ram:1},owned:['red-alert','legend-sword'],jobs:[job.jobs[0],{...job.jobs[0],gameId:'legend-sword'}]};
  expect(validateSave(conflict)).toBe(false);
  const allTierOne=['red-alert','legend-sword','need-parking','half-sleep','war-canteen','paladin-homework','car-school','star-internet'];
  expect(validateSave({...createInitialState(),owned:allTierOne,installed:allTierOne,collected:allTierOne,installedCount:8})).toBe(false);
 });
});
