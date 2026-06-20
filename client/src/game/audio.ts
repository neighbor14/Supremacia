/**
 * Audio System — Supremacia Digital
 * All sounds are synthesized in-browser via Web Audio API.
 * No external files required; works offline and on any host.
 */

export type SoundEffect =
  | 'button-click'
  | 'menu-open'
  | 'menu-close'
  | 'turn-start'
  | 'resource-gain'
  | 'resource-loss'
  | 'diplomacy-alert'
  | 'combat-start'
  | 'combat-hit'
  | 'missile-launch'
  | 'explosion'
  | 'territory-conquered'
  | 'error'
  | 'victory'
  | 'defeat'
  | 'dice-roll';

let audioCtx: AudioContext | null = null;
let globalVolume = 0.5;
let isMuted = false;
let audioEnabled = false; // set true after first user interaction

// Per-sound debounce — prevents audio spam on rapid taps
const lastPlayedAt = new Map<SoundEffect, number>();
const COOLDOWN_MS: Partial<Record<SoundEffect, number>> = {
  'button-click': 80,
  'combat-hit': 150,
  'dice-roll': 200,
  'resource-gain': 120,
  'resource-loss': 120,
  'error': 300,
};

// Per-call volume scale, set before each synth call and reset after
let callVolume = 1.0;

function getCtx(): AudioContext | null {
  if (!audioEnabled || isMuted) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function makeGain(c: AudioContext): GainNode {
  const g = c.createGain();
  g.connect(c.destination);
  return g;
}

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  freqEnd?: number;
  attack?: number;
  startAt?: number;
}

function tone(c: AudioContext, freq: number, dur: number, opts: ToneOpts = {}): void {
  const { type = 'sine', vol = 0.5, freqEnd, attack = 0.006, startAt = 0 } = opts;
  const peak = vol * globalVolume * callVolume;
  const g = makeGain(c);
  const o = c.createOscillator();
  o.type = type;
  const t = c.currentTime + startAt;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd != null && freqEnd > 0) {
    o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.06);
}

interface BurstOpts {
  vol?: number;
  filterFreq?: number;
  filterType?: BiquadFilterType;
  attack?: number;
  startAt?: number;
}

function burst(c: AudioContext, dur: number, opts: BurstOpts = {}): void {
  const {
    vol = 0.4,
    filterFreq = 3000,
    filterType = 'lowpass',
    attack = 0.003,
    startAt = 0,
  } = opts;
  const peak = vol * globalVolume * callVolume;
  const sampleRate = c.sampleRate;
  const len = Math.ceil(sampleRate * (dur + 0.06));
  const buf = c.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const flt = c.createBiquadFilter();
  flt.type = filterType;
  flt.frequency.value = filterFreq;

  const g = makeGain(c);
  const t = c.currentTime + startAt;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(flt);
  flt.connect(g);
  src.start(t);
  src.stop(t + dur + 0.1);
}

// ─── Sound Definitions ────────────────────────────────────────────────────────

