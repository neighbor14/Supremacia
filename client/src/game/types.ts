// ============================================================
// SUPREMACIA DIGITAL — Core Type Definitions
// Design: Atlas Tático / Cartografia Geopolítica Moderna
// ============================================================

export type ResourceType = 'grain' | 'oil' | 'mineral';
export type UnitType = 'army' | 'navy';
export type SeaType = 'coastal' | 'deep';

export type SuperpowerId = 'south_america' | 'africa' | 'europe' | 'china' | 'usa' | 'ussr';

export interface Superpower {
  id: SuperpowerId;
  name: string;
  shortName: string;
  color: string;
  territories: string[];
}

export interface Territory {
  id: string;
  name: string;
  owner: SuperpowerId | null; // null = neutral
  isHomeland: boolean;
  superpowerId: SuperpowerId | null;
  adjacentTerritories: string[];
  adjacentSeas: string[];
  hasPort: boolean;
  nuked: boolean;
  svgPath: string;
  labelPos: { x: number; y: number };
}

export interface SeaZone {
  id: string;
  name: string;
  type: SeaType;
  adjacentTerritories: string[];
  adjacentSeas: string[];
  svgPath: string;
  labelPos: { x: number; y: number };
}

export interface ResourceCard {
  id: string;
  type: ResourceType;
  companyName: string;
  territoryId: string;
  production: number;
  originSuperpower: SuperpowerId;
  ownerId: SuperpowerId | null;
  revealed: boolean;
}

export interface Player {
  id: SuperpowerId;
  name: string;
  money: number;
  supplies: Record<ResourceType, number>;
  maxSupply: number;
  resourceCards: string[]; // card IDs
  nukes: number;
  laserStars: number;
  hasResearchedNuke: boolean;
  hasResearchedLaserStar: boolean;
  loans: number;
  isHuman: boolean;
  isEliminated: boolean;
  armies: Record<string, number>; // territoryId -> count
  navies: Record<string, number>; // seaZoneId -> count
  embarked: Record<string, number>; // seaZoneId -> armies aboard
}

export type TurnStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TurnState {
  currentPlayer: SuperpowerId;
  stage: TurnStage;
  optionalStagesUsed: TurnStage[];
  maxOptionalStages: number;
  turnNumber: number;
  playerOrder: SuperpowerId[];
  currentPlayerIndex: number;
  isFirstTurn: boolean;
  stageComplete: boolean;
}

export interface MarketState {
  prices: Record<ResourceType, number>;
  priceHistory: Array<{ turn: number; grain: number; oil: number; mineral: number }>;
  minPrice: number;
  maxPrice: number;
  priceStep: number;
}

export interface CombatState {
  active: boolean;
  attackerId: SuperpowerId | null;
  defenderId: SuperpowerId | null;
  targetId: string | null; // territory or sea zone
  targetType: 'territory' | 'sea';
  attackerUnits: number;
  defenderUnits: number;
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  phase: 'select_target' | 'confirm' | 'rolling' | 'result' | 'occupy';
  defenderChoice: 'resist' | 'retreat' | 'surrender' | null;
}

export interface NuclearAttackState {
  active: boolean;
  attackerId: SuperpowerId | null;
  targetId: string | null;
  targetType: 'territory' | 'sea';
  laserStarDefense: boolean;
  defenseRolls: number[];
  intercepted: boolean;
  phase: 'select_target' | 'confirm' | 'defense' | 'result';
}

export interface EventLogEntry {
  id: string;
  turn: number;
  stage: TurnStage;
  player: SuperpowerId;
  message: string;
  timestamp: number;
  type: 'info' | 'combat' | 'nuclear' | 'economy' | 'build' | 'move' | 'elimination';
}

export interface GameState {
  players: Record<SuperpowerId, Player>;
  territories: Record<string, Territory>;
  seaZones: Record<string, SeaZone>;
  resourceCards: Record<string, ResourceCard>;
  resourceDeck: string[]; // unowned card IDs in deck
  market: MarketState;
  turn: TurnState;
  combat: CombatState;
  nuclearAttack: NuclearAttackState;
  eventLog: EventLogEntry[];
  nukedTerritoryCount: number;
  gameOver: boolean;
  winner: SuperpowerId | null;
  endCondition: 'supremacy' | 'detente' | 'holocaust' | null;
}

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'NEXT_STAGE' }
  | { type: 'SKIP_STAGE' }
  | { type: 'END_TURN' }
  | { type: 'PAY_SALARIES' }
  | { type: 'TRANSFER_PRODUCTION' }
  | { type: 'SELL_RESOURCE'; resource: ResourceType; quantity: number }
  | { type: 'BUY_RESOURCE'; resource: ResourceType; quantity: number }
  | { type: 'PROSPECT'; cardId: string }
  | { type: 'BUILD_UNITS'; units: Array<{ type: UnitType; locationId: string }> }
  | { type: 'BUILD_NUKE' }
  | { type: 'BUILD_LASER_STAR' }
  | { type: 'RESEARCH_NUKE'; cardId: string }
  | { type: 'RESEARCH_LASER_STAR'; cardId: string }
  | { type: 'MOVE_ARMY'; from: string; to: string; count: number }
  | { type: 'MOVE_NAVY'; from: string; to: string; count: number }
  | { type: 'AIRLIFT'; from: string; to: string; count: number }
  | { type: 'EMBARK'; territoryId: string; seaZoneId: string; count: number }
  | { type: 'DISEMBARK'; seaZoneId: string; territoryId: string; count: number }
  | { type: 'ATTACK_TERRITORY'; from: string; target: string }
  | { type: 'ATTACK_SEA'; from: string; target: string }
  | { type: 'RESOLVE_COMBAT'; defenderChoice: 'resist' | 'retreat' | 'surrender' }
  | { type: 'ROLL_COMBAT' }
  | { type: 'OCCUPY_TERRITORY' }
  | { type: 'LAUNCH_NUKE'; target: string; targetType: 'territory' | 'sea' }
  | { type: 'DEFEND_NUKE' }
  | { type: 'RESOLVE_NUKE' }
  | { type: 'TAKE_LOAN'; amount: number }
  | { type: 'PAY_LOAN'; amount: number }
  | { type: 'CPU_TURN' }
  | { type: 'LOAD_GAME'; state: GameState }
  | { type: 'DECLARE_DETENTE' };
