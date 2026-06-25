import { useMemo, useState } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { playSound } from '../game/audio';
import { ResourceType } from '../game/types';
import { useT, fmtNum } from '../i18n/useI18n';
import { TranslationKey } from '../i18n';

// ============================================================
// MODO DIGITAL BALANCEADO — UI da Venda Simultânea de Recursos
// Dois estados:
//  - phase 'declare' (jogador humano ainda não confirmou) → tela de declaração.
//  - phase 'resolve' (resolução pronta) → tela de resumo.
// Mobile-first: controles +/- grandes, nada depende de tooltip.
// ============================================================

const RESOURCES: { key: ResourceType; icon: string; color: string }[] = [
  { key: 'grain', icon: '🌾', color: '#eab308' },
  { key: 'oil', icon: '🛢', color: '#ef4444' },
  { key: 'mineral', icon: '⛏', color: '#a855f7' },
];

const money = (n: number) => `$${fmtNum(n)}`;

export default function SimultaneousSellModal() {
  const { game, dispatch } = useGameStore();
  const t = useT();
  const ss = game?.simultaneousSell;

  // O humano da partida (MVP: 1 humano).
  const human = useMemo(
    () => (game ? Object.values(game.players).find(p => p.isHuman && !p.isEliminated) : undefined),
    [game],
  );

  const humanDeclared = !!(human && ss?.declarations[human.id]?.confirmed);

  // Rascunho local da declaração (não toca o estado global até confirmar).
  const [draft, setDraft] = useState<Record<ResourceType, number>>({ grain: 0, oil: 0, mineral: 0 });

  if (!game || !ss || game.config.marketMode !== 'balanced') return null;

  // ── Tela de resumo da resolução ──────────────────────────────────────────
  if (ss.phase === 'resolve' && ss.resolution) {
    const res = ss.resolution;
    return (
      <Overlay>
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            {t('sells.resolvedTitle')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{t('sells.round', { n: res.round })}</p>
        </div>

        {/* Por recurso */}
        <div className="space-y-2 mb-4">
          {RESOURCES.map(({ key, icon, color }) => {
            const r = res.perResource[key];
            const dropped = r.priceAfter !== r.priceBefore;
            return (
              <div key={key} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
                  <span>{icon}</span> {t(`resource.${key}` as TranslationKey)}
                </span>
                <span className="text-xs text-right">
                  <span className="font-mono-num">{r.totalSold}</span> {t('sells.unitsSold')}
                  {dropped && (
                    <span className="block text-muted-foreground">
                      {money(r.priceBefore)} → <span className="text-foreground font-semibold">{money(r.priceAfter)}</span>
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Por jogador */}
        <div className="space-y-1.5 mb-5">
          {res.perPlayer.map(pp => {
            const psp = SUPERPOWERS[pp.playerId];
            return (
              <div key={pp.playerId} className="flex items-center justify-between text-xs px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: psp.color }} />
                  <span className="font-semibold">{psp.shortName}</span>
                </span>
                <span className="text-muted-foreground">
                  {pp.soldAny ? (
                    <>{t('sells.received')} <span className="text-emerald-400 font-semibold">{money(pp.revenue)}</span></>
                  ) : (
                    <span>{t('sells.didNotSell')}</span>
                  )}
                  {' · '}
                  <span className="font-mono-num">{pp.optionalActionsRemaining}</span> {t('sells.actionsWord')}
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { playSound('button-click', 0.6); dispatch({ type: 'ACK_SIMULTANEOUS_SELL' }); }}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold uppercase tracking-wider active:scale-[0.97]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('common.continue')}
        </button>
      </Overlay>
    );
  }

  // ── Tela de declaração ───────────────────────────────────────────────────
  // Só mostra para o humano enquanto ele não confirmou. Se já confirmou (IAs
  // ainda resolvendo via efeito do GameScreen), mostra um estado de espera.
  if (ss.phase !== 'declare' || !human) return null;

  const setQty = (r: ResourceType, q: number) => {
    const max = human.supplies[r];
    setDraft(d => ({ ...d, [r]: Math.max(0, Math.min(q, max)) }));
  };

  const estRevenue = RESOURCES.reduce((acc, { key }) => acc + draft[key] * ss.priceSnapshot[key], 0);
  const totalUnits = draft.grain + draft.oil + draft.mineral;

  const confirm = () => {
    playSound('button-click', 0.6);
    dispatch({
      type: 'SUBMIT_SELL_DECLARATION',
      playerId: human.id,
      grain: draft.grain, oil: draft.oil, mineral: draft.mineral,
    });
  };

  if (humanDeclared) {
    return (
      <Overlay>
        <div className="text-center py-6">
          <div className="text-3xl mb-3">⏳</div>
          <h2 className="text-base font-bold uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            {t('sells.confirmedTitle')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('sells.waiting')}</p>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div className="text-center mb-3">
        <h2 className="text-lg font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          {t('sells.title')}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{t('sells.round', { n: game.turn.turnNumber })}</p>
      </div>

      <p className="text-[11px] leading-snug text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-4">
        {t('sells.intro')}
      </p>

      <div className="space-y-2.5 mb-4">
        {RESOURCES.map(({ key, icon, color }) => {
          const stock = human.supplies[key];
          const price = ss.priceSnapshot[key];
          const qty = draft[key];
          return (
            <div key={key} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
                  <span>{icon}</span> {t(`resource.${key}` as TranslationKey)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t('sells.stock')} <span className="font-mono-num text-foreground">{stock}</span> · {t('sells.price')}{' '}
                  <span className="font-mono-num text-foreground">{money(price)}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StepBtn label="−" disabled={qty <= 0} onClick={() => setQty(key, qty - 1)} />
                  <span className="w-10 text-center text-lg font-bold font-mono-num" style={{ color }}>{qty}</span>
                  <StepBtn label="+" disabled={qty >= stock} onClick={() => setQty(key, qty + 1)} primary />
                  <button
                    onClick={() => setQty(key, stock)}
                    disabled={stock === 0 || qty === stock}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-secondary/60 text-muted-foreground disabled:opacity-30 active:scale-[0.95]"
                  >
                    {t('sells.max')}
                  </button>
                </div>
                <span className="text-xs text-emerald-400/90 font-mono-num">{money(qty * price)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          {t('sells.estRevenue')}
        </span>
        <span className="text-base font-bold text-emerald-400 font-mono-num">{money(estRevenue)}</span>
      </div>

      <button
        onClick={confirm}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold uppercase tracking-wider active:scale-[0.97]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {totalUnits > 0 ? t('sells.confirmSell', { n: totalUnits }) : t('sells.confirmNoSell')}
      </button>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        {t('sells.usesAction')}
      </p>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl p-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function StepBtn({ label, onClick, disabled, primary }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 rounded flex items-center justify-center text-lg font-bold disabled:opacity-30 active:scale-[0.9] ${
        primary ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-secondary text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
