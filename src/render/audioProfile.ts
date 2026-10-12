import type { SaveGame } from '../game/types';

/** Presentation-only gain; saved sliders remain in the original 0–1 range. */
export function audioProfile(compact: boolean) {
 return compact
  ? { musicGain: .55, effectsGain: .75 }
  : { musicGain: .33, effectsGain: .3 };
}

export function initialAudioSettings(compact: boolean): SaveGame['settings'] {
 return { music: compact ? .6 : .18, effects: compact ? .65 : .25, reducedMotion: false };
}
