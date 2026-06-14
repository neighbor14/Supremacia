import { useState, useEffect } from 'react';
import { RotateCcw, X } from 'lucide-react';

/**
 * LandscapePrompt: On mobile portrait, shows a prompt to rotate.
 * If user dismisses, the game content is forcibly rotated via CSS transform
 * to simulate landscape even when the device is in portrait.
 * Also attempts to lock screen orientation via the Screen Orientation API.
 */
export default function LandscapePrompt() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 768 || window.innerHeight < 768;
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(isMobile && portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    // Try to lock orientation to landscape
    try {
      const orientation = (screen as any).orientation;
      if (orientation && orientation.lock) {
        orientation.lock('landscape').catch(() => {
          // Silently fail - not all browsers support this
        });
      }
    } catch (e) {
      // Not supported
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // When dismissed and still in portrait, apply CSS rotation to the root
  useEffect(() => {
    if (dismissed && isPortrait) {
      document.documentElement.style.setProperty('--force-landscape', '1');
      document.body.classList.add('force-landscape');
    } else {
      document.documentElement.style.removeProperty('--force-landscape');
      document.body.classList.remove('force-landscape');
    }
    return () => {
      document.documentElement.style.removeProperty('--force-landscape');
      document.body.classList.remove('force-landscape');
    };
  }, [dismissed, isPortrait]);

  // If not portrait or already dismissed, don't show prompt
  if (!isPortrait || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
      {/* Rotating phone icon */}
      <div className="relative mb-6">
        <div className="w-16 h-28 border-2 border-primary/60 rounded-xl relative overflow-hidden">
          <div className="absolute inset-1 bg-primary/10 rounded-lg" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-5 h-1 bg-primary/30 rounded-full" />
          {/* Rotation arrow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <RotateCcw size={20} className="text-primary animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>
      </div>

      <h2
        className="text-lg font-bold text-foreground mb-2 text-center uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Gire o Celular
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed mb-6">
        O jogo funciona melhor na <strong className="text-foreground">horizontal</strong>.
        Gire o celular ou toque abaixo para forçar a rotação.
      </p>

      <button
        onClick={() => setDismissed(true)}
        className="px-6 py-3 bg-primary text-primary-foreground text-sm uppercase tracking-wider rounded-md hover:opacity-90 active:scale-[0.97] transition-all font-semibold"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Jogar em Landscape
      </button>
    </div>
  );
}
