// ============================================================
// MULTIPLAYER — Venda Simultânea online (Modo Digital Balanceado)
// ------------------------------------------------------------
// Cobre o que o online adiciona à fase de Venda Simultânea:
//  - isTurnExemptAction: as 4 ações da venda são isentas do turn lock (fase
//    global, todos agem ao mesmo tempo); o resto continua preso à vez.
//  - fluxo com 2 HUMANOS: cada um declara a própria venda mesmo NÃO sendo o
//    jogador da vez; ao resolver, todos recebem o preço de snapshot e o mercado
//    cai pelo total vendido por todos.
// O turn lock em si vive nos adapters (Local/Supabase) e na sessão, que apenas
// consultam isTurnExemptAction — por isso o helper é a unidade testada aqui.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store';
import { createMultiplayerGameState } from '../setup';
import { isTurnExemptAction } from '../multiplayer/types';
import { RULES } from '../rulesConfig';
import type { GameState, GameAction } from '../types';

function twoHumanBalanced(): GameState {
  const game = createMultiplayerGameState({
    humans: ['usa', 'china'],
    ai: [{ id: 'africa', difficulty: 'intermediate' }],
    marketMode: 'balanced',
  });
  // Rodada 1 (turnNumber 1) já é o default do setup; fixa o jogador da vez.
  game.turn.currentPlayer = game.turn.playerOrder[0];
  game.turn.currentPlayerIndex = 0;
  game.turn.isFirstTurn = false;
  return game;
}

const load = (game: GameState) =>
  useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });
const g = () => useGameStore.getState().game!;
const dispatch = (a: GameAction) => useGameStore.getState().dispatch(a);

beforeEach(() => {
  useGameStore.setState({ game: null });
});

describe('isTurnExemptAction', () => {
  it('isenta as 4 ações da Venda Simultânea do turn lock', () => {
    expect(isTurnExemptAction('OPEN_SIMULTANEOUS_SELL')).toBe(true);
    expect(isTurnExemptAction('SUBMIT_SELL_DECLARATION')).toBe(true);
    expect(isTurnExemptAction('RESOLVE_SIMULTANEOUS_SELL')).toBe(true);
    expect(isTurnExemptAction('ACK_SIMULTANEOUS_SELL')).toBe(true);
  });

  it('mantém as demais ações presas à vez', () => {
    for (const t of ['MOVE_ARMY', 'END_TURN', 'BUILD_UNITS', 'SELL_RESOURCE', 'ATTACK_TERRITORY'] as const) {
      expect(isTurnExemptAction(t)).toBe(false);
    }
  });
});

describe('venda simultânea com 2 humanos', () => {
  it('cada humano declara a própria venda fora da sua vez e a resolução paga o preço de snapshot', () => {
    load(twoHumanBalanced());
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });

    const ss0 = g().simultaneousSell;
    expect(ss0.phase).toBe('declare');
    // IA já confirmada na abertura; humanos pendentes.
    expect(ss0.declarations['africa']?.confirmed).toBe(true);
    expect(ss0.declarations['usa']?.confirmed).toBe(false);
    expect(ss0.declarations['china']?.confirmed).toBe(false);

    const price = ss0.priceSnapshot;
    const usaBefore = { ...g().players['usa'].supplies };
    const usaMoney = g().players['usa'].money;
    const chinaBefore = { ...g().players['china'].supplies };
    const chinaMoney = g().players['china'].money;

    // Pelo menos um humano NÃO é o jogador da vez; ainda assim declara — no
    // online a isenção (isTurnExemptAction) garante isto; aqui no reducer só
    // confirmamos que a declaração de quem não é da vez é aceita.
    const current = g().turn.currentPlayer;
    const offTurnHuman = (['usa', 'china'] as const).find(h => h !== current)!;
    expect(offTurnHuman).not.toBe(current);

    dispatch({ type: 'SUBMIT_SELL_DECLARATION', playerId: 'usa', grain: 2, oil: 0, mineral: 0 });
    dispatch({ type: 'SUBMIT_SELL_DECLARATION', playerId: 'china', grain: 0, oil: 3, mineral: 0 });

    expect(g().simultaneousSell.declarations['usa']?.confirmed).toBe(true);
    expect(g().simultaneousSell.declarations['china']?.confirmed).toBe(true);
    // A declaração do humano fora da vez foi registrada (núcleo do que o online
    // precisa permitir).
    expect(g().simultaneousSell.declarations[offTurnHuman]?.confirmed).toBe(true);

    dispatch({ type: 'RESOLVE_SIMULTANEOUS_SELL' });

    const after = g();
    // Receita ao preço de SNAPSHOT (igual para todos), estoque debitado.
    expect(after.players['usa'].money).toBe(usaMoney + 2 * price.grain);
    expect(after.players['usa'].supplies.grain).toBe(usaBefore.grain - 2);
    expect(after.players['china'].money).toBe(chinaMoney + 3 * price.oil);
    expect(after.players['china'].supplies.oil).toBe(chinaBefore.oil - 3);

    // Mercado cai pelo total vendido por TODOS (usa+china+ia), clamp no piso.
    const aiGrain = ss0.declarations['africa']!.grain;
    const aiOil = ss0.declarations['africa']!.oil;
    const expectGrain = Math.max(
      RULES.MARKET_MIN_PRICE, price.grain - (2 + aiGrain) * after.market.priceStep,
    );
    const expectOil = Math.max(
      RULES.MARKET_MIN_PRICE, price.oil - (3 + aiOil) * after.market.priceStep,
    );
    expect(after.market.prices.grain).toBe(expectGrain);
    expect(after.market.prices.oil).toBe(expectOil);

    // Resumo disponível; ACK fecha a fase.
    expect(after.simultaneousSell.phase).toBe('resolve');
    dispatch({ type: 'ACK_SIMULTANEOUS_SELL' });
    expect(g().simultaneousSell.phase).toBe('inactive');
  });
});
