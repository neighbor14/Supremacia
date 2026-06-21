import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store';
import { createInitialGameState } from '../setup';
import { RULES } from '../rulesConfig';
import type { GameState, SuperpowerId, CombatState } from '../types';

// D6/D7 — resposta do defensor pós-combate (reforço + contra-ataque).
// Manual Grow: defensor que mantém o território pode reforçar de adjacente e
// contra-atacar a origem uma vez. Ver docs/regras-supremacia.md.

const HUMAN: SuperpowerId = 'south_america';
const AI: SuperpowerId = 'africa';

/**
 * Monta um combate já resolvido em que o defensor (HUMAN) sobreviveu e tem a
 * janela de resposta aberta ('defender_response'). targetId = território
 * defendido; fromId = origem do ataque (do AI). Carrega no store.
 */
function defenderResponseGame(opts?: { aiTurn?: boolean }): {
  game: GameState; targetId: string; fromId: string; adj: string;
} {
  const game = createInitialGameState(HUMAN, [AI]);
  // Acha um território do HUMAN com um vizinho terrestre — vira o "defendido".
  const targetId = Object.values(game.territories).find(
    t => t.owner === HUMAN && t.adjacentTerritories.length > 0,
  )!.id;
  const adj = game.territories[targetId].adjacentTerritories[0];
  // fromId = a origem do ataque; usa outro vizinho se houver, senão o mesmo adj.
  const fromId = game.territories[targetId].adjacentTerritories[1] ?? adj;

  // Defensor humano com tropas no território defendido + reforço adjacente.
  game.players[HUMAN].armies = { [targetId]: 4, [adj]: 3 };
  game.territories[targetId].owner = HUMAN;
  game.territories[adj].owner = HUMAN;
  game.players[HUMAN].supplies = { grain: 5, oil: 5, mineral: 5 };

  // Atacante (AI) com tropas na origem.
  game.players[AI].armies = { [fromId]: 6 };
  game.territories[fromId].owner = AI;
  game.players[AI].supplies = { grain: 5, oil: 5, mineral: 5 };

  game.turn.currentPlayer = opts?.aiTurn ? AI : HUMAN;
  game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf(game.turn.currentPlayer);
  game.turn.isFirstTurn = false;

  const combat: CombatState = {
    active: true,
    attackerId: AI,
    defenderId: HUMAN,
    fromId,
    targetId,
    targetType: 'territory',
    attackerUnits: 6,
    defenderUnits: 4,
    attackerUnitsAfter: 6,
    defenderUnitsAfter: 4,
    conquered: false,
    attackerDice: [3],
    defenderDice: [2, 4],
    attackerLosses: 0,
    defenderLosses: 0,
    phase: 'defender_response',
    defenderChoice: null,
    reinforceAvailable: true,
    reinforceUsed: false,
    counterAttackAvailable: true,
    counterAttackUsed: false,
    counterResult: null,
  };
  game.combat = combat;
  return { game, targetId, fromId, adj };
}

function load(game: GameState) {
  useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });
}

describe('D6 — reforço do defensor pós-combate', () => {
  it('move exércitos do adjacente para o território defendido', () => {
    const { game, targetId, adj } = defenderResponseGame();
    load(game);
    const before = useGameStore.getState().game!.players[HUMAN].armies[targetId];

    useGameStore.getState().dispatch({ type: 'REINFORCE_AFTER_COMBAT', from: adj, count: 2 });

    const after = useGameStore.getState().game!;
    expect(after.players[HUMAN].armies[targetId]).toBe(before + 2);
    expect(after.players[HUMAN].armies[adj] ?? 0).toBe(1);
    expect(after.combat.reinforceUsed).toBe(true);
    expect(after.combat.reinforceAvailable).toBe(false);
  });

  it('não reforça de um território que não é adjacente ao defendido', () => {
    const { game, targetId } = defenderResponseGame();
    // Um território distante qualquer que não seja vizinho do defendido.
    const distant = Object.values(game.territories).find(
      t => t.id !== targetId && !game.territories[targetId].adjacentTerritories.includes(t.id),
    )!.id;
    game.players[HUMAN].armies[distant] = 5;
    game.territories[distant].owner = HUMAN;
    load(game);

    useGameStore.getState().dispatch({ type: 'REINFORCE_AFTER_COMBAT', from: distant, count: 2 });

    const after = useGameStore.getState().game!;
    expect(after.players[HUMAN].armies[distant]).toBe(5); // intacto
    expect(after.combat.reinforceUsed).toBe(false);
  });
});

