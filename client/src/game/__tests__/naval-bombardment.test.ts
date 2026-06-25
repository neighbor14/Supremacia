import { describe, it, expect, afterEach, vi } from 'vitest';
import { useGameStore } from '../store';
import { createInitialGameState } from '../setup';
import type { GameState, SuperpowerId } from '../types';

// Bombardeio naval (manual Grow): "As esquadras também podem atacar os exércitos
// a partir de um mar azul-claro adjacente." Uma esquadra num mar COSTEIRO ataca
// exércitos inimigos num território costeiro adjacente. É só dano — o território
// NÃO é conquistado (navio não ocupa terra). Ver docs/regras-supremacia.md.

const HUMAN: SuperpowerId = 'south_america';
const AI: SuperpowerId = 'china';

const SEA_COASTAL = 'yellow_sea'; // mar costeiro (type: 'coastal')
const SEA_DEEP = 'north_pacific'; // mar oceânico (type: 'deep')
const LAND = 'shantung';          // Xantung — costeiro, adjacente ao Mar Amarelo

/**
 * Monta um jogo no Estágio 4 (Combate) com o HUMAN segurando esquadras num mar
 * costeiro adjacente a um território inimigo (Xantung) defendido pela IA.
 */
function bombardmentGame(opts?: { fromSea?: string; defenderArmies?: number }): GameState {
  const game = createInitialGameState(HUMAN, [AI]);
  const fromSea = opts?.fromSea ?? SEA_COASTAL;

  // Atacante humano: esquadras no mar + suprimentos.
  game.players[HUMAN].navies = { [fromSea]: 3 };
  game.players[HUMAN].supplies = { grain: 5, oil: 5, mineral: 5 };

  // Defensor IA: exércitos em Xantung, que ela controla.
  game.players[AI].armies = { [LAND]: opts?.defenderArmies ?? 4 };
  game.territories[LAND].owner = AI;
  game.players[AI].supplies = { grain: 5, oil: 5, mineral: 5 };

  // Turno do HUMAN, Estágio 4 ativo.
  game.turn.currentPlayer = HUMAN;
  game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf(HUMAN);
  game.turn.isFirstTurn = false;
  game.turn.stage = 4;
  game.turn.stageComplete = false;
  game.turn.attackedFrom = [];

  return game;
}

function load(game: GameState) {
  useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'attack' });
}

afterEach(() => vi.restoreAllMocks());

describe('Bombardeio naval — mar costeiro → território terrestre', () => {
  it('uma esquadra em mar costeiro pode atacar Xantung (alvo válido)', () => {
    load(bombardmentGame());
    useGameStore.getState().dispatch({ type: 'ATTACK_LAND_FROM_SEA', from: SEA_COASTAL, target: LAND });

    const c = useGameStore.getState().game!.combat;
    expect(c.active).toBe(true);
    expect(c.bombardment).toBe(true);
    expect(c.targetType).toBe('territory');
    expect(c.fromId).toBe(SEA_COASTAL);
    expect(c.targetId).toBe(LAND);
    expect(c.attackerId).toBe(HUMAN);
    expect(c.defenderId).toBe(AI);
    // Atacante são esquadras (navies), não exércitos.
    expect(c.attackerUnits).toBe(3);
    expect(c.defenderUnits).toBe(4);
  });

  it('mesmo limpando os exércitos inimigos, NÃO conquista o território', () => {
    // Atacante rola 6s (máximo dano), defensor rola 1s → defensor é dizimado.
    const seq = [0.99, 0.99, 0.99, 0.99, 0, 0, 0, 0];
    let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => seq[i++ % seq.length]);

    load(bombardmentGame({ defenderArmies: 1 }));
    useGameStore.getState().dispatch({ type: 'ATTACK_LAND_FROM_SEA', from: SEA_COASTAL, target: LAND });
    useGameStore.getState().dispatch({ type: 'ROLL_COMBAT' });

    const g = useGameStore.getState().game!;
    // Invariante de fidelidade: bombardeio nunca muda o dono do território.
    expect(g.territories[LAND].owner).toBe(AI);
    // Atacante não ganhou exércitos em terra (navio não desembarca sozinho).
    expect(g.players[HUMAN].armies[LAND] ?? 0).toBe(0);
    // Nunca entra na fase de ocupação.
    expect(g.combat.phase).not.toBe('occupy');
  });

  it('baixas do atacante saem das ESQUADRAS, não de exércitos', () => {
    // Defensor rola alto, atacante baixo → atacante perde esquadras.
    const seq = [0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99];
    let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => seq[i++ % seq.length]);

    load(bombardmentGame());
    useGameStore.getState().dispatch({ type: 'ATTACK_LAND_FROM_SEA', from: SEA_COASTAL, target: LAND });
    useGameStore.getState().dispatch({ type: 'ROLL_COMBAT' });

    const g = useGameStore.getState().game!;
    // Perdeu esquadras (≤ contagem inicial), sem criar exércitos do nada.
    expect(g.players[HUMAN].navies[SEA_COASTAL] ?? 0).toBeLessThanOrEqual(3);
    expect(g.players[HUMAN].armies[SEA_COASTAL]).toBeUndefined();
  });

  it('mar oceânico (deep) NÃO pode bombardear terra', () => {
    const game = bombardmentGame({ fromSea: SEA_DEEP });
    // north_pacific não é adjacente a Xantung de qualquer forma; garante rejeição.
    load(game);
    useGameStore.getState().dispatch({ type: 'ATTACK_LAND_FROM_SEA', from: SEA_DEEP, target: LAND });

    expect(useGameStore.getState().game!.combat.active).toBe(false);
  });
});
