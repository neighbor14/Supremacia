import { GameState, GameConfig, Player, SuperpowerId, MarketState, TurnState, CombatState, NuclearAttackState, DrawnCardReveal } from './types';
import { RULES } from './rulesConfig';
import { TERRITORIES } from '../data/territories';
import { SEA_ZONES } from '../data/seaZones';
import { generateResourceCards } from '../data/resourceCards';
import { SUPERPOWERS, SUPERPOWER_IDS } from '../data/initialPlayers';
import { shuffleArray } from './rng';

export function createInitialGameState(
  humanPlayer: SuperpowerId,
  activeAiIds: SuperpowerId[]
): GameState {
  const resourceCards = generateResourceCards();

  const activePlayers = [humanPlayer, ...activeAiIds];
  const inactiveIds = SUPERPOWER_IDS.filter(id => !activePlayers.includes(id));

  // Create players — all 6 slots exist so the Record type stays satisfied.
  // Inactive players are marked eliminated from the start and receive nothing.
  const players: Record<SuperpowerId, Player> = {} as Record<SuperpowerId, Player>;
  SUPERPOWER_IDS.forEach(id => {
    const sp = SUPERPOWERS[id];
    const isActive = activePlayers.includes(id);
    const isHuman = id === humanPlayer;

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

  // Resource deck — cards not assigned to any active player
  const ownedCardIds = new Set(Object.values(players).flatMap(p => p.resourceCards));
  const deckCards = resourceCards.filter(c => !ownedCardIds.has(c.id));
  const resourceDeck = shuffleArray(deckCards.map(c => c.id));

  const cardState: Record<string, typeof resourceCards[0]> = {};
  resourceCards.forEach(c => { cardState[c.id] = c; });

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
    attackedFrom: [],
  };

  const combat: CombatState = {
    active: false, attackerId: null, defenderId: null, fromId: null, targetId: null,
    targetType: 'territory', attackerUnits: 0, defenderUnits: 0,
    attackerUnitsAfter: 0, defenderUnitsAfter: 0, conquered: false,
    attackerDice: [], defenderDice: [], attackerLosses: 0, defenderLosses: 0,
    phase: 'select_target', defenderChoice: null,
  };

  const nuclearAttack: NuclearAttackState = {
    active: false, attackerId: null, targetId: null, targetType: 'territory',
    laserStarDefense: false, defenseRolls: [], intercepted: false,
    phase: 'select_target',
  };

  const config: GameConfig = {
    humanPlayers: 1,
    aiPlayers: activeAiIds.length,
    totalActivePlayers: activePlayers.length,
    maxPlayers: SUPERPOWER_IDS.length,
    multiplayerReady: false,
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
    combat,
    nuclearAttack,
    drawnCard: null as DrawnCardReveal | null,
    eventLog: [],
    nukedTerritoryCount: 0,
    gameOver: false,
    winner: null,
    endCondition: null,
  };
}
