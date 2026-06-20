import { useState } from 'react';
import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';
import { SUPERPOWERS } from '../data/initialPlayers';
import { ResourceType, TurnStage } from '../game/types';
import { RULES } from '../game/rulesConfig';
import { TrendingUp, TrendingDown, Minus as MinusIcon, Plus, X, ShoppingCart, Search } from 'lucide-react';
import ProspectPanel from './ProspectPanel';

export default function BottomSheet() {
  const { game, selectedTerritory, selectedSeaZone, dispatch, selectTerritory, selectSeaZone } = useGameStore();
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

  // Ocean detail panel — tap a sea zone (outside the move/attack phases, which
  // render their own panels) to see fleets, embarked armies, capacity and owner.
  if (selectedSeaZone) {
    const sea = game.seaZones[selectedSeaZone];
    if (!sea) return null;
    const forces: { id: keyof typeof SUPERPOWERS; navies: number; embarked: number }[] = [];
    for (const [pid, p] of Object.entries(game.players)) {
      const navies = p.navies[selectedSeaZone] || 0;
      const embarked = p.embarked[selectedSeaZone] || 0;
      if (navies > 0 || embarked > 0) forces.push({ id: pid as keyof typeof SUPERPOWERS, navies, embarked });
    }
    const cap = RULES.NAVY_TRANSPORT_CAPACITY;

    return (
      <div
        className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200 z-10 max-h-[40vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">⚓</span>
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              {sea.name}
            </h3>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
              {sea.type === 'coastal' ? 'Costeiro' : 'Oceânico'}
            </span>
          </div>
          <button onClick={() => selectSeaZone(null)} className="w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80">
            <X size={12} />
          </button>
        </div>

        {forces.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhuma frota nesta zona marítima.</p>
        ) : (
          /* pr-16 keeps the capacity value clear of the bottom-right zoom controls */
          <div className="space-y-1.5 mb-2 pr-16">
            {forces.map(f => {
              const sp = SUPERPOWERS[f.id];
              const capacity = f.navies * cap;
              return (
                <div key={f.id} className="flex items-center gap-2 bg-secondary/40 rounded-md px-2 py-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sp.color }} />
                  <span className="text-[11px] font-semibold w-24 truncate" style={{ color: sp.color }}>{sp.shortName}</span>
                  <span className="text-[11px] font-mono flex items-center gap-1" title="Esquadras (navios)">
                    ⚓ <strong>{f.navies}</strong> <span className="text-muted-foreground">navio(s)</span>
                  </span>
                  <span className="text-[11px] font-mono flex items-center gap-1" title="Exércitos embarcados">
                    🪖 <strong>{f.embarked}</strong>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto" title="Capacidade usada / total">
                    {f.embarked}/{capacity} cap
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="pr-16">
          <p className="text-[10px] text-muted-foreground">
            <span className="text-foreground font-medium">Legenda:</span> ⚓ = esquadras (navios) · 🪖 = exércitos embarcados · cap = ocupação/capacidade ({cap} por navio).
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Para embarcar/desembarcar tropas, entre na fase <strong>Mover</strong> 🚀.
          </p>
        </div>
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
// BUILD PANEL — Mobile-first with cost-before-click UX
// ============================================================

/** Single resource pill shown in the player resource bar */
function ResChip({ icon, value, dim }: { icon: string; value: string | number; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-secondary/70 ${dim ? 'text-muted-foreground' : 'text-foreground'}`}>
      {icon} {value}
    </span>
  );
}

interface BuildActionCardProps {
  icon: string;
  title: string;
  costLabel: string;
  canAfford: boolean;
  missing: string[];
  /** Button label + handler, or null to show location list instead */
  action?: { label: string; onClick: () => void };
  extra?: string;
  children?: React.ReactNode;
}

/** Card that shows an action's cost and affordability before the player commits */
function BuildActionCard({ icon, title, costLabel, canAfford, missing, action, extra, children }: BuildActionCardProps) {
  return (
    <div className={`rounded-lg border p-2.5 ${canAfford ? 'bg-secondary/30 border-border/50' : 'bg-destructive/5 border-destructive/20'}`}>
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0 mt-0.5 leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          {/* Title row + availability badge */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[11px] font-semibold text-foreground leading-tight">{title}</p>
            {canAfford ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 shrink-0" style={{ fontFamily: 'var(--font-display)' }}>DISPONÍVEL</span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-destructive/20 text-destructive shrink-0" style={{ fontFamily: 'var(--font-display)' }}>BLOQUEADO</span>
            )}
          </div>

          {/* Cost line */}
          <p className="text-[10px] text-muted-foreground mb-1">
            <span className="text-muted-foreground/60">Custo:</span> {costLabel}
          </p>

          {/* Missing resources — only when blocked */}
          {!canAfford && missing.length > 0 && (
            <p className="text-[10px] text-destructive font-medium mb-1">
              ⚠ Falta: {missing.join(' · ')}
            </p>
          )}

          {/* Extra info (e.g. current weapon count) */}
          {extra && <p className="text-[10px] text-muted-foreground/60">{extra}</p>}

          {/* Inline children (location buttons) */}
          {canAfford && children && <div className="mt-2">{children}</div>}
        </div>

        {/* Inline action button for one-click actions */}
        {action && (
          <button
            onClick={action.onClick}
            disabled={!canAfford}
            className={`shrink-0 self-center text-[10px] px-3 py-2 rounded-md uppercase tracking-wide font-bold transition-all active:scale-[0.95] ${
              canAfford
                ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-600/30'
                : 'bg-secondary/30 text-muted-foreground/30 border border-border/20 cursor-not-allowed'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

function BuildPanel() {
  const { game, dispatch } = useGameStore();
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];

  // Build locations
  const homeTs = Object.values(game.territories).filter(
    t => t.superpowerId === player.id && !t.nuked && t.owner === player.id
  );
  const foreignTs = Object.entries(player.armies)
    .filter(([tid, count]) => count > 0 && game.territories[tid]?.superpowerId !== player.id && game.territories[tid]?.owner === player.id)
    .map(([tid]) => game.territories[tid])
    .filter(Boolean);
  const allBuildLocations = [...homeTs, ...foreignTs];

  // Naval zones (adjacent to a port the player controls)
  const navalZoneIds = new Set<string>();
  [...homeTs, ...foreignTs].forEach(t => {
    if (t.hasPort) t.adjacentSeas.forEach(s => navalZoneIds.add(s));
  });
  const navalZones = Array.from(navalZoneIds).map(id => game.seaZones[id]).filter(Boolean);

  // Resource snapshot
  const money = player.money;
  const grain = player.supplies.grain;
  const oil = player.supplies.oil;
  const mineral = player.supplies.mineral;

  // Affordability — units (1 unit per click = $1.000 + 1 set of supplies)
  const hasSupplies = grain >= 1 && oil >= 1 && mineral >= 1;
  const hasMoney = money >= RULES.UNIT_COST;
  const canBuildUnit = hasSupplies && hasMoney;
  const unitMissing: string[] = [];
  if (!hasMoney) unitMissing.push(`$${(RULES.UNIT_COST - money).toLocaleString()}`);
  if (grain < 1) unitMissing.push('1 cereal');
  if (oil < 1) unitMissing.push('1 petróleo');
  if (mineral < 1) unitMissing.push('1 minério');

  // Affordability — special weapons
  const canResearchNuke = !player.hasResearchedNuke && money >= RULES.RESEARCH_COST_PER_CARD;
  const nukeResearchMissing = !canResearchNuke && !player.hasResearchedNuke
    ? [`$${(RULES.RESEARCH_COST_PER_CARD - money).toLocaleString()}`] : [];

  const canBuildNuke = player.hasResearchedNuke && money >= RULES.NUKE_COST && mineral >= RULES.NUKE_MINERAL_COST && player.nukes < RULES.MAX_NUKES;
  const nukeBuildMissing: string[] = [];
  if (player.hasResearchedNuke && player.nukes < RULES.MAX_NUKES) {
    if (money < RULES.NUKE_COST) nukeBuildMissing.push(`$${(RULES.NUKE_COST - money).toLocaleString()}`);
    if (mineral < RULES.NUKE_MINERAL_COST) nukeBuildMissing.push(`${RULES.NUKE_MINERAL_COST - mineral} minério`);
  }

  const canResearchLaser = !player.hasResearchedLaserStar && money >= RULES.RESEARCH_COST_PER_CARD;
  const laserResearchMissing = !canResearchLaser && !player.hasResearchedLaserStar
    ? [`$${(RULES.RESEARCH_COST_PER_CARD - money).toLocaleString()}`] : [];

  const canBuildLaser = player.hasResearchedLaserStar && money >= RULES.LASER_STAR_COST && mineral >= RULES.LASER_STAR_MINERAL_COST && player.laserStars < RULES.MAX_LASER_STARS;
  const laserBuildMissing: string[] = [];
  if (player.hasResearchedLaserStar && player.laserStars < RULES.MAX_LASER_STARS) {
    if (money < RULES.LASER_STAR_COST) laserBuildMissing.push(`$${(RULES.LASER_STAR_COST - money).toLocaleString()}`);
    if (mineral < RULES.LASER_STAR_MINERAL_COST) laserBuildMissing.push(`${RULES.LASER_STAR_MINERAL_COST - mineral} minério`);
  }

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border animate-in slide-in-from-bottom-4 duration-200 z-10 max-h-[55vh] overflow-y-auto"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      {/* Header + current resources */}
      <div className="sticky top-0 bg-card/97 backdrop-blur-md px-3 pt-3 pb-2 border-b border-border/40 z-10">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          🏗️ Construção
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <ResChip icon="💵" value={`$${money.toLocaleString()}`} />
          <ResChip icon="🌾" value={grain} dim={grain === 0} />
          <ResChip icon="🛢️" value={oil} dim={oil === 0} />
          <ResChip icon="⛏️" value={mineral} dim={mineral === 0} />
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* ── ARMY ── */}
        <BuildActionCard
          icon="🎖️"
          title="Construir Exército"
          costLabel={`$${RULES.UNIT_COST.toLocaleString()} + 1 cereal + 1 petróleo + 1 minério`}
          canAfford={canBuildUnit}
          missing={unitMissing}
        >
          <p className="text-[10px] text-emerald-400 font-medium mb-1.5">Escolha o território:</p>
          <div className="flex flex-wrap gap-1.5">
            {allBuildLocations.map(t => (
              <button
                key={t.id}
                onClick={() => { playSound('button-click', 0.5); dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: t.id }] }); }}
                className="text-[11px] px-2.5 py-1.5 bg-emerald-600/20 text-emerald-300 rounded-md hover:bg-emerald-600/30 active:scale-[0.95] border border-emerald-600/30"
              >
                +1 {t.name}
              </button>
            ))}
          </div>
        </BuildActionCard>

        {/* ── NAVY ── */}
        {(navalZones.length > 0 || !canBuildUnit) && (
          <BuildActionCard
            icon="⚓"
            title="Construir Esquadra (Navio)"
            costLabel={`$${RULES.UNIT_COST.toLocaleString()} + 1 cereal + 1 petróleo + 1 minério · requer porto`}
            canAfford={canBuildUnit && navalZones.length > 0}
            missing={
              !canBuildUnit ? unitMissing
              : navalZones.length === 0 ? ['nenhum porto sob controle']
              : []
            }
          >
            {navalZones.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {navalZones.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { playSound('button-click', 0.5); dispatch({ type: 'BUILD_UNITS', units: [{ type: 'navy', locationId: s.id }] }); }}
                    className="text-[11px] px-2.5 py-1.5 bg-blue-600/20 text-blue-300 rounded-md hover:bg-blue-600/30 active:scale-[0.95] border border-blue-600/30"
                  >
                    +1 {s.name}
                  </button>
                ))}
              </div>
            )}
          </BuildActionCard>
        )}

        {/* ── SPECIAL WEAPONS ── */}
        <div className="pt-1">
          <p className="text-[10px] text-muted-foreground uppercase mb-2 tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Armas Especiais
          </p>
          <div className="space-y-2">
            {/* Research Nuke */}
            {!player.hasResearchedNuke && (
              <BuildActionCard
                icon="🔬"
                title="Pesquisar Bomba Atômica"
                costLabel={`$${RULES.RESEARCH_COST_PER_CARD.toLocaleString()} · 33% de chance por tentativa`}
                canAfford={canResearchNuke}
                missing={nukeResearchMissing}
                action={{ label: 'Pesquisar', onClick: () => { playSound('button-click', 0.5); dispatch({ type: 'RESEARCH_NUKE', cardId: '' }); } }}
              />
            )}

            {/* Build Nuke */}
            {player.hasResearchedNuke && player.nukes < RULES.MAX_NUKES && (
              <BuildActionCard
                icon="☢️"
                title="Construir Bomba Nuclear"
                costLabel={`$${RULES.NUKE_COST.toLocaleString()} + ${RULES.NUKE_MINERAL_COST} minério`}
                canAfford={canBuildNuke}
                missing={nukeBuildMissing}
                extra={`Em estoque: ${player.nukes} bomba(s) · máx ${RULES.MAX_NUKES}`}
                action={{ label: 'Construir', onClick: () => { playSound('missile-launch', 0.5); dispatch({ type: 'BUILD_NUKE' }); } }}
              />
            )}
            {player.hasResearchedNuke && player.nukes >= RULES.MAX_NUKES && (
              <p className="text-[10px] text-muted-foreground px-1">☢️ Arsenal máximo atingido ({RULES.MAX_NUKES} bombas).</p>
            )}

            {/* Research Laser */}
            {!player.hasResearchedLaserStar && (
              <BuildActionCard
                icon="🔬"
                title="Pesquisar Laser-Star"
                costLabel={`$${RULES.RESEARCH_COST_PER_CARD.toLocaleString()} · 25% de chance por tentativa`}
                canAfford={canResearchLaser}
                missing={laserResearchMissing}
                action={{ label: 'Pesquisar', onClick: () => { playSound('button-click', 0.5); dispatch({ type: 'RESEARCH_LASER_STAR', cardId: '' }); } }}
              />
            )}

            {/* Build Laser */}
            {player.hasResearchedLaserStar && player.laserStars < RULES.MAX_LASER_STARS && (
              <BuildActionCard
                icon="🛡️"
                title="Construir Laser-Star"
                costLabel={`$${RULES.LASER_STAR_COST.toLocaleString()} + ${RULES.LASER_STAR_MINERAL_COST} minério`}
                canAfford={canBuildLaser}
                missing={laserBuildMissing}
                extra={`Em estoque: ${player.laserStars} Laser-Star(s) · máx ${RULES.MAX_LASER_STARS}`}
                action={{ label: 'Construir', onClick: () => { playSound('diplomacy-alert', 0.8); dispatch({ type: 'BUILD_LASER_STAR' }); } }}
              />
            )}
            {player.hasResearchedLaserStar && player.laserStars >= RULES.MAX_LASER_STARS && (
              <p className="text-[10px] text-muted-foreground px-1">🛡️ Arsenal máximo atingido ({RULES.MAX_LASER_STARS} Laser-Stars).</p>
            )}
          </div>
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
        Toque num território (exércitos) ou zona marítima (esquadras) para ver destinos.
        Em território costeiro com frota adjacente aparece <strong className="text-blue-300">⚓ Embarcar</strong>;
        numa frota com tropas a bordo aparece <strong className="text-emerald-300">🪖 Desembarcar</strong>.
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
          {myNavies.map(([sid, count]) => {
            const emb = player.embarked[sid] || 0;
            return (
              <span key={sid} className={`text-[10px] px-1.5 py-0.5 rounded ${
                selectedSeaZone === sid ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-secondary'
              }`}>
                ⚓ {game.seaZones[sid]?.name}: {count}{emb > 0 ? ` · 🪖${emb}` : ''}
              </span>
            );
          })}
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

  // Embark targets: adjacent seas where the player holds a fleet with free capacity.
  const cap = RULES.NAVY_TRANSPORT_CAPACITY;
  const coastalSeas = territory.adjacentSeas.map(sid => {
    const navies = player.navies[sid] || 0;
    const embarked = player.embarked[sid] || 0;
    const free = navies * cap - embarked;
    return { sid, sea: game.seaZones[sid], navies, free };
  }).filter(s => s.sea);

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

      {/* Embark onto an adjacent fleet */}
      {territory.adjacentSeas.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <p className="text-[10px] text-blue-300 font-medium mb-1 flex items-center gap-1">
            ⚓ Embarcar exército:
          </p>
          {coastalSeas.length === 0 ? (
            <p className="text-[9px] text-muted-foreground">Sem zona marítima adjacente.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {coastalSeas.map(({ sid, sea, navies, free }) => {
                const canEmbark = navies > 0 && free > 0;
                const reason = navies === 0 ? 'sem navio adjacente' : free <= 0 ? 'sem capacidade' : '';
                return (
                  <button
                    key={sid}
                    disabled={!canEmbark}
                    onClick={() => {
                      if (!canEmbark) return;
                      playSound('button-click', 0.5);
                      dispatch({ type: 'EMBARK', territoryId: selectedTerritory, seaZoneId: sid, count: 1 });
                    }}
                    title={reason}
                    className={`text-[10px] px-2 py-2 rounded border transition-all ${
                      canEmbark
                        ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 active:scale-[0.95] border-blue-500/30'
                        : 'bg-secondary/30 text-muted-foreground/40 border-border/30 cursor-not-allowed'
                    }`}
                  >
                    ⚓ {sea!.name} {canEmbark ? `(livre ${free})` : `(${reason})`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SelectedSeaZoneMoveActions() {
  const { game, selectedSeaZone, dispatch } = useGameStore();
  if (!game || !selectedSeaZone) return null;

  const player = game.players[game.turn.currentPlayer];
  const sea = game.seaZones[selectedSeaZone];
  const myNavies = player.navies[selectedSeaZone] || 0;
  const myEmbarked = player.embarked[selectedSeaZone] || 0;

  if ((myNavies === 0 && myEmbarked === 0) || !sea) return null;

  // Valid disembark targets: adjacent coastal territories not occupied by an enemy.
  const disembarkTargets = sea.adjacentTerritories
    .map(tid => game.territories[tid])
    .filter(t => {
      if (!t || t.nuked) return false;
      const enemyArmies = Object.entries(game.players).some(
        ([pid, p]) => pid !== player.id && (p.armies[t.id] || 0) > 0
      );
      return !(t.owner && t.owner !== player.id && enemyArmies);
    });

  return (
    <div className="bg-secondary/50 rounded-md p-2 mb-2">
      <p className="text-[10px] text-foreground font-medium mb-1">
        <strong>{sea.name}</strong> — ⚓ {myNavies} esquadra(s){myEmbarked > 0 ? `, 🪖 ${myEmbarked} embarcado(s)` : ''}:
      </p>
      {myNavies > 0 && (
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
      )}

      {/* Disembark onto a coastal territory */}
      {myEmbarked > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <p className="text-[10px] text-emerald-300 font-medium mb-1">🪖 Desembarcar exército:</p>
          {disembarkTargets.length === 0 ? (
            <p className="text-[9px] text-muted-foreground">Nenhum território costeiro válido (ocupado por inimigo ou destruído).</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {disembarkTargets.map(t => (
                <button
                  key={t!.id}
                  onClick={() => {
                    playSound('button-click', 0.5);
                    dispatch({ type: 'DISEMBARK', seaZoneId: selectedSeaZone, territoryId: t!.id, count: 1 });
                  }}
                  className="text-[10px] px-2 py-2 bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500/30 active:scale-[0.95] border border-emerald-500/30"
                >
                  ↓ {t!.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
