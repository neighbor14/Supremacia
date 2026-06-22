import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store';
import { createInitialGameState } from '../setup';
import { RULES } from '../rulesConfig';
import {
  AI_PROFILES,
  chooseOptionalStages,
  getLegalOptionalStages,
  evaluateAction,
  planAmphibiousInvasion,
  EXECUTABLE_OPTIONAL_STAGES,
} from '../ai';
import type { AIDifficulty, GameState, Player } from '../types';

const LEVELS: AIDifficulty[] = ['beginner', 'intermediate', 'advanced', 'god'];

/** AI player 'africa' in a fresh game, ready to be tweaked per scenario.
 * Modo Clássico: estes testes exercitam a decisão de venda sequencial (Estágio
 * 3), que só existe no Clássico. A venda no Modo Balanceado é coberta em
 * simultaneous-sell.test.ts. */
function aiGame(): { game: GameState; ai: Player } {
  const game = createInitialGameState('usa', ['africa'], undefined, 'classic');
  return { game, ai: game.players.africa };
}

// Fixed RNG → zero noise and no "mistake" (0.5*2-1 = 0; 0.5 < mistakeRate only if >0.5).
const RNG_NEUTRAL = () => 0.5;

describe('AI difficulty profiles', () => {
  it('every profile exists with sane, rule-respecting knobs', () => {
    for (const level of LEVELS) {
      const p = AI_PROFILES[level];
      expect(p.difficulty).toBe(level);
      for (const k of ['randomness', 'mistakeRate', 'aggression', 'defensePriority', 'expansionPriority', 'economyPriority'] as const) {
        expect(p[k]).toBeGreaterThanOrEqual(0);
        expect(p[k]).toBeLessThanOrEqual(1);
      }
      expect(p.thinkingDelayMs).toBeGreaterThan(0);
    }
  });

  it('higher tiers are at least as deep as lower tiers', () => {
    expect(AI_PROFILES.beginner.planningDepth).toBeLessThanOrEqual(AI_PROFILES.god.planningDepth);
    expect(AI_PROFILES.god.mistakeRate).toBeLessThanOrEqual(AI_PROFILES.beginner.mistakeRate);
    expect(AI_PROFILES.god.randomness).toBeLessThanOrEqual(AI_PROFILES.beginner.randomness);
  });
});

describe('legal optional stages', () => {
  it('never offers a non-executable stage (e.g. movement=5 has no AI executor yet)', () => {
    const { game, ai } = aiGame();
    ai.money = 50000;
    ai.supplies = { grain: 6, oil: 6, mineral: 1 };
    const legal = getLegalOptionalStages(game, ai);
    for (const s of legal) expect(EXECUTABLE_OPTIONAL_STAGES).toContain(s);
    expect(legal).not.toContain(5);
  });

  it('first turn never allows combat', () => {
    const { game, ai } = aiGame();
    game.turn.isFirstTurn = true;
    ai.armies = { west_africa: 4 };
    ai.supplies = { grain: 3, oil: 3, mineral: 3 };
    expect(getLegalOptionalStages(game, ai)).not.toContain(4);
  });
});

describe('chooseOptionalStages — rules & purity', () => {
  it('is pure: does not mutate the game state', () => {
    const { game, ai } = aiGame();
    ai.money = 50000;
    ai.supplies = { grain: 6, oil: 6, mineral: 6 };
    const before = JSON.stringify(game);
    chooseOptionalStages(game, ai, AI_PROFILES.god);
    expect(JSON.stringify(game)).toBe(before);
  });

  it('returns stages in ascending order and within the rule cap', () => {
    const { game, ai } = aiGame();
    game.turn.isFirstTurn = false;
    ai.money = 50000;
    ai.supplies = { grain: 6, oil: 6, mineral: 1 };
    ai.armies = { west_africa: 3 }; // adjacency to neutral north_africa → attack opportunity
    const { stages } = chooseOptionalStages(game, ai, AI_PROFILES.god);
    expect(stages.length).toBeLessThanOrEqual(RULES.MAX_OPTIONAL_STAGES);
    const ascending = [...stages].sort((a, b) => a - b);
    expect(stages).toEqual(ascending);
  });

  it('caps at RULES.MAX_OPTIONAL_STAGES (3, same as humans) when many stages are legal', () => {
    const { game, ai } = aiGame();
    game.turn.isFirstTurn = false;
    ai.money = 50000;
    ai.supplies = { grain: 6, oil: 6, mineral: 1 }; // 3 (excess) + 7 (mineral short)
    ai.armies = { west_africa: 3 };                 // 4 (attack) + 5 (move/expansion)
    // minSupply 1 → 6 (build) also legal → 5 legal stages total.
    const { stages } = chooseOptionalStages(game, ai, AI_PROFILES.god);
    expect(stages.length).toBe(RULES.MAX_OPTIONAL_STAGES);
  });
});

