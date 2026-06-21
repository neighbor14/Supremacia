import { useState } from 'react';
import { toast } from 'sonner';
import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';
import { SUPERPOWERS } from '../data/initialPlayers';
import { TurnStage } from '../game/types';
import { RULES } from '../game/rulesConfig';

const STAGE_NAMES: Record<number, string> = {
  1: 'Salários',
  2: 'Produção',
  3: 'Vender',
  4: 'Atacar',
  5: 'Mover',
  6: 'Construir',
  7: 'Comprar',
};

const STAGE_ICONS: Record<number, string> = {
  1: '💰',
  2: '🏭',
  3: '📈',
  4: '⚔️',
  5: '🚀',
  6: '🏗️',
  7: '🛒',
};

const ORDINALS = ['1ª', '2ª', '3ª', '4ª', '5ª'];

function RoundStatusPanel({ onClose }: { onClose: () => void }) {
  const { game } = useGameStore();
  if (!game) return null;
  const { turn, players } = game;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold" style={{ fontFamily: 'var(--font-display)' }}>Rodada</p>
            <p className="text-2xl font-black font-mono leading-none" style={{ fontFamily: 'var(--font-display)' }}>{turn.turnNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Vez</p>
            <p className="text-lg font-bold font-mono">{turn.currentPlayerIndex + 1}<span className="text-muted-foreground text-sm">/{turn.playerOrder.length}</span></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none ml-3">✕</button>
        </div>

        {/* Player list in turn order */}
        <div className="p-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
          {turn.playerOrder.map((pid, idx) => {
            const p = players[pid];
            const sp = SUPERPOWERS[pid];
            const isCurrent = pid === turn.currentPlayer;
            const isPast = idx < turn.currentPlayerIndex;
            const isEliminated = p.isEliminated;

            return (
              <div
                key={pid}
                className={`rounded-lg px-3 py-2 border flex items-center gap-2 transition-all ${
                  isCurrent ? 'border-primary/60 bg-primary/10' :
                  isEliminated ? 'border-border/20 bg-secondary/10 opacity-40' :
                  isPast ? 'border-border/30 bg-secondary/20' :
                  'border-border/30 bg-secondary/5'
                }`}
              >
                {/* Position number */}
                <span className={`text-[10px] font-mono w-4 text-center shrink-0 ${isCurrent ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                  {idx + 1}
                </span>

                {/* Color dot */}
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sp.color }} />

                {/* Name */}
                <span className={`text-[11px] font-semibold flex-1 truncate uppercase tracking-wider ${isEliminated ? 'line-through' : ''}`} style={{ fontFamily: 'var(--font-display)', color: isCurrent ? sp.color : undefined }}>
                  {sp.shortName}
                  {!p.isHuman && <span className="text-[9px] text-muted-foreground ml-1 normal-case">CPU</span>}
                </span>

                {/* Status badges */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Research status */}
                  {p.hasResearchedNuke
                    ? <span className="text-[9px] px-1 py-0.5 rounded bg-destructive/20 text-destructive font-bold">☢️{p.nukes}</span>
                    : <span className="text-[9px] px-1 py-0.5 rounded bg-secondary/30 text-muted-foreground/40">☢️–</span>
                  }
                  {p.hasResearchedLaserStar
                    ? <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">🛡️{p.laserStars}</span>
                    : <span className="text-[9px] px-1 py-0.5 rounded bg-secondary/30 text-muted-foreground/40">🛡️–</span>
                  }
                </div>

                {/* Turn marker */}
                {isCurrent && <span className="text-[9px] text-primary font-bold shrink-0">▶ jogando</span>}
                {isPast && !isEliminated && <span className="text-[9px] text-muted-foreground/50 shrink-0">✓ feito</span>}
                {isEliminated && <span className="text-[9px] text-muted-foreground/40 shrink-0">eliminado</span>}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-2.5 border-t border-border/40 flex gap-3 flex-wrap">
          <span className="text-[9px] text-muted-foreground">☢️ = ogivas nucleares pesquisadas/qtd</span>
          <span className="text-[9px] text-muted-foreground">🛡️ = laser-stars pesquisadas/qtd</span>
        </div>
      </div>
    </div>
  );
}

export default function TurnPhaseBar() {
  const [showRoundPanel, setShowRoundPanel] = useState(false);
  const { game, dispatch } = useGameStore();
  if (!game) return null;

  const { turn } = game;
  const currentPlayer = game.players[turn.currentPlayer];
  const sp = SUPERPOWERS[turn.currentPlayer];
  const isHuman = currentPlayer.isHuman;

  const MAX_OPTIONAL = RULES.MAX_OPTIONAL_STAGES;
  const usedCount = turn.optionalStagesUsed.length;
  const remaining = MAX_OPTIONAL - usedCount;
  const isAtLimit = usedCount >= MAX_OPTIONAL;
  const progressPercent = (usedCount / MAX_OPTIONAL) * 100;

  // Choosing phase: after mandatory stages are done
  const isChoosingPhase = isHuman && turn.stage >= 2 && turn.stageComplete;

  const handleMandatoryAction = () => {
    if (!isHuman) return;
    playSound('button-click', 0.6);
    if (turn.stage === 1) {
      dispatch({ type: 'PAY_SALARIES' });
      // Avisa se alguma companhia ficou dormente por falta de salário (manual Grow:
      // companhia sem salário não transfere produção no Estágio 2).
      const dormant = useGameStore.getState().game?.turn.unpaidCompanies ?? [];
      if (dormant.length > 0) {
        const cards = useGameStore.getState().game!.resourceCards;
        const names = dormant.map(id => cards[id]?.companyName ?? id).join(', ');
        toast.warning('Salário insuficiente para todas as companhias', {
          description: `${dormant.length} companhia(s) não vão produzir neste turno: ${names}. Venda recursos ou faça empréstimo para pagar e reativá-las no próximo turno.`,
          duration: 7000,
        });
      }
      dispatch({ type: 'NEXT_STAGE' });
    } else if (turn.stage === 2 && !turn.stageComplete) {
      dispatch({ type: 'TRANSFER_PRODUCTION' });
      dispatch({ type: 'NEXT_STAGE' });
    }
  };

  const handleSelectOptionalStage = (stage: TurnStage) => {
    if (!isHuman) return;
    if (isAtLimit) return;
    if (turn.optionalStagesUsed.includes(stage)) return;
    playSound('turn-start', 0.5);
    dispatch({ type: 'SELECT_OPTIONAL_STAGE', stage });
  };

  const handleEndTurn = () => {
    if (!isHuman) return;
    playSound('button-click', 0.7);
    dispatch({ type: 'END_TURN' });
  };

  const handleSkipStage = () => {
    playSound('button-click', 0.6);
    dispatch({ type: 'NEXT_STAGE' });
  };

  const getStageAvailability = (stage: number) => {
    if (stage <= 2) return 'mandatory';
    if (turn.optionalStagesUsed.includes(stage as TurnStage)) return 'used';
    const lastUsed = turn.optionalStagesUsed[turn.optionalStagesUsed.length - 1] || 2;
    if (stage <= lastUsed) return 'past';
    if (isAtLimit) return 'locked';
    return 'available';
  };

  const getContextMessage = () => {
    if (usedCount === 0) {
      return `Escolha até ${MAX_OPTIONAL} ações: vender, atacar, mover, construir ou comprar.`;
    }
    if (isAtLimit) {
      return `Você usou todas as ${MAX_OPTIONAL} ações opcionais. Avance para o próximo jogador.`;
    }
    const ordinal = ORDINALS[usedCount - 1] ?? `${usedCount}ª`;
    const remainText = remaining === 1 ? 'mais 1 ação' : `mais ${remaining} ações`;
    return `${ordinal} ação concluída. Você ainda pode fazer ${remainText}.`;
  };

  return (
    <>
    <div className="flex-shrink-0 bg-card border-b border-border px-3 py-2 [@media(max-height:600px)]:py-1 safe-top">
      {/* Top row: Player info + Turn */}
      <div className="flex items-center justify-between mb-1.5 [@media(max-height:600px)]:mb-0.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sp.color }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', color: sp.color }}>
            {sp.shortName}
          </span>
          {!isHuman && (
            <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded uppercase">CPU</span>
          )}
        </div>
        <button
          onClick={() => setShowRoundPanel(true)}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-secondary/50 active:scale-[0.97]"
          title="Ver status de todos os jogadores"
        >
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>Rod.</span>
          <span className="font-bold">{turn.turnNumber}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[10px]">{turn.currentPlayerIndex + 1}/{turn.playerOrder.length}</span>
          <span className="text-[9px] text-muted-foreground/40 ml-0.5">ℹ</span>
        </button>
      </div>

      {/* Choosing mode: optional stage selection with counter + progress */}
      {isChoosingPhase ? (
        <div>
          {/* Optional actions counter + progress bar */}
          <div className="mb-2 [@media(max-height:600px)]:mb-1">
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${isAtLimit ? 'text-red-400' : 'text-emerald-400'}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Ações opcionais: {usedCount}/{MAX_OPTIONAL}
              </span>
              <span className={`text-[10px] font-mono ${isAtLimit ? 'text-red-400/70' : 'text-muted-foreground'}`}>
                {isAtLimit ? 'limite atingido' : `${remaining} restante${remaining !== 1 ? 's' : ''}`}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-secondary/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isAtLimit ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Contextual feedback message */}
            <p className={`text-[10px] mt-1 leading-tight [@media(max-height:600px)]:hidden ${isAtLimit ? 'text-red-400/80 font-medium' : 'text-muted-foreground'}`}>
              {getContextMessage()}
            </p>
          </div>

          {/* Optional stage buttons */}
          <div className="flex items-center gap-1 mb-2 [@media(max-height:600px)]:mb-1">
            {[3, 4, 5, 6, 7].map(stage => {
              const availability = getStageAvailability(stage);
              const isAvailable = availability === 'available';
              const isUsed = availability === 'used';
              const disabledTitle =
                availability === 'used' ? 'Já usada neste turno'
                : availability === 'past' ? 'Não pode voltar atrás'
                : `Limite de ${MAX_OPTIONAL} ações atingido neste turno`;

              return (
                <button
                  key={stage}
                  onClick={() => isAvailable && handleSelectOptionalStage(stage as TurnStage)}
                  disabled={!isAvailable}
                  className={`
                    flex-1 py-1.5 [@media(max-height:600px)]:py-1 px-0.5 rounded text-center transition-all uppercase tracking-wider flex flex-col items-center gap-0.5 min-w-0
                    ${isAvailable
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/30 active:scale-[0.95] animate-pulse-subtle'
                      : isUsed
                        ? 'bg-accent/20 text-accent-foreground/50 border border-accent/20 cursor-default'
                        : 'bg-secondary/20 text-muted-foreground/25 border border-border/10 cursor-not-allowed'
                    }
                  `}
                  style={{ fontFamily: 'var(--font-display)' }}
                  title={isAvailable ? `${STAGE_NAMES[stage]} — usa 1 ação` : disabledTitle}
                >
                  <span className={`text-sm leading-none ${!isAvailable && !isUsed ? 'opacity-30' : ''}`}>
                    {STAGE_ICONS[stage]}
                  </span>
                  <span className={`text-[9px] font-bold leading-tight truncate w-full text-center ${isUsed ? 'line-through' : ''}`}>
                    {STAGE_NAMES[stage]}
                  </span>
                  {isAvailable && (
                    <span className="text-emerald-400/60 text-[8px] leading-none [@media(max-height:600px)]:hidden">1 ação</span>
                  )}
                  {isUsed && (
                    <span className="text-accent-foreground/40 text-[8px] leading-none [@media(max-height:600px)]:hidden">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleEndTurn}
              className={`text-[10px] px-3 py-1.5 rounded uppercase tracking-wider active:scale-[0.97] transition-colors ${
                isAtLimit
                  ? 'bg-primary text-primary-foreground hover:opacity-90 font-bold'
                  : 'bg-destructive text-destructive-foreground hover:opacity-90'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {isAtLimit ? '→ Próximo Jogador' : 'Encerrar Turno'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Normal stage progress bar */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map(stage => {
              const isCurrent = turn.stage === stage && !turn.stageComplete;
              const isUsed = turn.optionalStagesUsed.includes(stage as TurnStage);
              const isPast = stage < turn.stage || (stage <= 2 && turn.stage > 2);

              return (
                <button
                  key={stage}
                  onClick={() => {
                    if (!isHuman) return;
                    if (isCurrent && stage <= 2) {
                      handleMandatoryAction();
                    }
                  }}
                  disabled={!isHuman || !isCurrent}
                  title={STAGE_NAMES[stage]}
                  className={`
                    flex-1 min-w-0 py-2.5 [@media(max-height:600px)]:py-1 px-0.5 rounded text-center transition-all uppercase tracking-wider flex flex-col items-center gap-0.5 overflow-hidden
                    ${isCurrent ? 'bg-primary text-primary-foreground ring-1 ring-primary/50 cursor-pointer' : ''}
                    ${isPast && !isCurrent ? 'bg-secondary/50 text-muted-foreground' : ''}
                    ${isUsed && !isCurrent ? 'bg-accent/50 text-accent-foreground/70' : ''}
                    ${!isCurrent && !isPast && !isUsed ? 'bg-secondary/30 text-muted-foreground/50' : ''}
                  `}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <span className="text-sm leading-none">{STAGE_ICONS[stage]}</span>
                  <span className="block w-full text-[10px] truncate text-center [@media(max-height:600px)]:hidden">{STAGE_NAMES[stage]}</span>
                </button>
              );
            })}
          </div>

          {/* Compact optional-actions indicator + action buttons during active optional stage */}
          {isHuman && turn.stage > 2 && !turn.stageComplete && (
            <div className="flex items-center gap-2 mt-2 [@media(max-height:600px)]:mt-1">
              {/* Compact pip counter */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground truncate">
                  {STAGE_NAMES[turn.stage]}
                </span>
                <div className="flex items-center gap-0.5 ml-1">
                  {Array.from({ length: MAX_OPTIONAL }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-1.5 rounded-sm transition-colors ${
                        i < usedCount ? 'bg-emerald-500' : 'bg-secondary/50'
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-[10px] font-mono tabular-nums ${isAtLimit ? 'text-red-400' : 'text-emerald-400'}`}>
                  {usedCount}/{MAX_OPTIONAL}
                </span>
              </div>

              <div className="flex-1" />

              <button
                onClick={handleSkipStage}
                className="text-[10px] px-2 py-1 bg-secondary text-secondary-foreground rounded uppercase tracking-wider hover:bg-secondary/80 active:scale-[0.97]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Concluir Fase
              </button>
              <button
                onClick={handleEndTurn}
                className="text-[10px] px-2 py-1 bg-destructive text-destructive-foreground rounded uppercase tracking-wider hover:opacity-90 active:scale-[0.97]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Encerrar Turno
              </button>
            </div>
          )}
        </>
      )}
    </div>
    {showRoundPanel && <RoundStatusPanel onClose={() => setShowRoundPanel(false)} />}
    </>
  );
}
