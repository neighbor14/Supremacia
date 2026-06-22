import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store';
import { createInitialGameState } from '../setup';
import { rollInitialMarketPrice } from '../marketSetup';
import { RULES } from '../rulesConfig';
import type { GameState, SuperpowerId, MarketMode } from '../types';

const ALL: SuperpowerId[] = ['south_america', 'africa', 'europe', 'china', 'usa', 'ussr'];

/** Balanced-mode game with `human` + (n-1) AIs as active players. */
function balancedGame(human: SuperpowerId = 'usa', aiCount = 2, mode: MarketMode = 'balanced'): GameState {
  const ais = ALL.filter(id => id !== human).slice(0, aiCount);
  const game = createInitialGameState(human, ais, undefined, mode);
  game.turn.currentPlayer = game.turn.playerOrder[0];
  game.turn.currentPlayerIndex = 0;
  game.turn.isFirstTurn = false;
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
// 1. Preço inicial — função isolada (mantido $5.000 fixo por ora)
// ============================================================
describe('preço inicial de mercado', () => {
  it('classic e balanced abrem em $5.000 (randomização pendente de tabela oficial)', () => {
    const classic = createInitialGameState('usa', ['china'], undefined, 'classic');
    const balanced = createInitialGameState('usa', ['china'], undefined, 'balanced');
    for (const r of ['grain', 'oil', 'mineral'] as const) {
      expect(classic.market.prices[r]).toBe(RULES.MARKET_START_PRICE);
      expect(balanced.market.prices[r]).toBe(RULES.MARKET_START_PRICE);
    }
  });

  it('rollInitialMarketPrice (provisória) clampa em [min,max] e varia por dado', () => {
    // soma 7 (centro) → $5.000; extremos afastam mas respeitam o teto/piso.
    expect(rollInitialMarketPrice(7)).toBe(5000);
    expect(rollInitialMarketPrice(2)).toBeGreaterThanOrEqual(RULES.MARKET_MIN_PRICE);
    expect(rollInitialMarketPrice(12)).toBeLessThanOrEqual(RULES.MARKET_MAX_PRICE);
    expect(rollInitialMarketPrice(2)).not.toBe(rollInitialMarketPrice(12));
  });
});

// ============================================================
// 2. Salário + produção globais ANTES da venda simultânea
// ============================================================
describe('abertura da fase (OPEN)', () => {
  it('todos os ativos pagam salário e recebem produção antes de declarar', () => {
    const game = balancedGame('usa', 2);
    const actives = game.turn.playerOrder.filter(id => !game.players[id].isEliminated);
    const before = actives.map(id => ({
      id, money: game.players[id].money, supplies: { ...game.players[id].supplies },
    }));
    load(game);
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });

    const s = g();
    expect(s.simultaneousSell.phase).toBe('declare');
    expect(s.turn.upkeepPreprocessed).toBe(true);
    for (const b of before) {
      const p = s.players[b.id];
      // salário cobrado (6 companhias × 500 + unidades) — dinheiro caiu
      expect(p.money).toBeLessThan(b.money);
      // produção transferida — pelo menos um recurso subiu
      const grew = (['grain', 'oil', 'mineral'] as const).some(r => p.supplies[r] > b.supplies[r]);
      expect(grew).toBe(true);
      // declaração criada para cada ativo
      expect(s.simultaneousSell.declarations[b.id]).toBeTruthy();
    }
  });

  it('IA auto-declara confirmada; humano fica pendente', () => {
    const game = balancedGame('usa', 2);
    load(game);
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });
    const s = g();
    for (const id of s.turn.playerOrder.filter(i => !s.players[i].isEliminated)) {
      const decl = s.simultaneousSell.declarations[id]!;
      expect(decl.confirmed).toBe(s.players[id].isHuman ? false : true);
    }
  });

  it('OPEN é idempotente e não reabre na mesma rodada', () => {
    const game = balancedGame('usa', 2);
    load(game);
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });
    const snap = JSON.stringify(g().simultaneousSell);
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });
    expect(JSON.stringify(g().simultaneousSell)).toBe(snap);
  });
});