describe('chooseOptionalStages — sensible decisions (deterministic: god)', () => {
  it('rich + abundant supplies → sells excess and builds', () => {
    const { game, ai } = aiGame();
    game.turn.isFirstTurn = true; // exclude combat to isolate economy/build
    ai.money = 50000;
    ai.supplies = { grain: 6, oil: 6, mineral: 6 };
    const { stages } = chooseOptionalStages(game, ai, AI_PROFILES.god);
    expect(stages).toContain(3); // sell excess
    expect(stages).toContain(6); // build
  });

  it('rich + starved supplies → buys from the market only', () => {
    const { game, ai } = aiGame();
    game.turn.isFirstTurn = true;
    ai.money = 50000;
    ai.supplies = { grain: 0, oil: 0, mineral: 0 };
    const { stages } = chooseOptionalStages(game, ai, AI_PROFILES.god);
    expect(stages).toEqual([7]);
  });

  it('beginner respects the same rule cap as everyone (max 3)', () => {
    const { game, ai } = aiGame();
    game.turn.isFirstTurn = false;
    ai.money = 50000;
    ai.supplies = { grain: 6, oil: 6, mineral: 1 };
    ai.armies = { west_africa: 3 };
    const { stages } = chooseOptionalStages(game, ai, AI_PROFILES.beginner, RULES.MAX_OPTIONAL_STAGES, RNG_NEUTRAL);
    expect(stages.length).toBeLessThanOrEqual(RULES.MAX_OPTIONAL_STAGES);
  });
});

