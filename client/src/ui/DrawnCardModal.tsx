import { useEffect, useRef } from 'react';
import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';
import { formatOdds } from '../game/researchDeck';
import { RULES } from '../game/rulesConfig';

const RESOURCE_CONFIG = {
  grain:   { icon: '🌾', label: 'Cereal',    color: '#eab308', bg: 'bg-yellow-900/20 border-yellow-500/40' },
  oil:     { icon: '🛢️',  label: 'Petróleo',  color: '#ef4444', bg: 'bg-red-900/20 border-red-500/40' },
  mineral: { icon: '⛏️',  label: 'Minério',   color: '#a855f7', bg: 'bg-purple-900/20 border-purple-500/40' },
};

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
  // Track which card ID last triggered sounds — resets on modal close so each
  // new card (even within the same prospecting/research session) plays fresh sounds.
  const lastSoundedCardRef = useRef<string | null>(null);

  const drawnCard = game?.drawnCard;
  const isResearch = !!drawnCard?.researchTarget;
  const researchFound = isResearch && drawnCard?.success;

  // Prospecting session state
  const isProspecting = !!drawnCard?.prospectTarget;
  const prospectFound = isProspecting && drawnCard?.success;
  // Session still active (not yet finalized inline) = can flip more cards
  const prospectSessionActive = !!game?.prospectingSession && !game.prospectingSession.found;

  // Can the player continue research?
  const currentPlayer = game?.players[game.turn.currentPlayer];
  const canContinueResearch =
    isResearch &&
    !researchFound &&
    !!currentPlayer &&
    currentPlayer.money >= RULES.RESEARCH_COST_PER_CARD &&
    (game?.resourceDeck.length ?? 0) > 0;

  // Can the player flip the next prospect card?
  const canContinueProspect =
    prospectSessionActive &&
    !!currentPlayer &&
    currentPlayer.money >= RULES.RESEARCH_COST_PER_CARD &&
    (game?.resourceDeck.length ?? 0) > 0;

  useEffect(() => {
    if (!drawnCard?.active) {
      lastSoundedCardRef.current = null;
      return;
    }
    // Use cardId (or context as fallback) as unique key per reveal
    const cardKey = drawnCard.cardId ?? drawnCard.context;
    if (lastSoundedCardRef.current === cardKey) return;
    lastSoundedCardRef.current = cardKey;

    // Card flip sound plays immediately as the card arrives on screen
    playSound('card-reveal', 0.9);

    // Result sound plays shortly after, letting the flip finish first
    const t = setTimeout(() => {
      if (drawnCard.success && (isResearch || isProspecting)) {
        playSound('territory-conquered', 1.0);
        setTimeout(() => playSound('diplomacy-alert', 0.7), 600);
      } else if (drawnCard.type === 'resource') {
        playSound('resource-gain', 0.8);
      } else {
        playSound('error', 0.6);
      }
    }, 160);

    return () => clearTimeout(t);
  }, [drawnCard?.active, drawnCard?.cardId, drawnCard?.context]);

  if (!game || !drawnCard?.active) return null;

  const cfg = TYPE_CONFIG[drawnCard.type];

  // For resource cards, overlay the resource color
  const resourceCfg = drawnCard.resourceType ? RESOURCE_CONFIG[drawnCard.resourceType] : null;
  const cardBg = resourceCfg ? resourceCfg.bg : cfg.bgClass;
  const cardIcon = resourceCfg ? resourceCfg.icon : cfg.icon;
  const cardLabel = resourceCfg ? resourceCfg.label : cfg.label;
  const cardLabelClass = resourceCfg ? '' : cfg.labelClass;
  const cardLabelStyle = resourceCfg ? { color: resourceCfg.color } : {};

  const handleContinueResearch = () => {
    playSound('button-click', 0.5);
    dispatch({ type: 'DRAW_RESEARCH_CARD' });
  };

  const handleStopResearch = () => {
    playSound('button-click', 0.3);
    dispatch({ type: 'STOP_RESEARCH' });
  };

  const handleContinueProspect = () => {
    playSound('button-click', 0.5);
    dispatch({ type: 'DRAW_PROSPECT_CARD' });
  };

  const handleStopProspect = () => {
    playSound('button-click', 0.3);
    dispatch({ type: 'STOP_PROSPECT' });
  };

  const handleDismiss = () => {
    playSound('button-click', 0.5);
    dispatch({ type: 'DISMISS_DRAWN_CARD' });
  };

  const targetName = drawnCard.researchTarget === 'nuke' ? 'Bomba Atômica' : 'Laser-Star';
  const prospectTargetLabel = drawnCard.prospectTarget
    ? (drawnCard.prospectTarget === 'grain' ? 'Cereal' : drawnCard.prospectTarget === 'oil' ? 'Petróleo' : 'Minério')
    : '';
  const prospectTargetIcon = drawnCard.prospectTarget
    ? (drawnCard.prospectTarget === 'grain' ? '🌾' : drawnCard.prospectTarget === 'oil' ? '🛢️' : '⛏️')
    : '';

  // Updated odds after this draw (research only)
  const deckLeft = drawnCard.deckRemaining ?? (game.resourceDeck.length);
  const nukeLeft = drawnCard.nukeCardsRemaining ?? 0;
  const laserLeft = drawnCard.laserCardsRemaining ?? 0;
  const nextOdds = drawnCard.researchTarget && deckLeft > 0
    ? formatOdds(
        drawnCard.researchTarget === 'nuke'
          ? nukeLeft / deckLeft
          : laserLeft / deckLeft
      )
    : null;

  // Which buttons section to show
  const showResearchButtons = isResearch && !researchFound;
  // Only show prospect buttons when the current reveal came from a prospecting session (isProspecting),
  // not just because a session happens to be active in the background
  const showProspectButtons = !showResearchButtons && isProspecting && prospectSessionActive && !prospectFound;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
    >
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
          <div className={`rounded-xl border p-4 mb-3 ${cardBg}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl ${cfg.iconBgClass}`}>
                {cardIcon}
              </div>
              <div>
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${cardLabelClass}`}
                  style={{ fontFamily: 'var(--font-display)', ...cardLabelStyle }}>
                  {cardLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(isResearch || isProspecting) ? 'Carta revelada do baralho' : 'Carta sorteada do baralho'}
                </p>
              </div>
            </div>

            <h3 className="text-base font-bold text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              {drawnCard.cardName}
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {drawnCard.cardEffect}
            </p>

            {/* Resource card details */}
            {resourceCfg && drawnCard.production && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-lg">{resourceCfg.icon}</span>
                <span className="text-xs font-mono font-semibold" style={{ color: resourceCfg.color }}>
                  +{drawnCard.production} por turno
                </span>
                {(isResearch || (isProspecting && !prospectFound)) && (
                  <span className="text-xs text-muted-foreground">· voltará ao baralho</span>
                )}
              </div>
            )}
          </div>

          {/* Research session progress */}
          {isResearch && (
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 mb-3 space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Procurando: <strong className="text-foreground">{targetName}</strong></span>
                <span className="font-mono">${drawnCard.researchCostSoFar?.toLocaleString() ?? 0}</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Cartas viradas: <strong className="text-foreground">{drawnCard.researchCardsDrawn}</strong></span>
                <span>Baralho: <strong className="text-foreground">{deckLeft} restantes</strong></span>
              </div>
              {nextOdds && !researchFound && (
                <div className="text-[10px] text-muted-foreground">
                  Chance na próxima carta:{' '}
                  <strong className="text-amber-400">{nextOdds}</strong>
                  {' '}({drawnCard.researchTarget === 'nuke' ? nukeLeft : laserLeft} {targetName}(s) restante(s))
                </div>
              )}
            </div>
          )}

          {/* Prospecting session progress */}
          {isProspecting && (
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 mb-3 space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  Procurando: <strong className="text-foreground">{prospectTargetIcon} {prospectTargetLabel}</strong>
                </span>
                <span className="font-mono">${drawnCard.prospectCostSoFar?.toLocaleString() ?? 0}</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Cartas viradas: <strong className="text-foreground">{drawnCard.prospectCardsFlipped}</strong></span>
                <span>Baralho: <strong className="text-foreground">{game.resourceDeck.length} restantes</strong></span>
              </div>
            </div>
          )}

          {/* Result badge (shown for non-session reveals and for found cards) */}
          {(!isResearch || researchFound) && (!isProspecting || prospectFound) && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-4 ${
              drawnCard.success
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-secondary border border-border'
            }`}>
              <span className="text-lg">{drawnCard.success ? '✅' : '❌'}</span>
              <p className={`text-xs font-semibold ${drawnCard.success ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {drawnCard.success
                  ? isProspecting
                    ? `${prospectTargetLabel} encontrada!`
                    : isResearch
                    ? `${targetName} encontrada!`
                    : 'Carta adquirida!'
                  : 'Não encontrada desta vez.'}
              </p>
            </div>
          )}

          {/* Buttons */}
          {showResearchButtons ? (
            <div className="flex gap-2">
              {canContinueResearch ? (
                <button
                  onClick={handleContinueResearch}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-[0.97]"
                  style={{ fontFamily: 'var(--font-display)', minHeight: '44px' }}
                >
                  Virar Próxima — ${RULES.RESEARCH_COST_PER_CARD.toLocaleString()}
                </button>
              ) : (
                <div className="flex-1 py-3 rounded-xl text-sm text-center text-muted-foreground bg-secondary border border-border">
                  {(currentPlayer?.money ?? 0) < RULES.RESEARCH_COST_PER_CARD
                    ? 'Dinheiro insuficiente'
                    : 'Baralho esgotado'}
                </div>
              )}
              <button
                onClick={handleStopResearch}
                className="px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider bg-secondary hover:bg-secondary/80 text-muted-foreground transition-all active:scale-[0.97] border border-border"
                style={{ fontFamily: 'var(--font-display)', minHeight: '44px' }}
              >
                Parar
              </button>
            </div>
          ) : showProspectButtons ? (
            <div className="flex gap-2">
              {canContinueProspect ? (
                <button
                  onClick={handleContinueProspect}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-[0.97]"
                  style={{ fontFamily: 'var(--font-display)', minHeight: '44px' }}
                >
                  Virar Próxima — ${RULES.RESEARCH_COST_PER_CARD.toLocaleString()}
                </button>
              ) : (
                <div className="flex-1 py-3 rounded-xl text-sm text-center text-muted-foreground bg-secondary border border-border">
                  {(currentPlayer?.money ?? 0) < RULES.RESEARCH_COST_PER_CARD
                    ? 'Dinheiro insuficiente'
                    : 'Baralho esgotado'}
                </div>
              )}
              <button
                onClick={handleStopProspect}
                className="px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider bg-secondary hover:bg-secondary/80 text-muted-foreground transition-all active:scale-[0.97] border border-border"
                style={{ fontFamily: 'var(--font-display)', minHeight: '44px' }}
              >
                Parar
              </button>
            </div>
          ) : (
            <button
              onClick={handleDismiss}
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
          )}
        </div>
      </div>
    </div>
  );
}
