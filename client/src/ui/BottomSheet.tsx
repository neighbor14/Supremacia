import { useState } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { ResourceType, UnitType, TurnStage } from '../game/types';
import { RULES } from '../game/rulesConfig';

export default function BottomSheet() {
  const { game, selectedTerritory, selectedSeaZone, dispatch, uiMode, setUiMode, selectTerritory } = useGameStore();
  if (!game) return null;

  const { turn } = game;
  const currentPlayer = game.players[turn.currentPlayer];
  const isHuman = currentPlayer.isHuman;

  // Show territory details
  if (selectedTerritory) {
    const territory = game.territories[selectedTerritory];
    if (!territory) return null;
    const ownerSp = territory.owner ? SUPERPOWERS[territory.owner] : null;
    const armiesHere: Record<string, number> = {};
    for (const [pid, p] of Object.entries(game.players)) {
      if (p.armies[selectedTerritory]) armiesHere[pid] = p.armies[selectedTerritory];
    }

    return (
      <div className="absolute bottom-14 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {ownerSp && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ownerSp.color }} />}
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              {territory.name}
            </h3>
          </div>
          <button onClick={() => selectTerritory(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>

        {territory.nuked && (
          <p className="text-xs text-destructive mb-2">☢ Território destruído por bomba nuclear</p>
        )}

        {/* Armies */}
        {Object.keys(armiesHere).length > 0 && (
          <div className="flex gap-3 mb-2">
            {Object.entries(armiesHere).map(([pid, count]) => (
              <div key={pid} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SUPERPOWERS[pid as keyof typeof SUPERPOWERS].color }} />
                <span className="text-xs font-mono-num">{count} exército(s)</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions for human player */}
        {isHuman && !territory.nuked && (
          <TerritoryActions territoryId={selectedTerritory} />
        )}
      </div>
    );
  }

  // Show market/build/move panels based on current stage
  if (isHuman && turn.stage === 3) return <MarketPanel mode="sell" />;
  if (isHuman && turn.stage === 7) return <MarketPanel mode="buy" />;
  if (isHuman && turn.stage === 6) return <BuildPanel />;
  if (isHuman && turn.stage === 5) return <MovePanel />;
  if (isHuman && turn.stage === 4) return <AttackPanel />;

  return null;
}

function TerritoryActions({ territoryId }: { territoryId: string }) {
  const { game, dispatch } = useGameStore();
  if (!game) return null;

  const { turn } = game;
  const player = game.players[turn.currentPlayer];
  const territory = game.territories[territoryId];
  const myArmies = player.armies[territoryId] || 0;

  // Move action (stage 5)
  if (turn.stage === 5 && myArmies > 0) {
    const adjacents = territory.adjacentTerritories.filter(t => !game.territories[t]?.nuked);
    return (
      <div>
        <p className="text-[10px] text-muted-foreground uppercase mb-1" style={{ fontFamily: 'var(--font-display)' }}>Mover exércitos de {territory.name}</p>
        <div className="flex flex-wrap gap-1">
          {adjacents.map(adjId => (
            <button
              key={adjId}
              onClick={() => dispatch({ type: 'MOVE_ARMY', from: territoryId, to: adjId, count: 1 })}
              className="text-[10px] px-2 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 active:scale-[0.97]"
            >
              → {game.territories[adjId]?.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Attack action (stage 4)
  if (turn.stage === 4 && myArmies > 1) {
    const targets = territory.adjacentTerritories.filter(t => {
      const adj = game.territories[t];
      if (!adj || adj.nuked) return false;
      return adj.owner !== player.id;
    });
    if (targets.length > 0) {
      return (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase mb-1" style={{ fontFamily: 'var(--font-display)' }}>Atacar a partir de {territory.name}</p>
          <div className="flex flex-wrap gap-1">
            {targets.map(targetId => (
              <button
                key={targetId}
                onClick={() => dispatch({ type: 'ATTACK_TERRITORY', from: territoryId, target: targetId })}
                className="text-[10px] px-2 py-1 bg-destructive/80 text-destructive-foreground rounded hover:bg-destructive active:scale-[0.97]"
              >
                ⚔ {game.territories[targetId]?.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
  }

  // Nuclear attack
  if (turn.stage === 4 && player.nukes > 0) {
    return (
      <div>
        <button
          onClick={() => dispatch({ type: 'LAUNCH_NUKE', target: territoryId, targetType: 'territory' })}
          className="text-[10px] px-3 py-1.5 bg-destructive text-destructive-foreground rounded uppercase tracking-wider hover:opacity-90 active:scale-[0.97]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          ☢ Lançar Bomba Nuclear
        </button>
      </div>
    );
  }

  return null;
}

function MarketPanel({ mode }: { mode: 'sell' | 'buy' }) {
  const { game, dispatch } = useGameStore();
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const resources: ResourceType[] = ['grain', 'oil', 'mineral'];
  const labels: Record<ResourceType, string> = { grain: 'Cereal', oil: 'Petróleo', mineral: 'Minério' };
  const colors: Record<ResourceType, string> = { grain: '#eab308', oil: '#1e293b', mineral: '#94a3b8' };

  return (
    <div className="absolute bottom-14 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-display)' }}>
        {mode === 'sell' ? 'Mercado — Vender' : 'Mercado — Comprar'}
      </h3>
      <div className="space-y-2">
        {resources.map(r => (
          <div key={r} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: colors[r] }} />
              <span className="text-xs">{labels[r]}</span>
              <span className="text-[10px] text-muted-foreground font-mono-num">
                (estoque: {player.supplies[r]})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-num text-primary">
                ${game.market.prices[r].toLocaleString()}
              </span>
              {mode === 'sell' && player.supplies[r] > 0 && (
                <button
                  onClick={() => dispatch({ type: 'SELL_RESOURCE', resource: r, quantity: 1 })}
                  className="text-[10px] px-2 py-0.5 bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 active:scale-[0.97]"
                >
                  Vender 1
                </button>
              )}
              {mode === 'buy' && player.money >= game.market.prices[r] && player.supplies[r] < player.maxSupply && (
                <button
                  onClick={() => dispatch({ type: 'BUY_RESOURCE', resource: r, quantity: 1 })}
                  className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary rounded hover:bg-primary/30 active:scale-[0.97]"
                >
                  Comprar 1
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildPanel() {
  const { game, dispatch } = useGameStore();
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const homeTs = Object.values(game.territories).filter(t => t.superpowerId === player.id && !t.nuked && t.owner === player.id);
  const canBuild = player.supplies.grain >= 1 && player.supplies.oil >= 1 && player.supplies.mineral >= 1 && player.money >= RULES.UNIT_COST;

  return (
    <div className="absolute bottom-14 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Construção
      </h3>

      {/* Build armies */}
      {canBuild ? (
        <div className="space-y-1.5 mb-3">
          <p className="text-[10px] text-muted-foreground">Custo: $1.000 + 1 set de suprimentos por 3 unidades</p>
          <div className="flex flex-wrap gap-1">
            {homeTs.map(t => (
              <button
                key={t.id}
                onClick={() => dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: t.id }] })}
                className="text-[10px] px-2 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 active:scale-[0.97]"
              >
                +1 Exército em {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground mb-3">Suprimentos ou dinheiro insuficientes.</p>
      )}

      {/* Research / Build Nukes */}
      <div className="flex flex-wrap gap-1">
        {!player.hasResearchedNuke && player.money >= RULES.RESEARCH_COST_PER_CARD && (
          <button
            onClick={() => dispatch({ type: 'RESEARCH_NUKE', cardId: '' })}
            className="text-[10px] px-2 py-1 bg-destructive/20 text-destructive rounded hover:bg-destructive/30 active:scale-[0.97]"
          >
            Pesquisar Bomba ($2.000)
          </button>
        )}
        {player.hasResearchedNuke && player.money >= RULES.NUKE_COST && player.supplies.mineral >= RULES.NUKE_MINERAL_COST && (
          <button
            onClick={() => dispatch({ type: 'BUILD_NUKE' })}
            className="text-[10px] px-2 py-1 bg-destructive/20 text-destructive rounded hover:bg-destructive/30 active:scale-[0.97]"
          >
            Construir Bomba ($5.000)
          </button>
        )}
        {!player.hasResearchedLaserStar && player.money >= RULES.RESEARCH_COST_PER_CARD && (
          <button
            onClick={() => dispatch({ type: 'RESEARCH_LASER_STAR', cardId: '' })}
            className="text-[10px] px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 active:scale-[0.97]"
          >
            Pesquisar Laser-Star ($2.000)
          </button>
        )}
        {player.hasResearchedLaserStar && player.money >= RULES.LASER_STAR_COST && player.supplies.mineral >= RULES.LASER_STAR_MINERAL_COST && (
          <button
            onClick={() => dispatch({ type: 'BUILD_LASER_STAR' })}
            className="text-[10px] px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 active:scale-[0.97]"
          >
            Construir Laser-Star ($10.000)
          </button>
        )}
      </div>
    </div>
  );
}

function MovePanel() {
  const { game } = useGameStore();
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const myTerritories = Object.entries(player.armies).filter(([, count]) => count > 0);

  return (
    <div className="absolute bottom-14 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Movimento — Selecione um território no mapa
      </h3>
      <p className="text-[10px] text-muted-foreground">
        Toque em um território com seus exércitos para ver opções de movimento.
        Custo: 1 cereal por território.
      </p>
      <div className="flex flex-wrap gap-1 mt-2">
        {myTerritories.map(([tid, count]) => (
          <span key={tid} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded">
            {game.territories[tid]?.name}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}

function AttackPanel() {
  const { game } = useGameStore();
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];

  return (
    <div className="absolute bottom-14 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 text-destructive" style={{ fontFamily: 'var(--font-display)' }}>
        Fase de Ataque
      </h3>
      <p className="text-[10px] text-muted-foreground">
        Selecione um território com 2+ exércitos para atacar adjacentes.
        Custo: 1 de cada suprimento por batalha.
      </p>
      {player.nukes > 0 && (
        <p className="text-[10px] text-destructive mt-1">
          ☢ Você tem {player.nukes} bomba(s) nuclear(es). Selecione um território alvo.
        </p>
      )}
    </div>
  );
}
