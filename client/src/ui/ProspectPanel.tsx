import { useState } from 'react';
import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';
import { RULES } from '../game/rulesConfig';
import { SUPERPOWERS } from '../data/initialPlayers';
import { Zap } from 'lucide-react';

export default function ProspectPanel() {
  const { game, dispatch } = useGameStore();
  const [prospectCount, setProspectCount] = useState(0);
  
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const costPerCard = RULES.RESEARCH_COST_PER_CARD;
  const totalCost = costPerCard * prospectCount;
  const canProspect = player.money >= totalCost && prospectCount > 0 && game.resourceDeck.length > 0;

  const handleProspect = () => {
    if (!canProspect) return;
    playSound('resource-gain', 0.6);
    for (let i = 0; i < prospectCount; i++) {
      dispatch({ type: 'PROSPECT', cardId: '' });
    }
    setProspectCount(0);
  };

  const deckRemaining = game.resourceDeck.length;
  const cardsInHand = Object.values(game.players).reduce((sum, p) => sum + p.resourceCards.length, 0);

  return (
    <div className="absolute bottom-14 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200 z-10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          🔍 Prospectar Cartas de Recursos
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">
          Saldo: ${player.money.toLocaleString()}
        </span>
      </div>

      {/* Deck info */}
      <div className="mb-3 p-2 bg-secondary/30 rounded text-[10px] text-muted-foreground">
        <p>📚 Cartas no baralho: {deckRemaining}</p>
        <p>🤝 Cartas em mão (todos): {cardsInHand}</p>
      </div>

      {deckRemaining > 0 ? (
        <>
          {/* Quantity selector */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[11px] font-medium">Cartas a prospectar:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  playSound('button-click', 0.4);
                  setProspectCount(Math.max(0, prospectCount - 1));
                }}
                className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-[0.9] text-xs"
              >
                −
              </button>
              <input
                type="number"
                value={prospectCount}
                onChange={(e) => setProspectCount(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                className="w-12 px-2 py-1 bg-background border border-border rounded text-center text-xs font-mono"
                min="0"
                max={Math.min(10, deckRemaining, Math.floor(player.money / costPerCard))}
              />
              <button
                onClick={() => {
                  playSound('button-click', 0.4);
                  setProspectCount(Math.min(10, prospectCount + 1, deckRemaining, Math.floor(player.money / costPerCard)));
                }}
                className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-[0.9] text-xs"
              >
                +
              </button>
            </div>
          </div>

          {/* Cost display */}
          <div className="mb-3 p-2 bg-primary/10 rounded border border-primary/30">
            <div className="flex justify-between items-center text-[11px]">
              <span>Custo por carta:</span>
              <span className="font-mono font-bold">${costPerCard.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] mt-1 font-semibold">
              <span>Total:</span>
              <span className="font-mono text-primary">${totalCost.toLocaleString()}</span>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={handleProspect}
            disabled={!canProspect}
            className={`w-full py-2 rounded font-semibold text-xs uppercase tracking-wider transition-all active:scale-[0.97] ${
              canProspect
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <Zap size={12} className="inline mr-1" />
            Prospectar {prospectCount} {prospectCount === 1 ? 'Carta' : 'Cartas'}
          </button>

          {/* Info */}
          <p className="text-[10px] text-muted-foreground mt-2">
            Você vira cartas do baralho uma por uma. Se encontrar uma carta de recurso, você a compra e a adiciona à sua mão.
            Se encontrar uma bomba ou Laser-Star, você também pode comprá-la.
          </p>
        </>
      ) : (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-center text-[11px] text-destructive">
          <p>Baralho vazio! Nenhuma carta disponível para prospectar.</p>
        </div>
      )}
    </div>
  );
}
