import { useState } from 'react';
import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';
import type { ResourceType } from '../game/types';
import { TrendingUp, TrendingDown, Minus as MinusIcon, X, LineChart } from 'lucide-react';
import { SUPERPOWERS } from '../data/initialPlayers';

const RESOURCES: { key: ResourceType; label: string; icon: string; color: string }[] = [
  { key: 'grain', label: 'Cereal', icon: '🌾', color: '#eab308' },
  { key: 'oil', label: 'Petróleo', icon: '🛢', color: '#ef4444' },
  { key: 'mineral', label: 'Minério', icon: '⛏', color: '#a855f7' },
];

/**
 * Sparkline from the recorded price history (+ the live current price as the last
 * point). Reads market data already produced by the engine — invents no prices.
 */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 96;
  const h = 26;
  if (values.length < 2) {
    return (
      <svg width={w} height={h} className="opacity-50">
        <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={color} strokeWidth={1} strokeDasharray="2 2" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastX = w;
  const lastY = h - 2 - ((values[values.length - 1] - min) / range) * (h - 4);
  return (
    <svg width={w} height={h}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}

export default function MarketDrawer() {
  const { game } = useGameStore();
  const [open, setOpen] = useState(false);

  if (!game) return null;
  const { market } = game;
  const history = market.priceHistory;

  // Build the series for a resource: historical closes + live current price.
  const seriesFor = (r: ResourceType): number[] => {
    const hist = history.map(h => h[r]);
    const last = hist[hist.length - 1];
    if (last !== market.prices[r]) hist.push(market.prices[r]);
    return hist.length > 0 ? hist : [market.prices[r]];
  };

  // Variation vs the previous recorded round.
  const variationFor = (r: ResourceType): number => {
    if (history.length === 0) return 0;
    return market.prices[r] - history[history.length - 1][r];
  };

  return (
    <>
      {/* Toggle tab — vertical tab on the right edge, never covers the map */}
      {!open && (
        <button
          onClick={() => { setOpen(true); playSound('button-click', 0.4); }}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 bg-card/95 border border-border border-r-0 rounded-l-lg px-1.5 py-2.5 shadow-lg hover:bg-secondary/60 transition-colors"
          style={{ writingMode: 'vertical-rl' }}
          aria-label="Abrir mercado"
        >
          <LineChart size={14} className="text-primary rotate-90" />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Mercado
          </span>
        </button>
      )}

      {open && (
        <div
          className="absolute bottom-0 left-0 right-0 z-40 bg-card/97 backdrop-blur-md border-t border-border animate-in slide-in-from-bottom-4 duration-200 max-h-[55vh] overflow-y-auto"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-card/97 backdrop-blur-md">
            <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display)' }}>
              <LineChart size={13} className="text-primary" /> Mercado / Commodities
            </h3>
            <button
              onClick={() => { setOpen(false); playSound('button-click', 0.4); }}
              className="w-8 h-8 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80"
              aria-label="Fechar mercado"
            >
              <X size={13} />
            </button>
          </div>

          <div className="px-3 py-1.5 text-[9px] text-muted-foreground border-b border-border/40">
            Preço por unidade. Variação desde a rodada anterior. Atualiza a cada compra/venda e nova rodada.
          </div>

          <div className="divide-y divide-border/30">
            {RESOURCES.map(({ key, label, icon, color }) => {
              const price = market.prices[key];
              const variation = variationFor(key);
              const series = seriesFor(key);
              return (
                <div key={key} className="flex items-center gap-3 px-3 py-2.5 pr-16">
                  <div className="flex items-center gap-2 w-24 shrink-0">
                    <span className="text-base">{icon}</span>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        ${market.minPrice / 1000}k–${market.maxPrice / 1000}k
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col shrink-0 w-20">
                    <span className="text-sm font-bold font-mono" style={{ color }}>
                      ${price.toLocaleString()}
                    </span>
                    <span className={`text-[10px] font-mono flex items-center gap-0.5 ${
                      variation > 0 ? 'text-emerald-400' : variation < 0 ? 'text-red-400' : 'text-muted-foreground'
                    }`}>
                      {variation > 0 && <TrendingUp size={10} />}
                      {variation < 0 && <TrendingDown size={10} />}
                      {variation === 0 && <MinusIcon size={10} />}
                      {variation === 0 ? '—' : `${variation > 0 ? '+' : ''}${variation.toLocaleString()}`}
                    </span>
                  </div>

                  <div className="ml-auto">
                    <Sparkline values={series} color={color} />
                  </div>
                </div>
              );
            })}
          </div>

          {history.length === 0 && (
            <p className="px-3 py-2 text-[10px] text-muted-foreground text-center">
              Histórico começa ao fim da 1ª rodada.
            </p>
          )}

          {/* Recent market transactions */}
          {(() => {
            const txEvents = game.eventLog
              .filter(e => e.type === 'economy' && (e.message.startsWith('Vendeu') || e.message.startsWith('Comprou')))
              .slice(-5)
              .reverse();
            if (txEvents.length === 0) return null;
            return (
              <div className="border-t border-border/40 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                  Últimas transações
                </p>
                <div className="space-y-1">
                  {txEvents.map(e => {
                    const sp = SUPERPOWERS[e.player];
                    const isSell = e.message.startsWith('Vendeu');
                    return (
                      <div key={e.id} className="flex items-start gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: sp.color }} />
                        <span className={`text-[9px] font-mono leading-snug ${isSell ? 'text-red-300' : 'text-emerald-300'}`}>
                          {isSell ? '▼' : '▲'} {e.message}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
