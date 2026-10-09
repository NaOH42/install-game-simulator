import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './ui/styles.css';
import { dispatch, tick, getSystemLoad } from './game/engine';
import { GAME_MAP } from './game/catalog';
import { loadGame, saveGame } from './game/persistence';
import type { Action } from './game/types';
import { GameAudio } from './render/audio';

function GameRoot(){
 const [loaded]=useState(loadGame);
 const [state,setState]=useState(loaded.state);
 const [incomeTotals,setIncomeTotals]=useState<Record<string,number>>({});
 const sessionIncome=useRef<Record<string,number>>({});
 const [notice,setNotice]=useState<string|null>(loaded.notice);
 const current=useRef(state);
 const audio=useRef<GameAudio|null>(null);
 const baseline=useRef(performance.now());
 const savedAt=useRef(performance.now());
 const saveWarning=useRef(false);
 const persist=()=>{if(!saveGame(current.current)&&!saveWarning.current){saveWarning.current=true;setNotice('存档未能写入，请保持网页打开并检查浏览器存储空间。');}};
 const advance=()=>{
  const now=performance.now();const elapsed=Math.max(0,(now-baseline.current)/1000);baseline.current=now;
  if(elapsed<=0)return;
  const previousCount=current.current.installedCount;
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
  if(current.current.installedCount>previousCount&&!document.hidden)audio.current?.complete();
  setState(current.current);
  if(now-savedAt.current>3000){savedAt.current=now;persist();}
 };
 useEffect(()=>{
  const sound=new GameAudio();audio.current=sound;
  const activate=()=>sound.start();
  document.addEventListener('pointerdown',activate,{once:true});document.addEventListener('keydown',activate,{once:true});
  const timer=setInterval(advance,250);
  let hiddenCount=current.current.installedCount;
  const visibility=()=>{
   advance();sound.setVisible(!document.hidden);
   if(document.hidden){hiddenCount=current.current.installedCount;persist();}
   else {const count=current.current.installedCount-hiddenCount;if(count>0){setNotice(`欢迎回来！刚才有 ${count} 款游戏安装完成。`);sound.complete();}}
  };
  const pageHide=()=>{advance();persist();};
  const pageShow=(event:PageTransitionEvent)=>{if(event.persisted)baseline.current=performance.now();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pageHide);window.addEventListener('pageshow',pageShow);
  return ()=>{clearInterval(timer);sound.stop();document.removeEventListener('pointerdown',activate);document.removeEventListener('keydown',activate);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pageHide);window.removeEventListener('pageshow',pageShow);};
 },[]);
 useEffect(()=>{const job=state.jobs[0];const load=getSystemLoad(state);const genreId=job?.gameId??state.running[0];audio.current?.update(state.settings,state.jobs.length>0||state.running.length>0,genreId?GAME_MAP[genreId].genre:'strategy',{cpu:load.cpu.ratio,ram:load.ram.ratio});},[state]);
 const onAction=(action:Action)=>{
  advance();const result=dispatch(current.current,action);
  if(result.error){setNotice(result.error);return;}
  current.current=result.state;setState(result.state);audio.current?.click();persist();
 };
 return <App state={state} incomeTotals={incomeTotals} onAction={onAction} notice={notice} onDismissNotice={()=>setNotice(null)}/>;
}
createRoot(document.getElementById('root')!).render(<GameRoot/>);
