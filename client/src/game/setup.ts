import { GameState, GameConfig, Player, SuperpowerId, MarketState, TurnState, CombatState, NuclearAttackState, DrawnCardReveal, AIDifficulty, MarketMode, SimultaneousSellState } from './types';
import { DEFAULT_AI_DIFFICULTY } from './ai';
import { RULES } from './rulesConfig';
import { TERRITORIES } from '../data/territories';
import { SEA_ZONES } from '../data/seaZones';
import { generateResourceCards, NUKE_CARD_IDS, LASER_CARD_IDS } from '../data/resourceCards';
import { SUPERPOWERS, SUPERPOWER_IDS } from '../data/initialPlayers';
import { shuffleArray } from './rng';

export function createInitialGameState(
  humanPlayer: SuperpowerId,
  activeAiIds: SuperpowerId[],
  // Dificuldade aplicada às IAs ativas. Aceita um nível global ou um mapa
  // por superpotência (cada IA com o seu nível). Padrão: intermediate.
  aiDifficulty: AIDifficulty | Partial<Record<SuperpowerId, AIDifficulty>> = DEFAULT_AI_DIFFICULTY,
  // Modo de mercado. Partidas novas → Digital Balanceado (default da regra).
  marketMode: MarketMode = RULES.DEFAULT_MARKET_MODE,
): GameState {
  return buildGameState({ humans: [humanPlayer], aiIds: activeAiIds, aiDifficulty, marketMode });
}

// Variante multiplayer: vários assentos humanos + assentos de IA, cada qual
// associado a uma superpotência. Mesma matemática/estrutura do single-player —
// só muda QUEM é humano. Usada pelo módulo multiplayer (lobby/host).
export function createMultiplayerGameState(opts: {
  humans: SuperpowerId[];
  ai: Array<{ id: SuperpowerId; difficulty: AIDifficulty }>;
  marketMode?: MarketMode;
}): GameState {
  const aiDifficulty: Partial<Record<SuperpowerId, AIDifficulty>> = {};
  opts.ai.forEach(a => { aiDifficulty[a.id] = a.difficulty; });
  return buildGameState({
    humans: opts.humans,
    aiIds: opts.ai.map(a => a.id),
    aiDifficulty,
    marketMode: opts.marketMode ?? RULES.DEFAULT_MARKET_MODE,
  });
}

