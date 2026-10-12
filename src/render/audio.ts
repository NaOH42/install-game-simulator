import type { Genre, SaveGame } from '../game/types';
import { getInstallIntensity } from './installIntensity';
import { REDUCED_TRANSITION_IMPACT_MS, TRANSITION_IMPACT_MS } from './completionTransitionTiming';
import { MachineAudio } from './machineAudio';
import type { MachineActivity } from './machineActivity';
import { audioProfile } from './audioProfile';

const THEMES:Record<Genre,number[]>={strategy:[0,7,12,7,3,10,15,10,5,12,17,12,3,10,7,3],wuxia:[0,2,7,9,12,9,7,2,0,7,9,14,12,9,7,2],racing:[0,12,7,12,3,15,10,15,5,17,12,17,7,19,14,19],scifi:[0,7,14,19,12,7,3,10,17,22,15,10,5,12,7,2]};
const volume=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const MAX_VOICES=48;
interface Voice { source:AudioScheduledSourceNode; nodes:AudioNode[]; target:GainNode; }

/** Original tracker score and synthesized machine sounds; no downloaded audio. */
export class GameAudio {
 private context:AudioContext|null=null;
 private music:GainNode|null=null;
 private musicDuck:GainNode|null=null;
 private effects:GainNode|null=null;
 private celebration:GainNode|null=null;
 private machine:MachineAudio|null=null;
 private machineDuck:GainNode|null=null;
 private limiter:DynamicsCompressorNode|null=null;
 private machineActivity:MachineActivity={fanLoad:0,diskActivity:0,diskIntensity:0};
 private machineTimer:ReturnType<typeof setTimeout>|null=null;
 private percussion:AudioBuffer|null=null;
 private voices=new Set<Voice>();
 private beat=0;
 private timer:ReturnType<typeof setTimeout>|null=null;
 private genre:Genre='strategy';
 private settings:SaveGame['settings']={music:.2,effects:.35,reducedMotion:false};
 private busy=false;
 private intensity=0;
 private pendingCompletion:{genre:Genre;reducedMotion:boolean;withTransition:boolean}|null=null;
 private visible=true;

 constructor(private readonly profile=()=>audioProfile(false)){}

 start=()=>{
  if(!this.visible)return;
  if(!this.context){
   const context=new AudioContext();this.context=context;
   this.limiter=context.createDynamicsCompressor();
   this.limiter.threshold.value=-1;this.limiter.knee.value=2;this.limiter.ratio.value=20;
   this.limiter.attack.value=.003;this.limiter.release.value=.12;
   this.limiter.connect(context.destination);
   this.music=context.createGain();this.musicDuck=context.createGain();
   this.music.connect(this.musicDuck);this.musicDuck.connect(this.limiter);
   this.effects=context.createGain();this.effects.connect(this.limiter);
   this.celebration=context.createGain();this.celebration.connect(this.effects);
   this.music.gain.value=0;this.effects.gain.value=0;
   this.machineDuck=context.createGain();this.machineDuck.connect(this.effects);
   this.machine=new MachineAudio(context,this.machineDuck);
   this.percussion=context.createBuffer(1,Math.ceil(context.sampleRate*.2),context.sampleRate);
   const noise=this.percussion.getChannelData(0);
   for(let i=0;i<noise.length;i++)noise[i]=Math.random()*2-1;
   context.onstatechange=()=>{if(this.context===context)this.syncPlayback();};
  }
  this.apply();
  this.resume();
 };

 update(settings:SaveGame['settings'],busy:boolean,genre:Genre,pressure={cpu:0,ram:0},progress=0,machine?:MachineActivity){
  this.settings={...settings,music:volume(settings.music),effects:volume(settings.effects)};
  this.busy=busy;this.genre=genre;
  this.machineActivity=machine??{fanLoad:volume(pressure.cpu),diskActivity:busy?.18:0,diskIntensity:0};
  this.intensity=getInstallIntensity(progress);
  this.apply();this.syncPlayback();
 }

 setVisible(visible:boolean){
  if(this.visible===visible)return;
  this.visible=visible;
  if(!visible){
   this.clearTimer();this.clearMachineTimer();this.machine?.clearSeeks();this.clearVoices(undefined,true);
   // The pixel scene also pauses. Context time freezes its already-scheduled cue and duck.
   this.apply();
   if(this.context&&this.context.state!=='closed')void this.context.suspend().catch(()=>{});
  }else{this.apply();this.resume();}
 }

