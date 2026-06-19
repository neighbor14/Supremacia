import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';

export default function CombatModal() {
  const { game, dispatch } = useGameStore();
  if (!game || !game.combat.active) return null;

  const { combat } = game;
  const attacker = combat.attackerId ? SUPERPOWERS[combat.attackerId] : null;
  const defender = combat.defenderId ? SUPERPOWERS[combat.defenderId] : null;
  const targetName = combat.targetId
    ? (combat.targetType === 'territory'
        ? game.territories[combat.targetId]?.name
        : game.seaZones[combat.targetId]?.name) || combat.targetId
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg p-5 w-full max-w-sm animate-in zoom-in-95 duration-200">
        <h2 className="text-lg font-bold uppercase tracking-wider text-center mb-4 text-destructive" style={{ fontFamily: 'var(--font-display)' }}>
          Combate
        </h2>

        {/* Target */}
        <p className="text-xs text-center text-muted-foreground mb-4">
          Batalha por <span className="text-foreground font-semibold">{targetName}</span>
        </p>

        {/* Forces */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-center">
            <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{ backgroundColor: attacker?.color }} />
            <p className="text-[10px] uppercase" style={{ fontFamily: 'var(--font-display)', color: attacker?.color }}>
              {attacker?.shortName}
            </p>
            <p className="text-lg font-bold font-mono-num">{combat.attackerUnits}</p>
          </div>
          <span className="text-xl text-muted-foreground">⚔</span>
          <div className="text-center">
            <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{ backgroundColor: defender?.color }} />
            <p className="text-[10px] uppercase" style={{ fontFamily: 'var(--font-display)', color: defender?.color }}>
              {defender?.shortName}
            </p>
            <p className="text-lg font-bold font-mono-num">{combat.defenderUnits}</p>
          </div>
        </div>

        {/* Dice results */}
        {combat.phase === 'result' || combat.phase === 'occupy' ? (
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <div className="flex gap-1">
                {combat.attackerDice.map((d, i) => (
                  <span key={i} className="w-7 h-7 flex items-center justify-center bg-secondary rounded text-sm font-bold font-mono-num">{d}</span>
                ))}
              </div>
              <div className="flex gap-1">
                {combat.defenderDice.map((d, i) => (
                  <span key={i} className="w-7 h-7 flex items-center justify-center bg-secondary rounded text-sm font-bold font-mono-num">{d}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Baixas: {combat.attackerLosses}</span>
              <span>Baixas: {combat.defenderLosses}</span>
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex gap-2 justify-center">
          {combat.phase === 'confirm' && (
            <button
              onClick={() => dispatch({ type: 'ROLL_COMBAT' })}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Rolar Dados
            </button>
          )}
          {combat.phase === 'occupy' && (
            <button
              onClick={() => dispatch({ type: 'OCCUPY_TERRITORY' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Ocupar Território
            </button>
          )}
          {combat.phase === 'result' && (
            <button
              onClick={() => dispatch({ type: 'OCCUPY_TERRITORY' })}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Encerrar Combate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
