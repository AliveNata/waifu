/**
 * The office's sound effects, made on the spot with WebAudio instead of shipped as recordings:
 * keys, the sliding door, the coffee machine, the ping-pong ball, Mochi, the standup gong, and the
 * chime when someone is waiting for the user.
 * Each sound plays from where it happens, quieter with distance from the listener (the camera, or
 * Alyx's eyes in first person) and panned to the side it is on. Off until switched on; while off
 * no AudioContext exists at all.
 */

import { defaultSoundSettings, normalizeSoundSettings, type OfficeSoundSettings } from "../../shared/sound-settings.js";

export type SoundCue =
  | "key"
  | "door-open"
  | "door-close"
  | "coffee"
  | "paddle"
  | "bounce"
  | "meow"
  | "gong"
  | "attention";

export interface SoundPoint {
  x: number;
  y: number;
  z: number;
}

export interface SoundListener {
  position: SoundPoint;
  /** The listener's right, on the floor plane, for panning. */
  right: { x: number; z: number };
}

/**
 * How far each cue carries, in meters: full volume inside this, then falling off with distance.
 * Keys are heard at the next desk or two; the gong is meant for the whole room.
 */
export const cueReach: Record<SoundCue, number> = {
  key: 1.2,
  "door-open": 2.5,
  "door-close": 2.5,
  coffee: 2,
  paddle: 2.5,
  bounce: 2.5,
  meow: 2.5,
  gong: 12,
  // It calls the user, wherever the camera is.
  attention: 30,
};

/** Peak loudness of each cue before distance, so keys stay a patter and the gong is not a crash. */
const cueLevel: Record<SoundCue, number> = {
  key: 0.18,
  "door-open": 0.35,
  "door-close": 0.3,
  coffee: 0.4,
  paddle: 0.5,
  bounce: 0.35,
  meow: 0.55,
  gong: 0.6,
  attention: 0.4,
};

/** Quieter than this after distance, a sound is not worth the nodes it costs. */
export const inaudible = 0.02;

/**
 * Inverse-distance falloff: 1 within `reach`, then reach over distance, squared so a desk across
 * the room is a faint tick rather than a steady clatter.
 */
export function distanceGain(distance: number, reach: number): number {
  if (distance <= reach) {
    return 1;
  }
  const ratio = reach / distance;
  return ratio * ratio;
}

/** -1 hard left to 1 hard right, never fully to one ear so nothing vanishes from the other. */
export function panFor(listener: SoundListener, at: SoundPoint): number {
  const dx = at.x - listener.position.x;
  const dz = at.z - listener.position.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-3) {
    return 0;
  }
  const side = (dx * listener.right.x + dz * listener.right.z) / length;
  return Math.max(-0.8, Math.min(0.8, side * 0.8));
}

/** What a cue sounds like at the listener: how loud, and how far to one side. */
export function placeCue(cue: SoundCue, listener: SoundListener, at: SoundPoint): { gain: number; pan: number } {
  const distance = Math.hypot(at.x - listener.position.x, at.y - listener.position.y, at.z - listener.position.z);
  return { gain: cueLevel[cue] * distanceGain(distance, cueReach[cue]), pan: panFor(listener, at) };
}

/**
 * The ball's hits between two points of the rally: the rally leg runs 0..2 and wraps, a paddle at
 * each whole number (0 and 1) and a bounce at each half (0.5 and 1.5).
 */
export function rallyHits(previousLeg: number, leg: number): ("paddle" | "bounce")[] {
  const hits: ("paddle" | "bounce")[] = [];
  // Unwrap so a leg that went past 2 and back to 0 still counts the hit at 2 (the west paddle).
  const end = leg < previousLeg ? leg + 2 : leg;
  for (let mark = Math.floor(previousLeg * 2) + 1; mark / 2 <= end; mark++) {
    hits.push(mark % 2 === 0 ? "paddle" : "bounce");
  }
  return hits;
}