 private resume(){
  const context=this.context;if(!context||!this.visible)return;
  if(context.state==='running'){this.syncPlayback();return;}
  if(context.state==='closed')return;
  // A later pointer/keyboard gesture can retry a browser-blocked resume.
  void context.resume().then(()=>{if(this.context===context)this.syncPlayback();}).catch(()=>{});
 }

 private apply(){
  if(!this.context)return;const t=this.context.currentTime;
  const profile=this.profile();
  // Faster notes have shorter tails and a quieter bus, rather than ever-growing loudness.
  this.music?.gain.setTargetAtTime(this.visible?this.settings.music*profile.musicGain/(1+this.intensity*.55):0,t,.12);
  this.effects?.gain.setTargetAtTime(this.visible?this.settings.effects*profile.effectsGain:0,t,.08);
  this.machine?.update(this.machineActivity);
  if(this.settings.effects<=0){
   this.machine?.clearSeeks();
   if(this.pendingCompletion||[...this.voices].some(voice=>voice.target===this.celebration))this.endCelebration();
  }
 }

 private clearTimer(){if(this.timer!==null){clearTimeout(this.timer);this.timer=null;}}
 private clearMachineTimer(){if(this.machineTimer!==null){clearTimeout(this.machineTimer);this.machineTimer=null;}}
 private syncMachine(){
  if(!this.context||this.context.state!=='running'||!this.visible||this.settings.effects<=0||this.machineActivity.diskActivity<=.015){
   this.clearMachineTimer();this.machine?.clearSeeks();return;
  }
  if(this.machineTimer===null)this.machineTimer=setTimeout(()=>this.machineStep(),80);
 }
 private machineStep(){
  this.machineTimer=null;
  if(!this.context||this.context.state!=='running'||!this.visible||this.settings.effects<=0||this.machineActivity.diskActivity<=.015)return;
  const interval=this.machine?.seek()??1.8;
  this.machineTimer=setTimeout(()=>this.machineStep(),interval*1000);
 }
 private syncPlayback(){
  if(this.visible&&this.context?.state==='running'&&this.pendingCompletion){
   const {genre,reducedMotion,withTransition}=this.pendingCompletion;this.pendingCompletion=null;this.complete(genre,reducedMotion,withTransition);
  }
  this.syncMachine();
  if(!this.context||this.context.state!=='running'||!this.visible||this.settings.music<=0||!this.busy){this.clearTimer();return;}
  if(this.timer===null)this.timer=setTimeout(()=>{
   this.timer=null;this.step();this.syncPlayback();
  },310-202*this.intensity);
 }

 private canPlay(target:GainNode){
  return !!this.context&&this.context.state==='running'&&this.visible&&this.voices.size<MAX_VOICES
   &&(target===this.music?this.settings.music>0:this.settings.effects>0);
 }

 private track(source:AudioScheduledSourceNode,nodes:AudioNode[],target:GainNode){
  const voice={source,nodes,target};this.voices.add(voice);
  source.onended=()=>{this.voices.delete(voice);source.disconnect();for(const node of nodes)node.disconnect();};
 }

 private clearVoices(target?:GainNode,keepCelebration=false){
  for(const voice of this.voices){
   if(target&&voice.target!==target)continue;
   if(keepCelebration&&voice.target===this.celebration)continue;
   const {source,nodes}=voice;
   source.onended=null;try{source.stop();}catch{/* Already stopped by its envelope. */}source.disconnect();for(const node of nodes)node.disconnect();
   this.voices.delete(voice);
  }
 }

