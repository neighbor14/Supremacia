import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';

export default function NuclearModal() {
  const { game, dispatch } = useGameStore();
  if (!game || !game.nuclearAttack.active) return null;

  const { nuclearAttack } = game;
  const attacker = nuclearAttack.attackerId ? SUPERPOWERS[nuclearAttack.attackerId] : null;
  const targetName = nuclearAttack.targetId
    ? (nuclearAttack.targetType === 'territory'
      ? game.territories[nuclearAttack.targetId]?.name
      : game.seaZones[nuclearAttack.targetId]?.name) || nuclearAttack.targetId
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-destructive/50 rounded-lg p-5 w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="text-center mb-4">
          <span className="text-4xl">☢</span>
          <h2 className="text-lg font-bold uppercase tracking-wider text-destructive mt-2" style={{ fontFamily: 'var(--font-display)' }}>
            Ataque Nuclear
          </h2>
        </div>

        <p className="text-xs text-center text-muted-foreground mb-4">
          <span style={{ color: attacker?.color }}>{attacker?.shortName}</span> lançou bomba nuclear em{' '}
          <span className="text-foreground font-semibold">{targetName}</span>
        </p>

        {/* Defense phase */}
        {nuclearAttack.phase === 'defense' && (
          <div className="text-center mb-4">
            <p className="text-xs text-primary mb-2">Defensor possui Laser-Star! Tentando interceptar...</p>
            <button
              onClick={() => dispatch({ type: 'DEFEND_NUKE' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Rolar Defesa
            </button>
          </div>
        )}

        {/* Confirm phase */}
        {nuclearAttack.phase === 'confirm' && (
          <div className="text-center">
            <button
              onClick={() => dispatch({ type: 'RESOLVE_NUKE' })}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Confirmar Lançamento
            </button>
          </div>
        )}

        {/* Result phase */}
        {nuclearAttack.phase === 'result' && (
          <div className="text-center">
            {nuclearAttack.intercepted ? (
              <p className="text-sm text-primary font-semibold mb-3">Interceptado pelo Laser-Star!</p>
            ) : (
              <p className="text-sm text-destructive font-semibold mb-3">Impacto confirmado. Território destruído.</p>
            )}
            {nuclearAttack.defenseRolls.length > 0 && (
              <div className="flex gap-1 justify-center mb-3">
                {nuclearAttack.defenseRolls.map((d, i) => (
                  <span key={i} className="w-7 h-7 flex items-center justify-center bg-secondary rounded text-sm font-bold font-mono-num">{d}</span>
                ))}
              </div>
            )}
            <button
              onClick={() => dispatch({ type: 'RESOLVE_NUKE' })}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
