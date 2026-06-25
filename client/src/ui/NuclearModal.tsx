import { useEffect, useRef } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { playSound } from '../game/audio';
import { useT } from '../i18n/useI18n';
import { useNames } from '../i18n/names';

export default function NuclearModal() {
  const { game, dispatch } = useGameStore();
  const t = useT();
  const names = useNames();
  const prevPhaseRef = useRef<string>('');

  useEffect(() => {
    if (!game?.nuclearAttack.active) return;
    const { phase, intercepted } = game.nuclearAttack;
    if (phase !== prevPhaseRef.current) {
      if (phase === 'result') {
        if (intercepted) {
          playSound('diplomacy-alert', 0.9);
        } else {
          playSound('explosion', 1.0);
        }
      }
      prevPhaseRef.current = phase;
    }
  }, [game?.nuclearAttack.phase, game?.nuclearAttack.active, game?.nuclearAttack.intercepted]);

  if (!game || !game.nuclearAttack.active) return null;

  const { nuclearAttack } = game;
  const attacker = nuclearAttack.attackerId ? SUPERPOWERS[nuclearAttack.attackerId] : null;
  const targetName = nuclearAttack.targetId
    ? (nuclearAttack.targetType === 'territory'
      ? names.territory(nuclearAttack.targetId)
      : names.sea(nuclearAttack.targetId))
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-destructive/50 rounded-lg p-5 w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="text-center mb-4">
          <span className="text-4xl">☢</span>
          <h2 className="text-lg font-bold uppercase tracking-wider text-destructive mt-2" style={{ fontFamily: 'var(--font-display)' }}>
            {t('nuke.title')}
          </h2>
        </div>

        <p className="text-xs text-center text-muted-foreground mb-4">
          <span style={{ color: attacker?.color }}>{nuclearAttack.attackerId ? names.factionShort(nuclearAttack.attackerId) : ''}</span> {t('nuke.launchedOn')}{' '}
          <span className="text-foreground font-semibold">{targetName}</span>
        </p>

        {/* Defense phase */}
        {nuclearAttack.phase === 'defense' && (
          <div className="text-center mb-4">
            <p className="text-xs text-primary mb-2">{t('nuke.defenderHasLaser')}</p>
            <button
              onClick={() => dispatch({ type: 'DEFEND_NUKE' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('nuke.rollDefense')}
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
              {t('nuke.confirmLaunch')}
            </button>
          </div>
        )}

        {/* Result phase */}
        {nuclearAttack.phase === 'result' && (
          <div className="text-center">
            {nuclearAttack.intercepted ? (
              <p className="text-sm text-primary font-semibold mb-3">{t('nuke.intercepted')}</p>
            ) : (
              <p className="text-sm text-destructive font-semibold mb-3">{t('nuke.impact')}</p>
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
              {t('common.continue')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
