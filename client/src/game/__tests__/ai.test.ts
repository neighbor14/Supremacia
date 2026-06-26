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
  publicWealth,
  readOpponentIntel,
  gamePressure,
  victoryThreat,
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
    expect(ev.reason).toBe('aireason.moveExpand');
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
    expect(ev.reason).toBe('aireason.moveAmphibious');
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

describe('opponent economic intel (public info)', () => {
  it('publicWealth only reads public fields and matches the détente wealth shape', () => {
    const { game, ai } = aiGame();
    ai.money = 10000;
    ai.supplies = { grain: 2, oil: 0, mineral: 0 };
    ai.resourceCards = ['c1', 'c2'];
    ai.armies = {}; ai.navies = {}; ai.embarked = {}; // isola: zero unidades
    ai.nukes = 1;
    ai.loans = 3000;
    const w = publicWealth(game, ai);
    const expected =
      10000 +
      2 * game.market.prices.grain +
      2 * RULES.WEALTH_COMPANY_VALUE +
      0 + // sem unidades
      1 * RULES.WEALTH_NUKE_VALUE -
      3000;
    expect(w).toBe(expected);
  });

  it('readOpponentIntel finds the richest live rival and counts nuke-armed enemies', () => {
    const game = createInitialGameState('usa', ['africa', 'china'], undefined, 'classic');
    const me = game.players.usa;
    game.players.africa.money = 999999; // claramente o líder
    game.players.china.money = 1000;
    game.players.china.nukes = 2;       // armado
    const intel = readOpponentIntel(game, me);
    expect(intel.leaderId).toBe('africa');
    expect(intel.behindBy).toBeGreaterThan(0);
    expect(intel.nukeArmedEnemies).toBe(1);
  });

  it('trailing the wealth leader raises the combat score and flags attackLeader', () => {
    const { game, ai } = aiGame();
    game.turn.isFirstTurn = false;
    ai.armies = { west_africa: 4 };
    ai.supplies = { grain: 3, oil: 3, mineral: 3 };
    game.territories.north_africa.owner = 'usa';     // alvo inimigo adjacente
    game.players.usa.armies = { north_africa: 1 };   // vencível (margem ≥ 2)
    game.players.usa.money = 500000;                 // humano disparado na frente
    ai.money = 1000;

    const smart = evaluateAction({ stage: 4 }, game, ai, AI_PROFILES.god);       // usesOpponentIntel
    const naive = evaluateAction({ stage: 4 }, game, ai, AI_PROFILES.beginner);  // ignora intel
    expect(smart.score).toBeGreaterThan(naive.score);
    expect(smart.reason).toBe('aireason.attackLeader');
  });

  it('gamePressure is low early and high when one player dominates wealth', () => {
    const game = createInitialGameState('usa', ['africa'], undefined, 'classic');
    const early = gamePressure(game);
    expect(early).toBeGreaterThanOrEqual(0);
    expect(early).toBeLessThan(0.6); // turno 1, equilíbrio → começo de jogo
    game.players.usa.money = 5_000_000; // dominância de riqueza disparada
    expect(gamePressure(game)).toBeGreaterThan(early);
    expect(gamePressure(game)).toBeGreaterThan(0.8);
  });

  it('victoryThreat rises with territorial control', () => {
    const game = createInitialGameState('usa', ['africa'], undefined, 'classic');
    const before = victoryThreat(game, game.players.africa);
    // Dá quase todo o mapa à África → ameaça de Supremacia (fração territorial)
    // ultrapassa qualquer fração de riqueza.
    Object.keys(game.territories).forEach(id => { game.territories[id].owner = 'africa'; });
    expect(victoryThreat(game, game.players.africa)).toBeGreaterThan(before);
    expect(victoryThreat(game, game.players.africa)).toBeGreaterThan(0.9);
  });

  it('phase-aware: expansion (stage 5) scores higher early than in a dominated late game', () => {
    function expansionScore(dominate: boolean) {
      const { game, ai } = aiGame();
      game.turn.isFirstTurn = false;
      ai.armies = { west_africa: 3 };
      game.territories.west_africa.owner = 'africa';
      game.territories.north_africa.owner = null;   // terra neutra p/ expandir
      ai.supplies = { grain: 6, oil: 0, mineral: 6 }; // oil 0 isola o estágio 5
      ai.money = 50000;
      if (dominate) {
        // Humano dominando o mapa → pressão de fim de jogo alta.
        Object.keys(game.territories).forEach(id => {
          if (id !== 'west_africa' && id !== 'north_africa') game.territories[id].owner = 'usa';
        });
      }
      return evaluateAction({ stage: 5 }, game, ai, AI_PROFILES.god).breakdown.expansionScore;
    }
    expect(expansionScore(false)).toBeGreaterThan(expansionScore(true));
  });

  it('cpuAttack prefers a poorer target when capturing it steals an enemy company', () => {
    const game = createInitialGameState('south_america', ['africa'], 'god', 'classic');
    game.turn.currentPlayer = 'africa';
    game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf('africa');
    game.turn.isFirstTurn = false;
    game.turn.stage = 1;
    const af = game.players.africa;
    af.resourceCards = [];
    af.supplies = { grain: 6, oil: 6, mineral: 6 };
    af.money = 60000;
    af.armies = { west_africa: 4, north_africa: 4 };
    game.territories.west_africa.owner = 'africa';
    game.territories.north_africa.owner = 'africa';
    const companyT = game.territories.west_africa.adjacentTerritories.find(
      id => id !== 'north_africa' && game.territories[id],
    )!;
    const plainT = game.territories.north_africa.adjacentTerritories.find(
      id => id !== 'west_africa' && game.territories[id] && id !== companyT,
    )!;
    // companyT pertence ao jogador POBRE, mas hospeda uma empresa do humano.
    game.territories[companyT].owner = 'usa';
    game.territories[plainT].owner = 'south_america';
    game.players.usa.armies = { [companyT]: 1 };
    game.players.south_america.armies = { [plainT]: 1 };
    game.players.usa.money = 1000;
    game.players.south_america.money = 50000;
    // Coloca uma carta de empresa do humano em companyT (capturável na conquista).
    const someCard = Object.values(game.resourceCards)[0];
    someCard.territoryId = companyT;
    someCard.ownerId = 'south_america';
    useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });

    useGameStore.getState().dispatch({ type: 'CPU_TURN' });

    const after = useGameStore.getState().game!;
    expect(after.territories[companyT].owner).toBe('africa'); // mirou a empresa, não o "mais rico"
  });

  it('a rival already holding nukes pushes the AI toward the tech/deterrent build', () => {
    const { game, ai } = aiGame();
    ai.money = 50000;
    ai.supplies = { grain: 3, oil: 3, mineral: 3 };
    ai.nukes = 0;
    game.players.usa.nukes = 1; // rival já armado
    const ev = evaluateAction({ stage: 6 }, game, ai, AI_PROFILES.god);
    expect(ev.reason).toBe('aireason.buildDeterrent');
    expect(ev.breakdown.techScore).toBeGreaterThan(10);
  });

  it('cpuAttack (smart profile) prefers striking the wealthier of two winnable targets', () => {
    const game = createInitialGameState('south_america', ['africa'], 'god', 'classic');
    game.turn.currentPlayer = 'africa';
    game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf('africa');
    game.turn.isFirstTurn = false;
    game.turn.stage = 1;
    const af = game.players.africa;
    af.resourceCards = [];
    af.supplies = { grain: 6, oil: 6, mineral: 6 };
    af.money = 60000;
    // África tem tropa em west_africa e north_africa, cada uma com um alvo inimigo
    // adjacente vencível, mas pertencentes a donos de riqueza muito diferente.
    af.armies = { west_africa: 4, north_africa: 4 };
    game.territories.west_africa.owner = 'africa';
    game.territories.north_africa.owner = 'africa';
    // central_africa (adj. a west_africa) = dono pobre; egypt-ish vizinho de north_africa = rico.
    const poorT = game.territories.west_africa.adjacentTerritories.find(
      id => id !== 'north_africa' && game.territories[id],
    )!;
    const richT = game.territories.north_africa.adjacentTerritories.find(
      id => id !== 'west_africa' && game.territories[id] && id !== poorT,
    )!;
    game.territories[poorT].owner = 'usa';
    game.territories[richT].owner = 'south_america';
    game.players.usa.armies = { [poorT]: 1 };
    game.players.south_america.armies = { [richT]: 1 };
    game.players.usa.money = 1000;            // alvo pobre
    game.players.south_america.money = 800000; // alvo rico → deve ser o escolhido
    useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });

    useGameStore.getState().dispatch({ type: 'CPU_TURN' });

    const after = useGameStore.getState().game!;
    // O território rico deve ter sido atacado (conquistado, dado margem 4 vs 1).
    expect(after.territories[richT].owner).toBe('africa');
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
