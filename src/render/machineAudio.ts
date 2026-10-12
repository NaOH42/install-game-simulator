import type { MachineActivity } from './machineActivity';

const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const SILENT_ACTIVITY: MachineActivity = { fanLoad: 0, diskActivity: 0, diskIntensity: 0 };
const MAX_SEEK_VOICES = 16;
type Loop = { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode };
type SeekVoice = { source: AudioBufferSourceNode; envelope: GainNode; filter: BiquadFilterNode };

/** Procedural case acoustics: airflow, motor vibration, spindle, and irregular head seeks.
 * No recording, network dependency, worklet, or separate saved settings are needed.
 */
export class MachineAudio {
 private bus: GainNode;
 private loops: Loop[] = [];
 private fan: Loop;
 private rotor: Loop;
 private spindle: Loop;
 private seekBuffers: AudioBuffer[] = [];
 private voices = new Set<SeekVoice>();
 private activity: MachineActivity = SILENT_ACTIVITY;
 private fanInertia = 1.8;
 private stopped = false;

 constructor(private context: BaseAudioContext, output: AudioNode, private random = Math.random) {
  this.bus = context.createGain();
  this.bus.connect(output);
  // Four seconds of non-repeating turbulence with a seam crossfade; motor harmonics
  // sit under it, avoiding the exposed pure beep of the former hard-disk sound.
  this.fan = this.loop(this.buffer(4, (i, rate, noise) => {
   const t = i / rate;
   return noise * (.79 + .13 * Math.sin(t * Math.PI * 2 * 23) + .08 * Math.sin(t * Math.PI * 2 * 31));
  }), 'lowpass', 920);
  this.rotor = this.loop(this.buffer(4, (i, rate, noise) => {
   const t = i / rate;
   return .22 * Math.sin(t * Math.PI * 2 * 96) + .085 * Math.sin(t * Math.PI * 2 * 192)
    + .028 * Math.sin(t * Math.PI * 2 * 288) + noise * .06;
  }), 'lowpass', 450);
  this.spindle = this.loop(this.buffer(4, (i, rate, noise) => {
   const t = i / rate;
   return .17 * Math.sin(t * Math.PI * 2 * 120) + .035 * Math.sin(t * Math.PI * 2 * 240)
    + noise * (.24 + .055 * Math.sin(t * Math.PI * 2 * 47));
  }), 'lowpass', 1150);
  for (let variant = 0; variant < 6; variant++) {
   // The short, damped thud is followed by a rough actuator scrape and a quieter
   // settling tap. Filtered noise keeps these mechanical rather than pitched.
   this.seekBuffers.push(this.buffer(.095 + variant * .012, (i, rate, noise) => {
    const t = i / rate;
    const attack = Math.min(1, t / .0015);
    const click = Math.exp(-t * (120 + variant * 8));
    const scrape = Math.exp(-t * 33) * (.55 + .45 * Math.sin(t * Math.PI * 2 * (71 + variant * 9)) ** 2);
    const settle = t > .027 ? Math.exp(-(t - .027) * 190) : 0;
    return attack * (noise * (.6 * click + .19 * scrape + .14 * settle)
     + Math.sin(t * Math.PI * 2 * (340 + variant * 43)) * .12 * click);
   }, false));
  }
  this.update(SILENT_ACTIVITY);
 }

