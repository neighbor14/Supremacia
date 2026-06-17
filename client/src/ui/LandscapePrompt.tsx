import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * LandscapePrompt: On mobile portrait, shows a brief prompt to rotate.
 * User can dismiss and play in portrait (which is now fully supported).
 * No forced CSS rotation - portrait layout is optimized.
 */
export default function LandscapePrompt() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem('landscape-dismissed') === '1';
  });

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 768 || window.innerHeight < 768;
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(isMobile && portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // If not portrait or already dismissed, don't show prompt
  if (!isPortrait || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('landscape-dismissed', '1');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
      {/* Rotating phone icon */}
      <div className="relative mb-6">
        <div className="w-16 h-28 border-2 border-primary/60 rounded-xl relative overflow-hidden">
          <div className="absolute inset-1 bg-primary/10 rounded-lg" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-5 h-1 bg-primary/30 rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <RotateCcw size={20} className="text-primary animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>
      </div>

      <h2
        className="text-lg font-bold text-foreground mb-2 text-center uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Melhor em Landscape
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed mb-6">
        O mapa fica maior na <strong className="text-foreground">horizontal</strong>.
        Mas você pode jogar em retrato também!
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleDismiss}
          className="w-full px-6 py-3 bg-primary text-primary-foreground text-sm uppercase tracking-wider rounded-md hover:opacity-90 active:scale-[0.97] transition-all font-semibold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Jogar em Retrato
        </button>
        <p className="text-[10px] text-muted-foreground text-center">
          Ou gire o celular para landscape
        </p>
      </div>
    </div>
  );
}
