import { GameState, Player, SuperpowerId, ResourceType, MarketState, TurnState, CombatState, NuclearAttackState } from './types';
import { RULES } from './rulesConfig';
import { TERRITORIES } from '../data/territories';
import { SEA_ZONES } from '../data/seaZones';
import { generateResourceCards } from '../data/resourceCards';
import { SUPERPOWERS, SUPERPOWER_IDS } from '../data/initialPlayers';
import { shuffleArray } from './rng';

export function createInitialGameState(humanPlayer: SuperpowerId = 'usa'): GameState {
  const resourceCards = generateResourceCards();
  const cardMap: Record<string, typeof resourceCards[0]> = {};
  resourceCards.forEach(c => { cardMap[c.id] = c; });

  // Create players
  const players: Record<SuperpowerId, Player> = {} as any;
  SUPERPOWER_IDS.forEach(id => {
    const sp = SUPERPOWERS[id];
    // Assign starting resource cards (6 per player: 2 grain, 2 oil, 2 mineral)
    const playerCards = resourceCards.filter(c => c.originSuperpower === id).slice(0, 6);
    playerCards.forEach(c => {
      c.ownerId = id;
      c.revealed = true;
    });

    // Place 1 army in each home territory
    const armies: Record<string, number> = {};
    sp.territories.forEach(t => { armies[t] = 1; });

    players[id] = {
      id,
      name: sp.name,
      money: RULES.STARTING_MONEY,
      supplies: { grain: RULES.STARTING_SUPPLIES, oil: RULES.STARTING_SUPPLIES, mineral: RULES.STARTING_SUPPLIES },
      maxSupply: RULES.MAX_SUPPLY,
      resourceCards: playerCards.map(c => c.id),
      nukes: 0,
      laserStars: 0,
      hasResearchedNuke: false,
      hasResearchedLaserStar: false,
      loans: 0,
      isHuman: id === humanPlayer,
      isEliminated: false,
      armies,
      navies: {},
      embarked: {},
    };
  });

  // Build resource deck (cards not owned by any player)
  const ownedCardIds = new Set(Object.values(players).flatMap(p => p.resourceCards));
  const deckCards = resourceCards.filter(c => !ownedCardIds.has(c.id));
  const resourceDeck = shuffleArray(deckCards.map(c => c.id));

  // Build card map for state
  const cardState: Record<string, typeof resourceCards[0]> = {};
  resourceCards.forEach(c => { cardState[c.id] = c; });

  // Market
  const market: MarketState = {
    prices: { grain: RULES.MARKET_START_PRICE, oil: RULES.MARKET_START_PRICE, mineral: RULES.MARKET_START_PRICE },
    priceHistory: [{ turn: 0, grain: RULES.MARKET_START_PRICE, oil: RULES.MARKET_START_PRICE, mineral: RULES.MARKET_START_PRICE }],
    minPrice: RULES.MARKET_MIN_PRICE,
    maxPrice: RULES.MARKET_MAX_PRICE,
    priceStep: RULES.MARKET_PRICE_STEP,
  };

  // Turn
  const playerOrder = shuffleArray([...SUPERPOWER_IDS]);
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
    attackedFrom: [],
  };

  // Combat
  const combat: CombatState = {
    active: false, attackerId: null, defenderId: null, fromId: null, targetId: null,
    targetType: 'territory', attackerUnits: 0, defenderUnits: 0,
    attackerDice: [], defenderDice: [], attackerLosses: 0, defenderLosses: 0,
    phase: 'select_target', defenderChoice: null,
  };

  // Nuclear
  const nuclearAttack: NuclearAttackState = {
    active: false, attackerId: null, targetId: null, targetType: 'territory',
    laserStarDefense: false, defenseRolls: [], intercepted: false,
    phase: 'select_target',
  };

  return {
    players,
    territories: { ...TERRITORIES },
    seaZones: { ...SEA_ZONES },
    resourceCards: cardState,
    resourceDeck,
    market,
    turn,
    combat,
    nuclearAttack,
    eventLog: [],
    nukedTerritoryCount: 0,
    gameOver: false,
    winner: null,
    endCondition: null,
  };
}