 private buffer(seconds: number, sample: (i: number, rate: number, noise: number) => number, loop = true) {
  const rate = this.context.sampleRate;
  const dataLength = Math.ceil(seconds * rate);
  const buffer = this.context.createBuffer(1, dataLength, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = sample(i, rate, this.random() * 2 - 1);
  if (loop) {
   const seam = Math.min(Math.floor(rate * .04), data.length / 2);
   for (let i = 0; i < seam; i++) {
    const blend = i / seam;
    const tail = data.length - seam + i;
    data[tail] = data[tail] * (1 - blend) + data[i] * blend;
   }
  } else {
   const fade = Math.min(Math.floor(rate * .012), data.length);
   for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
  }
  return buffer;
 }

 private loop(buffer: AudioBuffer, type: BiquadFilterType, frequency: number): Loop {
  const source = this.context.createBufferSource();
  const filter = this.context.createBiquadFilter();
  const gain = this.context.createGain();
  source.buffer = buffer; source.loop = true; source.loopStart = .04;
  filter.type = type; filter.frequency.value = frequency; filter.Q.value = .45;
  gain.gain.value = 0;
  source.connect(filter); filter.connect(gain); gain.connect(this.bus);
  source.start(this.context.currentTime, .04);
  const loop = { source, filter, gain }; this.loops.push(loop); return loop;
 }

 update(activity: MachineActivity, at = this.context.currentTime) {
  if (this.stopped) return;
  const previous = this.activity;
  this.activity = { fanLoad: clamp(activity.fanLoad), diskActivity: clamp(activity.diskActivity), diskIntensity: clamp(activity.diskIntensity) };
  const { fanLoad, diskActivity } = this.activity;
  // A case fan takes time to spin up and even longer to settle. Load changes never
  // restart the loops, and saturation does not keep making an overloaded PC louder.
  if (fanLoad !== previous.fanLoad) this.fanInertia = fanLoad > previous.fanLoad ? .8 : 1.8;
  const inertia = this.fanInertia;
  const cooling = Math.sqrt(fanLoad);
  this.fan.gain.gain.setTargetAtTime(.01 + cooling * .055, at, inertia);
  this.fan.filter.frequency.setTargetAtTime(680 + fanLoad * 950, at, inertia);
  this.fan.source.playbackRate.setTargetAtTime(.78 + fanLoad * .46, at, inertia);
  this.rotor.gain.gain.setTargetAtTime(.01 + cooling * .025, at, inertia);
  this.rotor.source.playbackRate.setTargetAtTime(.82 + fanLoad * .37, at, inertia);
  this.spindle.gain.gain.setTargetAtTime(.01 + diskActivity * .036, at, .38);
 }

 /** Called independently of musical tempo. Returns the next burst interval in seconds. */
 seek(at = this.context.currentTime): number {
  const { diskActivity, diskIntensity } = this.activity;
  const interval = (1.8 - diskActivity * 1.49) * (1 - diskIntensity * .3) * (.82 + this.random() * .36);
  if (this.stopped || diskActivity <= .015) return 1.8;
  const count = 1 + Math.floor(diskActivity * 2 + diskIntensity * 2 + this.random());
  let delay = 0;
  for (let i = 0; i < count && this.voices.size < MAX_SEEK_VOICES; i++) {
   const source = this.context.createBufferSource();
   const envelope = this.context.createGain();
   const filter = this.context.createBiquadFilter();
   source.buffer = this.seekBuffers[Math.floor(this.random() * this.seekBuffers.length)];
   source.playbackRate.value = .82 + this.random() * .4;
   filter.type = 'lowpass'; filter.frequency.value = 1900 + this.random() * 900; filter.Q.value = .4;
   // More writes create denser groups, with almost the same level per movement.
   envelope.gain.value = (.055 + diskActivity * .085) * (.78 + this.random() * .22);
   source.connect(filter); filter.connect(envelope); envelope.connect(this.bus);
   const voice = { source, envelope, filter }; this.voices.add(voice);
   source.onended = () => { this.voices.delete(voice); source.disconnect(); filter.disconnect(); envelope.disconnect(); };
   source.start(at + delay); source.stop(at + delay + .22);
   delay += .028 + this.random() * .035;
  }
  return Math.max(.16, interval);
 }

 /** Background/mute clears queued seeks so foreground return never replays a backlog. */
 clearSeeks() {
  for (const { source, envelope, filter } of this.voices) {
   source.onended = null;
   try { source.stop(); } catch { /* A naturally ended buffer may already be stopped. */ }
   source.disconnect(); envelope.disconnect(); filter.disconnect();
  }
  this.voices.clear();
 }

 stop() {
  if (this.stopped) return;
  this.stopped = true; this.clearSeeks();
  for (const { source, gain, filter } of this.loops) { source.stop(); source.disconnect(); gain.disconnect(); filter.disconnect(); }
  this.loops = []; this.seekBuffers = []; this.bus.disconnect();
 }
}