const SOUNDS: Record<SoundEffect, (c: AudioContext) => void> = {
  'button-click': (c) => {
    burst(c, 0.022, { vol: 0.24, filterFreq: 2400 });
    tone(c, 700, 0.04, { vol: 0.16, type: 'square' });
  },

  'menu-open': (c) => {
    tone(c, 280, 0.18, { freqEnd: 560, vol: 0.28, type: 'sine' });
    tone(c, 440, 0.12, { vol: 0.10, startAt: 0.08 });
  },

  'menu-close': (c) => {
    tone(c, 560, 0.15, { freqEnd: 280, vol: 0.26, type: 'sine' });
  },

  'turn-start': (c) => {
    // Ascending triad: C5 E5 G5
    tone(c, 523, 0.22, { vol: 0.30 });
    tone(c, 659, 0.22, { vol: 0.30, startAt: 0.16 });
    tone(c, 784, 0.32, { vol: 0.30, startAt: 0.32 });
  },

  'resource-gain': (c) => {
    tone(c, 520, 0.13, { vol: 0.26 });
    tone(c, 780, 0.18, { vol: 0.26, startAt: 0.10 });
  },

  'resource-loss': (c) => {
    tone(c, 380, 0.22, { freqEnd: 200, vol: 0.26 });
  },

  'diplomacy-alert': (c) => {
    // Double beep
    tone(c, 660, 0.09, { vol: 0.28, type: 'square' });
    tone(c, 880, 0.09, { vol: 0.28, type: 'square', startAt: 0.15 });
  },

  'combat-start': (c) => {
    burst(c, 0.26, { vol: 0.48, filterFreq: 340 });
    tone(c, 100, 0.30, { freqEnd: 60, vol: 0.36, type: 'sawtooth' });
  },

  'combat-hit': (c) => {
    burst(c, 0.13, { vol: 0.50, filterFreq: 5500 });
    tone(c, 180, 0.13, { freqEnd: 80, vol: 0.30, type: 'sawtooth' });
  },

  'dice-roll': (c) => {
    for (let i = 0; i < 4; i++) {
      burst(c, 0.065, { vol: 0.28, filterFreq: 3800, startAt: i * 0.075 });
    }
  },

  'missile-launch': (c) => {
    // Rising sawtooth sweep with noise
    tone(c, 80, 0.62, { freqEnd: 1400, vol: 0.38, type: 'sawtooth' });
    burst(c, 0.58, { vol: 0.20, filterFreq: 2200 });
  },

  'explosion': (c) => {
    // Low boom + high-frequency crack + sub rumble
    burst(c, 0.82, { vol: 0.62, filterFreq: 480 });
    tone(c, 60, 0.52, { freqEnd: 32, vol: 0.38, type: 'sawtooth' });
    burst(c, 0.28, { vol: 0.42, filterFreq: 9000, filterType: 'highpass', startAt: 0.05 });
  },

  'territory-conquered': (c) => {
    // Mini fanfare: C5 E5 G5 C6
    tone(c, 523, 0.16, { vol: 0.34 });
    tone(c, 659, 0.16, { vol: 0.34, startAt: 0.14 });
    tone(c, 784, 0.16, { vol: 0.34, startAt: 0.28 });
    tone(c, 1047, 0.30, { vol: 0.34, startAt: 0.42 });
  },

  'error': (c) => {
    // Two descending buzz tones
    tone(c, 360, 0.11, { type: 'square', vol: 0.28 });
    tone(c, 210, 0.11, { type: 'square', vol: 0.28, startAt: 0.14 });
  },

  'victory': (c) => {
    // Triumphant ascending scale: C E G C E
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) =>
      tone(c, f, i < 4 ? 0.18 : 0.40, { vol: 0.36, startAt: i * 0.13 })
    );
  },

  'defeat': (c) => {
    // Descending minor: G F Eb D
    const notes = [392, 349, 311, 293];
    notes.forEach((f, i) =>
      tone(c, f, i < 3 ? 0.24 : 0.44, { vol: 0.30, startAt: i * 0.19 })
    );
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function playSound(effect: SoundEffect, volumeScale = 1.0): void {
  if (isMuted || !audioEnabled) return;

  const cd = COOLDOWN_MS[effect];
  if (cd) {
    const last = lastPlayedAt.get(effect) ?? 0;
    if (performance.now() - last < cd) return;
    lastPlayedAt.set(effect, performance.now());
  }

  const c = getCtx();
  if (!c) return;

  callVolume = Math.max(0, Math.min(2, volumeScale));
  try {
    SOUNDS[effect](c);
  } catch {
    // Silently swallow any synthesis error
  }
  callVolume = 1.0;
}

export function setVolume(vol: number): void {
  globalVolume = Math.max(0, Math.min(1, vol));
  localStorage.setItem('supremacia-volume', String(globalVolume));
}

export function getVolume(): number {
  return globalVolume;
}

export function toggleMute(): boolean {
  isMuted = !isMuted;
  localStorage.setItem('supremacia-muted', String(isMuted));
  return isMuted;
}

export function getMuted(): boolean {
  return isMuted;
}

export function initAudio(): void {
  audioEnabled = true;
  const savedVolume = localStorage.getItem('supremacia-volume');
  if (savedVolume !== null) {
    const v = parseFloat(savedVolume);
    if (!isNaN(v)) globalVolume = v;
  }
  const savedMuted = localStorage.getItem('supremacia-muted');
  if (savedMuted !== null) {
    isMuted = savedMuted === 'true';
  }
}

/** No-op: synthesis needs no preloading */
export function preloadAudio(): void {}