// ============================================================
// 3, 4, 5. Snapshot de preço, preço único e queda pelo total
// ============================================================
describe('resolução da venda simultânea', () => {
  /** Cenário controlado: 3 vendedores de petróleo (A=2, B=4, C=5) a $5.000. */
  function threeSellers() {
    const game = balancedGame('usa', 2); // usa (humano) + 2 IAs
    const actives = game.turn.playerOrder.filter(id => !game.players[id].isEliminated);
    const [A, B, C] = actives;
    // estoque suficiente + preço fixo de snapshot
    for (const id of actives) game.players[id].supplies = { grain: 0, oil: 10, mineral: 0 };
    game.simultaneousSell.phase = 'declare';
    game.simultaneousSell.round = game.turn.turnNumber;
    game.simultaneousSell.priceSnapshot = { grain: 5000, oil: 5000, mineral: 5000 };
    game.market.prices = { grain: 5000, oil: 5000, mineral: 5000 };
    game.turn.upkeepPreprocessed = true;
    const mk = (id: SuperpowerId, oil: number) => ({ playerId: id, grain: 0, oil, mineral: 0, confirmed: true, timestamp: 1 });
    game.simultaneousSell.declarations = { [A]: mk(A, 2), [B]: mk(B, 4), [C]: mk(C, 5) } as any;
    return { game, A, B, C };
  }

  it('declarar não derruba o preço antes da resolução', () => {
    const game = balancedGame('usa', 2);
    load(game);
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });
    const snapOil = g().simultaneousSell.priceSnapshot.oil;
    const human = g().turn.playerOrder.find(id => g().players[id].isHuman)!;
    dispatch({ type: 'SUBMIT_SELL_DECLARATION', playerId: human, grain: 0, oil: 1, mineral: 0 });
    // mercado intocado: só a resolução move o preço
    expect(g().market.prices.oil).toBe(snapOil);
    expect(g().simultaneousSell.phase).toBe('declare');
  });

  it('todos recebem o MESMO preço de snapshot ($5.000/unidade)', () => {
    const { game, A, B, C } = threeSellers();
    const m0 = { A: game.players[A].money, B: game.players[B].money, C: game.players[C].money };
    load(game);
    dispatch({ type: 'RESOLVE_SIMULTANEOUS_SELL' });
    const s = g();
    expect(s.players[A].money - m0.A).toBe(2 * 5000);
    expect(s.players[B].money - m0.B).toBe(4 * 5000);
    expect(s.players[C].money - m0.C).toBe(5 * 5000);
  });

  it('o preço cai pelo total vendido (11 un.) com clamp no piso', () => {
    const { game } = threeSellers();
    load(game);
    dispatch({ type: 'RESOLVE_SIMULTANEOUS_SELL' });
    const s = g();
    const expected = Math.max(s.market.minPrice, 5000 - 11 * s.market.priceStep);
    expect(s.market.prices.oil).toBe(expected);
    expect(s.simultaneousSell.resolution!.perResource.oil.totalSold).toBe(11);
  });

  it('queda linear não-clampada: total 3 → $5.000 vira $2.000', () => {
    const { game, A, B, C } = threeSellers();
    // redeclara para total = 3 (1+1+1)
    const mk = (id: SuperpowerId) => ({ playerId: id, grain: 0, oil: 1, mineral: 0, confirmed: true, timestamp: 1 });
    game.simultaneousSell.declarations = { [A]: mk(A), [B]: mk(B), [C]: mk(C) } as any;
    load(game);
    dispatch({ type: 'RESOLVE_SIMULTANEOUS_SELL' });
    expect(g().market.prices.oil).toBe(5000 - 3 * 1000);
  });
});

// ============================================================
// 6, 7. Contabilidade de ações opcionais
// ============================================================
describe('ações opcionais pós-venda', () => {
  it('quem vendeu ≥1 fica com 2 ações opcionais (Estágio 3 pré-consumido)', () => {
    const game = balancedGame('usa', 2);
    const actives = game.turn.playerOrder.filter(id => !game.players[id].isEliminated);
    const first = actives[0];
    for (const id of actives) game.players[id].supplies = { grain: 0, oil: 10, mineral: 0 };
    game.simultaneousSell.phase = 'declare';
    game.simultaneousSell.priceSnapshot = { grain: 5000, oil: 5000, mineral: 5000 };
    game.turn.upkeepPreprocessed = true;
    game.simultaneousSell.declarations = Object.fromEntries(
      actives.map(id => [id, { playerId: id, grain: 0, oil: 2, mineral: 0, confirmed: true, timestamp: 1 }]),
    ) as any;
    load(game);
    dispatch({ type: 'RESOLVE_SIMULTANEOUS_SELL' });
    const s = g();
    // o primeiro jogador (currentPlayer) já entra com [3] pré-consumido
    expect(s.turn.optionalStagesUsed).toContain(3);
    const pp = s.simultaneousSell.resolution!.perPlayer.find(p => p.playerId === first)!;
    expect(pp.soldAny).toBe(true);
    expect(pp.optionalActionsRemaining).toBe(RULES.MAX_OPTIONAL_STAGES - 1);
  });

  it('quem vendeu zero mantém as 3 ações opcionais', () => {
    const game = balancedGame('usa', 2);
    const actives = game.turn.playerOrder.filter(id => !game.players[id].isEliminated);
    const first = actives[0];
    for (const id of actives) game.players[id].supplies = { grain: 0, oil: 10, mineral: 0 };
    game.simultaneousSell.phase = 'declare';
    game.simultaneousSell.priceSnapshot = { grain: 5000, oil: 5000, mineral: 5000 };
    game.turn.upkeepPreprocessed = true;
    game.simultaneousSell.declarations = Object.fromEntries(
      actives.map(id => [id, { playerId: id, grain: 0, oil: 0, mineral: 0, confirmed: true, timestamp: 1 }]),
    ) as any;
    load(game);
    dispatch({ type: 'RESOLVE_SIMULTANEOUS_SELL' });
    const s = g();
    expect(s.turn.optionalStagesUsed).not.toContain(3);
    const pp = s.simultaneousSell.resolution!.perPlayer.find(p => p.playerId === first)!;
    expect(pp.soldAny).toBe(false);
    expect(pp.optionalActionsRemaining).toBe(RULES.MAX_OPTIONAL_STAGES);
  });
});

