/**
 * Audio System — Supremacia Digital
 * SFX: synthesized via Web Audio API (no external files)
 * Music: HTML Audio elements — menu.mp3, gameplay.mp3, batalha.mp3
 */

// ─── Types ────────────────────────────────────────────────────────────────────

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
  | 'dice-roll'
  | 'card-reveal';

export type MusicTrack = 'menu' | 'gameplay' | 'battle';

// ─── State ────────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;
let audioEnabled = false;

// SFX
let sfxVolume = 0.5;
let sfxEnabled = true;

// Music
let musicVolume = 0.2;
let musicEnabled = true;

// Master mute
let masterMuted = false;

// Per-sound debounce
const lastPlayedAt = new Map<SoundEffect, number>();
const COOLDOWN_MS: Partial<Record<SoundEffect, number>> = {
  'button-click': 80,
  'combat-hit': 150,
  'dice-roll': 200,
  'resource-gain': 120,
  'resource-loss': 120,
  'error': 300,
};

let callVolume = 1.0;

// Music playback state
let currentTrack: MusicTrack | null = null;
let currentAudio: HTMLAudioElement | null = null;
const musicElements = new Map<MusicTrack, HTMLAudioElement>();
// rafId per audio element so fades don't stomp each other
const activeFades = new WeakMap<HTMLAudioElement, number>();

const MUSIC_PATHS: Record<MusicTrack, string> = {
  menu: '/audio/menu.mp3',
  gameplay: '/audio/gameplay.mp3',
  battle: '/audio/batalha.mp3',
};

// ─── Fade helper ─────────────────────────────────────────────────────────────

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function fadeAudio(
  audio: HTMLAudioElement,
  fromVol: number,
  toVol: number,
  durationMs: number,
  onDone?: () => void,
): void {
  const existing = activeFades.get(audio);
  if (existing != null) cancelAnimationFrame(existing);

  const start = performance.now();

  function step() {
    const t = Math.min((performance.now() - start) / durationMs, 1);
    audio.volume = Math.max(0, Math.min(1, fromVol + (toVol - fromVol) * easeInOut(t)));
    if (t < 1) {
      activeFades.set(audio, requestAnimationFrame(step));
    } else {
      activeFades.delete(audio);
      onDone?.();
    }
  }
  activeFades.set(audio, requestAnimationFrame(step));
}

// ─── Music internals ─────────────────────────────────────────────────────────

function getOrCreateMusic(track: MusicTrack): HTMLAudioElement | null {
  if (!musicElements.has(track)) {
    try {
      const audio = new Audio(MUSIC_PATHS[track]);
      audio.loop = true;
      audio.volume = 0;
      audio.preload = 'auto';
      audio.addEventListener('error', () => {
        console.warn(`[Supremacia Audio] Failed to load track: ${track}`);
        musicElements.delete(track);
      }, { once: true });
      musicElements.set(track, audio);
    } catch (e) {
      console.warn(`[Supremacia Audio] Exception creating audio element for ${track}:`, e);
      return null;
    }
  }
  return musicElements.get(track) ?? null;
}

function effectiveMusicVol(): number {
  return masterMuted || !musicEnabled ? 0 : musicVolume;
}

// ─── SFX internals ───────────────────────────────────────────────────────────

