import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';
import { SUPERPOWERS } from '../data/initialPlayers';
import { TurnStage } from '../game/types';

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

export default function TurnPhaseBar() {
  const { game, dispatch } = useGameStore();
  if (!game) return null;

  const { turn } = game;
  const currentPlayer = game.players[turn.currentPlayer];
  const sp = SUPERPOWERS[turn.currentPlayer];
  const isHuman = currentPlayer.isHuman;

  // After mandatory stages complete, player is in "choosing" mode
  const isChoosingPhase = isHuman && turn.stage >= 2 && turn.stageComplete;

  const handleMandatoryAction = () => {
    if (!isHuman) return;
    playSound('button-click', 0.6);
    if (turn.stage === 1) {
      dispatch({ type: 'PAY_SALARIES' });
      dispatch({ type: 'NEXT_STAGE' });
    } else if (turn.stage === 2 && !turn.stageComplete) {
      dispatch({ type: 'TRANSFER_PRODUCTION' });
      dispatch({ type: 'NEXT_STAGE' });
    }
  };

  const handleSelectOptionalStage = (stage: TurnStage) => {
    if (!isHuman) return;
    if (turn.optionalStagesUsed.length >= 3) return;
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

  // Check which optional stages are still available
  const getStageAvailability = (stage: number) => {
    if (stage <= 2) return 'mandatory';
    if (turn.optionalStagesUsed.includes(stage as TurnStage)) return 'used';
    // Must be in order: stage must be > last used optional
    const lastUsed = turn.optionalStagesUsed[turn.optionalStagesUsed.length - 1] || 2;
    if (stage <= lastUsed) return 'past';
    if (turn.optionalStagesUsed.length >= 3) return 'locked';
    return 'available';
  };

  return (
    <div className="flex-shrink-0 bg-card border-b border-border px-3 py-2 safe-top">
      {/* Top row: Player info + Turn */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sp.color }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', color: sp.color }}>
            {sp.shortName}
          </span>
          {!isHuman && (
            <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded uppercase">CPU</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          Turno {turn.turnNumber}
        </span>
      </div>

      {/* Choosing mode: show clear selection UI */}
      {isChoosingPhase ? (
        <div>
          <p className="text-[10px] text-emerald-400 mb-1.5 font-medium uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Escolha sua próxima ação ({turn.optionalStagesUsed.length}/3 usadas):
          </p>
          <div className="flex items-center gap-1">
            {[3, 4, 5, 6, 7].map(stage => {
              const availability = getStageAvailability(stage);
              const isAvailable = availability === 'available';

              return (
                <button
                  key={stage}
                  onClick={() => isAvailable && handleSelectOptionalStage(stage as TurnStage)}
                  disabled={!isAvailable}
                  className={`
                    flex-1 py-2 px-1 rounded text-center transition-all text-[10px] uppercase tracking-wider
                    ${isAvailable
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/30 active:scale-[0.95] animate-pulse-subtle'
                      : availability === 'used'
                        ? 'bg-secondary/30 text-muted-foreground/50 line-through'
                        : 'bg-secondary/30 text-muted-foreground/30 cursor-not-allowed'
                    }
                  `}
                  style={{ fontFamily: 'var(--font-display)' }}
                  title={
                    availability === 'used' ? 'Já usada neste turno'
                    : availability === 'past' ? 'Não pode voltar atrás'
                    : availability === 'locked' ? 'Limite de 3 atingido'
                    : 'Clique para selecionar'
                  }
                >
                  <span className="block text-sm mb-0.5">{STAGE_ICONS[stage]}</span>
                  {STAGE_NAMES[stage]}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end mt-2">
            <button
              onClick={handleEndTurn}
              className="text-[10px] px-3 py-1.5 bg-destructive text-destructive-foreground rounded uppercase tracking-wider hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Encerrar Turno
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Normal stage indicators */}
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
                  className={`
                    flex-1 min-w-0 py-1.5 px-0.5 rounded text-center transition-all uppercase tracking-wider flex flex-col items-center gap-0.5 overflow-hidden
                    ${isCurrent ? 'bg-primary text-primary-foreground ring-1 ring-primary/50 cursor-pointer' : ''}
                    ${isPast && !isCurrent ? 'bg-secondary/50 text-muted-foreground' : ''}
                    ${isUsed && !isCurrent ? 'bg-accent/50 text-accent-foreground/70' : ''}
                    ${!isCurrent && !isPast && !isUsed ? 'bg-secondary/30 text-muted-foreground/50' : ''}
                  `}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <span className="text-sm leading-none">{STAGE_ICONS[stage]}</span>
                  <span className="block w-full text-[8px] truncate text-center">{STAGE_NAMES[stage]}</span>
                </button>
              );
            })}
          </div>

          {/* Action buttons during an active optional stage */}
          {isHuman && turn.stage > 2 && !turn.stageComplete && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground">
                Fase: {STAGE_NAMES[turn.stage]}
              </span>
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
  );
}
