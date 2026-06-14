import { useGameStore } from '../game/store';
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

export default function TurnPhaseBar() {
  const { game, dispatch } = useGameStore();
  if (!game) return null;

  const { turn } = game;
  const currentPlayer = game.players[turn.currentPlayer];
  const sp = SUPERPOWERS[turn.currentPlayer];
  const isHuman = currentPlayer.isHuman;

  const handleStageAction = () => {
    if (!isHuman) return;
    if (turn.stage === 1) {
      dispatch({ type: 'PAY_SALARIES' });
      dispatch({ type: 'NEXT_STAGE' });
    } else if (turn.stage === 2) {
      dispatch({ type: 'TRANSFER_PRODUCTION' });
      dispatch({ type: 'NEXT_STAGE' });
    }
  };

  const handleSelectStage = (stage: TurnStage) => {
    if (!isHuman || stage <= 2) return;
    if (turn.optionalStagesUsed.length >= 3) return;
    if (turn.optionalStagesUsed.includes(stage)) return;
    dispatch({ type: 'NEXT_STAGE' });
  };

  const handleEndTurn = () => {
    if (!isHuman) return;
    dispatch({ type: 'END_TURN' });
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

      {/* Stage indicators */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map(stage => {
          const isCurrent = turn.stage === stage;
          const isUsed = turn.optionalStagesUsed.includes(stage as TurnStage);
          const isMandatory = stage <= 2;
          const isPast = stage < turn.stage || (stage <= 2 && turn.stage > 2);

          return (
            <button
              key={stage}
              onClick={() => {
                if (isCurrent && stage <= 2) handleStageAction();
              }}
              disabled={!isHuman}
              className={`
                flex-1 py-1.5 px-1 rounded text-center transition-all text-[10px] uppercase tracking-wider
                ${isCurrent ? 'bg-primary text-primary-foreground ring-1 ring-primary/50' : ''}
                ${isPast ? 'bg-secondary/50 text-muted-foreground' : ''}
                ${isUsed && !isCurrent ? 'bg-accent text-accent-foreground' : ''}
                ${!isCurrent && !isPast && !isUsed ? 'bg-secondary/30 text-muted-foreground/50' : ''}
              `}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {STAGE_NAMES[stage]}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      {isHuman && turn.stage > 2 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-muted-foreground">
            Opcionais: {turn.optionalStagesUsed.length}/3
          </span>
          <div className="flex-1" />
          <button
            onClick={() => dispatch({ type: 'SKIP_STAGE' })}
            className="text-[10px] px-2 py-1 bg-secondary text-secondary-foreground rounded uppercase tracking-wider hover:bg-secondary/80 active:scale-[0.97]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Pular
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
    </div>
  );
}