function getCtx(): AudioContext | null {
  if (!audioEnabled || masterMuted || !sfxEnabled) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
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
  const peak = vol * sfxVolume * callVolume;
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
  const peak = vol * sfxVolume * callVolume;
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

  // Card flip: snap noise + motion whoosh + reveal shimmer
  'card-reveal': (c) => {
    // Snap of the card being flipped — crisp high-freq burst
    burst(c, 0.040, { vol: 0.30, filterFreq: 4000 });
    // Low thud as card leaves the deck
    burst(c, 0.055, { vol: 0.14, filterFreq: 300, filterType: 'bandpass' });
    // Whoosh: card sweeping through air
    tone(c, 160, 0.09, { freqEnd: 640, vol: 0.09, type: 'sine', startAt: 0.006 });
    // Shimmer as card face is revealed
    tone(c, 920,  0.17, { vol: 0.18, type: 'sine', attack: 0.003, startAt: 0.040 });
    tone(c, 1380, 0.13, { vol: 0.10, type: 'sine', attack: 0.003, startAt: 0.055 });
  },

  'missile-launch': (c) => {
    tone(c, 80, 0.62, { freqEnd: 1400, vol: 0.38, type: 'sawtooth' });
    burst(c, 0.58, { vol: 0.20, filterFreq: 2200 });
  },

  'explosion': (c) => {
    burst(c, 0.82, { vol: 0.62, filterFreq: 480 });
    tone(c, 60, 0.52, { freqEnd: 32, vol: 0.38, type: 'sawtooth' });
    burst(c, 0.28, { vol: 0.42, filterFreq: 9000, filterType: 'highpass', startAt: 0.05 });
  },

  'territory-conquered': (c) => {
    tone(c, 523, 0.16, { vol: 0.34 });
    tone(c, 659, 0.16, { vol: 0.34, startAt: 0.14 });
    tone(c, 784, 0.16, { vol: 0.34, startAt: 0.28 });
    tone(c, 1047, 0.30, { vol: 0.34, startAt: 0.42 });
  },

  'error': (c) => {
    tone(c, 360, 0.11, { type: 'square', vol: 0.28 });
    tone(c, 210, 0.11, { type: 'square', vol: 0.28, startAt: 0.14 });
  },

  'victory': (c) => {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) =>
      tone(c, f, i < 4 ? 0.18 : 0.40, { vol: 0.36, startAt: i * 0.13 }),
    );
  },

  'defeat': (c) => {
    const notes = [392, 349, 311, 293];
    notes.forEach((f, i) =>
      tone(c, f, i < 3 ? 0.24 : 0.44, { vol: 0.30, startAt: i * 0.19 }),
    );
  },
};

// ─── Public API: SFX ─────────────────────────────────────────────────────────

export function playSound(effect: SoundEffect, volumeScale = 1.0): void {
  if (!audioEnabled || masterMuted || !sfxEnabled) return;

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
    // Silently swallow synthesis errors
  }
  callVolume = 1.0;
}

export function setSfxVolume(vol: number): void {
  sfxVolume = Math.max(0, Math.min(1, vol));
  localStorage.setItem('supremacia-sfx-volume', String(sfxVolume));
}

export function getSfxVolume(): number {
  return sfxVolume;
}

export function setSfxEnabled(enabled: boolean): void {
  sfxEnabled = enabled;
  localStorage.setItem('supremacia-sfx-enabled', String(enabled));
}

export function getSfxEnabled(): boolean {
  return sfxEnabled;
}

// Legacy compat aliases (used by existing components)
export function setVolume(vol: number): void { setSfxVolume(vol); }
export function getVolume(): number { return sfxVolume; }

// ─── Public API: Music ────────────────────────────────────────────────────────

export function playMusic(track: MusicTrack, fadeDurationMs = 1500): void {
  if (currentTrack === track) return;

  const prevAudio = currentAudio;
  currentTrack = track;

  if (!audioEnabled) {
    // deferred until initAudio() is called - will retry in initAudio()
    return;
  }

  const nextEl = getOrCreateMusic(track);
  if (!nextEl) {
    console.warn(`[Supremacia Audio] Could not create audio element for track: ${track}`);
    return;
  }

  nextEl.volume = 0;
  nextEl.currentTime = 0;

  const targetVol = effectiveMusicVol();

  const startPlayback = () => {
    const playPromise = nextEl.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`[Supremacia Audio] Now playing: ${track} @ vol=${targetVol}`);
          fadeAudio(nextEl, 0, targetVol, fadeDurationMs);
        })
        .catch((err) => {
          console.warn(`[Supremacia Audio] playback failed for ${track}:`, err);
        });
    } else {
      fadeAudio(nextEl, 0, targetVol, fadeDurationMs);
    }
  };

  // If the element is still in a "pausing" state from unlock, wait a tick
  if (nextEl.paused) {
    startPlayback();
  } else {
    // Already playing (shouldn't happen since we reset currentTime), just fade in
    nextEl.pause();
    nextEl.currentTime = 0;
    setTimeout(startPlayback, 50);
  }

  if (prevAudio) {
    const prev = prevAudio;
    const prevVol = prev.volume;
    fadeAudio(prev, prevVol, 0, fadeDurationMs, () => {
      prev.pause();
    });
  }

  currentAudio = nextEl;
}

