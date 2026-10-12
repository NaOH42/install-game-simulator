import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './audio';
import { audioProfile } from './audioProfile';
import { REDUCED_TRANSITION_IMPACT_MS, TRANSITION_IMPACT_MS } from './completionTransitionTiming';

class FakeParam {
 value=1;
 setValueAtTime=vi.fn((value:number,_time:number)=>{this.value=value;});
 setTargetAtTime=vi.fn((value:number,_time:number,_constant:number)=>{this.value=value;});
 linearRampToValueAtTime=vi.fn((value:number,_time:number)=>{this.value=value;});
 exponentialRampToValueAtTime=vi.fn((value:number,_time:number)=>{this.value=value;});
 cancelScheduledValues=vi.fn();
}
class FakeNode {
 connections:FakeNode[]=[];
 connect=(target:FakeNode)=>{this.connections.push(target);};
 disconnect=vi.fn();
}
class FakeGain extends FakeNode { gain=new FakeParam(); }
class FakeFilter extends FakeNode { frequency=new FakeParam();Q=new FakeParam();type='lowpass'; }
class FakeCompressor extends FakeNode { threshold=new FakeParam();knee=new FakeParam();ratio=new FakeParam();attack=new FakeParam();release=new FakeParam(); }
class FakeSource extends FakeNode {
 onended:(()=>void)|null=null;
 ended=false;
 loop=false;
 buffer:unknown=null;
 playbackRate=new FakeParam();
 startedAt:number|null=null;
 endsAt:number|null=null;
 private endTimer:ReturnType<typeof setTimeout>|null=null;
 constructor(private context:FakeContext){super();}
 start=vi.fn((time=this.context.currentTime)=>{this.startedAt=time;});
 stop=vi.fn((time=this.context.currentTime)=>{
  if(this.endTimer!==null){clearTimeout(this.endTimer);this.endTimer=null;}
  this.endsAt=time;
  if(time<=this.context.currentTime){this.ended=true;this.onended?.();return;}
  this.reschedule();
 });
 reschedule(){
  if(this.endTimer!==null){clearTimeout(this.endTimer);this.endTimer=null;}
  if(this.ended||this.endsAt===null||this.context.state!=='running')return;
  this.endTimer=setTimeout(()=>{this.ended=true;this.onended?.();},Math.max(0,this.endsAt-this.context.currentTime)*1000);
 }
}
class FakeOscillator extends FakeSource { type='sine';frequency=new FakeParam(); }
class FakeContext {
 static instances:FakeContext[]=[];
 state:AudioContextState='suspended';
 sampleRate=8000;
 destination=new FakeNode();
 onstatechange:(()=>void)|null=null;
 gains:FakeGain[]=[];
 sources:FakeSource[]=[];
 oscillators:FakeOscillator[]=[];
 compressors:FakeCompressor[]=[];
 private offset=0;
 private resumedAt=0;
 get currentTime(){return this.offset+(this.state==='running'?(Date.now()-this.resumedAt)/1000:0);}
 constructor(){FakeContext.instances.push(this);}
 createGain=()=>{const gain=new FakeGain();this.gains.push(gain);return gain;};
 createBiquadFilter=()=>new FakeFilter();
 createDynamicsCompressor=()=>{const node=new FakeCompressor();this.compressors.push(node);return node;};
 createBuffer=(_channels:number,length:number)=>({getChannelData:()=>new Float32Array(length)});
 createBufferSource=()=>{const source=new FakeSource(this);this.sources.push(source);return source;};
 createOscillator=()=>{const source=new FakeOscillator(this);this.sources.push(source);this.oscillators.push(source);return source;};
 resume=vi.fn(async()=>{this.resumedAt=Date.now();this.state='running';for(const source of this.sources)source.reschedule();this.onstatechange?.();});
 suspend=vi.fn(async()=>{this.offset=this.currentTime;this.state='suspended';for(const source of this.sources)source.reschedule();this.onstatechange?.();});
 close=vi.fn(async()=>{this.offset=this.currentTime;this.state='closed';for(const source of this.sources)source.reschedule();this.onstatechange?.();});
}

