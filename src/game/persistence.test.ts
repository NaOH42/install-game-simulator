import { describe, expect, it } from 'vitest';
import { createInitialState, dispatch, tick } from './engine';
import { parseSave, validateSave } from './persistence';

describe('local save contract',()=>{
 it('roundtrips a partially installed task without granting offline progress',()=>{
  const running=tick(dispatch(createInitialState(),{type:'install',gameId:'red-alert'}).state,7.5);
  const restored=parseSave(JSON.stringify(running));
  expect(restored).toEqual(running);
  expect(restored?.jobs[0].stageProgress).toBeGreaterThan(0);
  expect(restored?.playTime).toBe(7.5);
 });
 it('preserves first-install history after uninstall and reload',()=>{
  const finished=tick(dispatch(createInitialState(),{type:'install',gameId:'red-alert'}).state,60);
  const uninstalled=dispatch(finished,{type:'uninstall',gameId:'red-alert'}).state;
  const restored=parseSave(JSON.stringify(uninstalled))!;
  expect(restored.installed).not.toContain('red-alert');
  expect(restored.collected).toContain('red-alert');
  const before=restored.points;
  const reinstalled=tick(dispatch(restored,{type:'install',gameId:'red-alert'}).state,30);
  expect(reinstalled.points).toBeCloseTo(before,6);
  expect(reinstalled.collected).toEqual(['red-alert']);
 });
 it('rejects corrupt or incompatible data before it reaches simulation',()=>{
  expect(parseSave('{broken')).toBeNull();
  expect(validateSave({...createInitialState(),version:2})).toBe(false);
  expect(validateSave({...createInitialState(),points:Infinity})).toBe(false);
  expect(validateSave({...createInitialState(),hardware:{cpu:7}})).toBe(false);
  expect(validateSave({...createInitialState(),installed:['unknown-game']})).toBe(false);
  expect(validateSave({...createInitialState(),owned:['red-alert','red-alert']})).toBe(false);
 });
 it('rejects conflicting queue, reservation, and collection records',()=>{
  const running=dispatch(createInitialState(),{type:'install',gameId:'red-alert'}).state;
  expect(validateSave({...running,queue:['red-alert']})).toBe(false);
  expect(validateSave({...running,collected:['legend-sword']})).toBe(false);
  const conflict={...running,pipeline:true,hardware:{...running.hardware,ram:1},owned:['red-alert','legend-sword'],jobs:[running.jobs[0],{...running.jobs[0],gameId:'legend-sword'}]};
  expect(validateSave(conflict)).toBe(false);
  const allTierOne=['red-alert','legend-sword','need-parking','half-sleep','war-canteen','paladin-homework','car-school','star-internet'];
  expect(validateSave({...createInitialState(),owned:allTierOne,installed:allTierOne,collected:allTierOne,installedCount:8})).toBe(false);
 });
});