/** Plays the office's sounds. Construct freely: the audio graph is only built once sound is on. */
export class OfficeSound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: OfficeSoundSettings = { ...defaultSoundSettings };
  private listener: SoundListener = { position: { x: 0, y: 1.2, z: 0 }, right: { x: 1, z: 0 } };
  private purr: { source: OscillatorNode; gain: GainNode; pan: StereoPannerNode; lfo: OscillatorNode } | null = null;

  /** Applies the setting; the first time it is switched on builds the audio graph. */
  configure(settings: OfficeSoundSettings): void {
    this.settings = normalizeSoundSettings(settings);
    if (this.settings.enabled) {
      this.ensureContext();
    }
    if (this.master !== null && this.context !== null) {
      const level = this.settings.enabled ? this.settings.volume / 100 : 0;
      this.master.gain.setTargetAtTime(level, this.context.currentTime, 0.05);
    }
    if (!this.settings.enabled) {
      this.setPurr(null);
    }
  }

  /**
   * Browsers keep audio suspended until the person does something on the page, so every click or
   * key press tries to wake it; once running this does nothing.
   */
  wake(): void {
    if (this.context !== null && this.context.state === "suspended") {
      this.context.resume().catch((error: unknown) => console.warn("[office-sound] could not start audio yet", error));
    }
  }

  setListener(listener: SoundListener): void {
    this.listener = listener;
  }

  play(cue: SoundCue, at: SoundPoint): void {
    if (!this.settings.enabled || this.settings.volume === 0) {
      return;
    }
    const context = this.context;
    if (context === null || context.state !== "running") {
      return;
    }
    const { gain, pan } = placeCue(cue, this.listener, at);
    if (gain < inaudible) {
      return;
    }
    const out = this.voice(context, gain, pan);
    const start = context.currentTime + 0.005;
    switch (cue) {
      case "key":
        this.keyClick(context, out, start);
        break;
      case "door-open":
        this.whoosh(context, out, start, 0.7, 500, 2200);
        break;
      case "door-close":
        this.whoosh(context, out, start, 0.55, 1800, 400);
        this.thump(context, out, start + 0.45, 70, 0.6);
        break;
      case "coffee":
        this.coffee(context, out, start);
        break;
      case "paddle":
        this.tock(context, out, start, 1050, 0.06);
        break;
      case "bounce":
        this.tock(context, out, start, 1500, 0.04);
        break;
      case "meow":
        this.meow(context, out, start);
        break;
      case "gong":
        this.gong(context, out, start);
        break;
      case "attention":
        this.chime(context, out, start);
        break;
    }
  }

  /** A soft purr from Mochi while she is stroked, or silence with null. */
  setPurr(at: SoundPoint | null): void {
    const context = this.context;
    const playing = this.purr;
    if (at === null || !this.settings.enabled || context === null || context.state !== "running") {
      if (playing !== null && context !== null) {
        const stopAt = context.currentTime + 0.3;
        playing.gain.gain.setTargetAtTime(0, context.currentTime, 0.08);
        playing.source.stop(stopAt);
        playing.lfo.stop(stopAt);
      }
      this.purr = null;
      return;
    }
    const { gain, pan } = placeCue("meow", this.listener, at);
    const loudness = gain * 0.6;
    if (playing !== null) {
      playing.gain.gain.setTargetAtTime(loudness, context.currentTime, 0.1);
      playing.pan.pan.setTargetAtTime(pan, context.currentTime, 0.1);
      return;
    }
    // A low buzz, its loudness pulsing about 25 times a second, through a dark filter.
    const source = context.createOscillator();
    source.type = "sawtooth";
    source.frequency.value = 48;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    const pulse = context.createGain();
    pulse.gain.value = 0.5;
    const lfo = context.createOscillator();
    lfo.frequency.value = 24;
    const depth = context.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(pulse.gain);
    const level = context.createGain();
    level.gain.value = 0;
    level.gain.setTargetAtTime(loudness, context.currentTime, 0.15);
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    source.connect(filter).connect(pulse).connect(level).connect(panner).connect(this.output(context));
    source.start();
    lfo.start();
    this.purr = { source, gain: level, pan: panner, lfo };
  }

  private ensureContext(): void {
    if (this.context !== null) {
      return;
    }
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    // One second of white noise, reused by every hiss, click and whoosh.
    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let index = 0; index < samples.length; index++) {
      samples[index] = Math.random() * 2 - 1;
    }
    this.context = context;
    this.master = master;
    this.noise = noise;
  }

  private output(context: AudioContext): AudioNode {
    return this.master ?? context.destination;
  }

  /** A gain and panner for one sound, which the browser drops once the sound's sources end. */
  private voice(context: AudioContext, gain: number, pan: number): AudioNode {
    const level = context.createGain();
    level.gain.value = gain;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    level.connect(panner).connect(this.output(context));
    return level;
  }

  private noiseSource(context: AudioContext): AudioBufferSourceNode {
    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    return source;
  }

  /** A short bright tick, a little different every key. */
  private keyClick(context: AudioContext, out: AudioNode, start: number): void {
    const source = this.noiseSource(context);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2600 + Math.random() * 2400;
    filter.Q.value = 1.4;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(1, start + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.035);
    source.connect(filter).connect(envelope).connect(out);
    source.start(start, Math.random() * 0.9);
    source.stop(start + 0.05);
  }

  /** Air moving: noise through a filter that sweeps from `from` to `to` hertz. */
  private whoosh(
    context: AudioContext,
    out: AudioNode,
    start: number,
    seconds: number,
    from: number,
    to: number,
  ): void {
    const source = this.noiseSource(context);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + seconds);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.8, start + seconds * 0.35);
    envelope.gain.linearRampToValueAtTime(0, start + seconds);
    source.connect(filter).connect(envelope).connect(out);
    source.start(start, Math.random() * 0.5);
    source.stop(start + seconds + 0.05);
  }

  /** A dull knock, as of the door meeting its frame. */
  private thump(context: AudioContext, out: AudioNode, start: number, hertz: number, level: number): void {
    const tone = context.createOscillator();
    tone.frequency.setValueAtTime(hertz * 1.6, start);
    tone.frequency.exponentialRampToValueAtTime(hertz, start + 0.08);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(level, start);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    tone.connect(envelope).connect(out);
    tone.start(start);
    tone.stop(start + 0.2);
  }

  /** The hollow tock of a celluloid ball. */
  private tock(context: AudioContext, out: AudioNode, start: number, hertz: number, seconds: number): void {
    const tone = context.createOscillator();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(hertz, start);
    tone.frequency.exponentialRampToValueAtTime(hertz * 0.7, start + seconds);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(1, start);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    tone.connect(envelope).connect(out);
    tone.start(start);
    tone.stop(start + seconds + 0.01);
    this.keyClick(context, out, start);
  }

  /** The grinder whirring for a couple of seconds, then the steam hissing through. */
  private coffee(context: AudioContext, out: AudioNode, start: number): void {
    const grind = context.createOscillator();
    grind.type = "sawtooth";
    grind.frequency.setValueAtTime(110, start);
    grind.frequency.linearRampToValueAtTime(135, start + 2);
    const grindFilter = context.createBiquadFilter();
    grindFilter.type = "bandpass";
    grindFilter.frequency.value = 900;
    grindFilter.Q.value = 0.7;
    const grindLevel = context.createGain();
    grindLevel.gain.setValueAtTime(0, start);
    grindLevel.gain.linearRampToValueAtTime(0.35, start + 0.15);
    grindLevel.gain.setValueAtTime(0.35, start + 1.9);
    grindLevel.gain.linearRampToValueAtTime(0, start + 2.1);
    grind.connect(grindFilter).connect(grindLevel).connect(out);
    grind.start(start);
    grind.stop(start + 2.2);

    const steamStart = start + 2.4;
    const steam = this.noiseSource(context);
    const steamFilter = context.createBiquadFilter();
    steamFilter.type = "highpass";
    steamFilter.frequency.value = 2500;
    const steamLevel = context.createGain();
    steamLevel.gain.setValueAtTime(0, steamStart);
    steamLevel.gain.linearRampToValueAtTime(0.45, steamStart + 0.2);
    steamLevel.gain.setValueAtTime(0.45, steamStart + 1.4);
    steamLevel.gain.linearRampToValueAtTime(0, steamStart + 2);
    steam.connect(steamFilter).connect(steamLevel).connect(out);
    steam.start(steamStart, 0.3);
    steam.stop(steamStart + 2.05);
  }

  /** A small cat's meow: a buzzy tone that rises and falls through a vowel-like filter. */
  private meow(context: AudioContext, out: AudioNode, start: number): void {
    const seconds = 0.55 + Math.random() * 0.25;
    const pitch = 520 + Math.random() * 120;
    const voice = context.createOscillator();
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(pitch * 0.85, start);
    voice.frequency.linearRampToValueAtTime(pitch * 1.35, start + seconds * 0.35);
    voice.frequency.exponentialRampToValueAtTime(pitch * 0.75, start + seconds);
    const vibrato = context.createOscillator();
    vibrato.frequency.value = 6;
    const vibratoDepth = context.createGain();
    vibratoDepth.gain.value = pitch * 0.02;
    vibrato.connect(vibratoDepth).connect(voice.frequency);
    // "mi" opening to "a" and closing to "u".
    const vowel = context.createBiquadFilter();
    vowel.type = "bandpass";
    vowel.Q.value = 3;
    vowel.frequency.setValueAtTime(1100, start);
    vowel.frequency.linearRampToValueAtTime(1700, start + seconds * 0.4);
    vowel.frequency.linearRampToValueAtTime(800, start + seconds);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(1, start + 0.06);
    envelope.gain.setValueAtTime(1, start + seconds * 0.6);
    envelope.gain.linearRampToValueAtTime(0, start + seconds);
    voice.connect(vowel).connect(envelope).connect(out);
    voice.start(start);
    vibrato.start(start);
    voice.stop(start + seconds + 0.02);
    vibrato.stop(start + seconds + 0.02);
  }

  /** Two soft bell notes, falling a fourth: someone needs the user, gently. */
  private chime(context: AudioContext, out: AudioNode, start: number): void {
    for (const [index, frequency] of [1175, 880].entries()) {
      const at = start + index * 0.16;
      const tone = context.createOscillator();
      tone.type = "sine";
      tone.frequency.value = frequency;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(0.5, at + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.9);
      tone.connect(envelope).connect(out);
      tone.start(at);
      tone.stop(at + 0.95);
    }
  }

  /** A struck gong: a few out-of-tune partials ringing down over several seconds. */
  private gong(context: AudioContext, out: AudioNode, start: number): void {
    const base = 98;
    const partials: [number, number, number][] = [
      // ratio to the base, level, seconds to ring
      [1, 1, 5],
      [2.02, 0.5, 3.5],
      [2.76, 0.45, 3],
      [4.07, 0.25, 2],
      [5.4, 0.15, 1.4],
    ];
    // The partials all start together, so share the level out between them to keep the strike under full scale.
    const total = partials.reduce((sum, [, level]) => sum + level, 0);
    for (const [ratio, share, seconds] of partials) {
      const level = share / total;
      const tone = context.createOscillator();
      tone.frequency.value = base * ratio;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(level, start + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      tone.connect(envelope).connect(out);
      tone.start(start);
      tone.stop(start + seconds + 0.05);
    }
  }
}