const sounds:GameAudio[]=[];
const settings={music:1,effects:0,reducedMotion:false};
const pressure={cpu:0,ram:0};
function openSound(progress=0,options=settings,busy=true){
 const sound=new GameAudio();sounds.push(sound);
 sound.update(options,busy,'strategy',pressure,progress);sound.start();
 return {sound,context:FakeContext.instances.at(-1)!};
}
const melodyCount=(context:FakeContext)=>context.oscillators.filter(source=>source.type==='triangle'&&source.frequency.value>=196).length;

beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(0);FakeContext.instances=[];vi.stubGlobal('AudioContext',FakeContext);});
afterEach(()=>{for(const sound of sounds)sound.stop();sounds.length=0;vi.useRealTimers();vi.unstubAllGlobals();});

describe('progress-driven game audio',()=>{
 it('raises mobile output and returns to desktop gain without changing sliders or creating another context',()=>{
  let compact=true;const sound=new GameAudio(()=>audioProfile(compact));sounds.push(sound);
  sound.update({music:1,effects:1,reducedMotion:false},true,'strategy');sound.start();
  const context=FakeContext.instances.at(-1)!;
  expect(context.gains[0].gain.value).toBe(.55);expect(context.gains[2].gain.value).toBe(.75);
  compact=false;sound.update({music:1,effects:1,reducedMotion:false},true,'strategy');
  expect(context.gains[0].gain.value).toBe(.33);expect(context.gains[2].gain.value).toBe(.3);
  expect(FakeContext.instances).toHaveLength(1);
  sound.update({music:0,effects:0,reducedMotion:false},true,'strategy');
  expect(context.gains[0].gain.value).toBe(0);expect(context.gains[2].gain.value).toBe(0);
 });
 it('keeps the raised music audible at final progress and applies the slider across its full range',()=>{
  const sound=new GameAudio(()=>audioProfile(true));sounds.push(sound);
  sound.update({music:1,effects:.25,reducedMotion:false},true,'wuxia',pressure,1);sound.start();
  const context=FakeContext.instances.at(-1)!;
  const full=context.gains[0].gain.value;
  expect(full).toBeCloseTo(.55/1.55);
  sound.update({music:.5,effects:.25,reducedMotion:false},true,'wuxia',pressure,1);
  expect(context.gains[0].gain.value).toBeCloseTo(full/2);
  sound.update({music:0,effects:.25,reducedMotion:false},true,'wuxia',pressure,1);
  expect(context.gains[0].gain.value).toBe(0);
 });
 it('routes music and all effects through one limiter and disconnects it on stop',()=>{
  const {sound,context}=openSound();const limiter=context.compressors[0];
  expect(context.gains[1].connections).toEqual([limiter]);expect(context.gains[2].connections).toEqual([limiter]);
  expect(limiter.connections).toEqual([context.destination]);expect(limiter.threshold.value).toBe(-1);
  sound.stop();expect(limiter.disconnect).toHaveBeenCalledOnce();
 });
 it('accelerates the actual melody scheduler and adds percussion without raising the music bus',()=>{
  const early=openSound(0);
  vi.advanceTimersByTime(1000);
  expect(melodyCount(early.context)).toBe(3);
  const earlyBusGain=early.context.gains[0].gain.value;
  early.sound.stop();
  const finish=openSound(.97);
  vi.advanceTimersByTime(1000);
  expect(melodyCount(finish.context)).toBeGreaterThanOrEqual(8);
  expect(finish.context.sources.filter(source=>!(source instanceof FakeOscillator)&&!source.loop).length).toBeGreaterThan(0);
  expect(finish.context.gains[0].gain.value).toBeLessThan(earlyBusGain);
  const notesBefore=melodyCount(finish.context);
  finish.sound.update(settings,true,'strategy');
  vi.advanceTimersByTime(1100);
  expect(melodyCount(finish.context)-notesBefore).toBeLessThanOrEqual(4);
 });

 it('keeps a single scheduler when settings and resume gestures repeat',()=>{
  const {sound,context}=openSound();
  for(let i=0;i<5;i++){sound.start();sound.update(settings,true,'strategy',pressure,0);}
  vi.advanceTimersByTime(1000);
  expect(melodyCount(context)).toBe(3);
  expect(context.resume).toHaveBeenCalledTimes(1);
 });

 it('does not schedule muted music, effects, clicks, or completion stings',()=>{
  const {sound,context}=openSound(.99,{...settings,music:0,effects:0});
  sound.complete();sound.click();vi.advanceTimersByTime(2000);
  expect(context.oscillators).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
  expect(context.gains[0].gain.value).toBe(0);
  expect(context.gains[2].gain.value).toBe(0);
  sound.update({...settings,music:0,effects:1},true,'strategy',pressure,.99);
  sound.complete('wuxia');
  expect(context.oscillators.length).toBeGreaterThan(0);
  expect(context.gains[0].gain.value).toBe(0);
 });

 it('stops scheduling in the background while pausing the current pixel celebration cue',()=>{
  const {sound,context}=openSound(.98,{...settings,effects:1});
  vi.advanceTimersByTime(500);sound.complete();
  sound.setVisible(false);
  const count=context.sources.length;
  const paused=context.sources.filter(source=>!source.loop&&!source.ended);
  expect(paused.length).toBeGreaterThan(0);
  vi.advanceTimersByTime(5000);
  expect(context.sources).toHaveLength(count);
  expect(paused.every(source=>!source.ended)).toBe(true);
  expect(context.currentTime).toBe(.5);
  expect(context.state).toBe('suspended');
  expect(vi.getTimerCount()).toBe(0);
  sound.setVisible(true);vi.advanceTimersByTime(120);
  expect(context.sources.length).toBeGreaterThan(count);
  expect(context.state).toBe('running');
  expect(context.resume).toHaveBeenCalledTimes(2);
 });

 it('ducks music independently of settings updates and resolves to the requested genre',()=>{
  const {sound,context}=openSound(1,{...settings,effects:1});
  sound.complete('wuxia');
  const duck=context.gains[1].gain;
  expect(duck.linearRampToValueAtTime).toHaveBeenCalledWith(.14,.025);
  expect(duck.setTargetAtTime).toHaveBeenCalledWith(1,4.4,.08);
  expect(context.oscillators.some(source=>source.frequency.value===293.66)).toBe(true);
  expect(context.oscillators.find(source=>source.frequency.value===293.66&&source.type==='triangle')?.startedAt).toBe(1.1);
  const ramps=duck.linearRampToValueAtTime.mock.calls.length;
  const cancels=duck.cancelScheduledValues.mock.calls.length;
  sound.update({...settings,effects:1},true,'strategy',pressure,.4);
  expect(duck.linearRampToValueAtTime.mock.calls).toHaveLength(ramps);
  expect(duck.cancelScheduledValues).toHaveBeenCalledTimes(cancels);
 });

 it('plays one pending celebration after context resume, and stop prevents a late resume from restarting audio',async()=>{
  const {sound,context}=openSound(0,{...settings,effects:1},false);
  await context.suspend();
  let release:(()=>void)|undefined;
  context.resume.mockImplementation(()=>new Promise<void>(resolve=>{release=()=>{context.state='running';context.onstatechange?.();resolve();};}));
  sound.complete('scifi');
  expect(context.oscillators).toHaveLength(0);
  release!();await Promise.resolve();
  expect(context.oscillators.some(source=>source.frequency.value===220)).toBe(true);
  const played=context.oscillators.length;
  await context.suspend();sound.start();sound.stop();release!();await Promise.resolve();
  vi.advanceTimersByTime(5000);
  expect(context.oscillators).toHaveLength(played);
  expect(context.close).toHaveBeenCalledTimes(1);
  expect(context.sources.every(source=>source.ended&&source.disconnect.mock.calls.length>0)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
 });

 it('replaces rapid celebration requests instead of stacking their notes',()=>{
  const {sound,context}=openSound(0,{...settings,effects:1},false);
  sound.complete();const firstCueSize=context.sources.filter(source=>!source.loop&&!source.ended).length;
  for(let i=0;i<100;i++)sound.complete();
  expect(context.sources.filter(source=>!source.loop&&!source.ended)).toHaveLength(firstCueSize);
  vi.advanceTimersByTime(5000);
  expect(context.sources.filter(source=>!source.loop).every(source=>source.ended&&source.disconnect.mock.calls.length>0)).toBe(true);
  const count=context.sources.length;sound.complete();
  expect(context.sources.length).toBeGreaterThan(count);
 });

 it('stops only the old celebration on skip and lets the next celebration start cleanly',()=>{
  const {sound,context}=openSound(0,{...settings,effects:1},false);
  sound.complete('strategy');
  const first=context.sources.filter(source=>!source.loop);
  sound.click();const click=context.sources.at(-1)!;
  sound.endCelebration();
  expect(first.every(source=>source.ended&&source.disconnect.mock.calls.length>0)).toBe(true);
  expect(click.ended).toBe(false);
  expect(context.sources.find(source=>source.loop)?.ended).toBe(false);
  expect(context.gains[1].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1,.08);
  sound.complete('racing');
  const next=context.sources.slice(context.sources.indexOf(click)+1);
  expect(next.length).toBeGreaterThan(0);
  expect(next.every(source=>!source.ended)).toBe(true);
  expect(context.gains[1].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(.14,.025);
 });

 it('compresses the cue and releases the duck within the reduced-motion scene',()=>{
  const {sound,context}=openSound(0,{...settings,effects:1,reducedMotion:true},false);
  sound.complete('strategy');
  expect(context.oscillators.find(source=>source.type==='triangle'&&source.frequency.value===261.63)?.startedAt).toBe(.16);
  const cue=context.sources.filter(source=>!source.loop);
  expect(cue.every(source=>source.endsAt!==null&&source.endsAt<1.4)).toBe(true);
  expect(context.gains[1].gain.setTargetAtTime).toHaveBeenCalledWith(1,1.12,.08);
  vi.advanceTimersByTime(1600);
  expect(cue.every(source=>source.ended)).toBe(true);
 });
});

describe('completion transition audio',()=>{
 const audible={music:0,effects:1,reducedMotion:false};

 it('places the pressure release at the shared impact time and moves every pixel cue and duck by that offset',()=>{
  const {sound,context}=openSound(0,audible,false);
  const before=context.sources.length;sound.complete('wuxia');
  const original=context.sources.slice(before).map(source=>({startedAt:source.startedAt,endsAt:source.endsAt}));
  const next=context.sources.length;sound.complete('wuxia',false,true);
  const transition=context.sources.slice(next);
  const offset=TRANSITION_IMPACT_MS/1000;
  expect(transition).toHaveLength(original.length+2);
  const [air,bass,...pixel]=transition;
  expect(air.loop).toBe(true);expect(air.startedAt).toBe(0);expect(air.endsAt).toBeCloseTo(offset+.4);
  expect(bass.startedAt).toBe(offset);
  pixel.forEach((source,index)=>{
   expect(source.startedAt).toBeCloseTo(original[index].startedAt!+offset);
   expect(source.endsAt).toBeCloseTo(original[index].endsAt!+offset);
  });
  expect(context.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(1,offset+4.4,.08);
  expect(context.gains[4].gain.setTargetAtTime).toHaveBeenLastCalledWith(1,offset+4.4,.3);
 });

 it('keeps reduced-motion pressure release quieter, shorter, and aligned with the gentle scene',()=>{
  const {sound,context}=openSound(0,audible,false);
  const before=context.sources.length;sound.complete('wuxia',true,true);
  const cue=context.sources.slice(before);const [air,bass]=cue;
  const offset=REDUCED_TRANSITION_IMPACT_MS/1000;
  expect(bass.startedAt).toBe(offset);
  const bassEnvelope=bass.connections[0] as FakeGain;
  expect(bassEnvelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(.12,offset+.007);
  expect(air.endsAt).toBeCloseTo(offset+.18);
  expect(cue.every(source=>source.endsAt!==null&&source.endsAt<1.55)).toBe(true);
  expect(context.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(1,offset+1.12,.08);
 });

 it('cancels the upcoming burst on skip without interrupting the continuous case audio',()=>{
  const {sound,context}=openSound(0,audible,false);
  const machine=context.sources.slice();const before=context.sources.length;
  sound.complete('strategy',false,true);const cue=context.sources.slice(before);
  vi.advanceTimersByTime(100);sound.endCelebration();
  expect(cue.every(source=>source.ended&&source.disconnect.mock.calls.length>0)).toBe(true);
  expect(machine.every(source=>!source.ended)).toBe(true);
  const count=context.sources.length;vi.advanceTimersByTime(6000);
  expect(context.sources).toHaveLength(count);expect(vi.getTimerCount()).toBe(0);
 });

 it('pauses the intake and its scheduled burst in the background, then resumes at the same audio time',()=>{
  const {sound,context}=openSound(0,audible,false);
  const before=context.sources.length;sound.complete('scifi',false,true);
  const cue=context.sources.slice(before);
  vi.advanceTimersByTime(90);sound.setVisible(false);vi.advanceTimersByTime(8000);
  expect(context.currentTime).toBe(.09);expect(cue.every(source=>!source.ended)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  sound.setVisible(true);vi.advanceTimersByTime(5100);
  expect(cue.every(source=>source.ended)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
 });

 it('clears queued burst voices when effects are muted and never replays them when unmuted',()=>{
  const {sound,context}=openSound(0,audible,false);
  const before=context.sources.length;sound.complete('racing',false,true);
  const cue=context.sources.slice(before);
  vi.advanceTimersByTime(80);sound.update({...audible,effects:0},false,'racing');
  expect(cue.every(source=>source.ended&&source.disconnect.mock.calls.length>0)).toBe(true);
  const count=context.sources.length;
  sound.complete('racing',false,true);vi.advanceTimersByTime(1000);
  sound.update(audible,false,'racing');vi.advanceTimersByTime(6000);
  expect(context.sources).toHaveLength(count);expect(vi.getTimerCount()).toBe(0);
 });

 it('retains transition timing for a browser-delayed resume and can cancel a pending request',async()=>{
  const {sound,context}=openSound(0,audible,false);
  await context.suspend();
  let release:(()=>void)|undefined;
  context.resume.mockImplementation(()=>new Promise<void>(resolve=>{release=()=>{context.state='running';context.onstatechange?.();resolve();};}));
  const before=context.sources.length;sound.complete('wuxia',false,true);
  release!();await Promise.resolve();
  const cue=context.sources.slice(before);
  expect(cue[1].startedAt).toBe(TRANSITION_IMPACT_MS/1000);
  await context.suspend();sound.complete('wuxia',false,true);sound.endCelebration();
  const count=context.sources.length;release!();await Promise.resolve();
  expect(context.sources).toHaveLength(count);
  expect(cue.every(source=>source.ended)).toBe(true);
 });
});

describe('load-driven case audio',()=>{
 const effectsOnly={music:0,effects:.25,reducedMotion:false};
 const idle={fanLoad:0,diskActivity:0,diskIntensity:0};
 const full={fanLoad:1,diskActivity:1,diskIntensity:1};
 const seeks=(context:FakeContext)=>context.sources.filter(source=>!(source instanceof FakeOscillator)&&!source.loop);

 it('plays irregular disk activity independently of muted music, and does not add pitched disk beeps',()=>{
  const {sound,context}=openSound(0,effectsOnly,false);
  sound.update(effectsOnly,true,'wuxia',pressure,.99,full);
  vi.advanceTimersByTime(1200);
  expect(seeks(context).length).toBeGreaterThan(8);
  expect(context.oscillators).toHaveLength(0);
  expect(context.sources.filter(source=>source.loop)).toHaveLength(3);
  sound.update(effectsOnly,false,'wuxia',pressure,0,idle);
  const count=seeks(context).length;
  vi.advanceTimersByTime(2000);
  expect(seeks(context)).toHaveLength(count);
  expect(seeks(context).every(source=>source.ended)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
 });

 it('increases seek density near completion without restarting continuous motors or piling up schedulers',()=>{
  vi.spyOn(Math,'random').mockReturnValue(.5);
  const {sound,context}=openSound(0,effectsOnly,false);
  sound.update(effectsOnly,true,'strategy',pressure,.8,{...full,diskIntensity:0});
  vi.advanceTimersByTime(2000);
  const earlyCount=seeks(context).length;
  const loops=context.sources.filter(source=>source.loop);
  sound.update(effectsOnly,true,'strategy',pressure,.99,full);
  for(let i=0;i<20;i++){sound.start();sound.update(effectsOnly,true,'strategy',pressure,.99,full);}
  vi.advanceTimersByTime(2000);
  const lateCount=seeks(context).length-earlyCount;
  expect(lateCount).toBeGreaterThan(earlyCount);
  expect(lateCount).toBeLessThan(60);
  expect(context.sources.filter(source=>source.loop)).toEqual(loops);
  expect(seeks(context).filter(source=>!source.ended).length).toBeLessThanOrEqual(16);
  vi.restoreAllMocks();
 });

 it('clears all pending seeks when muted or hidden and resumes without a delayed burst',()=>{
  const {sound,context}=openSound(0,effectsOnly,false);
  sound.update(effectsOnly,true,'strategy',pressure,.99,full);
  vi.advanceTimersByTime(100);
  expect(seeks(context).some(source=>!source.ended)).toBe(true);
  sound.update({...effectsOnly,effects:0},true,'strategy',pressure,.99,full);
  expect(seeks(context).every(source=>source.ended)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  const before=seeks(context).length;
  vi.advanceTimersByTime(2000);
  expect(seeks(context)).toHaveLength(before);
  sound.update(effectsOnly,true,'strategy',pressure,.99,full);
  sound.setVisible(false);vi.advanceTimersByTime(6000);
  expect(vi.getTimerCount()).toBe(0);
  expect(seeks(context)).toHaveLength(before);
  sound.setVisible(true);vi.advanceTimersByTime(100);
  expect(seeks(context).length-before).toBeGreaterThan(0);
  expect(seeks(context).length-before).toBeLessThanOrEqual(5);
  sound.stop();vi.advanceTimersByTime(6000);
  expect(context.sources.every(source=>source.ended)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
 });

 it('gives the completion cue room in the mix and preserves the duck across state updates',()=>{
  const {sound,context}=openSound(0,effectsOnly,false);
  sound.update(effectsOnly,true,'strategy',pressure,.99,full);
  sound.complete();
  const duck=context.gains.find(gain=>gain.gain.linearRampToValueAtTime.mock.calls.some(([value])=>value===.38))!.gain;
  expect(duck.setTargetAtTime).toHaveBeenCalledWith(1,4.4,.3);
  const cancels=duck.cancelScheduledValues.mock.calls.length;
  sound.update(effectsOnly,true,'strategy',pressure,.99,full);
  expect(duck.cancelScheduledValues).toHaveBeenCalledTimes(cancels);
  sound.endCelebration();
  expect(duck.setTargetAtTime).toHaveBeenLastCalledWith(1,0,.3);
 });
});
