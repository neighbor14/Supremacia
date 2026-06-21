// ============================================================
// SUPREMACIA DIGITAL — Core Type Definitions
// Design: Atlas Tático / Cartografia Geopolítica Moderna
// ============================================================

export type ResourceType = 'grain' | 'oil' | 'mineral';
export type UnitType = 'army' | 'navy';
export type SeaType = 'coastal' | 'deep';
export type PlayerType = 'human' | 'ai' | 'remote';

// Níveis de dificuldade da IA. Afetam SÓ a qualidade da decisão —
// nunca concedem bônus de recurso, dado ou informação oculta.
// Perfis e pesos ficam em game/ai/aiConfig.ts.
export type AIDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'god';

export interface GameConfig {
  humanPlayers: number;
  aiPlayers: number;
  totalActivePlayers: number;
  maxPlayers: number;
  multiplayerReady: boolean;
}

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
  type: PlayerType;
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
  // Dificuldade da IA que controla este jogador (só relevante p/ type === 'ai').
  // Cada IA pode ter o seu próprio nível; ausência → perfil padrão.
  aiDifficulty?: AIDifficulty;
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
  attackedFrom: string[]; // origin ids (territory/sea) that already attacked this turn
  // Companhias cujo salário NÃO foi pago no Estágio 1 deste turno. Fiel ao manual
  // Grow: "se não pagar os salários das suas companhias, não poderá transferir as
  // unidades produzidas no estágio 2". Elas ficam dormentes (não produzem) só
  // neste turno; voltam a produzir quando o salário for pago. Recalculado a cada
  // pagamento de salários (paySalaries).
  unpaidCompanies: string[];
  // Fidelidade D3: manual Grow permite até 3 tentativas de prospecção por turno
  // no Estágio 7. Incrementa a cada nova sessão iniciada; reseta a cada turno.
  prospectAttemptsUsed: number;
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
  fromId: string | null; // origin territory/sea zone of the attacker
  targetId: string | null; // territory or sea zone
  targetType: 'territory' | 'sea';
  attackerUnits: number;
  defenderUnits: number;
  attackerUnitsAfter: number;
  defenderUnitsAfter: number;
  conquered: boolean;
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  phase: 'select_target' | 'confirm' | 'rolling' | 'result' | 'occupy' | 'counter_attack_available';
  defenderChoice: 'resist' | 'retreat' | 'surrender' | null;
  // D7: manual Grow — defensor pode contra-atacar uma vez por combate
  counterAttackAvailable: boolean;
  counterAttackUsed: boolean;
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

export interface DrawnCardReveal {
  active: boolean;
  type: 'nuke' | 'laser' | 'resource';
  success: boolean;
  cardName: string;
  cardEffect: string;
  context: string;
  cardId?: string;
  // Resource card details (populated when revealing a resource card during research/prospect)
  resourceType?: ResourceType;
  companyName?: string;
  production?: number;
  // Research session snapshot — present when this reveal came from a research action
  researchTarget?: 'nuke' | 'laser';
  researchCardsDrawn?: number;
  researchCostSoFar?: number;
  deckRemaining?: number;
  nukeCardsRemaining?: number;
  laserCardsRemaining?: number;
  // Prospecting session snapshot — present when this reveal came from targeted prospecting
  prospectTarget?: ResourceType;
  prospectCardsFlipped?: number;
  prospectCostSoFar?: number;
}

// Tracks an active research session across multiple card draws
export interface ResearchSession {
  target: 'nuke' | 'laser';
  cardsRevealed: string[];
  found: boolean;
  totalCost: number;
}

