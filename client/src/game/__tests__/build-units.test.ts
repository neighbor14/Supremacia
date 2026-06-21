import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store';
import { createInitialGameState } from '../setup';
import { RULES } from '../rulesConfig';
import type { GameState, SuperpowerId } from '../types';

const ALL: SuperpowerId[] = ['south_america', 'africa', 'europe', 'china', 'usa', 'ussr'];

/** Build a game with `human` active at the construction stage (6), then load it. */
function setupBuildGame(human: SuperpowerId = 'usa'): GameState {
  const ais = ALL.filter(id => id !== human);
  const game = createInitialGameState(human, ais);
  game.turn.currentPlayer = human;
  game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf(human);
  game.turn.stage = 6 as GameState['turn']['stage'];
  game.turn.isFirstTurn = false;
  game.turn.unitsBuiltThisTurn = 0;
  return game;
}

function load(game: GameState) {
  useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });
}
const g = () => useGameStore.getState().game!;
const dispatch = (a: Parameters<ReturnType<typeof useGameStore.getState>['dispatch']>[0]) =>
  useGameStore.getState().dispatch(a);

beforeEach(() => {
  useGameStore.setState({ game: null });
});

// ============================================================
// Fidelidade 3.7.1 (manual Grow): 1 conjunto de suprimentos
// (1 cereal + 1 petróleo + 1 minério) constrói 3 peças militares.
// ============================================================
describe('construção de unidades — 3 peças por conjunto de suprimentos', () => {
  /** Returns a home territory id the human controls (valid build location). */
  function homeTerritory(game: GameState, human: SuperpowerId): string {
    const t = Object.values(game.territories).find(
      t => t.superpowerId === human && !t.nuked && t.owner === human
    );
    if (!t) throw new Error('no home territory for human');
    return t.id;
  }

  it('três exércitos avulsos custam 1 conjunto (não 3)', () => {
    const game = setupBuildGame('usa');
    const human = 'usa';
    const loc = homeTerritory(game, human);
    const p = game.players[human];
    p.money = 100_000;
    p.supplies = { grain: 5, oil: 5, mineral: 5 };
    const baseArmies = p.armies[loc] || 0;
    load(game);

    // Build three armies one at a time (the real UI dispatch shape).
    for (let i = 0; i < 3; i++) {
      dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: loc }] });
    }

    const after = g().players[human];
    // 3 units → exactly 1 supply set consumed.
    expect(after.supplies.grain).toBe(4);
    expect(after.supplies.oil).toBe(4);
    expect(after.supplies.mineral).toBe(4);
    // Money: $1.000 per unit × 3.
    expect(after.money).toBe(100_000 - 3 * RULES.UNIT_COST);
    // Three armies landed.
    expect(after.armies[loc] - baseArmies).toBe(3);
    expect(g().turn.unitsBuiltThisTurn).toBe(3);
  });

  it('a quarta peça abre um novo conjunto', () => {
    const game = setupBuildGame('usa');
    const human = 'usa';
    const loc = homeTerritory(game, human);
    const p = game.players[human];
    p.money = 100_000;
    p.supplies = { grain: 5, oil: 5, mineral: 5 };
    const baseArmies = p.armies[loc] || 0;
    load(game);

    for (let i = 0; i < 4; i++) {
      dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: loc }] });
    }

    const after = g().players[human];
    // 4 units → ceil(4/3) = 2 sets consumed.
    expect(after.supplies.mineral).toBe(3);
    expect(after.armies[loc] - baseArmies).toBe(4);
  });

  it('um único minério permite construir até 3 peças', () => {
    const game = setupBuildGame('usa');
    const human = 'usa';
    const loc = homeTerritory(game, human);
    const p = game.players[human];
    p.money = 100_000;
    p.supplies = { grain: 1, oil: 1, mineral: 1 };
    const baseArmies = p.armies[loc] || 0;
    load(game);

    for (let i = 0; i < 3; i++) {
      dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: loc }] });
    }

    const after = g().players[human];
    expect(after.armies[loc] - baseArmies).toBe(3);
    expect(after.supplies.mineral).toBe(0);

    // A fourth unit must be rejected — no supplies left for a new set.
    dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: loc }] });
    expect(g().players[human].armies[loc] - baseArmies).toBe(3);
  });

  it('o contador reseta entre turnos (próximo turno cobra um novo conjunto)', () => {
    const game = setupBuildGame('usa');
    const human = 'usa';
    const loc = homeTerritory(game, human);
    const p = game.players[human];
    p.money = 100_000;
    p.supplies = { grain: 5, oil: 5, mineral: 5 };
    load(game);

    dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: loc }] });
    expect(g().turn.unitsBuiltThisTurn).toBe(1);

    // Simulate the per-turn reset that advanceToNextPlayer performs.
    useGameStore.setState(s => {
      const ng = { ...s.game! };
      ng.turn = { ...ng.turn, unitsBuiltThisTurn: 0 };
      return { game: ng };
    });

    dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: loc }] });
    const after = g().players[human];
    // Two separate single-unit turns → 2 sets total.
    expect(after.supplies.mineral).toBe(3);
  });
});
