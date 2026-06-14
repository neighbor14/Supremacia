import { useEffect, useCallback, useState } from 'react';
import { initAudio, playSound, setVolume, getVolume, toggleMute, getMuted, type SoundEffect } from '../game/audio';

/**
 * Hook to initialize audio system on first user interaction
 */
export function useAudioInit() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;

    const handleInteraction = () => {
      initAudio();
      setInitialized(true);
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [initialized]);

  return initialized;
}

/**
 * Hook for audio controls (volume, mute)
 */
export function useAudioControls() {
  const [volume, setVol] = useState(getVolume());
  const [muted, setMuted] = useState(getMuted());

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    setVol(v);
  }, []);

  const toggle = useCallback(() => {
    const newMuted = toggleMute();
    setMuted(newMuted);
  }, []);

  return { volume, muted, changeVolume, toggleMute: toggle };
}

/**
 * Hook that returns the playSound function
 */
export function usePlaySound() {
  return useCallback((effect: SoundEffect, volume?: number) => {
    playSound(effect, volume);
  }, []);
}
