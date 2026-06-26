import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useGameStore } from '../game/store';
import { isSimultaneousSellRound } from '../game/simultaneousSell';
import { playSound } from '../game/audio';
import { SUPERPOWERS } from '../data/initialPlayers';
import { TurnStage } from '../game/types';
import { RULES } from '../game/rulesConfig';
import { useTutorialStore } from '../stores/tutorialStore';
import { useT, fmtNum } from '../i18n/useI18n';
import { useNames } from '../i18n/names';
import { TranslationKey } from '../i18n';

const STAGE_ICONS: Record<number, string> = {
  1: '💰',
  2: '🏭',
  3: '📈',
  4: '⚔️',
  5: '🚀',
  6: '🏗️',
  7: '🛒',
};

function RoundStatusPanel({ onClose }: { onClose: () => void }) {
  const { game } = useGameStore();
  const t = useT();
  const names = useNames();
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
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold" style={{ fontFamily: 'var(--font-display)' }}>{t('hud.round')}</p>
            <p className="text-2xl font-black font-mono leading-none" style={{ fontFamily: 'var(--font-display)' }}>{turn.turnNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">{t('hud.turn')}</p>
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

            // Informação pública (fiel ao tabuleiro): dinheiro, estoque de recursos,
            // nº de cartas de empresa e armas ficam à vista de todos os jogadores.
            const cardCount = p.resourceCards.length;

            return (
              <div
                key={pid}
                className={`rounded-lg px-3 py-2 border transition-all ${
                  isCurrent ? 'border-primary/60 bg-primary/10' :
                  isEliminated ? 'border-border/20 bg-secondary/10 opacity-40' :
                  isPast ? 'border-border/30 bg-secondary/20' :
                  'border-border/30 bg-secondary/5'
                }`}
              >
                {/* Top line: position, color, name, weapons, turn marker */}
                <div className="flex items-center gap-2">
                  {/* Position number */}
                  <span className={`text-[10px] font-mono w-4 text-center shrink-0 ${isCurrent ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {idx + 1}
                  </span>

                  {/* Color dot */}
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sp.color }} />

                  {/* Name */}
                  <span className={`text-[11px] font-semibold flex-1 truncate uppercase tracking-wider ${isEliminated ? 'line-through' : ''}`} style={{ fontFamily: 'var(--font-display)', color: isCurrent ? sp.color : undefined }}>
                    {names.factionShort(pid)}
                    {!p.isHuman && <span className="text-[9px] text-muted-foreground ml-1 normal-case">CPU</span>}
                  </span>

                  {/* Weapon badges */}
                  <div className="flex items-center gap-1 shrink-0">
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
                  {isCurrent && <span className="text-[9px] text-primary font-bold shrink-0">▶ {t('hud.playing')}</span>}
                  {isPast && !isEliminated && <span className="text-[9px] text-muted-foreground/50 shrink-0">✓ {t('hud.done')}</span>}
                  {isEliminated && <span className="text-[9px] text-muted-foreground/40 shrink-0">{t('hud.eliminated')}</span>}
                </div>

                {/* Bottom line: public economy — money, resources, company cards */}
                {!isEliminated && (
                  <div className="flex items-center gap-2 mt-1.5 pl-6 flex-wrap">
                    {/* Money */}
                    <span
                      className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-0.5"
                      title={t('hud.statMoney')}
                    >
                      💵 ${p.money >= 1000 ? `${Math.floor(p.money / 1000)}k` : fmtNum(p.money)}
                    </span>
                    {p.loans > 0 && (
                      <span className="text-[9px] font-mono text-destructive" title={t('hud.statLoans')}>
                        -{Math.floor(p.loans / 1000)}k
                      </span>
                    )}

                    {/* Resource supplies */}
                    <span className="text-[10px] font-mono text-yellow-500 flex items-center gap-0.5" title={t('resource.grain')}>🌾{p.supplies.grain}</span>
                    <span className="text-[10px] font-mono text-red-400 flex items-center gap-0.5" title={t('resource.oil')}>🛢{p.supplies.oil}</span>
                    <span className="text-[10px] font-mono text-purple-400 flex items-center gap-0.5" title={t('resource.mineral')}>⛏{p.supplies.mineral}</span>

                    {/* Company cards (count only — which companies stay private) */}
                    <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5" title={t('hud.statCards')}>
                      🃏{cardCount}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-2.5 border-t border-border/40 flex flex-col gap-1">
          <span className="text-[9px] text-muted-foreground/80 italic">{t('hud.publicInfoNote')}</span>
          <div className="flex gap-3 flex-wrap">
            <span className="text-[9px] text-muted-foreground">{t('hud.legendNuke')}</span>
            <span className="text-[9px] text-muted-foreground">{t('hud.legendLaser')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TurnPhaseBar() {
  const [showRoundPanel, setShowRoundPanel] = useState(false);
  // Mini-placar: sempre visível por padrão, mas o jogador pode recolher.
  // A preferência fica lembrada entre sessões.
  const [scoreboardOpen, setScoreboardOpen] = useState(() => {
    try { return localStorage.getItem('supremacia_scoreboard') !== 'collapsed'; } catch { return true; }
  });
  const toggleScoreboard = () => setScoreboardOpen(o => {
    const next = !o;
    try { localStorage.setItem('supremacia_scoreboard', next ? 'open' : 'collapsed'); } catch { /* ignore */ }
    return next;
  });
  const { game, dispatch, companyMapVisible, setCompanyMapVisible } = useGameStore();
  const t = useT();
  const names = useNames();
  const tutorialActiveKey = useTutorialStore(s => s.activeKey);
  const stageName = (stage: number) => t(`phase.${stage}.name` as TranslationKey);
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

  // Hide private overlay whenever the active player changes (hotseat privacy).
  useEffect(() => {
    setCompanyMapVisible(false);
  }, [turn.currentPlayer]);

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
        const nameList = dormant.map(id => names.company(id, cards[id]?.companyName ?? id)).join(', ');
        toast.warning(t('hud.salaryShortTitle'), {
          description: t('hud.salaryShortDesc', { count: dormant.length, names: nameList }),
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
    // Modo Digital Balanceado: só na 1ª rodada a venda (Estágio 3) é resolvida na
    // fase de Venda Simultânea — aqui aparece como já tratada. Da rodada 2 em
    // diante o Estágio 3 volta ao fluxo normal de venda por turno.
    if (stage === 3 && isSimultaneousSellRound(game)) return 'used';
    if (turn.optionalStagesUsed.includes(stage as TurnStage)) return 'used';
    const lastUsed = turn.optionalStagesUsed[turn.optionalStagesUsed.length - 1] || 2;
    if (stage <= lastUsed) return 'past';
    if (isAtLimit) return 'locked';
    return 'available';
  };

  const getContextMessage = () => {
    if (usedCount === 0) {
      return t('hud.ctxStart', { max: MAX_OPTIONAL });
    }
    if (isAtLimit) {
      return t('hud.ctxLimit', { max: MAX_OPTIONAL });
    }
    const ordinal = t(`hud.ordinal.${usedCount}` as TranslationKey);
    const remainText =
      remaining === 1 ? t('hud.moreActionsOne') : t('hud.moreActionsMany', { n: remaining });
    return t('hud.ctxProgress', { ordinal, remain: remainText });
  };

  return (
    <>
    <div className="flex-shrink-0 bg-card border-b border-border px-3 py-2 [@media(max-height:600px)]:py-1 safe-top">
      {/* Top row: Player info + Turn */}
      <div className="flex items-center justify-between mb-1.5 [@media(max-height:600px)]:mb-0.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sp.color }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', color: sp.color }}>
            {names.factionShort(turn.currentPlayer)}
          </span>
          {!isHuman && (
            <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded uppercase">CPU</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isHuman && (
            <button
              onClick={() => setCompanyMapVisible(!companyMapVisible)}
              title={companyMapVisible ? t('hud.companiesHide') : t('hud.companiesShow')}
              className={`
                text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-all active:scale-[0.95]
                ${companyMapVisible
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 font-semibold'
                  : 'bg-secondary/40 text-muted-foreground border border-border/40 hover:bg-secondary/70'}
              `}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span>🗺</span>
              <span className="[@media(max-width:360px)]:hidden">{t('hud.view')}</span>
            </button>
          )}
          <button
            onClick={() => setShowRoundPanel(true)}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-secondary/50 active:scale-[0.97]"
            title={t('hud.viewAllPlayers')}
          >
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>{t('hud.roundShort')}</span>
            <span className="font-bold">{turn.turnNumber}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-[10px]">{turn.currentPlayerIndex + 1}/{turn.playerOrder.length}</span>
            <span className="text-[9px] text-muted-foreground/40 ml-0.5">ℹ</span>
          </button>
        </div>
      </div>

      {/* Mini-placar de jogadores — informação pública (dinheiro), sempre visível
          e retrátil. Tocar num jogador abre o painel completo (recursos/cartas/armas). */}
      <div className="mb-1.5 [@media(max-height:600px)]:mb-1">
        {scoreboardOpen ? (
          <div className="flex items-center gap-1">
            <div className="flex-1 flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {turn.playerOrder.map(pid => {
                const p = game.players[pid];
                const psp = SUPERPOWERS[pid];
                const isCur = pid === turn.currentPlayer;
                const money = p.money >= 1000 ? `$${Math.floor(p.money / 1000)}k` : `$${fmtNum(p.money)}`;
                return (
                  <button
                    key={pid}
                    onClick={() => setShowRoundPanel(true)}
                    title={t('hud.viewAllPlayers')}
                    className={`shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-md border transition-all active:scale-[0.96] ${
                      isCur ? 'border-primary/60 bg-primary/10' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'
                    } ${p.isEliminated ? 'opacity-40' : ''}`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: psp.color }} />
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider ${p.isEliminated ? 'line-through' : ''}`}
                      style={{ fontFamily: 'var(--font-display)', color: isCur ? psp.color : undefined }}
                    >
                      {names.factionShort(pid)}
                    </span>
                    {!p.isEliminated && (
                      <span className="text-[9px] font-mono font-bold text-emerald-400">{money}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={toggleScoreboard}
              title={t('hud.scoreboardHide')}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            >
              <ChevronUp size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={toggleScoreboard}
            title={t('hud.scoreboardShow')}
            className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary/50"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <Users size={11} /> {t('hud.players')} <ChevronDown size={11} />
          </button>
        )}
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
                {t('hud.optionalActions', { used: usedCount, max: MAX_OPTIONAL })}
              </span>
              <span className={`text-[10px] font-mono ${isAtLimit ? 'text-red-400/70' : 'text-muted-foreground'}`}>
                {isAtLimit
                  ? t('hud.limitReached')
                  : `${remaining} ${remaining !== 1 ? t('hud.remainingMany') : t('hud.remainingOne')}`}
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
                availability === 'used' ? t('hud.usedThisTurn')
                : availability === 'past' ? t('hud.pastPhase')
                : t('hud.limitTitle', { max: MAX_OPTIONAL });

              return (
                <button
                  key={stage}
                  onClick={() => isAvailable && handleSelectOptionalStage(stage as TurnStage)}
                  disabled={!isAvailable}
                  className={`
                    flex-1 py-1.5 [@media(max-height:600px)]:py-1 px-0.5 rounded text-center transition-all uppercase tracking-wider flex flex-col items-center gap-0.5 min-w-0
                    ${tutorialActiveKey === `phase.${stage}` ? 'ring-2 ring-primary/70 animate-pulse' : ''}
                    ${isAvailable
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/30 active:scale-[0.95] animate-pulse-subtle'
                      : isUsed
                        ? 'bg-accent/20 text-accent-foreground/50 border border-accent/20 cursor-default'
                        : availability === 'past'
                          ? 'bg-orange-500/8 text-orange-400/35 border border-orange-500/15 cursor-not-allowed'
                          : 'bg-secondary/20 text-muted-foreground/25 border border-border/10 cursor-not-allowed'
                    }
                  `}
                  style={{ fontFamily: 'var(--font-display)' }}
                  title={isAvailable ? t('hud.stageUsesAction', { stage: stageName(stage) }) : disabledTitle}
                >
                  <span className={`text-sm leading-none ${!isAvailable && !isUsed ? 'opacity-30' : ''}`}>
                    {STAGE_ICONS[stage]}
                  </span>
                  <span className={`text-[9px] font-bold leading-tight truncate w-full text-center ${isUsed ? 'line-through' : ''}`}>
                    {stageName(stage)}
                  </span>
                  {isAvailable && (
                    <span className="text-emerald-400/60 text-[8px] leading-none [@media(max-height:600px)]:hidden">{t('hud.oneAction')}</span>
                  )}
                  {isUsed && (
                    <span className="text-accent-foreground/40 text-[8px] leading-none [@media(max-height:600px)]:hidden">✓</span>
                  )}
                  {availability === 'past' && (
                    <span className="text-orange-400/40 text-[8px] leading-none [@media(max-height:600px)]:hidden">← {t('hud.previousShort')}</span>
                  )}
                  {availability === 'locked' && (
                    <span className="text-muted-foreground/25 text-[8px] leading-none [@media(max-height:600px)]:hidden">⛔</span>
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
              {isAtLimit ? `→ ${t('hud.nextPlayer')}` : t('hud.endTurn')}
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
                  title={stageName(stage)}
                  className={`
                    flex-1 min-w-0 py-2.5 [@media(max-height:600px)]:py-1 px-0.5 rounded text-center transition-all uppercase tracking-wider flex flex-col items-center gap-0.5 overflow-hidden
                    ${tutorialActiveKey === `phase.${stage}` ? 'ring-2 ring-primary/70 animate-pulse' : ''}
                    ${isCurrent ? 'bg-primary text-primary-foreground ring-1 ring-primary/50 cursor-pointer' : ''}
                    ${isPast && !isCurrent ? 'bg-secondary/50 text-muted-foreground' : ''}
                    ${isUsed && !isCurrent ? 'bg-accent/50 text-accent-foreground/70' : ''}
                    ${!isCurrent && !isPast && !isUsed ? 'bg-secondary/30 text-muted-foreground/50' : ''}
                  `}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <span className="text-sm leading-none">{STAGE_ICONS[stage]}</span>
                  <span className="block w-full text-[10px] truncate text-center [@media(max-height:600px)]:hidden">{stageName(stage)}</span>
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
                  {stageName(turn.stage)}
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
                {t('hud.completePhase')}
              </button>
              <button
                onClick={handleEndTurn}
                className="text-[10px] px-2 py-1 bg-destructive text-destructive-foreground rounded uppercase tracking-wider hover:opacity-90 active:scale-[0.97]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('hud.endTurn')}
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
