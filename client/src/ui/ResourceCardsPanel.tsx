import { useState } from 'react';
import { useGameStore } from '../game/store';
import { ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import type { ResourceType } from '../game/types';
import { useT } from '../i18n/useI18n';
import { useNames } from '../i18n/names';
import { TranslationKey } from '../i18n';

const RESOURCE_CONFIG: { key: ResourceType; icon: string; color: string }[] = [
  { key: 'grain',   icon: '🌾', color: '#eab308' },
  { key: 'oil',     icon: '🛢',  color: '#ef4444' },
  { key: 'mineral', icon: '⛏',  color: '#a855f7' },
];

export default function ResourceCardsPanel() {
  const { game } = useGameStore();
  const t = useT();
  const names = useNames();
  const [expanded, setExpanded] = useState(false);
  const { containerRef, dragHandleProps, containerStyle } = useDraggable(() => ({
    x: window.innerWidth - 212,
    y: 56,
  }));

  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const cardIds = player.resourceCards;

  // Territories the player controls (distinct from companies/cards). A controlled
  // territory only produces if a company card is located there.
  const territoryIdsWithMyCompany = new Set(
    cardIds.map(id => game.resourceCards[id]?.territoryId).filter(Boolean) as string[]
  );
  const controlledTerritories = Object.values(game.territories)
    .filter(t => t.owner === player.id && !t.nuked)
    .map(t => ({ id: t.id, name: names.territory(t.id), producing: territoryIdsWithMyCompany.has(t.id) }));
  const producingCount = controlledTerritories.filter(t => t.producing).length;

  const totalProduction: Record<ResourceType, number> = { grain: 0, oil: 0, mineral: 0 };
  const cardsByType: Record<ResourceType, { id: string; name: string; production: number; territory: string }[]> = {
    grain: [], oil: [], mineral: [],
  };
  const specials: { id: string; label: string }[] = [];

  for (const cardId of cardIds) {
    const card = game.resourceCards[cardId];
    if (!card) continue;
    if (card.type === 'grain' || card.type === 'oil' || card.type === 'mineral') {
      totalProduction[card.type] += card.production;
      cardsByType[card.type].push({
        id: cardId,
        name: names.company(cardId, card.companyName),
        production: card.production,
        territory: names.territory(card.territoryId),
      });
    } else {
      specials.push({ id: cardId, label: names.company(cardId, card.companyName) });
    }
  }

  const totalCards = cardIds.length;

  return (
    <div
      ref={containerRef}
      className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl max-w-[200px] z-20 animate-in fade-in slide-in-from-top-2 duration-200"
      style={containerStyle}
    >
      {/* Drag handle + toggle */}
      <div className="flex items-center">
        <div
          {...dragHandleProps}
          className="flex items-center justify-center px-1.5 py-2 rounded-tl-lg hover:bg-secondary/40 transition-colors"
          title={t('status.dragPanel')}
        >
          <GripHorizontal size={12} className="text-muted-foreground/60" />
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-1 flex items-center justify-between px-2 py-2 hover:bg-secondary/30 transition-colors rounded-tr-lg"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]">📋</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              {t('cards.myCards')}
            </span>
            <span className="text-[10px] font-mono bg-secondary text-muted-foreground px-1 py-0.5 rounded-full leading-none">
              {totalCards}
            </span>
          </div>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Summary: companies vs controlled territories are different things */}
          <div className="border-t border-border/50 px-3 py-1.5 bg-secondary/20 grid grid-cols-2 gap-1 text-[9px]">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground uppercase">{t('cards.companies')}</span>
              <span className="text-[11px] font-bold font-mono text-emerald-300">{totalCards}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground uppercase">{t('cards.territories')}</span>
              <span className="text-[11px] font-bold font-mono text-primary">{controlledTerritories.length}</span>
            </div>
          </div>

          <div className="border-t border-border/50 px-3 py-1.5 bg-secondary/20 flex items-center gap-3">
            <span className="text-[9px] text-muted-foreground uppercase">{t('cards.prodPerTurn')}</span>
            {RESOURCE_CONFIG.map(({ key, icon, color }) => (
              <div key={key} className="flex items-center gap-0.5">
                <span className="text-[9px]">{icon}</span>
                <span className="text-[11px] font-bold font-mono" style={{ color }}>
                  {totalProduction[key]}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-border/50 divide-y divide-border/30">
            {RESOURCE_CONFIG.map(({ key, icon, color }) => {
              const cards = cardsByType[key];
              if (cards.length === 0) return null;
              return (
                <div key={key} className="px-3 py-1.5">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[9px]">{icon}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color }}>
                      {t(`resource.${key}` as TranslationKey)} ({cards.length})
                    </span>
                  </div>
                  <div className="space-y-0.5 pl-2">
                    {cards.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground truncate">{c.territory}</span>
                        <span className="text-[10px] font-bold font-mono shrink-0" style={{ color }}>+{c.production}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {specials.length > 0 && (
              <div className="px-3 py-1.5">
                <div className="space-y-0.5">
                  {specials.map(s => (
                    <div key={s.id} className="text-[10px] text-muted-foreground">{s.label}</div>
                  ))}
                </div>
              </div>
            )}

            {totalCards === 0 && (
              <div className="px-3 py-3 text-center text-[10px] text-muted-foreground">
                {t('cards.noCompanies')}
              </div>
            )}
          </div>

          {/* Controlled territories — separate from companies. Shows which produce. */}
          <div className="border-t border-border/50 px-3 py-1.5 max-h-32 overflow-y-auto">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[9px]">🗺️</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-primary">
                {t('cards.controlledTerritories')} ({controlledTerritories.length})
              </span>
            </div>
            {controlledTerritories.length === 0 ? (
              <p className="text-[10px] text-muted-foreground pl-2">{t('cards.noControlled')}</p>
            ) : (
              <div className="space-y-0.5 pl-2">
                {controlledTerritories.map(terr => (
                  <div key={terr.id} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground truncate">{terr.name}</span>
                    <span className={`text-[9px] shrink-0 ${terr.producing ? 'text-emerald-300' : 'text-amber-400/80'}`}>
                      {terr.producing ? t('cards.companyActive') : t('cards.noCompany')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {producingCount < controlledTerritories.length && (
              <p className="text-[9px] text-muted-foreground/70 mt-1 pl-2 leading-snug">
                {t('cards.producingNote', { producing: producingCount, total: controlledTerritories.length })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
