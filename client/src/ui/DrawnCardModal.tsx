import { useEffect, useRef } from 'react';
import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';

const TYPE_CONFIG = {
  nuke: {
    icon: '☢️',
    label: 'Bomba Atômica',
    bgClass: 'bg-destructive/10 border-destructive/40',
    iconBgClass: 'bg-destructive/20',
    labelClass: 'text-destructive',
  },
  laser: {
    icon: '🛡️',
    label: 'Guerra nas Estrelas',
    bgClass: 'bg-blue-900/20 border-blue-500/40',
    iconBgClass: 'bg-blue-600/20',
    labelClass: 'text-blue-300',
  },
  resource: {
    icon: '📋',
    label: 'Carta de Empresa',
    bgClass: 'bg-emerald-900/20 border-emerald-500/40',
    iconBgClass: 'bg-emerald-600/20',
    labelClass: 'text-emerald-300',
  },
};

export default function DrawnCardModal() {
  const { game, dispatch } = useGameStore();
  const soundPlayedRef = useRef(false);

  const drawnCard = game?.drawnCard;

  useEffect(() => {
    if (!drawnCard?.active || soundPlayedRef.current) return;
    soundPlayedRef.current = true;

    if (drawnCard.type === 'resource') {
      playSound('resource-gain', 0.9);
    } else if (drawnCard.success) {
      // Victory fanfare — found the special card!
      playSound('territory-conquered', 1.0);
      // Short delay then a second accent tone
      setTimeout(() => playSound('diplomacy-alert', 0.7), 600);
    } else {
      playSound('error', 0.8);
    }
  }, [drawnCard?.active]);

  // Reset sound flag when modal closes
  useEffect(() => {
    if (!drawnCard?.active) {
      soundPlayedRef.current = false;
    }
  }, [drawnCard?.active]);

  if (!game || !drawnCard?.active) return null;

  const cfg = TYPE_CONFIG[drawnCard.type];

  const handleContinue = () => {
    playSound('button-click', 0.5);
    dispatch({ type: 'DISMISS_DRAWN_CARD' });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleContinue(); }}
    >
      {/* Card panel — bottom sheet on mobile, centered modal on sm+ */}
      <div
        className={`
          w-full sm:max-w-sm
          bg-card border rounded-t-2xl sm:rounded-xl
          animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-250
          ${cfg.bgClass}
        `}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        <div className="px-5 pt-3 pb-4">
          {/* Header */}
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3"
            style={{ fontFamily: 'var(--font-display)' }}>
            {drawnCard.context}
          </p>

          {/* Card visual */}
          <div className={`rounded-xl border p-4 mb-4 ${cfg.bgClass}`}>
            {/* Card type badge */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl ${cfg.iconBgClass}`}>
                {cfg.icon}
              </div>
              <div>
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${cfg.labelClass}`}
                  style={{ fontFamily: 'var(--font-display)' }}>
                  {cfg.label}
                </p>
                <p className="text-xs text-muted-foreground">Carta sorteada do baralho</p>
              </div>
            </div>

            {/* Card name */}
            <h3 className="text-base font-bold text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              {drawnCard.cardName}
            </h3>

            {/* Card effect */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {drawnCard.cardEffect}
            </p>
          </div>

          {/* Result badge */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-4 ${
            drawnCard.success
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-secondary border border-border'
          }`}>
            <span className="text-lg">{drawnCard.success ? '✅' : '❌'}</span>
            <p className={`text-xs font-semibold ${drawnCard.success ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {drawnCard.success ? 'Descoberta com sucesso!' : 'Não encontrada desta vez.'}
            </p>
          </div>

          {/* Continue button — min 44px touch target */}
          <button
            onClick={handleContinue}
            className={`
              w-full py-3 rounded-xl text-sm font-semibold uppercase tracking-wider
              transition-all active:scale-[0.97]
              ${drawnCard.success
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }
            `}
            style={{ fontFamily: 'var(--font-display)', minHeight: '44px' }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
