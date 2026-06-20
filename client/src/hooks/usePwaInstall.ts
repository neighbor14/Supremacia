import { useState, useEffect, useRef } from 'react';

// The beforeinstallprompt event is not in the standard TypeScript lib
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android-chrome' | 'other-mobile' | 'desktop';

export interface PwaInstallState {
  isStandalone: boolean;
  platform: Platform;
  isMobile: boolean;
  canInstall: boolean;
  supportsFullscreen: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  enterFullscreen: () => Promise<void>;
}

function detectPlatform(): { platform: Platform; isMobile: boolean } {
  const ua = navigator.userAgent;

  // iOS 13+ iPads report as Mac in UA, so check maxTouchPoints too
  const isIos =
    (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;

  const isAndroid = /Android/.test(ua);
  const isMobileByTouch = 'ontouchstart' in window && window.innerWidth < 1024;
  const isMobile = isIos || isAndroid || isMobileByTouch;

  let platform: Platform;
  if (isIos) platform = 'ios';
  else if (isAndroid) platform = 'android-chrome';
  else if (isMobile) platform = 'other-mobile';
  else platform = 'desktop';

  return { platform, isMobile };
}

export function usePwaInstall(): PwaInstallState {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  const { platform, isMobile } = detectPlatform();

  // iOS Safari does not support requestFullscreen at all
  const supportsFullscreen =
    platform !== 'ios' && typeof document.documentElement.requestFullscreen === 'function';

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPromptRef.current) return 'unavailable';
    await deferredPromptRef.current.prompt();
    const { outcome } = await deferredPromptRef.current.userChoice;
    deferredPromptRef.current = null;
    setCanInstall(false);
    return outcome;
  };

  const enterFullscreen = async (): Promise<void> => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Silently ignore — user may deny or browser may restrict it
    }
  };

  return {
    isStandalone,
    platform,
    isMobile,
    canInstall,
    supportsFullscreen,
    promptInstall,
    enterFullscreen,
  };
}
