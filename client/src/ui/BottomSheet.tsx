import { useState } from 'react';
import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';
import { SUPERPOWERS } from '../data/initialPlayers';
import { ResourceType, TurnStage } from '../game/types';
import { RULES } from '../game/rulesConfig';
import { TrendingUp, TrendingDown, Minus as MinusIcon, Plus, X, ShoppingCart, Search } from 'lucide-react';
import ProspectPanel from './ProspectPanel';

export default function BottomSheet() {
  const { game, selectedTerritory, selectedSeaZone, dispatch, selectTerritory } = useGameStore();
  if (!game) return null;

  const { turn } = game;
  const currentPlayer = game.players[turn.currentPlayer];
  const isHuman = currentPlayer.isHuman;

  // Phase panels take priority - territory details shown inline
  if (isHuman) {
    if (turn.stage === 3) return <MarketPanel mode="sell" />;
    if (turn.stage === 7) return <BuyAndProspectPanel />;
    if (turn.stage === 6) return <BuildPanel />;
    if (turn.stage === 5) return <MovePanel />;
    if (turn.stage === 4) return <AttackPanel />;
  }

  // Show territory details only when no phase panel is active
  if (selectedTerritory) {
    const territory = game.territories[selectedTerritory];
    if (!territory) return null;
    const ownerSp = territory.owner ? SUPERPOWERS[territory.owner] : null;
    const armiesHere: Record<string, number> = {};
    for (const [pid, p] of Object.entries(game.players)) {
      if (p.armies[selectedTerritory]) armiesHere[pid] = p.armies[selectedTerritory];
    }

    return (
      <div
        className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200 z-10 max-h-[35vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {ownerSp && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ownerSp.color }} />}
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              {territory.name}
            </h3>
          </div>
          <button onClick={() => selectTerritory(null)} className="w-6 h-6 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80">
            <X size={12} />
          </button>
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
                <span className="text-xs font-mono">{count} exército(s)</span>
              </div>
            ))}
          </div>
        )}

        {/* Resource cards linked to this territory */}
        {game.resourceCards && (() => {
          const linkedCards = Object.values(game.resourceCards).filter(c => c.territoryId === selectedTerritory && c.ownerId === currentPlayer.id);
          if (linkedCards.length === 0) return null;
          return (
            <div className="mt-1">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Cartas neste território:</p>
              <div className="flex flex-wrap gap-1">
                {linkedCards.map(card => (
                  <span key={card.id} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded">
                    {card.type === 'grain' ? '🌾' : card.type === 'oil' ? '🛢️' : '⛏️'} {card.companyName} (+{card.production})
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return null;
}

// ============================================================
// BUY AND PROSPECT PANEL (Stage 7) - Toggle between buy and prospect
// ============================================================

function BuyAndProspectPanel() {
  const [mode, setMode] = useState<'buy' | 'prospect'>('buy');

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border animate-in slide-in-from-bottom-4 duration-200 z-10 max-h-[45vh] overflow-y-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Tab toggle */}
      <div className="flex border-b border-border">
        <button
          onClick={() => { setMode('buy'); playSound('button-click', 0.4); }}
          className={`flex-1 px-3 py-2 text-[11px] uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            mode === 'buy' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <ShoppingCart size={12} /> Comprar Suprimentos
        </button>
        <button
          onClick={() => { setMode('prospect'); playSound('button-click', 0.4); }}
          className={`flex-1 px-3 py-2 text-[11px] uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            mode === 'prospect' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Search size={12} /> Prospectar Cartas
        </button>
      </div>

      {mode === 'buy' ? <MarketPanel mode="buy" /> : <ProspectPanel />}
    </div>
  );
}

// ============================================================
// MARKET PANEL with price chart and quantity controls
// ============================================================

function MarketPanel({ mode }: { mode: 'sell' | 'buy' }) {
  const { game, dispatch } = useGameStore();
  const [quantities, setQuantities] = useState<Record<ResourceType, number>>({ grain: 1, oil: 1, mineral: 1 });

  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const resources: ResourceType[] = ['grain', 'oil', 'mineral'];
  const labels: Record<ResourceType, string> = { grain: 'Cereal', oil: 'Petróleo', mineral: 'Minério' };
  const colors: Record<ResourceType, string> = { grain: '#eab308', oil: '#3b82f6', mineral: '#a855f7' };

  const history = game.market.priceHistory;

  const getTrend = (resource: ResourceType): 'up' | 'down' | 'flat' => {
    if (history.length < 2) return 'flat';
    const prev = history[history.length - 2][resource];
    const curr = history[history.length - 1][resource];
    if (curr > prev) return 'up';
    if (curr < prev) return 'down';
    return 'flat';
  };

  const adjustQty = (resource: ResourceType, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [resource]: Math.max(1, Math.min(10, prev[resource] + delta)),
    }));
  };

  const handleTransaction = (resource: ResourceType) => {
    const qty = quantities[resource];
    if (mode === 'sell') {
      playSound('resource-loss', 0.6);
      dispatch({ type: 'SELL_RESOURCE', resource, quantity: qty });
    } else {
      playSound('resource-gain', 0.6);
      dispatch({ type: 'BUY_RESOURCE', resource, quantity: qty });
    }
  };

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          {mode === 'sell' ? '📈 Vender Suprimentos' : '🛒 Comprar Suprimentos'}
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">
          Saldo: ${player.money.toLocaleString()}
        </span>
      </div>

      {/* Resource rows */}
      <div className="space-y-2.5">
        {resources.map(r => {
          const trend = getTrend(r);
          const price = game.market.prices[r];
          const stock = player.supplies[r];
          const canSell = mode === 'sell' && stock >= quantities[r];
          const canBuy = mode === 'buy' && player.money >= price * quantities[r] && stock + quantities[r] <= player.maxSupply;

          return (
            <div key={r} className="flex items-center gap-2">
              {/* Resource info */}
              <div className="flex items-center gap-1.5 w-16 shrink-0">
                <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: colors[r] }} />
                <span className="text-[11px] font-medium">{labels[r]}</span>
              </div>

              {/* Price + trend */}
              <div className="flex items-center gap-1 w-16 shrink-0">
                <span className="text-xs font-bold font-mono" style={{ color: colors[r] }}>
                  ${price.toLocaleString()}
                </span>
                {trend === 'up' && <TrendingUp size={10} className="text-emerald-400" />}
                {trend === 'down' && <TrendingDown size={10} className="text-red-400" />}
              </div>

              {/* Stock */}
              <span className="text-[10px] text-muted-foreground font-mono w-6 shrink-0">
                x{stock}
              </span>

              {/* Quantity control */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => { playSound('button-click', 0.5); adjustQty(r, -1); }}
                  className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-[0.9]"
                >
                  <MinusIcon size={10} />
                </button>
                <span className="text-[11px] font-mono w-4 text-center">{quantities[r]}</span>
                <button
                  onClick={() => { playSound('button-click', 0.5); adjustQty(r, 1); }}
                  className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-[0.9]"
                >
                  <Plus size={10} />
                </button>
              </div>

              {/* Action button */}
              <button
                onClick={() => handleTransaction(r)}
                disabled={mode === 'sell' ? !canSell : !canBuy}
                className={`
                  text-[10px] px-3 py-1.5 rounded uppercase tracking-wider font-semibold
                  active:scale-[0.95] transition-all shrink-0
                  ${mode === 'sell'
                    ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed'
                    : 'bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed'
                  }
                `}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {mode === 'sell' ? 'Vender' : 'Comprar'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// BUILD PANEL - Enhanced with clearer UX
// ============================================================

function BuildPanel() {
  const { game, dispatch, selectedTerritory, selectTerritory } = useGameStore();
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const homeTs = Object.values(game.territories).filter(t => t.superpowerId === player.id && !t.nuked && t.owner === player.id);
  const foreignTs = Object.entries(player.armies)
    .filter(([tid, count]) => count > 0 && game.territories[tid]?.superpowerId !== player.id && game.territories[tid]?.owner === player.id)
    .map(([tid]) => game.territories[tid])
    .filter(Boolean);

  const allBuildLocations = [...homeTs, ...foreignTs];

  // Navies are built in sea zones adjacent to a port the player controls
  const navalZoneIds = new Set<string>();
  [...homeTs, ...foreignTs].forEach(t => {
    if (t.hasPort) t.adjacentSeas.forEach(s => navalZoneIds.add(s));
  });
  const navalZones = Array.from(navalZoneIds).map(id => game.seaZones[id]).filter(Boolean);

  const hasSupplies = player.supplies.grain >= 1 && player.supplies.oil >= 1 && player.supplies.mineral >= 1;
  const hasMoney = player.money >= RULES.UNIT_COST;
  const canBuild = hasSupplies && hasMoney;

  const handleBuild = (territoryId: string) => {
    playSound('button-click', 0.5);
    dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: territoryId }] });
  };

  const handleBuildNavy = (seaZoneId: string) => {
    playSound('button-click', 0.5);
    dispatch({ type: 'BUILD_UNITS', units: [{ type: 'navy', locationId: seaZoneId }] });
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200 z-10 max-h-[45vh] overflow-y-auto"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-display)' }}>
        🏗️ Construção
      </h3>

      {/* Status info */}
      <div className="flex flex-wrap gap-2 mb-2 text-[10px] text-muted-foreground">
        <span>Saldo: <strong className="text-foreground">${player.money.toLocaleString()}</strong></span>
        <span>🌾{player.supplies.grain} 🛢️{player.supplies.oil} ⛏️{player.supplies.mineral}</span>
        <span className="text-[9px]">(Custo: $1.000 + 1 set por 3 unid.)</span>
      </div>

      {/* Build armies + navies */}
      {canBuild ? (
        <div className="mb-3">
          <p className="text-[10px] text-emerald-400 mb-1.5 font-medium">Selecione onde construir exércitos:</p>
          <div className="flex flex-wrap gap-1.5">
            {allBuildLocations.map(t => (
              <button
                key={t.id}
                onClick={() => handleBuild(t.id)}
                className="text-[11px] px-2.5 py-1.5 bg-emerald-600/20 text-emerald-300 rounded-md hover:bg-emerald-600/30 active:scale-[0.95] border border-emerald-600/30 transition-all"
              >
                +1 🎖️ {t.name}
              </button>
            ))}
          </div>

          {navalZones.length > 0 && (
            <>
              <p className="text-[10px] text-blue-300 mt-2.5 mb-1.5 font-medium">Construir esquadras (zonas com porto):</p>
              <div className="flex flex-wrap gap-1.5">
                {navalZones.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleBuildNavy(s.id)}
                    className="text-[11px] px-2.5 py-1.5 bg-blue-600/20 text-blue-300 rounded-md hover:bg-blue-600/30 active:scale-[0.95] border border-blue-600/30 transition-all"
                  >
                    +1 ⚓ {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mb-3 p-2 bg-destructive/10 rounded-md border border-destructive/20">
          <p className="text-[10px] text-destructive">
            {!hasSupplies && '❌ Suprimentos insuficientes (precisa 1 de cada). '}
            {!hasMoney && '❌ Dinheiro insuficiente ($1.000 por unidade). '}
          </p>
        </div>
      )}

      {/* Research / Build Nukes & Laser-Stars */}
      <div className="border-t border-border/50 pt-2">
        <p className="text-[10px] text-muted-foreground uppercase mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>Armas Especiais</p>
        <div className="flex flex-wrap gap-1.5">
          {!player.hasResearchedNuke && player.money >= RULES.RESEARCH_COST_PER_CARD && (
            <button
              onClick={() => { playSound('button-click', 0.5); dispatch({ type: 'RESEARCH_NUKE', cardId: '' }); }}
              className="text-[10px] px-2.5 py-1.5 bg-destructive/20 text-destructive rounded-md hover:bg-destructive/30 active:scale-[0.95] border border-destructive/30"
            >
              🔬 Pesquisar Bomba ($2.000)
            </button>
          )}
          {player.hasResearchedNuke && player.money >= RULES.NUKE_COST && player.supplies.mineral >= RULES.NUKE_MINERAL_COST && (
            <button
              onClick={() => { playSound('missile-launch', 0.5); dispatch({ type: 'BUILD_NUKE' }); }}
              className="text-[10px] px-2.5 py-1.5 bg-destructive/20 text-destructive rounded-md hover:bg-destructive/30 active:scale-[0.95] border border-destructive/30"
            >
              ☢️ Construir Bomba ($5.000 + 1⛏️)
            </button>
          )}
          {player.hasResearchedNuke && player.nukes > 0 && (
            <span className="text-[10px] px-2 py-1.5 bg-destructive/10 text-destructive rounded-md">
              Bombas: {player.nukes}
            </span>
          )}
          {!player.hasResearchedLaserStar && player.money >= RULES.RESEARCH_COST_PER_CARD && (
            <button
              onClick={() => { playSound('button-click', 0.5); dispatch({ type: 'RESEARCH_LASER_STAR', cardId: '' }); }}
              className="text-[10px] px-2.5 py-1.5 bg-blue-600/20 text-blue-300 rounded-md hover:bg-blue-600/30 active:scale-[0.95] border border-blue-600/30"
            >
              🔬 Pesquisar Laser-Star ($2.000)
            </button>
          )}
          {player.hasResearchedLaserStar && player.money >= RULES.LASER_STAR_COST && player.supplies.mineral >= RULES.LASER_STAR_MINERAL_COST && (
            <button
              onClick={() => { playSound('diplomacy-alert', 0.8); dispatch({ type: 'BUILD_LASER_STAR' }); }}
              className="text-[10px] px-2.5 py-1.5 bg-blue-600/20 text-blue-300 rounded-md hover:bg-blue-600/30 active:scale-[0.95] border border-blue-600/30"
            >
              🛡️ Construir Laser-Star ($10.000 + 2⛏️)
            </button>
          )}
          {player.hasResearchedLaserStar && player.laserStars > 0 && (
            <span className="text-[10px] px-2 py-1.5 bg-blue-600/10 text-blue-300 rounded-md">
              Laser-Stars: {player.laserStars}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MOVE PANEL
// ============================================================

function MovePanel() {
  const { game, selectedTerritory, selectedSeaZone } = useGameStore();
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const myTerritories = Object.entries(player.armies).filter(([, count]) => count > 0);
  const myNavies = Object.entries(player.navies).filter(([, count]) => count > 0);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200 z-10 max-h-[35vh] overflow-y-auto"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-display)' }}>
        🚀 Movimento
      </h3>
      <p className="text-[10px] text-muted-foreground mb-2">
        Toque em um território (exércitos) ou zona marítima (esquadras) para ver destinos.
        Custo: 1 cereal/território | 2 petróleo/voo | 1 petróleo/mar.
      </p>

      {/* Show selected territory/sea actions */}
      {selectedTerritory && <SelectedTerritoryMoveActions />}
      {selectedSeaZone && <SelectedSeaZoneMoveActions />}

      {/* List of territories with armies */}
      <div className="flex flex-wrap gap-1 mt-2">
        {myTerritories.map(([tid, count]) => (
          <span key={tid} className={`text-[10px] px-1.5 py-0.5 rounded ${
            selectedTerritory === tid ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary'
          }`}>
            {game.territories[tid]?.name}: {count}
          </span>
        ))}
      </div>

      {/* List of sea zones with navies */}
      {myNavies.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {myNavies.map(([sid, count]) => (
            <span key={sid} className={`text-[10px] px-1.5 py-0.5 rounded ${
              selectedSeaZone === sid ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-secondary'
            }`}>
              ⚓ {game.seaZones[sid]?.name}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectedTerritoryMoveActions() {
  const { game, selectedTerritory, dispatch } = useGameStore();
  if (!game || !selectedTerritory) return null;

  const player = game.players[game.turn.currentPlayer];
  const territory = game.territories[selectedTerritory];
  const myArmies = player.armies[selectedTerritory] || 0;

  if (myArmies === 0) return null;

  const adjacents = territory.adjacentTerritories.filter(t => !game.territories[t]?.nuked);

  return (
    <div className="bg-secondary/50 rounded-md p-2 mb-2">
      <p className="text-[10px] text-foreground font-medium mb-1">
        Mover de <strong>{territory.name}</strong> ({myArmies} exércitos):
      </p>
      <div className="flex flex-wrap gap-1">
        {adjacents.map(adjId => (
          <button
            key={adjId}
            onClick={() => {
              playSound('button-click', 0.5);
              dispatch({ type: 'MOVE_ARMY', from: selectedTerritory, to: adjId, count: 1 });
            }}
            className="text-[10px] px-2 py-2 bg-primary/20 text-primary rounded hover:bg-primary/30 active:scale-[0.95] border border-primary/20"
          >
            → {game.territories[adjId]?.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectedSeaZoneMoveActions() {
  const { game, selectedSeaZone, dispatch } = useGameStore();
  if (!game || !selectedSeaZone) return null;

  const player = game.players[game.turn.currentPlayer];
  const sea = game.seaZones[selectedSeaZone];
  const myNavies = player.navies[selectedSeaZone] || 0;

  if (myNavies === 0 || !sea) return null;

  return (
    <div className="bg-secondary/50 rounded-md p-2 mb-2">
      <p className="text-[10px] text-foreground font-medium mb-1">
        Mover de <strong>{sea.name}</strong> ({myNavies} esquadra(s)):
      </p>
      <div className="flex flex-wrap gap-1">
        {sea.adjacentSeas.map(adjId => (
          <button
            key={adjId}
            onClick={() => {
              playSound('button-click', 0.5);
              dispatch({ type: 'MOVE_NAVY', from: selectedSeaZone, to: adjId, count: 1 });
            }}
            className="text-[10px] px-2 py-2 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 active:scale-[0.95] border border-blue-500/20"
          >
            → {game.seaZones[adjId]?.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ATTACK PANEL
// ============================================================

function AttackPanel() {
  const { game, selectedTerritory, selectedSeaZone, dispatch } = useGameStore();
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200 z-10 max-h-[35vh] overflow-y-auto"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-1 text-destructive" style={{ fontFamily: 'var(--font-display)' }}>
        ⚔️ Fase de Ataque
      </h3>
      <p className="text-[10px] text-muted-foreground mb-2">
        Território com 2+ exércitos ataca adjacentes; zona marítima com esquadras ataca mares vizinhos.
        Custo: 1 de cada suprimento por batalha.
      </p>

      {/* Show attack options for selected territory/sea */}
      {selectedTerritory && <SelectedTerritoryAttackActions />}
      {selectedSeaZone && <SelectedSeaZoneAttackActions />}

      {player.nukes > 0 && (
        <p className="text-[10px] text-destructive mt-2 p-1.5 bg-destructive/10 rounded">
          ☢ Você tem {player.nukes} bomba(s) nuclear(es). Selecione qualquer território alvo no mapa.
        </p>
      )}
    </div>
  );
}

function SelectedTerritoryAttackActions() {
  const { game, selectedTerritory, dispatch } = useGameStore();
  if (!game || !selectedTerritory) return null;

  const player = game.players[game.turn.currentPlayer];
  const territory = game.territories[selectedTerritory];
  const myArmies = player.armies[selectedTerritory] || 0;

  // Attack from this territory
  if (myArmies > 1) {
    const targets = territory.adjacentTerritories.filter(t => {
      const adj = game.territories[t];
      if (!adj || adj.nuked) return false;
      return adj.owner !== player.id;
    });

    if (targets.length > 0) {
      return (
        <div className="bg-destructive/10 rounded-md p-2 mb-2">
          <p className="text-[10px] text-foreground font-medium mb-1">
            Atacar de <strong>{territory.name}</strong> ({myArmies} exércitos):
          </p>
          <div className="flex flex-wrap gap-1">
            {targets.map(targetId => (
              <button
                key={targetId}
                onClick={() => {
                  playSound('combat-start', 0.7);
                  dispatch({ type: 'ATTACK_TERRITORY', from: selectedTerritory, target: targetId });
                }}
                className="text-[10px] px-2 py-2 bg-destructive/20 text-destructive rounded hover:bg-destructive/30 active:scale-[0.95] border border-destructive/30"
              >
                ⚔ {game.territories[targetId]?.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
  }

  // Nuclear attack on selected territory
  if (player.nukes > 0 && territory.owner !== player.id) {
    return (
      <div className="bg-destructive/10 rounded-md p-2 mb-2">
        <button
          onClick={() => {
            playSound('missile-launch', 0.8);
            dispatch({ type: 'LAUNCH_NUKE', target: selectedTerritory, targetType: 'territory' });
          }}
          className="text-[10px] px-3 py-1.5 bg-destructive text-destructive-foreground rounded uppercase tracking-wider hover:opacity-90 active:scale-[0.95]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          ☢ Lançar Bomba Nuclear em {territory.name}
        </button>
      </div>
    );
  }

  return null;
}

function SelectedSeaZoneAttackActions() {
  const { game, selectedSeaZone, dispatch } = useGameStore();
  if (!game || !selectedSeaZone) return null;

  const player = game.players[game.turn.currentPlayer];
  const sea = game.seaZones[selectedSeaZone];
  const myNavies = player.navies[selectedSeaZone] || 0;

  if (myNavies < 1 || !sea) return null;

  // Adjacent sea zones that hold enemy navies
  const targets = sea.adjacentSeas.filter(sid =>
    Object.entries(game.players).some(([pid, p]) => pid !== player.id && (p.navies[sid] || 0) > 0)
  );

  if (targets.length === 0) return null;

  return (
    <div className="bg-destructive/10 rounded-md p-2 mb-2">
      <p className="text-[10px] text-foreground font-medium mb-1">
        Atacar de <strong>{sea.name}</strong> ({myNavies} esquadra(s)):
      </p>
      <div className="flex flex-wrap gap-1">
        {targets.map(targetId => (
          <button
            key={targetId}
            onClick={() => {
              playSound('combat-start', 0.7);
              dispatch({ type: 'ATTACK_SEA', from: selectedSeaZone, target: targetId });
            }}
            className="text-[10px] px-2 py-2 bg-destructive/20 text-destructive rounded hover:bg-destructive/30 active:scale-[0.95] border border-destructive/30"
          >
            ⚔ {game.seaZones[targetId]?.name}
          </button>
        ))}
      </div>
    </div>
  );
}