export function stopMusic(fadeDurationMs = 800): void {
  currentTrack = null;
  if (currentAudio) {
    const audio = currentAudio;
    currentAudio = null;
    fadeAudio(audio, audio.volume, 0, fadeDurationMs, () => {
      audio.pause();
    });
  }
}

export function getCurrentTrack(): MusicTrack | null {
  return currentTrack;
}

export function setMusicVolume(vol: number): void {
  musicVolume = Math.max(0, Math.min(1, vol));
  localStorage.setItem('supremacia-music-volume', String(musicVolume));
  if (currentAudio && !masterMuted && musicEnabled) {
    currentAudio.volume = musicVolume;
  }
}

export function getMusicVolume(): number {
  return musicVolume;
}

export function setMusicEnabled(enabled: boolean): void {
  musicEnabled = enabled;
  localStorage.setItem('supremacia-music-enabled', String(enabled));
  if (currentAudio) {
    const target = (!enabled || masterMuted) ? 0 : musicVolume;
    fadeAudio(currentAudio, currentAudio.volume, target, 500);
  }
}

export function getMusicEnabled(): boolean {
  return musicEnabled;
}

// ─── Public API: Master mute ─────────────────────────────────────────────────

export function setMasterMuted(muted: boolean): void {
  masterMuted = muted;
  localStorage.setItem('supremacia-master-muted', String(muted));
  if (currentAudio) {
    const target = muted ? 0 : effectiveMusicVol();
    fadeAudio(currentAudio, currentAudio.volume, target, 300);
  }
}

export function getMasterMuted(): boolean {
  return masterMuted;
}

// Legacy: toggleMute / getMuted now map to master mute
export function toggleMute(): boolean {
  setMasterMuted(!masterMuted);
  return masterMuted;
}

export function getMuted(): boolean {
  return masterMuted;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function isAudioEnabled(): boolean {
  return audioEnabled;
}

export function initAudio(): void {
  if (audioEnabled) return;
  audioEnabled = true;
  console.log('[Supremacia Audio] Initializing audio system');

  // Restore user preferences
  const savedSfxVol =
    localStorage.getItem('supremacia-sfx-volume') ??
    localStorage.getItem('supremacia-volume'); // migrate old key
  if (savedSfxVol !== null) {
    const v = parseFloat(savedSfxVol);
    if (!isNaN(v)) sfxVolume = v;
  }

  const savedMusicVol = localStorage.getItem('supremacia-music-volume');
  if (savedMusicVol !== null) {
    const v = parseFloat(savedMusicVol);
    if (!isNaN(v)) musicVolume = v;
  }

  const savedSfxEnabled = localStorage.getItem('supremacia-sfx-enabled');
  if (savedSfxEnabled !== null) sfxEnabled = savedSfxEnabled !== 'false';

  const savedMusicEnabled = localStorage.getItem('supremacia-music-enabled');
  if (savedMusicEnabled !== null) musicEnabled = savedMusicEnabled !== 'false';

  const savedMuted =
    localStorage.getItem('supremacia-master-muted') ??
    localStorage.getItem('supremacia-muted'); // migrate old key
  if (savedMuted !== null) masterMuted = savedMuted === 'true';

  console.log(`[Supremacia Audio] Prefs: music=${musicEnabled}@${Math.round(musicVolume*100)}%, sfx=${sfxEnabled}@${Math.round(sfxVolume*100)}%, muted=${masterMuted}`);

  // iOS/Safari require audio.play() to be called synchronously within a user gesture.
  // We unlock all three tracks here (play→pause at vol=0) so later async plays work.
  const tracks: MusicTrack[] = ['menu', 'gameplay', 'battle'];
  for (const t of tracks) {
    const el = getOrCreateMusic(t);
    if (!el) continue;
    el.volume = 0;
    const p = el.play();
    if (p) {
      p.then(() => {
        el.pause();
        el.currentTime = 0;
        console.log(`[Supremacia Audio] Unlocked track: ${t}`);
      }).catch(() => {});
    }
  }

  // Start any track that was requested before init
  if (currentTrack) {
    const track = currentTrack;
    console.log(`[Supremacia Audio] Playing deferred track: ${track}`);
    currentTrack = null; // reset so playMusic sees it as new
    playMusic(track);
  }
}

/** No-op: synthesis needs no preloading; music loads on demand */
export function preloadAudio(): void {}
