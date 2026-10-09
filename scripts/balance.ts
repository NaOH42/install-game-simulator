import { GAMES, HARDWARE } from '../src/game/catalog';
import { AUTOMATION_COST, PIPELINE_COST, createInitialState, dispatch, diskCapacity, incomePerSecond, installBlockReason, maxJobs, reservedSpace, tick, usedSpace, getSystemLoad, gamePerformance } from '../src/game/engine';
import type { Action, HardwareKey, ResourceKey, SaveGame } from '../src/game/types';

const resourceKeys:ResourceKey[]=['cpu','ram','gpu','network'];
const hardwareOrder:HardwareKey[]=['network','cpu','disk','ram','gpu'];
type Milestone={event:string;seconds:number;collected:number;running:number;income:number};
function simulate(managed:boolean){
 let state=createInitialState();
 const milestones:Milestone[]=[];
 const record=(event:string)=>milestones.push({event,seconds:Math.round(state.playTime),collected:state.collected.length,running:state.running.length,income:Number(incomePerSecond(state).toFixed(2))});
 const act=(action:Action)=>{const result=dispatch(state,action);if(result.error)throw new Error(JSON.stringify(action)+': '+result.error);state=result.state;};
 let firstUpgrade=false;
 let managementChanges=0;
 let totalRunInstallOverlap=0;
 const maxSeconds=10800;
 record('开机');
 for(let second=0;second<maxSeconds&&state.collected.length<GAMES.length;second++){
  // A player keeps the most useful earning games running while reserving room for installation.
  const installed=[...state.installed];
  let selected=installed;
  if(managed&&installed.length){
   const budget={cpu:.8,ram:.85,gpu:1,network:.65};
   const idle={...state,running:[],jobs:[]};
   const capacities=getSystemLoad(idle);
   const desirability=(id:string)=>{const p=gamePerformance(idle,id);const cost=Math.max(...resourceKeys.map(key=>p.demand[key]/capacities[key].capacity));return p.baseIncome/Math.max(.01,cost);};
   const ranked=installed.sort((a,b)=>desirability(b)-desirability(a));
   selected=[];
   for(const id of ranked){
    const candidate={...idle,running:[...selected,id]};
    const load=getSystemLoad(candidate);
    if(resourceKeys.every(key=>load[key].ratio<=budget[key])||selected.length===0)selected.push(id);
   }
  }
  for(const id of state.running.filter(id=>!selected.includes(id))){act({type:'stop',gameId:id});managementChanges++;}
  for(const id of selected.filter(id=>!state.running.includes(id)))act({type:'run',gameId:id});

  const next=GAMES.find(game=>!state.collected.includes(game.id)&&!state.jobs.some(job=>job.gameId===game.id)&&!state.queue.includes(game.id));
  if(next){
   const desired=next.tier-1;
   if(!firstUpgrade&&state.collected.length>=2&&state.points>=HARDWARE.cpu[1].price){act({type:'upgrade',key:'cpu',option:1});firstUpgrade=true;record('第一次硬件升级');}
   const nextCapacity=usedSpace(state)+reservedSpace(state)+next.sizeGB;
   const diskFull=nextCapacity>diskCapacity(state)+1e-6;
   const missing=diskFull?'disk':hardwareOrder.find(key=>HARDWARE[key][state.hardware[key]].generation<desired);
   if(missing){
    const current=HARDWARE[missing][state.hardware[missing]];
    let option=Math.min(2,current.generation+1);
    if(missing==='disk'){
     if(diskFull)option=HARDWARE.disk.findIndex(model=>model.capacity>=nextCapacity&&model.capacity>current.capacity);
     if(option<0)option=4;
    }
    const target=HARDWARE[missing][option];
    if(target&&option!==state.hardware[missing]&&state.points>=target.price){act({type:'upgrade',key:missing,option});record(`换装 ${missing} ${target.name}`);}
   }
   if(!missing&&!state.pipeline&&HARDWARE.ram[state.hardware.ram].capacity>=512&&state.points>=PIPELINE_COST+next.price){act({type:'unlockPipeline'});record('解锁流水线');}
   if(!missing&&state.pipeline&&!state.automation&&state.collected.length>=12&&state.points>=AUTOMATION_COST+next.price){act({type:'unlockAutomation'});record('解锁自动队列');}
   if(!missing){
    for(const game of GAMES.filter(game=>game.tier===next.tier)){
     if(state.collected.includes(game.id)||state.jobs.some(job=>job.gameId===game.id)||state.queue.includes(game.id))continue;
     if(state.jobs.length>=maxJobs(state)&&!state.automation)break;
     // Reserve room for queued tasks as well so the policy does not buy an unstartable shelf forever.
     const pendingSpace=state.queue.reduce((sum,id)=>sum+GAMES.find(game=>game.id===id)!.sizeGB,0);
     if(usedSpace(state)+reservedSpace(state)+pendingSpace+game.sizeGB>diskCapacity(state)+1e-6)break;
     if(!state.owned.includes(game.id)){if(state.points<game.price)break;act({type:'buy',gameId:game.id});}
     if(state.automation)act({type:'queue',gameId:game.id});
     else if(!installBlockReason(state,game))act({type:'install',gameId:game.id});
    }
   }
  }
  const previous=state;
  if(state.running.length&&state.jobs.length)totalRunInstallOverlap++;
  state=tick(state,1);
  for(const id of state.collected.filter(id=>!previous.collected.includes(id)))record(`安装 ${GAMES.find(game=>game.id===id)!.title}`);
  if(state.points<-.000001||usedSpace(state)+reservedSpace(state)>diskCapacity(state)+.000001)throw new Error('Economic/capacity invariant failed');
 }
 return {state,milestones,managementChanges,totalRunInstallOverlap};
}
const managed=simulate(true);
const allRunning=simulate(false);
const final=createInitialState();final.hardware={cpu:2,ram:2,disk:2,gpu:2,network:2};
let earlier=dispatch(final,{type:'install',gameId:'red-alert'}).state;
let earlySeconds=0;
while(!earlier.installed.length&&earlySeconds<20){earlier=tick(earlier,.01);earlySeconds+=.01;}
console.table(managed.milestones);
const flagshipSeconds=managed.milestones.find(item=>item.event===`安装 ${GAMES.find(game=>game.id==='crisis-final')!.title}`)!.seconds;
console.log(JSON.stringify({games:GAMES.length,managed:{flagshipSeconds,seconds:Math.round(managed.state.playTime),minutes:Number((managed.state.playTime/60).toFixed(2)),collected:managed.state.collected.length,running:managed.state.running.length,income:incomePerSecond(managed.state),managementChanges:managed.managementChanges,runInstallOverlapSeconds:managed.totalRunInstallOverlap,usedGB:usedSpace(managed.state)},allRunning:{seconds:Math.round(allRunning.state.playTime),minutes:Number((allRunning.state.playTime/60).toFixed(2)),collected:allRunning.state.collected.length,running:allRunning.state.running.length,income:incomePerSecond(allRunning.state)},earliestGameAtFastHardwareSeconds:Number(earlySeconds.toFixed(2))},null,2));
if(managed.state.collected.length!==32||!managed.state.won||!managed.state.automation||earlySeconds>=10||managed.totalRunInstallOverlap<600||flagshipSeconds<2100||flagshipSeconds>2700||managed.state.playTime<2700||managed.state.playTime>3600)throw new Error('Progression/overlap target not met');
