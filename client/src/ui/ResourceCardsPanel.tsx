import { useState } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ResourceCardsPanel() {
  const { game, selectedTerritory } = useGameStore();
  const [expanded, setExpanded] = useState(true);

  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const cardIds = player.resourceCards;

  // Group by territory
  const cardsByTerritory: Record<string, string[]> = {};
  cardIds.forEach(cardId => {
    const card = game.resourceCards[cardId];
    if (card) {
      if (!cardsByTerritory[card.territoryId]) {
        cardsByTerritory[card.territoryId] = [];
      }
      cardsByTerritory[card.territoryId].push(cardId);
    }
  });

  // Calculate total production
  const totalProduction: Record<string, number> = {
    grain: 0,
    oil: 0,
    mineral: 0,
  };
  cardIds.forEach(cardId => {
    const card = game.resourceCards[cardId];
    if (card && (card.type === 'grain' || card.type === 'oil' || card.type === 'mineral')) {
      totalProduction[card.type] += card.production;
    }
  });

  const resourceColors = {
    grain: '#fbbf24',
    oil: '#ef4444',
    mineral: '#8b5cf6',
  };

  return (
    <div className="absolute top-16 right-4 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg max-w-xs z-20 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          📋 Minhas Cartas ({cardIds.length})
        </h3>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <>
          {/* Production Summary */}
          <div className="border-t border-border px-3 py-2 bg-secondary/20">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Produção Total/Turno:</p>
            <div className="flex gap-2">
              {(['grain', 'oil', 'mineral'] as const).map(resource => (
                <div key={resource} className="flex items-center gap-1 text-[10px]">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: resourceColors[resource] }} />
                  <span className="font-mono font-bold">{totalProduction[resource]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cards list */}
          <div className="border-t border-border max-h-64 overflow-y-auto">
            {cardIds.length === 0 ? (
              <div className="p-3 text-center text-[10px] text-muted-foreground">
                Nenhuma carta ainda. Conquiste territórios ou prospere cartas!
              </div>
            ) : (
              Object.entries(cardsByTerritory).map(([territoryId, territoryCardIds]) => {
                const territory = game.territories[territoryId];
                const territoryOwner = territory?.owner;
                const isSelected = selectedTerritory === territoryId;

                return (
                  <div
                    key={territoryId}
                    className={`border-b border-border/50 last:border-b-0 p-2 text-[10px] ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-secondary/20'
                    } transition-colors`}
                  >
                    {/* Territory header */}
                    <div className="flex items-center gap-1.5 mb-1.5 font-semibold">
                      {territoryOwner && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: SUPERPOWERS[territoryOwner].color }}
                        />
                      )}
                      <span className="text-[11px]">{territory?.name || territoryId}</span>
                      <span className="text-muted-foreground ml-auto">({territoryCardIds.length})</span>
                    </div>

                    {/* Cards in this territory */}
                    <div className="space-y-1 ml-3">
                      {territoryCardIds.map(cardId => {
                        const cardObj = game.resourceCards[cardId];
                        if (!cardObj) return null;
                        return (
                          <div key={cardId} className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {cardObj.companyName.includes('Bomba') && '💣 Bomba'}
                              {cardObj.companyName.includes('Laser') && '⭐ Laser-Star'}
                              {cardObj.type === 'grain' && '🌾 Cereal'}
                              {cardObj.type === 'oil' && '🛢️ Petróleo'}
                              {cardObj.type === 'mineral' && '⛏️ Minério'}
                            </span>
                            {cardObj.type !== 'grain' && cardObj.type !== 'oil' && cardObj.type !== 'mineral' && !cardObj.companyName.includes('Bomba') && !cardObj.companyName.includes('Laser') ? null : (
                              cardObj.type === 'grain' || cardObj.type === 'oil' || cardObj.type === 'mineral' ? (
                                <span className="font-mono font-bold text-foreground">+{cardObj.production}</span>
                              ) : null
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