describe('AI movement (stage 5) — land + naval', () => {
  it('stage 5 is legal and scores > 0 when there is neutral land to occupy', () => {
    const { game, ai } = aiGame();
    game.turn.isFirstTurn = false;
    ai.armies = { west_africa: 3 };
    game.territories.west_africa.owner = 'africa';
    game.territories.north_africa.owner = null; // neutral neighbour
    ai.supplies = { grain: 6, oil: 0, mineral: 6 }; // oil 0 → combat illegal, isola o movimento
    ai.money = 50000;
    expect(getLegalOptionalStages(game, ai)).toContain(5);
    const ev = evaluateAction({ stage: 5 }, game, ai, AI_PROFILES.god);
    expect(ev.score).toBeGreaterThan(0);
    expect(ev.reason).toContain('território neutro');
  });

  it('stage 5 is legal and scores > 0 for an amphibious landing across the sea', () => {
    // Africa holds venezuela (coastal, touches caribbean) + a fleet in caribbean.
    // eastern_usa is neutral, touches caribbean, and is NOT land-adjacent to venezuela
    // → only reachable by an amphibious landing.
    const { game, ai } = aiGame();
    game.turn.isFirstTurn = false;
    game.territories.venezuela.owner = 'africa';
    // Cerca venezuela por terra (vizinhos não-neutros) p/ isolar o anfíbio: sem
    // expansão terrestre disponível, a única oportunidade do estágio 5 é o desembarque.
    game.territories.brazil.owner = 'usa';
    game.territories.peru.owner = 'usa';
    game.territories.central_america.owner = 'usa'; // bloqueia a ponte terrestre p/ eastern_usa
    game.territories.eastern_usa.owner = null;      // só alcançável por mar
    delete game.players.usa.armies.eastern_usa;     // sem defensor → desembarque legal (terra vazia)
    ai.armies = { venezuela: 3 };
    ai.navies = { caribbean: 1 };
    ai.supplies = { grain: 6, oil: 0, mineral: 6 }; // oil 0 → 0-leg landing, combat illegal
    ai.money = 50000;
    expect(getLegalOptionalStages(game, ai)).toContain(5);
    const ev = evaluateAction({ stage: 5 }, game, ai, AI_PROFILES.god);
    expect(ev.score).toBeGreaterThan(0);
    expect(ev.reason).toContain('além-mar');
  });

  it('cpuMove (via CPU_TURN) lands troops across the sea onto neutral land (amphibious)', () => {
    const game = createInitialGameState('south_america', ['africa'], 'god', 'classic');
    game.turn.currentPlayer = 'africa';
    game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf('africa');
    game.turn.isFirstTurn = false;
    game.turn.stage = 1;
    const af = game.players.africa;
    af.resourceCards = [];                 // sem produção → não interfere
    af.armies = { venezuela: 4 };          // território costeiro próprio, com tropa sobrando
    af.navies = { caribbean: 1 };          // frota na zona costeira adjacente
    af.embarked = {};
    af.supplies = { grain: 6, oil: 0, mineral: 6 }; // 0 pernas: embarque+desembarque no mesmo mar
    af.money = 60000;
    game.territories.venezuela.owner = 'africa';
    game.territories.central_america.owner = 'usa'; // bloqueia a ponte terrestre
    game.territories.eastern_usa.owner = null;      // alvo neutro, só alcançável por mar
    useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });

    useGameStore.getState().dispatch({ type: 'CPU_TURN' });

    const after = useGameStore.getState().game!;
    expect(after.territories.eastern_usa.owner).toBe('africa');
  });

  it('planAmphibiousInvasion routes a fleet across multiple ocean legs to reach distant neutral land', () => {
    // África parte do Golfo da Guiné e precisa cruzar o Atlântico (2 pernas:
    // gulf_of_guinea → south_atlantic → north_atlantic) p/ desembarcar em eastern_usa,
    // território neutro inalcançável por terra ou por uma única perna naval.
    const game = createInitialGameState('china', ['africa'], undefined, 'classic');
    const af = game.players.africa;
    af.navies = { gulf_of_guinea: 1 };
    af.armies = { west_africa: 4 };
    af.supplies = { grain: 6, oil: 6, mineral: 6 }; // petróleo p/ ≥2 pernas
    // Bloqueia alvos neutros mais próximos (1 perna) no Atlântico Sul.
    game.territories.argentina.owner = 'china';
    game.territories.brazil.owner = 'china';

    const plan = planAmphibiousInvasion(game, af);
    expect(plan).not.toBeNull();
    expect(plan!.embarkTerritory).toBe('west_africa');
    expect(plan!.route).toEqual(['gulf_of_guinea', 'south_atlantic', 'north_atlantic']);
    expect(plan!.landTerritory).toBe('eastern_usa');
  });

  it('planAmphibiousInvasion respects the oil budget: too little oil → no long route', () => {
    const game = createInitialGameState('china', ['africa'], undefined, 'classic');
    const af = game.players.africa;
    af.navies = { gulf_of_guinea: 1 };
    af.armies = { west_africa: 4 };
    af.supplies = { grain: 6, oil: 1, mineral: 6 }; // só 1 perna paga
    game.territories.argentina.owner = 'china';
    game.territories.brazil.owner = 'china';
    // Com 1 perna e sem alvo a ≤1 perna, não há plano (eastern_usa fica a 2 pernas).
    expect(planAmphibiousInvasion(game, af)).toBeNull();
  });

  it('cpuMove (via CPU_TURN) executes a 2-leg amphibious invasion across the Atlantic', () => {
    const game = createInitialGameState('china', ['africa'], undefined, 'classic');
    game.turn.currentPlayer = 'africa';
    game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf('africa');
    game.turn.isFirstTurn = true; // exclui combate p/ isolar o movimento
    game.turn.stage = 1;
    const af = game.players.africa;
    af.resourceCards = [];
    af.navies = { gulf_of_guinea: 1 };
    af.armies = { west_africa: 4 };
    af.embarked = {};
    af.supplies = { grain: 6, oil: 6, mineral: 6 };
    af.money = 60000;
    game.territories.argentina.owner = 'china';
    game.territories.brazil.owner = 'china'; // bloqueia alvos a 1 perna
    useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });

    useGameStore.getState().dispatch({ type: 'CPU_TURN' });

    // Cruzou o Atlântico e conquistou eastern_usa pela cadeia embark→navega→disembark.
    const after = useGameStore.getState().game!;
    expect(after.territories.eastern_usa.owner).toBe('africa');
  });

  it('cpuMove (via CPU_TURN) occupies an adjacent neutral territory using the human move rules', () => {
    const game = createInitialGameState('usa', ['africa'], 'god', 'classic');
    game.turn.currentPlayer = 'africa';
    game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf('africa');
    game.turn.isFirstTurn = false;
    game.turn.stage = 1;
    const af = game.players.africa;
    af.resourceCards = [];                 // sem produção → oil fica 0 → combate ilegal
    af.armies = { west_africa: 3 };
    af.supplies = { grain: 6, oil: 0, mineral: 6 };
    af.money = 60000;
    game.territories.west_africa.owner = 'africa';
    game.territories.north_africa.owner = null;
    useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });

    useGameStore.getState().dispatch({ type: 'CPU_TURN' });

    const after = useGameStore.getState().game!;
    expect(after.territories.north_africa.owner).toBe('africa');
  });
});

describe('evaluateAction', () => {
  it('always returns a human-readable reason', () => {
    const { game, ai } = aiGame();
    ai.money = 50000;
    ai.supplies = { grain: 6, oil: 6, mineral: 6 };
    for (const stage of getLegalOptionalStages(game, ai)) {
      const ev = evaluateAction({ stage }, game, ai, AI_PROFILES.god);
      expect(ev.reason.length).toBeGreaterThan(0);
      expect(Number.isFinite(ev.score)).toBe(true);
    }
  });
});
