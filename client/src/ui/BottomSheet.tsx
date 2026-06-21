import { useState } from 'react';
import { toast } from 'sonner';
import { useGameStore, getMoveBlockReason, moveBlockMessage, companiesInTerritory, getBuildTargets } from '../game/store';
import { playSound } from '../game/audio';
import { SUPERPOWERS } from '../data/initialPlayers';
import { ResourceType, TurnStage } from '../game/types';
import { RULES } from '../game/rulesConfig';
import { TrendingUp, TrendingDown, Minus as MinusIcon, Plus, X, ShoppingCart, Search, ChevronDown, ChevronUp } from 'lucide-react';
import ProspectPanel from './ProspectPanel';
import { getTechCounts, formatOdds } from '../game/researchDeck';
import { getCompanyOpportunities } from '../game/companyMap';

const RESOURCE_PT: Record<ResourceType, string> = { grain: 'Cereal', oil: 'Petróleo', mineral: 'Minério' };
const RESOURCE_ICON_PT: Record<ResourceType, string> = { grain: '🌾', oil: '🛢️', mineral: '⛏️' };

export default function BottomSheet() {
  const { game, selectedTerritory, selectedSeaZone, dispatch, selectTerritory, selectSeaZone, companyMapVisible } = useGameStore();
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
    const isMine = territory.owner === currentPlayer.id;
    const armiesHere: Record<string, number> = {};
    for (const [pid, p] of Object.entries(game.players)) {
      if (p.armies[selectedTerritory]) armiesHere[pid] = p.armies[selectedTerritory];
    }

    // Company located here that the human player owns (an "active company").
    const myCompanyIds = companiesInTerritory(game, selectedTerritory, currentPlayer.id);
    const myCompanies = myCompanyIds.map(id => game.resourceCards[id]).filter(Boolean);
    // A company exists here but belongs to someone else / undiscovered.
    const hasForeignCompany = companiesInTerritory(game, selectedTerritory).some(id => !myCompanyIds.includes(id) && game.resourceCards[id]?.revealed);

    // Company-map opportunity for this territory (only when overlay is active).
    const companyOpportunity = companyMapVisible && isHuman
      ? getCompanyOpportunities(game, currentPlayer.id).get(selectedTerritory) ?? null
      : null;

    // Build eligibility (mirrors BuildPanel rule): own, non-nuked land territory.
    const canBuildHere = isMine && !territory.nuked;
    const buildReason = territory.nuked
      ? 'território destruído por bomba nuclear'
      : !territory.owner
        ? 'território neutro — conquiste-o primeiro movendo um exército para cá'
        : !isMine
          ? `controlado por ${ownerSp?.shortName ?? 'outro jogador'}`
          : 'território seu';

    return (
      <div
        className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-3 animate-in slide-in-from-bottom-4 duration-200 z-10 max-h-[42vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {ownerSp
              ? <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ownerSp.color }} />
              : <div className="w-3 h-3 rounded-full border border-border bg-secondary" title="Neutro" />}
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              {territory.name}
            </h3>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
              Território terrestre
            </span>
          </div>
          <button onClick={() => selectTerritory(null)} className="w-6 h-6 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80">
            <X size={12} />
          </button>
        </div>

        {territory.nuked && (
          <p className="text-xs text-destructive mb-2">☢ Território destruído por bomba nuclear</p>
        )}

        {/* Company-map opportunity badge — only visible when overlay is active */}
        {companyOpportunity && (
          <div className={`flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md text-[11px] border ${
            companyOpportunity === 'own'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : companyOpportunity === 'neutral'
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span>{companyOpportunity === 'own' ? '🟡' : companyOpportunity === 'neutral' ? '🔵' : '🔴'}</span>
            <span>
              {companyOpportunity === 'own'
                ? 'Você possui companhia aqui e controla o território.'
                : companyOpportunity === 'neutral'
                  ? 'Você possui companhia aqui. Conquiste o território para maximizar produção.'
                  : 'Você possui companhia aqui, mas o território pertence a outro jogador.'}
            </span>
          </div>
        )}

        {/* Controller / owner line */}
        <div className="flex items-center gap-1.5 mb-1.5 text-[11px]">
          <span className="text-muted-foreground">Controlador:</span>
          {ownerSp
            ? <span className="font-semibold" style={{ color: ownerSp.color }}>{ownerSp.name}{isMine ? ' (você)' : ''}</span>
            : <span className="font-semibold text-muted-foreground">Neutro (sem controlador)</span>}
        </div>

        {/* Armies */}
        {Object.keys(armiesHere).length > 0 ? (
          <div className="flex gap-3 mb-2">
            {Object.entries(armiesHere).map(([pid, count]) => (
              <div key={pid} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SUPERPOWERS[pid as keyof typeof SUPERPOWERS].color }} />
                <span className="text-xs font-mono">{count} exército(s)</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground mb-2">Nenhum exército presente.</p>
        )}

        {/* Company / resource status — território controlado ≠ companhia */}
        <div className="rounded-md bg-secondary/40 border border-border/50 p-2 mb-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Companhia / Carta de recurso</p>
          {myCompanies.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {myCompanies.map(card => (
                <span key={card!.id} className="text-[11px] px-1.5 py-0.5 bg-emerald-600/15 text-emerald-300 border border-emerald-600/30 rounded">
                  {RESOURCE_ICON_PT[card!.type]} {card!.companyName} · {RESOURCE_PT[card!.type]} +{card!.production}/turno
                </span>
              ))}
            </div>
          ) : hasForeignCompany ? (
            <p className="text-[11px] text-muted-foreground">
              Há uma companhia aqui que pertence a outro jogador. Conquiste o território para capturá-la.
            </p>
          ) : (
            <p className="text-[11px] text-amber-300/90">
              {isMine
                ? 'Você controla este território, mas ainda não possui uma companhia de recurso aqui.'
                : 'Nenhuma companhia ativa conhecida neste território.'}
            </p>
          )}
          {myCompanies.length === 0 && (
            <button
              onClick={() => toast.info('Companhias são obtidas por prospecção (fase Comprar 🛒 → Prospectar), negociação ou conquista de territórios que já possuíam cartas de recurso. Controlar um território não garante produção automática.', { duration: 8000 })}
              className="mt-1.5 text-[10px] px-2 py-1 rounded bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 active:scale-[0.97]"
            >
              ❓ Como obter uma companhia?
            </button>
          )}
        </div>

        {/* Build eligibility */}
        <div className="flex items-start gap-1.5 text-[11px]">
          <span className="text-muted-foreground shrink-0">Construir exército:</span>
          {canBuildHere
            ? <span className="text-emerald-300 font-semibold">Sim ✓ <span className="text-muted-foreground font-normal">({buildReason})</span></span>
            : <span className="text-muted-foreground">Não — {buildReason}</span>}
        </div>
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

  // Compares the live current price with the last end-of-round snapshot so the
  // arrow reflects transactions that already happened within this round.
  const getTrend = (resource: ResourceType): 'up' | 'down' | 'flat' => {
    if (history.length === 0) return 'flat';
    const roundStartPrice = history[history.length - 1][resource];
    const currentPrice = game.market.prices[resource];
    if (currentPrice > roundStartPrice) return 'up';
    if (currentPrice < roundStartPrice) return 'down';
    return 'flat';
  };

  // Price the resource will reach after `qty` units are traded.
  const previewPriceAfter = (resource: ResourceType, qty: number): number => {
    let p = game.market.prices[resource];
    const { minPrice, maxPrice, priceStep } = game.market;
    for (let i = 0; i < qty; i++) {
      if (mode === 'sell') p = Math.max(minPrice, p - priceStep);
      else p = Math.min(maxPrice, p + priceStep);
    }
    return p;
  };

  // Total money received (sell) or spent (buy) for `qty` units, accounting for
  // the sliding price per unit.
  const previewTotal = (resource: ResourceType, qty: number): number => {
    let p = game.market.prices[resource];
    const { minPrice, maxPrice, priceStep } = game.market;
    let total = 0;
    for (let i = 0; i < qty; i++) {
      total += p;
      if (mode === 'sell') p = Math.max(minPrice, p - priceStep);
      else p = Math.min(maxPrice, p + priceStep);
    }
    return total;
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
          const qty = quantities[r];
          const priceAfter = previewPriceAfter(r, qty);
          const total = previewTotal(r, qty);
          const canSell = mode === 'sell' && stock >= qty;
          const canBuy = mode === 'buy' && player.money >= total && stock + qty <= player.maxSupply;

          return (
            <div key={r} className="flex items-center gap-2">
              {/* Resource info */}
              <div className="flex items-center gap-1.5 w-16 shrink-0">
                <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: colors[r] }} />
                <span className="text-[11px] font-medium">{labels[r]}</span>
              </div>

              {/* Price + trend + impact preview */}
              <div className="flex flex-col gap-0.5 w-20 shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold font-mono" style={{ color: colors[r] }}>
                    ${price.toLocaleString()}
                  </span>
                  {trend === 'up' && <TrendingUp size={10} className="text-emerald-400" />}
                  {trend === 'down' && <TrendingDown size={10} className="text-red-400" />}
                  {trend === 'flat' && <MinusIcon size={10} className="text-muted-foreground/40" />}
                </div>
                {priceAfter !== price && (
                  <span className={`text-[9px] font-mono flex items-center gap-0.5 ${
                    mode === 'sell' ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {mode === 'sell' ? <TrendingDown size={8} /> : <TrendingUp size={8} />}
                    ${priceAfter.toLocaleString()}
                  </span>
                )}
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
                <span className="text-[11px] font-mono w-4 text-center">{qty}</span>
                <button
                  onClick={() => { playSound('button-click', 0.5); adjustQty(r, 1); }}
                  className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-[0.9]"
                >
                  <Plus size={10} />
                </button>
              </div>

              {/* Action button — shows total value of the transaction */}
              <button
                onClick={() => handleTransaction(r)}
                disabled={mode === 'sell' ? !canSell : !canBuy}
                className={`
                  flex flex-col items-center text-[10px] px-2 py-1 rounded uppercase tracking-wider font-semibold
                  active:scale-[0.95] transition-all shrink-0
                  ${mode === 'sell'
                    ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed'
                    : 'bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed'
                  }
                `}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span>{mode === 'sell' ? 'Vender' : 'Comprar'}</span>
                <span className="text-[8px] font-mono normal-case tracking-normal opacity-80">
                  {mode === 'sell' ? '+' : '-'}${total.toLocaleString()}
                </span>
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

/** Compact resource pill for the build HUD header / "você tem" strip. */
function ResChip({ icon, value, dim }: { icon: string; value: string | number; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${dim ? 'bg-destructive/15 text-destructive border border-destructive/30' : 'bg-secondary/70 text-foreground'}`}>
      {icon} {value}
    </span>
  );
}

/** One tappable tile in the compact build menu (army / navy / weapon). */
function BuildTile({
  icon, title, cost, ready, badge, onClick,
}: {
  icon: string;
  title: string;
  cost: string;
  ready: boolean;
  badge: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={ready ? onClick : undefined}
      disabled={!ready}
      className={`flex items-start gap-2 text-left rounded-lg border p-2 transition-all min-h-[3.25rem] ${
        ready
          ? 'bg-secondary/40 border-border/60 hover:bg-secondary/60 active:scale-[0.98]'
          : 'bg-destructive/5 border-destructive/20 opacity-70 cursor-not-allowed'
      }`}
    >
      <span className="text-lg leading-none mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-foreground leading-tight truncate">{title}</span>
          <span
            className={`text-[8px] px-1 py-0.5 rounded-full font-bold shrink-0 ${ready ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'}`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {badge}
          </span>
        </span>
        <span className="block text-[9px] text-muted-foreground leading-tight mt-0.5">{cost}</span>
      </span>
    </button>
  );
}

// Shared compact-panel chrome — small footprint so the map stays visible/clickable.
const BUILD_PANEL_CLASS =
  'absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border animate-in slide-in-from-bottom-4 duration-200 z-10 max-h-[32vh] overflow-y-auto';
const BUILD_PANEL_STYLE: React.CSSProperties = {
  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)',
};

function BuildPanel() {
  const { game, dispatch, buildAction, setBuildAction } = useGameStore();
  const [collapsed, setCollapsed] = useState(false);
  if (!game) return null;

  const player = game.players[game.turn.currentPlayer];
  const money = player.money;
  const grain = player.supplies.grain;
  const oil = player.supplies.oil;
  const mineral = player.supplies.mineral;

  // Valid placement targets — shared source of truth with the WorldMap highlight.
  const armyTargets = getBuildTargets(game, 'army');
  const navyTargets = getBuildTargets(game, 'navy');

  // Affordability — units. Fidelidade 3.7.1: 1 conjunto de suprimentos constrói
  // UNITS_PER_SUPPLY_SET peças; só cobra novo conjunto ao cruzar um múltiplo.
  const unitsBuiltThisTurn = game.turn.unitsBuiltThisTurn;
  const setSize = RULES.UNITS_PER_SUPPLY_SET;
  const nextUnitNeedsNewSet = unitsBuiltThisTurn % setSize === 0;
  const freeUnitsInSet = nextUnitNeedsNewSet ? 0 : setSize - (unitsBuiltThisTurn % setSize);
  const hasSupplies = !nextUnitNeedsNewSet || (grain >= 1 && oil >= 1 && mineral >= 1);
  const hasMoney = money >= RULES.UNIT_COST;
  const canBuildUnit = hasSupplies && hasMoney;
  const unitMissing: string[] = [];
  if (!hasMoney) unitMissing.push(`💵 $${money.toLocaleString()}/$${RULES.UNIT_COST.toLocaleString()}`);
  if (nextUnitNeedsNewSet) {
    if (grain < 1) unitMissing.push('🌾 0/1');
    if (oil < 1) unitMissing.push('🛢️ 0/1');
    if (mineral < 1) unitMissing.push('⛏️ 0/1');
  }

  // Affordability — special weapons
  const canResearchNuke = !player.hasResearchedNuke && money >= RULES.RESEARCH_COST_PER_CARD;
  const canBuildNuke = player.hasResearchedNuke && money >= RULES.NUKE_COST && mineral >= RULES.NUKE_MINERAL_COST && player.nukes < RULES.MAX_NUKES;
  const nukeMaxed = player.hasResearchedNuke && player.nukes >= RULES.MAX_NUKES;
  const canResearchLaser = !player.hasResearchedLaserStar && money >= RULES.RESEARCH_COST_PER_CARD;
  const canBuildLaser = player.hasResearchedLaserStar && money >= RULES.LASER_STAR_COST && mineral >= RULES.LASER_STAR_MINERAL_COST && player.laserStars < RULES.MAX_LASER_STARS;
  const laserMaxed = player.hasResearchedLaserStar && player.laserStars >= RULES.MAX_LASER_STARS;

  // Real-time research odds derived from the actual deck
  const { nukeCount, laserCount, total: deckTotal } = getTechCounts(game.resourceDeck);
  const nukeOdds = deckTotal > 0 ? formatOdds(nukeCount / deckTotal) : '0,00%';
  const laserOdds = deckTotal > 0 ? formatOdds(laserCount / deckTotal) : '0,00%';

  const resourceStrip = (
    <div className="flex flex-wrap items-center gap-1">
      <ResChip icon="💵" value={`$${money.toLocaleString()}`} />
      <ResChip icon="🌾" value={grain} dim={grain === 0} />
      <ResChip icon="🛢️" value={oil} dim={oil === 0} />
      <ResChip icon="⛏️" value={mineral} dim={mineral === 0} />
    </div>
  );

  // ── SELECTION MODE: army/navy targets are tapped directly on the map ──
  if (buildAction === 'army' || buildAction === 'navy') {
    const isArmy = buildAction === 'army';
    const targets = isArmy ? armyTargets : navyTargets;
    const title = isArmy ? '🎖️ Construir Exército' : '⚓ Construir Esquadra (Navio)';
    const costLabel = isArmy
      ? `$${RULES.UNIT_COST.toLocaleString()} · 1 conjunto (🌾🛢️⛏️) a cada ${setSize} peças`
      : `$${RULES.UNIT_COST.toLocaleString()} · requer porto · 1 conjunto a cada ${setSize} peças`;
    const blocked = !canBuildUnit;

    return (
      <div className={BUILD_PANEL_CLASS} style={BUILD_PANEL_STYLE}>
        <div className="max-w-2xl mx-auto p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{title}</p>
            <button
              onClick={() => { playSound('button-click', 0.4); setBuildAction(null); }}
              className="text-[10px] px-2.5 py-1.5 rounded-md bg-secondary text-foreground hover:bg-secondary/70 active:scale-[0.95] uppercase tracking-wider font-semibold shrink-0"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Cancelar
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground">{costLabel}</p>

          {blocked ? (
            <p className="text-[11px] text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5">
              ⚠ Falta: {unitMissing.join(' · ')}. Venda recursos ou tome empréstimo antes de construir.
            </p>
          ) : targets.length === 0 ? (
            <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5">
              {isArmy
                ? 'Nenhum território seu disponível para construção.'
                : 'Nenhum porto sob seu controle — conquiste um território com porto para construir esquadras.'}
            </p>
          ) : (
            <p className={`text-[11px] rounded px-2 py-1.5 border ${isArmy ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-blue-300 bg-blue-500/10 border-blue-500/30'}`}>
              👆 Toque {isArmy ? 'num território destacado' : 'numa zona marítima destacada'} no mapa para construir.
              <span className="opacity-70"> ({targets.length} {isArmy ? 'território(s)' : 'mar(es)'} válido(s))</span>
            </p>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider shrink-0">Você tem:</span>
            {resourceStrip}
          </div>
          {freeUnitsInSet > 0 && !blocked && (
            <p className="text-[9px] text-emerald-400/80">Conjunto pago: {freeUnitsInSet} peça(s) sem custo de suprimento.</p>
          )}
        </div>
      </div>
    );
  }

  // ── MENU MODE: choose what to build / research ──
  return (
    <div className={BUILD_PANEL_CLASS} style={BUILD_PANEL_STYLE}>
      <div className="max-w-2xl mx-auto">
      {/* Header strip: title + resources + collapse toggle */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-border/40 sticky top-0 bg-card/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{ fontFamily: 'var(--font-display)' }}>🏗️ Construir</h3>
          <div className="min-w-0 overflow-hidden">{resourceStrip}</div>
        </div>
        <button
          onClick={() => { playSound('button-click', 0.3); setCollapsed(c => !c); }}
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-secondary hover:bg-secondary/70 active:scale-[0.95]"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Army */}
            <BuildTile
              icon="🎖️"
              title="Construir Exército"
              cost={`$${RULES.UNIT_COST.toLocaleString()} + suprimentos`}
              ready={canBuildUnit && armyTargets.length > 0}
              badge={armyTargets.length === 0 ? 'SEM ÁREA' : canBuildUnit ? 'DISPONÍVEL' : 'BLOQUEADO'}
              onClick={() => { playSound('turn-start', 0.4); setBuildAction('army'); }}
            />

            {/* Navy */}
            <BuildTile
              icon="⚓"
              title="Construir Esquadra"
              cost={`$${RULES.UNIT_COST.toLocaleString()} · requer porto`}
              ready={canBuildUnit && navyTargets.length > 0}
              badge={navyTargets.length === 0 ? 'SEM PORTO' : canBuildUnit ? 'DISPONÍVEL' : 'BLOQUEADO'}
              onClick={() => { playSound('turn-start', 0.4); setBuildAction('navy'); }}
            />

            {/* Nuke: research → build → maxed */}
            {!player.hasResearchedNuke ? (
              <BuildTile
                icon="🔬"
                title="Pesquisar Bomba"
                cost={`$${RULES.RESEARCH_COST_PER_CARD.toLocaleString()}/carta · ${nukeOdds}`}
                ready={canResearchNuke}
                badge={canResearchNuke ? 'PESQUISAR' : 'BLOQUEADO'}
                onClick={() => { playSound('button-click', 0.5); dispatch({ type: 'RESEARCH_NUKE', cardId: '' }); }}
              />
            ) : nukeMaxed ? (
              <BuildTile icon="☢️" title="Bomba Nuclear" cost={`Arsenal máximo (${RULES.MAX_NUKES})`} ready={false} badge="MÁX" />
            ) : (
              <BuildTile
                icon="☢️"
                title="Construir Bomba"
                cost={`$${RULES.NUKE_COST.toLocaleString()} + ${RULES.NUKE_MINERAL_COST}⛏️ · ${player.nukes}/${RULES.MAX_NUKES}`}
                ready={canBuildNuke}
                badge={canBuildNuke ? 'CONSTRUIR' : 'BLOQUEADO'}
                onClick={() => { playSound('missile-launch', 0.5); dispatch({ type: 'BUILD_NUKE' }); }}
              />
            )}

            {/* Laser: research → build → maxed */}
            {!player.hasResearchedLaserStar ? (
              <BuildTile
                icon="🔬"
                title="Pesquisar Laser-Star"
                cost={`$${RULES.RESEARCH_COST_PER_CARD.toLocaleString()}/carta · ${laserOdds}`}
                ready={canResearchLaser}
                badge={canResearchLaser ? 'PESQUISAR' : 'BLOQUEADO'}
                onClick={() => { playSound('button-click', 0.5); dispatch({ type: 'RESEARCH_LASER_STAR', cardId: '' }); }}
              />
            ) : laserMaxed ? (
              <BuildTile icon="🛡️" title="Laser-Star" cost={`Arsenal máximo (${RULES.MAX_LASER_STARS})`} ready={false} badge="MÁX" />
            ) : (
              <BuildTile
                icon="🛡️"
                title="Construir Laser-Star"
                cost={`$${RULES.LASER_STAR_COST.toLocaleString()} + ${RULES.LASER_STAR_MINERAL_COST}⛏️ · ${player.laserStars}/${RULES.MAX_LASER_STARS}`}
                ready={canBuildLaser}
                badge={canBuildLaser ? 'CONSTRUIR' : 'BLOQUEADO'}
                onClick={() => { playSound('diplomacy-alert', 0.8); dispatch({ type: 'BUILD_LASER_STAR' }); }}
              />
            )}
          </div>
          <p className="px-3 pb-1.5 -mt-0.5 text-[9px] text-muted-foreground font-mono">
            Baralho: {deckTotal} {deckTotal === 1 ? 'carta' : 'cartas'} · ☢️ {nukeCount} · 🛡️ {laserCount}
          </p>
        </>
      )}
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
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          🚀 Movimento
        </h3>
        {/* Movement consumes cereal — show the live balance up front */}
        <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${player.supplies.grain > 0 ? 'bg-secondary text-foreground' : 'bg-destructive/20 text-destructive'}`}>
          🌾 {player.supplies.grain} cereal
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">
        Toque num território (exércitos) ou zona marítima (esquadras) para ver destinos.
        Em território costeiro com frota adjacente aparece <strong className="text-blue-300">⚓ Embarcar</strong>;
        numa frota com tropas a bordo aparece <strong className="text-emerald-300">🪖 Desembarcar</strong>.
        <strong className="text-foreground"> Mover tropas consome {RULES.LAND_MOVE_GRAIN_COST} cereal por território</strong> · 2 petróleo/voo · 1 petróleo/mar.
      </p>
      {player.supplies.grain <= 0 && (
        <p className="text-[10px] text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1 mb-2">
          ⚠ Você está sem cereal. Movimentos terrestres ficam bloqueados até produzir ou comprar cereal.
        </p>
      )}

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

  // Classify each adjacent target via the shared engine validation so the UI
  // and the engine never disagree on why a move is allowed/blocked.
  const targets = adjacents.map(adjId => ({
    id: adjId,
    name: game.territories[adjId]?.name ?? adjId,
    neutral: game.territories[adjId]?.owner == null,
    block: getMoveBlockReason(game, selectedTerritory, adjId),
  }));

  const handleMove = (adjId: string, wasNeutral: boolean) => {
    const reason = getMoveBlockReason(game, selectedTerritory, adjId);
    if (reason) {
      playSound('error', 0.5);
      toast.error(moveBlockMessage(reason));
      return;
    }
    playSound('button-click', 0.5);
    dispatch({ type: 'MOVE_ARMY', from: selectedTerritory, to: adjId, count: 1 });
    // After dispatch, an unopposed neutral target becomes controlled — confirm it.
    const after = useGameStore.getState().game;
    if (wasNeutral && after?.territories[adjId]?.owner === player.id) {
      playSound('territory-conquered', 0.7);
      toast.success(`Conquistou ${game.territories[adjId]?.name} — agora é seu território.`);
    }
  };

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
        Mover de <strong>{territory.name}</strong> ({myArmies} exércitos) — custo {RULES.LAND_MOVE_GRAIN_COST} 🌾:
      </p>
      <div className="flex flex-wrap gap-1">
        {targets.map(({ id, name, neutral, block }) => {
          const enemy = block === 'enemy_held';
          const blocked = !!block;
          return (
            <button
              key={id}
              onClick={() => handleMove(id, neutral)}
              title={block ? moveBlockMessage(block) : (neutral ? 'Território neutro — mover para cá conquista-o' : '')}
              className={`text-[10px] px-2 py-2 rounded active:scale-[0.95] border transition-all ${
                enemy
                  ? 'bg-destructive/10 text-destructive/70 border-destructive/20 cursor-not-allowed'
                  : blocked
                    ? 'bg-secondary/40 text-muted-foreground/50 border-border/30'
                    : neutral
                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/30'
                      : 'bg-primary/20 text-primary hover:bg-primary/30 border-primary/20'
              }`}
            >
              {enemy ? '⚔ ' : neutral ? '🏴 ' : '→ '}{name}{neutral ? ' (neutro)' : ''}
            </button>
          );
        })}
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