// ============================================================
// 2b. Estágios 1 e 2 individuais não cobram de novo (no-op) no balanced
// ============================================================
describe('upkeep global não duplica nos estágios individuais', () => {
  it('PAY_SALARIES e TRANSFER_PRODUCTION viram no-op após a fase global', () => {
    const game = balancedGame('usa', 2);
    load(game);
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });
    const human = g().turn.playerOrder.find(id => g().players[id].isHuman)!;
    dispatch({ type: 'SUBMIT_SELL_DECLARATION', playerId: human, grain: 0, oil: 0, mineral: 0 });
    dispatch({ type: 'RESOLVE_SIMULTANEOUS_SELL' });
    dispatch({ type: 'ACK_SIMULTANEOUS_SELL' });

    // De volta ao Estágio 1 do jogador atual; salário/produção já feitos na rodada.
    const s0 = g();
    const cur = s0.turn.currentPlayer;
    s0.turn.stage = 1;
    useGameStore.setState({ game: s0 });
    const moneyBefore = g().players[cur].money;
    const suppliesBefore = { ...g().players[cur].supplies };
    dispatch({ type: 'PAY_SALARIES' });
    dispatch({ type: 'TRANSFER_PRODUCTION' });
    expect(g().players[cur].money).toBe(moneyBefore);
    expect(g().players[cur].supplies).toEqual(suppliesBefore);
  });
});

// ============================================================
// 8. Validações
// ============================================================
describe('validações de declaração', () => {
  it('não permite vender acima do estoque (clamp) nem negativos', () => {
    const game = balancedGame('usa', 2);
    load(game);
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });
    const human = g().turn.playerOrder.find(id => g().players[id].isHuman)!;
    const stock = g().players[human].supplies.oil;
    dispatch({ type: 'SUBMIT_SELL_DECLARATION', playerId: human, grain: -5, oil: stock + 99, mineral: 0 });
    const decl = g().simultaneousSell.declarations[human]!;
    expect(decl.grain).toBe(0);          // negativo → 0
    expect(decl.oil).toBe(stock);        // acima do estoque → clamp
    expect(decl.confirmed).toBe(true);
  });

  it('SUBMIT fora da fase declare é ignorado', () => {
    const game = balancedGame('usa', 2);
    load(game); // phase 'inactive'
    dispatch({ type: 'SUBMIT_SELL_DECLARATION', playerId: 'usa', grain: 1, oil: 1, mineral: 1 });
    expect(g().simultaneousSell.declarations['usa']).toBeFalsy();
  });
});

// ============================================================
// 9. Fluxo integrado humano + IA (OPEN → SUBMIT → RESOLVE → ACK)
// ============================================================
describe('fluxo integrado humano + IA', () => {
  it('resolve quando humano confirma e IAs já auto-declararam', () => {
    const game = balancedGame('usa', 2);
    load(game);
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });
    const human = g().turn.playerOrder.find(id => g().players[id].isHuman)!;
    dispatch({ type: 'SUBMIT_SELL_DECLARATION', playerId: human, grain: 0, oil: 0, mineral: 0 });
    dispatch({ type: 'RESOLVE_SIMULTANEOUS_SELL' });
    expect(g().simultaneousSell.phase).toBe('resolve');
    expect(g().simultaneousSell.resolution).toBeTruthy();
    dispatch({ type: 'ACK_SIMULTANEOUS_SELL' });
    expect(g().simultaneousSell.phase).toBe('inactive');
  });
});

// ============================================================
// 10. Modo Clássico Grow permanece disponível e inalterado
// ============================================================
describe('Modo Clássico Grow', () => {
  it('OPEN não faz nada no modo clássico (sem fase, sem upkeep global)', () => {
    const game = balancedGame('usa', 2, 'classic');
    const moneyBefore = game.players[game.turn.currentPlayer].money;
    load(game);
    dispatch({ type: 'OPEN_SIMULTANEOUS_SELL' });
    const s = g();
    expect(s.simultaneousSell.phase).toBe('inactive');
    expect(s.turn.upkeepPreprocessed).toBeFalsy();
    expect(s.players[s.turn.currentPlayer].money).toBe(moneyBefore);
  });

  it('estágios 1 e 2 individuais funcionam normalmente no clássico', () => {
    const game = balancedGame('usa', 2, 'classic');
    game.turn.stage = 1;
    const moneyBefore = game.players[game.turn.currentPlayer].money;
    load(game);
    dispatch({ type: 'PAY_SALARIES' });
    // no clássico o salário é cobrado de verdade no Estágio 1
    expect(g().players[g().turn.currentPlayer].money).toBeLessThan(moneyBefore);
  });
});