 private tone(freq:number,duration:number,gain:number,target:GainNode,type:OscillatorType='sine',delay=0){
  const c=this.context;if(!c||!this.canPlay(target))return;const at=c.currentTime+delay;
  const oscillator=c.createOscillator();const envelope=c.createGain();
  oscillator.type=type;oscillator.frequency.value=freq;
  envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(gain,at+.008);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);
  oscillator.connect(envelope);envelope.connect(target);this.track(oscillator,[envelope],target);
  oscillator.start(at);oscillator.stop(at+duration+.02);
 }

 private drum(target:GainNode,gain:number,delay=0){
  const c=this.context;if(!c||!this.canPlay(target))return;const at=c.currentTime+delay;
  const oscillator=c.createOscillator();const envelope=c.createGain();
  oscillator.frequency.setValueAtTime(145,at);oscillator.frequency.exponentialRampToValueAtTime(47,at+.13);
  envelope.gain.setValueAtTime(gain,at);envelope.gain.exponentialRampToValueAtTime(.0001,at+.22);
  oscillator.connect(envelope);envelope.connect(target);this.track(oscillator,[envelope],target);
  oscillator.start(at);oscillator.stop(at+.24);
 }

 private hiss(target:GainNode,gain:number,duration:number,frequency:number,delay=0){
  const c=this.context;if(!c||!this.percussion||!this.canPlay(target))return;const at=c.currentTime+delay;
  const source=c.createBufferSource();const filter=c.createBiquadFilter();const envelope=c.createGain();
  source.buffer=this.percussion;filter.type='highpass';filter.frequency.value=frequency;
  envelope.gain.setValueAtTime(gain,at);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter);filter.connect(envelope);envelope.connect(target);this.track(source,[filter,envelope],target);
  source.start(at);source.stop(at+duration+.01);
 }

 private transitionBreath(target:GainNode,impact:number,reducedMotion:boolean){
  const c=this.context;if(!c||!this.percussion||!this.canPlay(target))return;const at=c.currentTime;
  // A short, rounded intake turns into an outward air release at the visual impact.
  const air=c.createBufferSource();const filter=c.createBiquadFilter();const envelope=c.createGain();
  air.buffer=this.percussion;air.loop=true;filter.type='bandpass';filter.Q.value=.65;
  filter.frequency.setValueAtTime(420,at);filter.frequency.exponentialRampToValueAtTime(1350,at+impact);
  filter.frequency.exponentialRampToValueAtTime(280,at+impact+.25);
  envelope.gain.setValueAtTime(.0001,at);
  envelope.gain.exponentialRampToValueAtTime(reducedMotion?.026:.075,at+impact-.018);
  envelope.gain.linearRampToValueAtTime(.0001,at+impact-.004);
  envelope.gain.linearRampToValueAtTime(reducedMotion?.035:.14,at+impact+.012);
  envelope.gain.exponentialRampToValueAtTime(.0001,at+impact+(reducedMotion?.16:.38));
  air.connect(filter);filter.connect(envelope);envelope.connect(target);this.track(air,[filter,envelope],target);
  air.start(at);air.stop(at+impact+(reducedMotion?.18:.4));
  if(!this.canPlay(target))return;
  const bass=c.createOscillator();const bassEnvelope=c.createGain();
  bass.type='sine';bass.frequency.setValueAtTime(reducedMotion?90:116,at+impact);
  bass.frequency.exponentialRampToValueAtTime(46,at+impact+.2);
  bassEnvelope.gain.setValueAtTime(.0001,at+impact);
  bassEnvelope.gain.linearRampToValueAtTime(reducedMotion?.12:.46,at+impact+.007);
  bassEnvelope.gain.exponentialRampToValueAtTime(.0001,at+impact+(reducedMotion?.18:.44));
  bass.connect(bassEnvelope);bassEnvelope.connect(target);this.track(bass,[bassEnvelope],target);
  bass.start(at+impact);bass.stop(at+impact+(reducedMotion?.2:.46));
 }

 private step(){
  if(!this.context||this.context.state!=='running'||!this.music||!this.effects||!this.visible)return;
  const note=THEMES[this.genre][this.beat%16];const strength=this.intensity;
  const interval=.31-.202*strength;
  if(this.busy){
   this.tone(196*2**(note/12),interval*1.9,.24,this.music,'triangle');
   if(this.beat%4===0)this.tone(98*2**(Math.floor(this.beat/4)%4/12),interval*3.3,.18,this.music);
   if(strength>.08){
    if(this.beat%2===0)this.drum(this.music,.28*strength);
    else this.hiss(this.music,.06*strength,.08,1700);
   }
   if(strength>.45){
    this.tone(784*2**([0,7,12,19][this.beat%4]/12),interval*.8,.13*strength,this.music,'sine');
    this.hiss(this.music,.055*strength,.025,6500,interval*.5);
   }
  }
  this.beat++;
 }

 complete(genre:Genre=this.genre,reducedMotion=this.settings.reducedMotion,withTransition=false){
  this.endCelebration();
  if(!this.context||!this.celebration||!this.visible||this.settings.effects<=0)return;
  if(this.context.state==='suspended'){
   this.pendingCompletion={genre,reducedMotion,withTransition};this.resume();return;
  }
  if(!this.canPlay(this.celebration))return;
  const at=this.context.currentTime;
  const offset=withTransition?(reducedMotion?REDUCED_TRANSITION_IMPACT_MS:TRANSITION_IMPACT_MS)/1000:0;
  const strike=offset+(reducedMotion ? .16 : 1.1);
  if(this.musicDuck){
   const gain=this.musicDuck.gain;gain.cancelScheduledValues(at);gain.setValueAtTime(gain.value,at);
   gain.linearRampToValueAtTime(.14,at+.025);gain.setTargetAtTime(1,at+offset+(reducedMotion?1.12:4.4),.08);
  }
  if(this.machineDuck){
   const gain=this.machineDuck.gain;gain.cancelScheduledValues(at);gain.setValueAtTime(gain.value,at);
   gain.linearRampToValueAtTime(.38,at+.06);gain.setTargetAtTime(1,at+offset+(reducedMotion?1.12:4.4),.3);
  }
  const root:Record<Genre,number>={strategy:261.63,wuxia:293.66,racing:329.63,scifi:220};
  const tonic=root[genre];
  const target=this.celebration;
  if(withTransition)this.transitionBreath(target,offset,reducedMotion);
  this.tone(tonic*2,.11,.18,target,'triangle',offset);
  if(!reducedMotion)[0,7,12].forEach((note,index)=>this.tone(tonic*2**(note/12),.18,.12,target,'sine',offset+.25+index*.26));
  this.drum(target,.6,strike);this.hiss(target,.15,.16,1100,strike);
  this.tone(tonic/2,reducedMotion ? .45 : .85,.25,target,'sine',strike);
  [0,4,7,12].forEach(note=>this.tone(tonic*2**(note/12),reducedMotion ? .6 : 2.2,.12,target,'triangle',strike));
  [0,4,7,12,16].forEach((note,index)=>this.tone(tonic*2*2**(note/12),reducedMotion ? .3 : .65,.19,target,'sine',strike+index*.065));
  [7,12].forEach((note,index)=>this.tone(tonic*4*2**(note/12),reducedMotion ? .22 : .5,.075,target,'sine',offset+(reducedMotion ? .8 : 3.4)+index*(reducedMotion ? .1 : .3)));
 }

 endCelebration(){
  this.pendingCompletion=null;
  if(this.celebration)this.clearVoices(this.celebration);
  if(this.musicDuck&&this.context){
   const gain=this.musicDuck.gain;const at=this.context.currentTime;
   gain.cancelScheduledValues(at);gain.setValueAtTime(gain.value,at);gain.linearRampToValueAtTime(1,at+.08);
  }
  if(this.machineDuck&&this.context){
   const gain=this.machineDuck.gain;const at=this.context.currentTime;
   gain.cancelScheduledValues(at);gain.setValueAtTime(gain.value,at);gain.setTargetAtTime(1,at,.3);
  }
 }

 click(){if(this.effects)this.tone(800,.035,.035,this.effects,'triangle');}

 stop(){
  this.clearTimer();this.clearMachineTimer();this.clearVoices();this.pendingCompletion=null;
  this.machine?.stop();this.machine=null;
  const context=this.context;this.context=null;
  if(context){context.onstatechange=null;if(context.state!=='closed')void context.close().catch(()=>{});}
  this.music?.disconnect();this.musicDuck?.disconnect();this.effects?.disconnect();this.celebration?.disconnect();this.machineDuck?.disconnect();
  this.music=null;this.musicDuck=null;this.effects=null;this.celebration=null;this.machineDuck=null;this.percussion=null;this.beat=0;
  this.limiter?.disconnect();this.limiter=null;
 }
}
