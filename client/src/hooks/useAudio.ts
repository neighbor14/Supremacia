import { useEffect, useCallback, useState } from 'react';
import {
  initAudio,
  isAudioEnabled,
  playSound,
  playMusic,
  stopMusic,
  setSfxVolume,
  getSfxVolume,
  setSfxEnabled,
  getSfxEnabled,
  setMusicVolume,
  getMusicVolume,
  setMusicEnabled,
  getMusicEnabled,
  setMasterMuted,
  getMasterMuted,
  type SoundEffect,
  type MusicTrack,
} from '../game/audio';

/**
 * Hook to initialize audio on first user interaction.
 * Returns { initialized, activate } — activate() can be wired to an explicit button.
 */
export function useAudioInit() {
  const [initialized, setInitialized] = useState(isAudioEnabled());

  const activate = useCallback(() => {
    if (initialized) return;
    initAudio();
    setInitialized(true);
  }, [initialized]);

  useEffect(() => {
    if (initialized) return;

    const handle = () => {
      initAudio();
      setInitialized(true);
      document.removeEventListener('click', handle);
      document.removeEventListener('touchstart', handle);
    };

    document.addEventListener('click', handle);
    document.addEventListener('touchstart', handle);

    return () => {
      document.removeEventListener('click', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [initialized]);

  return { initialized, activate };
}

/**
 * Full audio controls: master mute, music toggle, SFX toggle, volume sliders.
 */
export function useAudioControls() {
  const [masterMuted, setMasterMutedState] = useState(getMasterMuted());
  const [musicEnabled, setMusicEnabledState] = useState(getMusicEnabled());
  const [sfxEnabled, setSfxEnabledState] = useState(getSfxEnabled());
  const [musicVol, setMusicVol] = useState(getMusicVolume());
  const [sfxVol, setSfxVol] = useState(getSfxVolume());

  const toggleMasterMute = useCallback(() => {
    const next = !getMasterMuted();
    setMasterMuted(next);
    setMasterMutedState(next);
  }, []);

  const toggleMusic = useCallback(() => {
    const next = !getMusicEnabled();
    setMusicEnabled(next);
    setMusicEnabledState(next);
  }, []);

  const toggleSfx = useCallback(() => {
    const next = !getSfxEnabled();
    setSfxEnabled(next);
    setSfxEnabledState(next);
  }, []);

  const changeMusicVolume = useCallback((v: number) => {
    setMusicVolume(v);
    setMusicVol(v);
  }, []);

  const changeSfxVolume = useCallback((v: number) => {
    setSfxVolume(v);
    setSfxVol(v);
  }, []);

  // Legacy compat: single "volume" / "muted" for components not yet updated
  const changeVolume = useCallback((v: number) => {
    setSfxVolume(v);
    setSfxVol(v);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !getMasterMuted();
    setMasterMuted(next);
    setMasterMutedState(next);
  }, []);

  return {
    masterMuted,
    musicEnabled,
    sfxEnabled,
    musicVol,
    sfxVol,
    toggleMasterMute,
    toggleMusic,
    toggleSfx,
    changeMusicVolume,
    changeSfxVolume,
    // legacy
    volume: sfxVol,
    muted: masterMuted,
    changeVolume,
    toggleMute,
  };
}

/**
 * Hook that returns the playSound function
 */
export function usePlaySound() {
  return useCallback((effect: SoundEffect, volume?: number) => {
    playSound(effect, volume);
  }, []);
}

/**
 * Hook for controlling background music
 */
export function useMusicPlayer() {
  const play = useCallback((track: MusicTrack, fadeDurationMs?: number) => {
    playMusic(track, fadeDurationMs);
  }, []);

  const stop = useCallback((fadeDurationMs?: number) => {
    stopMusic(fadeDurationMs);
  }, []);

  return { play, stop };
}