// Construtor compartilhado: fonte única de verdade do estado inicial. Os dois
// wrappers acima só diferem em quantos assentos são humanos.
function buildGameState(args: {
  humans: SuperpowerId[];
  aiIds: SuperpowerId[];
  aiDifficulty: AIDifficulty | Partial<Record<SuperpowerId, AIDifficulty>>;
  marketMode: MarketMode;
}): GameState {
  const { humans, aiIds, aiDifficulty, marketMode } = args;
  const humanSet = new Set(humans);
  const difficultyFor = (id: SuperpowerId): AIDifficulty =>
    typeof aiDifficulty === 'string'
      ? aiDifficulty
      : aiDifficulty[id] ?? DEFAULT_AI_DIFFICULTY;
  const resourceCards = generateResourceCards();

  const activePlayers = [...humans, ...aiIds];
  const inactiveIds = SUPERPOWER_IDS.filter(id => !activePlayers.includes(id));

  // Create players — all 6 slots exist so the Record type stays satisfied.
  // Inactive players are marked eliminated from the start and receive nothing.
  const players: Record<SuperpowerId, Player> = {} as Record<SuperpowerId, Player>;
  SUPERPOWER_IDS.forEach(id => {
    const sp = SUPERPOWERS[id];
    const isActive = activePlayers.includes(id);
    const isHuman = humanSet.has(id);

    if (isActive) {
      const playerCards = resourceCards.filter(c => c.originSuperpower === id).slice(0, 6);
      playerCards.forEach(c => { c.ownerId = id; c.revealed = true; });

      const armies: Record<string, number> = {};
      sp.territories.forEach(t => { armies[t] = 1; });

      players[id] = {
        id,
        name: sp.name,
        type: isHuman ? 'human' : 'ai',
        money: RULES.STARTING_MONEY,
        supplies: { grain: RULES.STARTING_SUPPLIES, oil: RULES.STARTING_SUPPLIES, mineral: RULES.STARTING_SUPPLIES },
        maxSupply: RULES.MAX_SUPPLY,
        resourceCards: playerCards.map(c => c.id),
        nukes: 0,
        laserStars: 0,
        hasResearchedNuke: false,
        hasResearchedLaserStar: false,
        loans: 0,
        isHuman,
        isEliminated: false,
        aiDifficulty: isHuman ? undefined : difficultyFor(id),
        armies,
        navies: {},
        embarked: {},
      };
    } else {
      players[id] = {
        id,
        name: sp.name,
        type: 'ai',
        money: 0,
        supplies: { grain: 0, oil: 0, mineral: 0 },
        maxSupply: RULES.MAX_SUPPLY,
        resourceCards: [],
        nukes: 0,
        laserStars: 0,
        hasResearchedNuke: false,
        hasResearchedLaserStar: false,
        loans: 0,
        isHuman: false,
        isEliminated: true,
        armies: {},
        navies: {},
        embarked: {},
      };
    }
  });

  // Territories: copy from data, then neutralize inactive players' homelands.
  const territories = Object.fromEntries(
    Object.entries(TERRITORIES).map(([k, t]) => {
      if (t.owner && inactiveIds.includes(t.owner)) {
        return [k, { ...t, owner: null }];
      }
      return [k, { ...t }];
    })
  ) as typeof TERRITORIES;

  // Unified game deck: unassigned resource cards + all tech cards, shuffled together
  const ownedCardIds = new Set(Object.values(players).flatMap(p => p.resourceCards));
  const deckCards = resourceCards.filter(c => !ownedCardIds.has(c.id));
  const techCardIds: string[] = [...NUKE_CARD_IDS, ...LASER_CARD_IDS];
  const resourceDeck = shuffleArray([...deckCards.map(c => c.id), ...techCardIds]);

  const cardState: Record<string, typeof resourceCards[0]> = {};
  resourceCards.forEach(c => { cardState[c.id] = c; });

  // Preço inicial: FIXO em $5.000 nos dois modos por ora. O Modo Digital
  // Balanceado prevê preço inicial variável (2d6), mas a tabela oficial Grow
  // ainda não está confirmada no projeto — ver game/marketSetup.ts
  // (rollInitialMarketPrices, isolada e documentada, ainda desconectada).
  // TODO: confirmar regra original e ligar rollInitialMarketPrices no modo balanced.
  const market: MarketState = {
    prices: { grain: RULES.MARKET_START_PRICE, oil: RULES.MARKET_START_PRICE, mineral: RULES.MARKET_START_PRICE },
    priceHistory: [{ turn: 0, grain: RULES.MARKET_START_PRICE, oil: RULES.MARKET_START_PRICE, mineral: RULES.MARKET_START_PRICE }],
    minPrice: RULES.MARKET_MIN_PRICE,
    maxPrice: RULES.MARKET_MAX_PRICE,
    priceStep: RULES.MARKET_PRICE_STEP,
  };

  // Only active players enter the turn order
  const playerOrder = shuffleArray([...activePlayers]);
  const turn: TurnState = {
    currentPlayer: playerOrder[0],
    stage: 1,
    optionalStagesUsed: [],
    maxOptionalStages: RULES.MAX_OPTIONAL_STAGES,
    turnNumber: 1,
    playerOrder,
    currentPlayerIndex: 0,
    isFirstTurn: true,
    stageComplete: false,
    upkeepPreprocessed: false,
    attackedFrom: [],
    unpaidCompanies: [],
    prospectAttemptsUsed: 0,
    unitsBuiltThisTurn: 0,
  };

  const combat: CombatState = {
    active: false, attackerId: null, defenderId: null, fromId: null, targetId: null,
    targetType: 'territory', bombardment: false, attackerUnits: 0, defenderUnits: 0,
    attackerUnitsAfter: 0, defenderUnitsAfter: 0, conquered: false,
    attackerDice: [], defenderDice: [], attackerLosses: 0, defenderLosses: 0,
    phase: 'select_target', defenderChoice: null,
    reinforceAvailable: false, reinforceUsed: false,
    counterAttackAvailable: false, counterAttackUsed: false, counterResult: null,
  };

  const nuclearAttack: NuclearAttackState = {
    active: false, attackerId: null, targetId: null, targetType: 'territory',
    laserStarDefense: false, defenseRolls: [], intercepted: false,
    phase: 'select_target',
  };

  const config: GameConfig = {
    humanPlayers: humans.length,
    aiPlayers: aiIds.length,
    totalActivePlayers: activePlayers.length,
    maxPlayers: SUPERPOWER_IDS.length,
    multiplayerReady: humans.length > 1,
    marketMode,
  };

  // Modo Digital Balanceado — fatia da Venda Simultânea (inativa no Clássico).
  const simultaneousSell: SimultaneousSellState = {
    phase: 'inactive',
    round: 0,
    lastResolvedRound: 0,
    priceSnapshot: { grain: RULES.MARKET_START_PRICE, oil: RULES.MARKET_START_PRICE, mineral: RULES.MARKET_START_PRICE },
    declarations: {},
    soldThisRound: [],
    resolution: null,
  };

  return {
    config,
    players,
    territories,
    seaZones: { ...SEA_ZONES },
    resourceCards: cardState,
    resourceDeck,
    market,
    turn,
    simultaneousSell,
    combat,
    nuclearAttack,
    drawnCard: null as DrawnCardReveal | null,
    researchSession: null,
    prospectingSession: null,
    eventLog: [],
    nukedTerritoryCount: 0,
    gameOver: false,
    winner: null,
    endCondition: null,
  };
}
