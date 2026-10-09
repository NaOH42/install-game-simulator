import type { Genre, SaveGame } from '../game/types';

/** Small original tracker-like score and synthesized machine sounds; no downloaded audio. */
export class GameAudio {
 private context:AudioContext|null=null;
 private music:GainNode|null=null;
 private effects:GainNode|null=null;
 private fan:GainNode|null=null;
 private beat=0;
 private timer:ReturnType<typeof setInterval>|null=null;
 private genre:Genre='strategy';
 private settings:SaveGame['settings']={music:.2,effects:.35,reducedMotion:false};
 private busy=false;
 private visible=true;
 start=()=>{
  if(this.context){void this.context.resume();return;}
  const context=new AudioContext();this.context=context;
  this.music=context.createGain();this.music.connect(context.destination);
  this.effects=context.createGain();this.effects.connect(context.destination);
  this.fan=context.createGain();this.fan.connect(this.effects);this.fan.gain.value=.006;
  const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
  const data=buffer.getChannelData(0);let last=0;
  for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.06)/1.025;data[i]=last;}
  const noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;
  const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=360;
  noise.connect(filter);filter.connect(this.fan);noise.start();
  this.apply();this.timer=setInterval(()=>this.step(),310);
 };
 update(settings:SaveGame['settings'],busy:boolean,genre:Genre){this.settings=settings;this.busy=busy;this.genre=genre;this.apply();}
 setVisible(visible:boolean){this.visible=visible;this.apply();}
 private apply(){if(!this.context)return;const t=this.context.currentTime;this.music?.gain.setTargetAtTime(this.visible?this.settings.music*.055:0,t,.15);this.effects?.gain.setTargetAtTime(this.visible?this.settings.effects*.3:0,t,.1);this.fan?.gain.setTargetAtTime(this.busy?.035:.009,t,.1);}
 private tone(freq:number,duration:number,gain:number,target:GainNode,type:OscillatorType='sine',delay=0){
  const c=this.context;if(!c)return;const at=c.currentTime+delay;
  const oscillator=c.createOscillator();const envelope=c.createGain();
  oscillator.type=type;oscillator.frequency.value=freq;envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(gain,at+.008);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);
  oscillator.connect(envelope);envelope.connect(target);oscillator.start(at);oscillator.stop(at+duration+.02);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
 }
 private step(){
  if(!this.context||!this.music||!this.effects||!this.visible)return;
  const themes:Record<Genre,number[]>={strategy:[0,7,12,7,3,10,15,10,5,12,17,12,3,10,7,3],wuxia:[0,2,7,9,12,9,7,2,0,7,9,14,12,9,7,2],racing:[0,12,7,12,3,15,10,15,5,17,12,17,7,19,14,19],scifi:[0,7,14,19,12,7,3,10,17,22,15,10,5,12,7,2]};
  const note=themes[this.genre][this.beat%16];
  if(this.busy){this.tone(196*2**(note/12),.6,.24,this.music,'triangle');if(this.beat%4===0)this.tone(98*2**(Math.floor(this.beat/4)%4/12),1.1,.18,this.music);if(this.beat%3===0)this.tone(130+Math.random()*120,.026,.08,this.effects,'triangle');}
  this.beat++;
 }
 complete(){
  if(!this.effects)return;
  // A small drum-like impact, climbing chimes, then a warm major chord.
  this.tone(130.81,.28,.3,this.effects,'sine');
  [523.25,659.25,783.99,1046.5,1318.51].forEach((note,index)=>{
   this.tone(note,.55,.2,this.effects!,'sine',index*.075);
   this.tone(note/2,.28,.065,this.effects!,'triangle',index*.075);
  });
  [523.25,659.25,783.99,1046.5].forEach(note=>this.tone(note,1.2,.085,this.effects!,'sine',.4));
  [1567.98,2093].forEach((note,index)=>this.tone(note,.32,.08,this.effects!,'sine',.66+index*.1));
 }
 click(){if(this.effects)this.tone(800,.035,.035,this.effects,'triangle');}
 stop(){if(this.timer)clearInterval(this.timer);void this.context?.close();}
}