describe('D7 — contra-ataque do defensor', () => {
  it('custa 1 conjunto de suprimentos e registra o resultado', () => {
    const { game } = defenderResponseGame();
    load(game);
    const sup = useGameStore.getState().game!.players[HUMAN].supplies;
    const g0 = sup.grain, o0 = sup.oil, m0 = sup.mineral;

    useGameStore.getState().dispatch({ type: 'COUNTER_ATTACK' });

    const after = useGameStore.getState().game!;
    expect(after.players[HUMAN].supplies.grain).toBe(g0 - RULES.COMBAT_SUPPLY_COST);
    expect(after.players[HUMAN].supplies.oil).toBe(o0 - RULES.COMBAT_SUPPLY_COST);
    expect(after.players[HUMAN].supplies.mineral).toBe(m0 - RULES.COMBAT_SUPPLY_COST);
    expect(after.combat.counterAttackUsed).toBe(true);
    expect(after.combat.counterAttackAvailable).toBe(false);
    expect(after.combat.counterResult).not.toBeNull();
  });

  it('não contra-ataca duas vezes', () => {
    const { game } = defenderResponseGame();
    load(game);
    useGameStore.getState().dispatch({ type: 'COUNTER_ATTACK' });
    const suppliesAfterFirst = { ...useGameStore.getState().game!.players[HUMAN].supplies };

    useGameStore.getState().dispatch({ type: 'COUNTER_ATTACK' });

    const after = useGameStore.getState().game!;
    // Suprimentos não mudam no 2º contra-ataque (bloqueado por counterAttackUsed).
    expect(after.players[HUMAN].supplies).toEqual(suppliesAfterFirst);
  });
});

describe('FINISH_DEFENDER_RESPONSE', () => {
  it('encerra o combate e, em turno da IA, avança para o próximo jogador', () => {
    const { game } = defenderResponseGame({ aiTurn: true });
    load(game);
    expect(useGameStore.getState().game!.turn.currentPlayer).toBe(AI);

    useGameStore.getState().dispatch({ type: 'FINISH_DEFENDER_RESPONSE' });

    const after = useGameStore.getState().game!;
    expect(after.combat.active).toBe(false);
    expect(after.turn.currentPlayer).not.toBe(AI); // turno da IA encerrado
  });
});

describe('Humano ataca IA — resposta do defensor é automática', () => {
  it('IA defensora forte sobrevive e o combate fica em result (não defender_response)', () => {
    const game = createInitialGameState(HUMAN, [AI]);
    // Acha fronteira HUMAN→AI adjacente.
    let from = '', target = '';
    for (const t of Object.values(game.territories)) {
      if (t.owner !== HUMAN) continue;
      const adjAi = t.adjacentTerritories.find(a => game.territories[a]?.owner === AI || a);
      if (adjAi) { from = t.id; target = t.adjacentTerritories[0]; break; }
    }
    // Configura combate humano→IA com defensor forte (sobrevive sempre).
    game.territories[from].owner = HUMAN;
    game.territories[target].owner = AI;
    game.players[HUMAN].armies = { [from]: 12 };
    game.players[AI].armies = { [target]: 12 }; // 12 tropas: baixa máx ~8 < 12 → sobrevive
    game.players[HUMAN].supplies = { grain: 5, oil: 5, mineral: 5 };
    game.players[AI].supplies = { grain: 5, oil: 5, mineral: 5 };
    game.turn.currentPlayer = HUMAN;
    game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf(HUMAN);
    game.turn.stage = 4;
    game.turn.isFirstTurn = false;
    load(game);

    useGameStore.getState().dispatch({ type: 'ATTACK_TERRITORY', from, target });
    useGameStore.getState().dispatch({ type: 'ROLL_COMBAT' });

    const after = useGameStore.getState().game!;
    // Defensor IA sobreviveu → resposta resolvida automaticamente, phase volta a 'result'
    // (humano vê o resultado e encerra). NUNCA fica preso em 'defender_response'.
    expect(after.combat.phase).not.toBe('defender_response');
    expect(after.combat.active).toBe(true); // ainda aberto até o humano encerrar
  });
});