// Tracks an active targeted-prospecting session (one card flip at a time)
export interface ProspectingSession {
  targetType: ResourceType;
  cardsSetAside: string[];  // non-matching cards waiting to be reshuffled back
  found: boolean;
  totalCost: number;
  cardsFlipped: number;
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

// D6: manual Grow — defensor pode mover reforços após combate
export interface DefenderReinforcement {
  territory: string;          // território que foi defendido
  defenderPlayer: SuperpowerId;
  attackerOrigin: string | null; // território de onde o ataque partiu
}

export interface GameState {
  config: GameConfig;
  players: Record<SuperpowerId, Player>;
  territories: Record<string, Territory>;
  seaZones: Record<string, SeaZone>;
  resourceCards: Record<string, ResourceCard>;
  resourceDeck: string[]; // unified deck: resource card IDs + tech card IDs ('nuke_0', 'laser_0', …)
  market: MarketState;
  turn: TurnState;
  combat: CombatState;
  nuclearAttack: NuclearAttackState;
  drawnCard: DrawnCardReveal | null;
  researchSession: ResearchSession | null;
  prospectingSession: ProspectingSession | null;
  eventLog: EventLogEntry[];
  nukedTerritoryCount: number;
  gameOver: boolean;
  winner: SuperpowerId | null;
  endCondition: 'supremacy' | 'detente' | 'holocaust' | null;
  // D6: janela de reforço do defensor pós-combate (null = sem reforço pendente)
  defenderReinforcement: DefenderReinforcement | null;
}

// ============================================================
// TURN PRESENTATION LAYER — shared protocol for AI, local human,
// and future remote_human players. All action representations go
// through this structure so multiplayer can reuse the same UI.
// ============================================================

export type ActionEventType =
  | 'pay_salaries'
  | 'transfer_production'
  | 'sell_resource'
  | 'buy_resource'
  | 'build_armies'
  | 'build_navies'
  | 'move'
  | 'attack_result_victory'
  | 'attack_result_defeat'
  | 'research'
  | 'card_reveal'
  | 'end_turn';

export interface CombatDetails {
  fromId: string | null;
  toId: string | null;
  attackerUnitsInitial: number;
  defenderUnitsInitial: number;
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  attackerUnitsAfter: number;
  defenderUnitsAfter: number;
  conquered: boolean;
  defenderName: string;
}

export interface PlayerActionEvent {
  id: string;
  playerId: SuperpowerId;
  playerName: string;
  playerType: PlayerType;
  phase: TurnStage;
  actionType: ActionEventType;
  title: string;
  description: string;
  fromId?: string;
  toId?: string;
  resourceChanges?: Partial<Record<ResourceType | 'money', number>>;
  armyDelta?: number;
  navyDelta?: number;
  soundKey?: string;
  durationMs: number;
  combatDetails?: CombatDetails;
}

export interface PlannedStep {
  event: PlayerActionEvent;
  stateAfter: GameState;
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
  | { type: 'PROSPECT'; cardId: string; resourceType?: ResourceType }
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
  | { type: 'OCCUPY_TERRITORY'; count?: number }
  | { type: 'LAUNCH_NUKE'; target: string; targetType: 'territory' | 'sea' }
  | { type: 'DEFEND_NUKE' }
  | { type: 'RESOLVE_NUKE' }
  | { type: 'TAKE_LOAN'; amount: number }
  | { type: 'PAY_LOAN'; amount: number }
  | { type: 'CPU_TURN' }
  | { type: 'LOAD_GAME'; state: GameState }
  | { type: 'SELECT_OPTIONAL_STAGE'; stage: TurnStage }
  | { type: 'SET_ARMY_PLACEMENT'; placement: Record<string, number> }
  | { type: 'DECLARE_DETENTE' }
  | { type: 'DISMISS_DRAWN_CARD' }
  | { type: 'DRAW_RESEARCH_CARD' }
  | { type: 'STOP_RESEARCH' }
  | { type: 'DRAW_PROSPECT_CARD' }
  | { type: 'STOP_PROSPECT' }
  | { type: 'APPLY_AI_STEP'; state: GameState }
  // D7: contra-ataque do defensor
  | { type: 'COUNTER_ATTACK' }
  | { type: 'SKIP_COUNTER_ATTACK' }
  // D6: reforço do defensor pós-combate
  | { type: 'REINFORCE_AFTER_COMBAT'; from: string; to: string; count: number }
  | { type: 'SKIP_REINFORCEMENT' };
