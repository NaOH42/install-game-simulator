import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './ui/styles.css';
import { dispatch, tick, getSystemLoad } from './game/engine';
import { GAME_MAP } from './game/catalog';
import { loadGame, saveGame } from './game/persistence';
import type { Action } from './game/types';
import { GameAudio } from './render/audio';
import { getMachineActivity } from './render/machineActivity';

function GameRoot(){
 const [loaded]=useState(loadGame);
 const [state,setState]=useState(loaded.state);
 const [incomeTotals,setIncomeTotals]=useState<Record<string,number>>({});
 const sessionIncome=useRef<Record<string,number>>({});
 const [notice,setNotice]=useState<string|null>(loaded.notice);
 const [focusedJobId,setFocusedJobId]=useState<string|null>(null);
 const current=useRef(state);
 const audio=useRef<GameAudio|null>(null);
 const baseline=useRef(performance.now());
 const savedAt=useRef(performance.now());
 const saveWarning=useRef(false);
 const persist=()=>{if(!saveGame(current.current)&&!saveWarning.current){saveWarning.current=true;setNotice('存档未能写入，请保持网页打开并检查浏览器存储空间。');}};
 const advance=()=>{
  const now=performance.now();const elapsed=Math.max(0,(now-baseline.current)/1000);baseline.current=now;
  if(elapsed<=0)return;
  const incomeThisStep:Record<string,number>={};
  current.current=tick(current.current,elapsed,(gameId,amount)=>{
   incomeThisStep[gameId]=(incomeThisStep[gameId]||0)+amount;
  });
  if(Object.keys(incomeThisStep).length){
   const totals={...sessionIncome.current};
   for(const [gameId,amount] of Object.entries(incomeThisStep))totals[gameId]=(totals[gameId]||0)+amount;
   sessionIncome.current=totals;
   setIncomeTotals(totals);
  }
  setState(current.current);
  if(now-savedAt.current>3000){savedAt.current=now;persist();}
 };
 useEffect(()=>{
  const sound=new GameAudio();audio.current=sound;
  sound.setVisible(!document.hidden);
  const activate=()=>sound.start();
  document.addEventListener('pointerdown',activate);document.addEventListener('keydown',activate);
  const celebrate=(event:Event)=>{const detail=(event as CustomEvent<{gameId?:string;transition?:boolean}>).detail;const gameId=detail?.gameId;if(gameId&&GAME_MAP[gameId]&&!document.hidden){sound.setVisible(true);sound.complete(GAME_MAP[gameId].genre,current.current.settings.reducedMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches,detail?.transition===true);}};
  const endCelebration=()=>sound.endCelebration();
  window.addEventListener('install-celebration-start',celebrate);
  window.addEventListener('install-celebration-end',endCelebration);
  const timer=setInterval(advance,250);
  let hiddenCount=current.current.installedCount;
  const visibility=()=>{
   advance();sound.setVisible(!document.hidden);
   if(document.hidden){hiddenCount=current.current.installedCount;persist();}
   else {const count=current.current.installedCount-hiddenCount;if(count>0)setNotice(`欢迎回来！刚才有 ${count} 款游戏安装完成。`);}
  };
  const pageHide=()=>{advance();persist();};
  const pageShow=(event:PageTransitionEvent)=>{if(event.persisted)baseline.current=performance.now();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pageHide);window.addEventListener('pageshow',pageShow);
  return ()=>{clearInterval(timer);sound.stop();document.removeEventListener('pointerdown',activate);document.removeEventListener('keydown',activate);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pageHide);window.removeEventListener('pageshow',pageShow);window.removeEventListener('install-celebration-start',celebrate);window.removeEventListener('install-celebration-end',endCelebration);};
 },[]);
 useEffect(()=>{const job=state.jobs.find(job=>job.id===focusedJobId);const load=getSystemLoad(state);const genreId=job?.gameId??state.jobs[0]?.gameId??state.running[0];audio.current?.update(state.settings,state.jobs.length>0||state.running.length>0,genreId?GAME_MAP[genreId].genre:'strategy',{cpu:load.cpu.ratio,ram:load.ram.ratio},job?.progress??0,getMachineActivity(state,load));},[state,focusedJobId]);
 const onAction=(action:Action)=>{
  advance();const result=dispatch(current.current,action);
  if(result.error){setNotice(result.error);return;}
  current.current=result.state;setState(result.state);audio.current?.click();persist();
 };
 return <App state={state} incomeTotals={incomeTotals} onAction={onAction} notice={notice} onDismissNotice={()=>setNotice(null)} onInstallFocus={setFocusedJobId}/>;
}
createRoot(document.getElementById('root')!).render(<GameRoot/>);
