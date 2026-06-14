import { useState, useEffect } from 'react';
import { RotateCcw, X } from 'lucide-react';

export default function LandscapePrompt() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Only show on mobile-sized screens (< 768px width)
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

  if (!isPortrait || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Fechar"
      >
        <X size={16} />
      </button>

      {/* Rotating phone icon */}
      <div className="relative mb-8">
        <div className="w-20 h-32 border-2 border-primary/60 rounded-xl relative overflow-hidden animate-[tilt_2s_ease-in-out_infinite]">
          <div className="absolute inset-1 bg-primary/10 rounded-lg" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-1 bg-primary/30 rounded-full" />
        </div>
        <RotateCcw size={24} className="absolute -bottom-2 -right-4 text-primary animate-spin" style={{ animationDuration: '3s' }} />
      </div>

      <h2
        className="text-xl font-bold text-foreground mb-3 text-center uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Gire o Celular
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed">
        Para uma melhor experiência no mapa, jogue com o celular na <strong className="text-foreground">horizontal</strong> (landscape).
      </p>

      <button
        onClick={() => setDismissed(true)}
        className="mt-8 px-6 py-2.5 bg-secondary text-secondary-foreground text-xs uppercase tracking-wider rounded-md hover:bg-secondary/80 active:scale-[0.97] transition-all"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Jogar assim mesmo
      </button>
    </div>
  );
}
