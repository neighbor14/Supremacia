import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';
import { RULES } from '../game/rulesConfig';
import type { ResourceCard } from '../game/types';

type RevealedCard = ResourceCard;

const CARD_LABELS: Record<string, string> = { grain: 'Cereal', oil: 'Petróleo', mineral: 'Minério' };
const CARD_ICONS: Record<string, string> = { grain: '🌾', oil: '🛢', mineral: '⛏' };
const CARD_COLORS: Record<string, string> = { grain: '#eab308', oil: '#ef4444', mineral: '#a855f7' };

export default function ProspectPanel() {
  const { game, dispatch } = useGameStore();
  const [revealed, setRevealed] = useState<RevealedCard[]>([]);
  const [flipping, setFlipping] = useState(false);
  const prevCardIds = useRef<Set<string>>(new Set());

  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const cost = RULES.RESEARCH_COST_PER_CARD;
  const deckLeft = game.resourceDeck.length;
  const canProspect = player.money >= cost && deckLeft > 0 && !flipping;

  // Detect newly added resource cards after each dispatch
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const currentIds = new Set(player.resourceCards);
    const newIds: string[] = [];
    currentIds.forEach(id => {
      if (!prevCardIds.current.has(id)) newIds.push(id);
    });
    if (newIds.length > 0) {
      const newCards: RevealedCard[] = newIds
        .map(id => game.resourceCards[id])
        .filter(Boolean) as RevealedCard[];
      setRevealed(prev => [...prev, ...newCards]);
      setFlipping(false);
    }
    prevCardIds.current = currentIds;
  }, [player.resourceCards, game.resourceCards]);

  // Also reset flipping when any DrawnCardModal fires (covers tech-card-in-deck scenario)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (game.drawnCard?.active) setFlipping(false);
  }, [game.drawnCard?.active, game.drawnCard?.cardId]);

  const handleFlip = () => {
    if (!canProspect) return;
    setFlipping(true);
    playSound('resource-gain', 0.6);
    dispatch({ type: 'PROSPECT', cardId: '' });
  };

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          🔍 Prospectar Cartas
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">
          ${player.money.toLocaleString()} • {deckLeft} cartas
        </span>
      </div>

      {/* Deck visual + flip button */}
      <div className="flex items-center gap-4 mb-4">
        {/* Visual deck stack */}
        <div className="relative flex-shrink-0" style={{ width: 58, height: 80 }}>
          {deckLeft > 2 && (
            <div className="absolute rounded-lg border border-border/40 bg-secondary/50"
              style={{ width: 52, height: 72, top: 6, left: 5 }} />
          )}
          {deckLeft > 1 && (
            <div className="absolute rounded-lg border border-border/60 bg-secondary/70"
              style={{ width: 52, height: 72, top: 3, left: 3 }} />
          )}
          {deckLeft > 0 ? (
            <div
              onClick={canProspect ? handleFlip : undefined}
              className={`absolute rounded-lg border border-border bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center shadow-md transition-transform ${canProspect ? 'cursor-pointer hover:scale-105 active:scale-95' : 'opacity-50'}`}
              style={{ width: 52, height: 72, top: 0, left: 0 }}
            >
              <div className="text-center">
                <div className="text-2xl opacity-40 select-none">🂠</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{deckLeft}</div>
              </div>
            </div>
          ) : (
            <div className="absolute rounded-lg border border-dashed border-border/40 flex items-center justify-center"
              style={{ width: 52, height: 72, top: 0, left: 0 }}>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">Baralho<br/>vazio</span>
            </div>
          )}
        </div>

        {/* Action */}
        <div className="flex-1 flex flex-col gap-1.5">
          <button
            onClick={handleFlip}
            disabled={!canProspect}
            className={`w-full py-2 rounded font-semibold text-xs uppercase tracking-wider transition-all active:scale-[0.97] ${
              canProspect
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground opacity-40 cursor-not-allowed'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {flipping ? '⏳ Virando...' : `Virar Carta  $${cost.toLocaleString()}`}
          </button>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Pague ${cost.toLocaleString()} e veja qual carta sai do baralho.
          </p>
        </div>
      </div>

      {/* Revealed cards this session */}
      {revealed.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
              Reveladas esta sessão ({revealed.length})
            </span>
            <button
              onClick={() => setRevealed([])}
              className="text-[9px] text-muted-foreground hover:text-foreground underline"
            >
              limpar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {revealed.map((card, i) => {
              const color = CARD_COLORS[card.type] ?? '#94a3b8';
              const icon = CARD_ICONS[card.type] ?? '🃏';
              const typeLabel = CARD_LABELS[card.type] ?? card.type;

              return (
                <div
                  key={`${card.id}-${i}`}
                  className="rounded-lg border p-2 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-300"
                  style={{ borderColor: color + '50', backgroundColor: color + '12' }}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-sm leading-none">{icon}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
                      {typeLabel}
                    </span>
                    <span className="ml-auto text-[11px] font-bold font-mono" style={{ color }}>
                      +{card.production}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted-foreground truncate leading-tight">{card.companyName}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">
                    {game.territories[card.territoryId]?.name ?? card.territoryId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {deckLeft === 0 && revealed.length === 0 && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-center text-[11px] text-destructive">
          Baralho vazio — nenhuma carta disponível.
        </div>
      )}
    </div>
  );
}
