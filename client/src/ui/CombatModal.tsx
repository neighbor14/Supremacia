import { useEffect, useRef } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { playSound } from '../game/audio';
import { useT } from '../i18n/useI18n';

function Dice({ values }: { values: number[] }) {
  return (
    <div className="flex gap-1">
      {values.map((d, i) => (
        <span key={i} className="w-7 h-7 flex items-center justify-center bg-secondary rounded text-sm font-bold font-mono-num">{d}</span>
      ))}
    </div>
  );
}

export default function CombatModal() {
  const { game, dispatch } = useGameStore();
  const t = useT();
  const prevPhaseRef = useRef<string>('');

  useEffect(() => {
    if (!game?.combat.active) return;
    const phase = game.combat.phase;
    if (phase !== prevPhaseRef.current) {
      if (phase === 'result') playSound('combat-hit', 0.8);
      prevPhaseRef.current = phase;
    }
  }, [game?.combat.phase, game?.combat.active]);

  if (!game || !game.combat.active) return null;

  const { combat } = game;
  const attacker = combat.attackerId ? SUPERPOWERS[combat.attackerId] : null;
  const defender = combat.defenderId ? SUPERPOWERS[combat.defenderId] : null;
  const targetName = combat.targetId
    ? (combat.targetType === 'territory'
        ? game.territories[combat.targetId]?.name
        : game.seaZones[combat.targetId]?.name) || combat.targetId
    : '';

  const showDice = combat.phase === 'result' || combat.phase === 'occupy' || combat.phase === 'defender_response';
  const isDefenderResponse = combat.phase === 'defender_response';

  // D6: territórios adjacentes ao defendido, do defensor, com exércitos disponíveis.
  const reinforcementSources = (() => {
    if (!isDefenderResponse || !combat.defenderId || !combat.targetId) return [];
    const defenderPlayer = game.players[combat.defenderId];
    const territory = game.territories[combat.targetId];
    if (!territory) return [];
    return territory.adjacentTerritories
      .filter(tid => (defenderPlayer.armies[tid] || 0) > 0 && game.territories[tid]?.owner === combat.defenderId)
      .map(tid => ({ id: tid, name: game.territories[tid]?.name ?? tid, count: defenderPlayer.armies[tid] || 0 }));
  })();

  const cr = combat.counterResult;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg p-5 w-full max-w-sm animate-in zoom-in-95 duration-200">
        <h2 className="text-lg font-bold uppercase tracking-wider text-center mb-4 text-destructive" style={{ fontFamily: 'var(--font-display)' }}>
          {isDefenderResponse ? t('combat.defenderResponse') : t('combat.title')}
        </h2>

        {/* Target */}
        <p className="text-xs text-center text-muted-foreground mb-4">
          {t('combat.battleFor')} <span className="text-foreground font-semibold">{targetName}</span>
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
        {showDice ? (
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <Dice values={combat.attackerDice} />
              <Dice values={combat.defenderDice} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t('combat.casualties')}: {combat.attackerLosses}</span>
              <span>{t('combat.casualties')}: {combat.defenderLosses}</span>
            </div>
          </div>
        ) : null}

        {/* Counter-attack result (D7) — quando a IA/o defensor contra-atacou */}
        {cr ? (
          <div className="mb-4 p-2 rounded border border-destructive/40 bg-destructive/5">
            <p className="text-[10px] uppercase tracking-wider text-destructive mb-1 text-center" style={{ fontFamily: 'var(--font-display)' }}>
              {t('combat.counterAttack')}
            </p>
            <div className="flex justify-between mb-1">
              <Dice values={cr.attackerDice} />
              <Dice values={cr.defenderDice} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t('combat.crDefenderLost')}: {cr.counterAttackerLosses}</span>
              <span>{t('combat.crAttackerLost')}: {cr.counterDefenderLosses}</span>
            </div>
            {cr.clearedTarget && (
              <p className="text-[10px] text-center text-amber-500 mt-1">{t('combat.originCleared')}</p>
            )}
          </div>
        ) : null}

        {/* ── D6/D7: painel interativo de resposta do defensor ── */}
        {isDefenderResponse && (
          <div className="mb-3 space-y-3">
            <p className="text-xs text-center text-foreground">
              {t('combat.resisted')}
            </p>

            {/* D6: Reforço */}
            {combat.reinforceAvailable && reinforcementSources.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {t('combat.reinforceTap')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {reinforcementSources.map(src => (
                    <button
                      key={src.id}
                      onClick={() => { playSound('button-click', 0.5); dispatch({ type: 'REINFORCE_AFTER_COMBAT', from: src.id, count: 1 }); }}
                      className="px-2.5 py-1.5 bg-secondary text-secondary-foreground rounded text-[11px] font-semibold hover:opacity-90 active:scale-[0.97]"
                    >
                      {src.name} ({src.count})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* D7: Contra-ataque */}
            {combat.counterAttackAvailable && (
              <button
                onClick={() => { playSound('dice-roll', 0.9); dispatch({ type: 'COUNTER_ATTACK' }); }}
                className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('combat.counterAttackBtn')}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-center">
          {combat.phase === 'confirm' && (
            <button
              onClick={() => { playSound('dice-roll', 0.9); dispatch({ type: 'ROLL_COMBAT' }); }}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('combat.rollDice')}
            </button>
          )}
          {combat.phase === 'occupy' && (
            <button
              onClick={() => { playSound('territory-conquered'); dispatch({ type: 'OCCUPY_TERRITORY' }); }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('combat.occupy')}
            </button>
          )}
          {combat.phase === 'result' && (
            <button
              onClick={() => { playSound('button-click', 0.5); dispatch({ type: 'OCCUPY_TERRITORY' }); }}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('combat.endCombat')}
            </button>
          )}
          {isDefenderResponse && (
            <button
              onClick={() => { playSound('button-click', 0.5); dispatch({ type: 'FINISH_DEFENDER_RESPONSE' }); }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('combat.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
