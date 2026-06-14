/**
 * Audio System for Supremacia Digital
 * Uses CC0 licensed sounds from Kenney UI Audio and rse/soundfx
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

const SOUND_URLS: Record<SoundEffect, string> = {
  'button-click': '/manus-storage/button-click_e955ab5a.ogg',
  'menu-open': '/manus-storage/menu-open_8fde14f2.ogg',
  'menu-close': '/manus-storage/menu-close_1397a535.ogg',
  'turn-start': '/manus-storage/turn-start_3c1355b5.ogg',
  'resource-gain': '/manus-storage/resource-gain_be7f6058.ogg',
  'resource-loss': '/manus-storage/resource-loss_8a5035c2.ogg',
  'diplomacy-alert': '/manus-storage/diplomacy-alert_523fd70a.ogg',
  'combat-start': '/manus-storage/combat-start_aacb072a.ogg',
  'combat-hit': '/manus-storage/combat-hit_03962081.ogg',
  'missile-launch': '/manus-storage/missile-launch_6e386a1d.ogg',
  'explosion': '/manus-storage/explosion_f50d981a.ogg',
  'territory-conquered': '/manus-storage/territory-conquered_d7031220.ogg',
  'error': '/manus-storage/error_845b2160.ogg',
  'victory': '/manus-storage/victory_406aa651.ogg',
  'defeat': '/manus-storage/defeat_3a98f7a4.ogg',
  'dice-roll': '/manus-storage/dice-roll_dbace553.ogg',
};

// Audio cache to avoid re-creating Audio objects
const audioCache: Map<SoundEffect, HTMLAudioElement> = new Map();

// Global volume and mute state
let globalVolume = 0.5;
let isMuted = false;

/**
 * Preload all audio files for instant playback
 */
export function preloadAudio(): void {
  Object.entries(SOUND_URLS).forEach(([key, url]) => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = globalVolume;
    audioCache.set(key as SoundEffect, audio);
  });
}

/**
 * Play a sound effect
 */
export function playSound(effect: SoundEffect, volume?: number): void {
  if (isMuted) return;

  const cached = audioCache.get(effect);
  if (cached) {
    // Clone the audio element for overlapping sounds
    const audio = cached.cloneNode() as HTMLAudioElement;
    audio.volume = (volume ?? 1) * globalVolume;
    audio.play().catch(() => {
      // Silently fail - browser may block autoplay
    });
  } else {
    // Fallback: create new audio element
    const url = SOUND_URLS[effect];
    if (url) {
      const audio = new Audio(url);
      audio.volume = (volume ?? 1) * globalVolume;
      audio.play().catch(() => {});
      audioCache.set(effect, audio);
    }
  }
}

/**
 * Set global volume (0 to 1)
 */
export function setVolume(vol: number): void {
  globalVolume = Math.max(0, Math.min(1, vol));
  localStorage.setItem('supremacia-volume', String(globalVolume));
}

/**
 * Get current volume
 */
export function getVolume(): number {
  return globalVolume;
}

/**
 * Toggle mute
 */
export function toggleMute(): boolean {
  isMuted = !isMuted;
  localStorage.setItem('supremacia-muted', String(isMuted));
  return isMuted;
}

/**
 * Get mute state
 */
export function getMuted(): boolean {
  return isMuted;
}

/**
 * Initialize audio system - load saved preferences
 */
export function initAudio(): void {
  const savedVolume = localStorage.getItem('supremacia-volume');
  if (savedVolume !== null) {
    globalVolume = parseFloat(savedVolume);
  }
  const savedMuted = localStorage.getItem('supremacia-muted');
  if (savedMuted !== null) {
    isMuted = savedMuted === 'true';
  }
  preloadAudio();
}
