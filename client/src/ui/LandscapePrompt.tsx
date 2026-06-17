import { useState, useEffect } from 'react';
import { Smartphone } from 'lucide-react';

/**
 * LandscapePrompt: On mobile portrait, shows a brief dismissible prompt
 * suggesting the user rotate their device for a better experience.
 * 
 * iOS does NOT support screen.orientation.lock() in Safari.
 * The only reliable approach is:
 * 1. Detect portrait via matchMedia / window dimensions
 * 2. Show a polite suggestion to rotate
 * 3. Let the user dismiss and play in portrait (fully supported)
 * 
 * The game works in both orientations - landscape just gives more map space.
 */
export default function LandscapePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem('landscape-dismissed') === '1';
  });

  useEffect(() => {
    const checkOrientation = () => {
      // Only show on mobile-sized screens in portrait
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 500;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowPrompt(isMobile && isSmallScreen && isPortrait);
    };

    checkOrientation();

    // Use both resize and matchMedia for iOS compatibility
    window.addEventListener('resize', checkOrientation);
    
    // matchMedia is more reliable on iOS for orientation changes
    const mql = window.matchMedia('(orientation: portrait)');
    const handler = () => checkOrientation();
    mql.addEventListener?.('change', handler);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      mql.removeEventListener?.('change', handler);
    };
  }, []);

  // Auto-dismiss when user rotates to landscape
  useEffect(() => {
    if (!showPrompt && dismissed) {
      // Already dismissed, no action needed
    }
  }, [showPrompt]);

  if (!showPrompt || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('landscape-dismissed', '1');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
      {/* Animated phone rotation icon */}
      <div className="relative mb-6">
        <div className="animate-pulse">
          <Smartphone size={48} className="text-blue-400 rotate-90" />
        </div>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping" />
      </div>

      <h2
        className="text-lg font-bold text-white mb-2 text-center uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Gire o celular
      </h2>
      <p className="text-sm text-slate-400 text-center max-w-xs leading-relaxed mb-6">
        O mapa fica muito melhor na <strong className="text-blue-300">horizontal</strong>.
        Mas você pode jogar em retrato também.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleDismiss}
          className="w-full px-6 py-3.5 bg-blue-600 text-white text-sm uppercase tracking-wider rounded-lg hover:bg-blue-500 active:scale-[0.97] transition-all font-semibold shadow-lg shadow-blue-600/30"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Jogar em Retrato
        </button>
        <p className="text-[11px] text-slate-500 text-center">
          Desative o bloqueio de rotação no iOS (Centro de Controle)
        </p>
      </div>
    </div>
  );
}
