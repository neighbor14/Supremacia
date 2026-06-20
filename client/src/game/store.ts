import { create } from 'zustand';
import { GameState, GameAction, SuperpowerId, ResourceType, TurnStage, EventLogEntry, UnitType, Player, PlayerActionEvent, PlannedStep } from './types';
import { createInitialGameState } from './setup';
import { RULES } from './rulesConfig';
import { rollDice, sumDice, shuffleArray } from './rng';
import { SUPERPOWER_IDS, SUPERPOWERS } from '../data/initialPlayers';
import { nanoid } from 'nanoid';

interface GameStore {
  game: GameState | null;
  selectedTerritory: string | null;
  selectedSeaZone: string | null;
  uiMode: 'map' | 'market' | 'build' | 'move' | 'attack' | 'nuclear';

  // Actions
  startGame: (humanPlayer: SuperpowerId, aiCount: number) => void;
  dispatch: (action: GameAction) => void;
  selectTerritory: (id: string | null) => void;
  selectSeaZone: (id: string | null) => void;
  setUiMode: (mode: GameStore['uiMode']) => void;
  loadGame: (state: GameState) => void;
  saveGame: () => string;
}

const RESOURCE_NAME: Record<ResourceType, string> = { grain: 'cereal', oil: 'petróleo', mineral: 'minério' };

function addEvent(state: GameState, player: SuperpowerId, message: string, type: EventLogEntry['type'] = 'info'): void {
  state.eventLog.push({
    id: nanoid(8),
    turn: state.turn.turnNumber,
    stage: state.turn.stage,
    player,
    message,
    timestamp: Date.now(),
    type,
  });
  // Keep last 100 events
  if (state.eventLog.length > 100) state.eventLog = state.eventLog.slice(-100);
}



function countPlayerUnits(player: { armies: Record<string, number>; navies: Record<string, number>; embarked?: Record<string, number> }): number {
  const armies = Object.values(player.armies).reduce((sum: number, n: number) => sum + n, 0);
  const navies = Object.values(player.navies).reduce((sum: number, n: number) => sum + n, 0);
  // Embarked armies are still paid units — they just ride aboard the fleet.
  const embarked = Object.values(player.embarked || {}).reduce((sum: number, n: number) => sum + n, 0);
  return armies + navies + embarked;
}

/**
 * Single source of truth for Stage-1 upkeep. Reused by paySalaries() and by the
 * salary-provision UI so the forecast always matches what will actually be charged.
 */
export interface SalaryDue {
  unitCount: number;
  companyCount: number;
  unitCost: number;
  companyCost: number;
  loanInterest: number;
  total: number;
}

export function computeSalaryDue(player: Player): SalaryDue {
  const unitCount = countPlayerUnits(player);
  const companyCount = player.resourceCards.length;
  const unitCost = unitCount * RULES.SALARY_PER_UNIT;
  const companyCost = companyCount * RULES.SALARY_PER_COMPANY;
  const loanInterest = Math.floor(player.loans * RULES.LOAN_INTEREST_RATE);
  return {
    unitCount,
    companyCount,
    unitCost,
    companyCost,
    loanInterest,
    total: unitCost + companyCost + loanInterest,
  };
}

/**
 * When a fleet shrinks (combat losses, nuke), embarked armies that no longer fit
 * the surviving transport capacity are lost at sea. Keeps embarked ≤ navies × cap.
 */
function dropOverCapacityEmbarked(player: Player, seaZoneId: string): void {
  const navies = player.navies[seaZoneId] || 0;
  const capacity = navies * RULES.NAVY_TRANSPORT_CAPACITY;
  const embarked = player.embarked[seaZoneId] || 0;
  if (embarked > capacity) {
    if (capacity <= 0) delete player.embarked[seaZoneId];
    else player.embarked[seaZoneId] = capacity;
  }
}

function paySalaries(state: GameState): void {
  const player = state.players[state.turn.currentPlayer];
  const { unitCost, companyCost, loanInterest, total: totalCost } = computeSalaryDue(player);

  if (player.money >= totalCost) {
    player.money -= totalCost;
    addEvent(state, player.id, `Pagou salários: ${unitCost.toLocaleString()} (unidades) + ${companyCost.toLocaleString()} (companhias) + ${loanInterest.toLocaleString()} (juros)`, 'economy');
  } else {
    // Pay what can be paid, remove unpaid units.
    // Compute the deficit BEFORE zeroing money, otherwise it always equals totalCost.
    const deficit = totalCost - player.money;
    player.money = 0;
    addEvent(state, player.id, `Fundos insuficientes para salários. Unidades removidas.`, 'economy');
    // Remove armies proportionally to the unpaid amount
    let toRemove = Math.ceil(deficit / RULES.SALARY_PER_UNIT);
    const territories = Object.keys(player.armies);
    for (const t of territories) {
      if (toRemove <= 0) break;
      const remove = Math.min(player.armies[t], toRemove);
      player.armies[t] -= remove;
      toRemove -= remove;
      if (player.armies[t] <= 0) delete player.armies[t];
    }
  }
}

function transferProduction(state: GameState): void {
  const player = state.players[state.turn.currentPlayer];
  let produced = { grain: 0, oil: 0, mineral: 0 };

  for (const cardId of player.resourceCards) {
    const card = state.resourceCards[cardId];
    if (!card || !card.revealed) continue;
    const space = player.maxSupply - player.supplies[card.type];
    const amount = Math.min(card.production, space);
    player.supplies[card.type] += amount;
    produced[card.type] += amount;
  }

  addEvent(state, player.id, `Produção: +${produced.grain} cereal, +${produced.oil} petróleo, +${produced.mineral} minério`, 'economy');
}

function sellResource(state: GameState, resource: ResourceType, quantity: number): void {
  const player = state.players[state.turn.currentPlayer];
  const available = player.supplies[resource];
  const toSell = Math.min(quantity, available);
  if (toSell <= 0) return;

  const previousPrice = state.market.prices[resource];
  let totalRevenue = 0;
  for (let i = 0; i < toSell; i++) {
    totalRevenue += state.market.prices[resource];
    state.market.prices[resource] = Math.max(
      state.market.minPrice,
      state.market.prices[resource] - state.market.priceStep
    );
  }
  const newPrice = state.market.prices[resource];

  player.supplies[resource] -= toSell;
  player.money += totalRevenue;

  const priceTag = newPrice !== previousPrice
    ? ` Preço do ${RESOURCE_NAME[resource]}: $${(previousPrice / 1000).toFixed(0)}k → $${(newPrice / 1000).toFixed(0)}k.`
    : '';
  addEvent(
    state, player.id,
    `Vendeu ${toSell} ${RESOURCE_NAME[resource]} por $${totalRevenue.toLocaleString()}.${priceTag}`,
    'economy'
  );
}

function buyResource(state: GameState, resource: ResourceType, quantity: number): void {
  const player = state.players[state.turn.currentPlayer];
  const previousPrice = state.market.prices[resource];
  let totalCost = 0;
  let bought = 0;

  for (let i = 0; i < quantity; i++) {
    const price = state.market.prices[resource];
    if (player.money < price) break;
    if (player.supplies[resource] >= player.maxSupply) break;
    player.money -= price;
    player.supplies[resource]++;
    totalCost += price;
    bought++;
    state.market.prices[resource] = Math.min(
      state.market.maxPrice,
      state.market.prices[resource] + state.market.priceStep
    );
  }

  if (bought > 0) {
    const newPrice = state.market.prices[resource];
    const priceTag = newPrice !== previousPrice
      ? ` Preço do ${RESOURCE_NAME[resource]}: $${(previousPrice / 1000).toFixed(0)}k → $${(newPrice / 1000).toFixed(0)}k.`
      : '';
    addEvent(
      state, player.id,
      `Comprou ${bought} ${RESOURCE_NAME[resource]} por $${totalCost.toLocaleString()}.${priceTag}`,
      'economy'
    );
  }
}

function prospect(state: GameState): void {
  const player = state.players[state.turn.currentPlayer];
  if (state.resourceDeck.length === 0) {
    addEvent(state, player.id, 'Baralho vazio — nada para prospectar.', 'info');
    return;
  }
  if (player.money < RULES.RESEARCH_COST_PER_CARD) {
    addEvent(state, player.id, 'Dinheiro insuficiente para prospectar.', 'info');
    return;
  }

  // Pay the flip cost and draw the top card from the (shuffled) deck
  player.money -= RULES.RESEARCH_COST_PER_CARD;
  const cardId = state.resourceDeck.shift()!;
  const card = state.resourceCards[cardId];
  if (card) {
    card.ownerId = player.id;
    card.revealed = true;
    player.resourceCards.push(cardId);
    const icon = card.type === 'grain' ? 'cereal' : card.type === 'oil' ? 'petróleo' : 'minério';
    addEvent(state, player.id, `Prospecção: ${card.companyName} (+${card.production} ${icon}) adquirida.`, 'economy');
    state.drawnCard = {
      active: true,
      type: 'resource',
      success: true,
      cardName: card.companyName,
      cardEffect: `+${card.production} ${icon} por turno`,
      context: 'Prospecção de Recursos',
      cardId: card.id,
    };
  }
}

function startNewRound(state: GameState): void {
  state.turn.turnNumber++;
  state.turn.isFirstTurn = false;
  // Record price history at end of round
  state.market.priceHistory.push({
    turn: state.turn.turnNumber,
    grain: state.market.prices.grain,
    oil: state.market.prices.oil,
    mineral: state.market.prices.mineral,
  });
  // Keep last 20 entries
  if (state.market.priceHistory.length > 20) {
    state.market.priceHistory = state.market.priceHistory.slice(-20);
  }
}

function advanceToNextPlayer(state: GameState): void {
  // Reset per-turn attack tracking
  state.turn.attackedFrom = [];

  // Victory check: only one (or zero) non-eliminated player remains
  const active = state.turn.playerOrder.filter(id => !state.players[id].isEliminated);
  if (active.length <= 1) {
    state.gameOver = true;
    state.winner = active[0] || null;
    state.endCondition = 'supremacy';
    return;
  }

  // Advance to the next non-eliminated player, starting a new round when the
  // index wraps past the end. playerOrder keeps its full length so indices stay
  // stable; eliminated players are simply skipped (prevents turn-stall freeze).
  const order = state.turn.playerOrder;
  let idx = state.turn.currentPlayerIndex;
  for (let step = 0; step < order.length; step++) {
    idx++;
    if (idx >= order.length) {
      idx = 0;
      startNewRound(state);
    }
    if (!state.players[order[idx]].isEliminated) break;
  }

  state.turn.currentPlayerIndex = idx;
  state.turn.currentPlayer = order[idx];
  state.turn.stage = 1;
  state.turn.optionalStagesUsed = [];
  state.turn.stageComplete = false;
}

function canUseOptionalStage(state: GameState, stage: TurnStage): boolean {
  if (stage <= 2) return true; // mandatory
  if (state.turn.optionalStagesUsed.length >= RULES.MAX_OPTIONAL_STAGES) return false;
  if (state.turn.optionalStagesUsed.includes(stage)) return false;
  // Must be in order
  const lastUsed = state.turn.optionalStagesUsed[state.turn.optionalStagesUsed.length - 1] || 2;
  return stage > lastUsed;
}

function nextStage(state: GameState): void {
  const current = state.turn.stage;
  const player = state.players[state.turn.currentPlayer];
  
  if (current === 1) {
    state.turn.stage = 2;
  } else if (current === 2) {
    // After mandatory stages, human player chooses which optional stage to go to
    // For CPU, auto-advance to first available optional
    if (player.isHuman) {
      // Stay at stage 2 with stageComplete=true to signal "ready to choose"
      state.turn.stageComplete = true;
      return; // Don't reset stageComplete below
    } else {
      state.turn.stage = 3;
    }
  } else {
    // After completing an optional stage, human chooses next or ends turn
    if (player.isHuman) {
      // Mark current stage as used and wait for player choice
      state.turn.stageComplete = true;
      return;
    }
    // For CPU: find next available optional stage
    const nextOptions = RULES.OPTIONAL_STAGES.filter(s => s > current && canUseOptionalStage(state, s));
    if (nextOptions.length > 0 && state.turn.optionalStagesUsed.length < RULES.MAX_OPTIONAL_STAGES) {
      state.turn.stage = nextOptions[0];
    } else {
      advanceToNextPlayer(state);
    }
  }
  state.turn.stageComplete = false;
}

function selectOptionalStage(state: GameState, stage: TurnStage): void {
  if (canUseOptionalStage(state, stage)) {
    state.turn.optionalStagesUsed.push(stage);
    state.turn.stage = stage;
    state.turn.stageComplete = false;
  }
}

function buildUnits(state: GameState, units: Array<{ type: UnitType; locationId: string }>): void {
  const player = state.players[state.turn.currentPlayer];
  // Check supply sets needed
  const setsNeeded = Math.ceil(units.length / RULES.UNITS_PER_SUPPLY_SET);
  const moneyCost = units.length * RULES.UNIT_COST;

  if (player.supplies.grain < setsNeeded || player.supplies.oil < setsNeeded || player.supplies.mineral < setsNeeded) {
    addEvent(state, player.id, 'Suprimentos insuficientes para construção.', 'info');
    return;
  }
  if (player.money < moneyCost) {
    addEvent(state, player.id, 'Dinheiro insuficiente para construção.', 'info');
    return;
  }

  player.supplies.grain -= setsNeeded;
  player.supplies.oil -= setsNeeded;
  player.supplies.mineral -= setsNeeded;
  player.money -= moneyCost;

  for (const unit of units) {
    if (unit.type === 'army') {
      player.armies[unit.locationId] = (player.armies[unit.locationId] || 0) + 1;
    } else {
      player.navies[unit.locationId] = (player.navies[unit.locationId] || 0) + 1;
    }
  }

  addEvent(state, player.id, `Construiu ${units.length} unidade(s) por ${moneyCost.toLocaleString()}`, 'build');
}

function moveArmy(state: GameState, from: string, to: string, count: number): void {
  const player = state.players[state.turn.currentPlayer];
  const available = player.armies[from] || 0;
  const toMove = Math.min(count, available);
  if (toMove <= 0) return;

  // Validate adjacency (defense in depth — UI also filters)
  const fromT = state.territories[from];
  if (!fromT || !fromT.adjacentTerritories.includes(to)) {
    addEvent(state, player.id, 'Movimento inválido: territórios não adjacentes.', 'info');
    return;
  }

  // Check grain cost
  if (player.supplies.grain < RULES.LAND_MOVE_GRAIN_COST) {
    addEvent(state, player.id, 'Cereal insuficiente para movimento.', 'info');
    return;
  }

  player.supplies.grain -= RULES.LAND_MOVE_GRAIN_COST;
  player.armies[from] -= toMove;
  if (player.armies[from] <= 0) delete player.armies[from];
  player.armies[to] = (player.armies[to] || 0) + toMove;

  addEvent(state, player.id, `Moveu ${toMove} exército(s) para ${state.territories[to]?.name || to}`, 'move');
}

function airlift(state: GameState, from: string, to: string, count: number): void {
  const player = state.players[state.turn.currentPlayer];
  const available = player.armies[from] || 0;
  const toMove = Math.min(count, available);
  if (toMove <= 0) return;

  const oilCost = RULES.AIRLIFT_OIL_COST * toMove;
  if (player.supplies.oil < oilCost) {
    addEvent(state, player.id, 'Petróleo insuficiente para transporte aéreo.', 'info');
    return;
  }

  player.supplies.oil -= oilCost;
  player.armies[from] -= toMove;
  if (player.armies[from] <= 0) delete player.armies[from];
  player.armies[to] = (player.armies[to] || 0) + toMove;

  addEvent(state, player.id, `Aerotransportou ${toMove} exército(s) para ${state.territories[to]?.name || to}`, 'move');
}

function moveNavy(state: GameState, from: string, to: string, count: number): void {
  const player = state.players[state.turn.currentPlayer];
  const available = player.navies[from] || 0;
  const toMove = Math.min(count, available);
  if (toMove <= 0) return;

  // Validate adjacency between sea zones
  const fromSea = state.seaZones[from];
  if (!fromSea || !fromSea.adjacentSeas.includes(to)) {
    addEvent(state, player.id, 'Movimento naval inválido: zonas não adjacentes.', 'info');
    return;
  }

  if (player.supplies.oil < RULES.SEA_MOVE_OIL_COST) {
    addEvent(state, player.id, 'Petróleo insuficiente para movimento naval.', 'info');
    return;
  }

  player.supplies.oil -= RULES.SEA_MOVE_OIL_COST;
  player.navies[from] -= toMove;
  if (player.navies[from] <= 0) delete player.navies[from];
  player.navies[to] = (player.navies[to] || 0) + toMove;

  // Carry embarked armies along with the fleet, up to the capacity that arrives
  // at the destination (moved navies × capacity per navy).
  const embarkedHere = player.embarked[from] || 0;
  if (embarkedHere > 0) {
    const carried = Math.min(embarkedHere, toMove * RULES.NAVY_TRANSPORT_CAPACITY);
    if (carried > 0) {
      player.embarked[from] -= carried;
      if (player.embarked[from] <= 0) delete player.embarked[from];
      player.embarked[to] = (player.embarked[to] || 0) + carried;
    }
  }

  const carriedNote = (player.embarked[to] || 0) > 0 ? ` (com ${player.embarked[to]} exército(s) embarcado(s))` : '';
  addEvent(state, player.id, `Moveu ${toMove} esquadra(s) para ${state.seaZones[to]?.name || to}${carriedNote}`, 'move');
}

/**
 * Embark armies from a coastal territory onto the player's fleet in an adjacent
 * sea zone. Restores the stubbed naval-transport rule (NAVY_TRANSPORT_CAPACITY).
 * Capacity = navies in the zone × 4 armies each, minus already-embarked.
 * TODO: confirmar regra original — manual físico pode cobrar custo de embarque.
 */
function embark(state: GameState, territoryId: string, seaZoneId: string, count: number): void {
  const player = state.players[state.turn.currentPlayer];
  const territory = state.territories[territoryId];
  const sea = state.seaZones[seaZoneId];

  if (!territory || !sea) return;
  if (!territory.adjacentSeas.includes(seaZoneId)) {
    addEvent(state, player.id, 'Embarque inválido: território não é costeiro nesta zona.', 'info');
    return;
  }
  const available = player.armies[territoryId] || 0;
  if (available <= 0) {
    addEvent(state, player.id, 'Embarque inválido: nenhum exército neste território.', 'info');
    return;
  }
  const navies = player.navies[seaZoneId] || 0;
  if (navies <= 0) {
    addEvent(state, player.id, 'Embarque inválido: sem esquadra própria nesta zona.', 'info');
    return;
  }
  const capacity = navies * RULES.NAVY_TRANSPORT_CAPACITY;
  const used = player.embarked[seaZoneId] || 0;
  const freeCapacity = capacity - used;
  if (freeCapacity <= 0) {
    addEvent(state, player.id, 'Embarque inválido: esquadra sem capacidade.', 'info');
    return;
  }

  const toEmbark = Math.min(count, available, freeCapacity);
  if (toEmbark <= 0) return;

  player.armies[territoryId] -= toEmbark;
  if (player.armies[territoryId] <= 0) delete player.armies[territoryId];
  player.embarked[seaZoneId] = used + toEmbark;

  addEvent(state, player.id, `Embarcou ${toEmbark} exército(s) em ${sea.name}`, 'move');
}

/**
 * Disembark armies from the fleet in a sea zone onto an adjacent coastal
 * territory the player controls (or that is empty of enemies).
 * TODO: confirmar regra original — desembarque em território inimigo (invasão anfíbia).
 */
function disembark(state: GameState, seaZoneId: string, territoryId: string, count: number): void {
  const player = state.players[state.turn.currentPlayer];
  const territory = state.territories[territoryId];
  const sea = state.seaZones[seaZoneId];

  if (!territory || !sea) return;
  if (!sea.adjacentTerritories.includes(territoryId)) {
    addEvent(state, player.id, 'Desembarque inválido: território não adjacente.', 'info');
    return;
  }
  if (territory.nuked) {
    addEvent(state, player.id, 'Desembarque inválido: território destruído.', 'info');
    return;
  }
  const embarkedHere = player.embarked[seaZoneId] || 0;
  if (embarkedHere <= 0) {
    addEvent(state, player.id, 'Desembarque inválido: nenhum exército embarcado.', 'info');
    return;
  }
  // Only onto own territory or one without enemy armies (no amphibious assault yet).
  const enemyArmies = Object.entries(state.players).some(
    ([pid, p]) => pid !== player.id && ((p as Player).armies[territoryId] || 0) > 0
  );
  if (territory.owner && territory.owner !== player.id && enemyArmies) {
    addEvent(state, player.id, 'Desembarque inválido: território ocupado por inimigo.', 'info');
    return;
  }

  const toLand = Math.min(count, embarkedHere);
  if (toLand <= 0) return;

  player.embarked[seaZoneId] -= toLand;
  if (player.embarked[seaZoneId] <= 0) delete player.embarked[seaZoneId];
  player.armies[territoryId] = (player.armies[territoryId] || 0) + toLand;

  // Landing on a neutral/empty territory takes control of it (no defenders).
  if (!territory.owner || territory.owner === player.id) {
    territory.owner = player.id;
  }

  addEvent(state, player.id, `Desembarcou ${toLand} exército(s) em ${territory.name}`, 'move');
}

function initiateAttack(state: GameState, from: string, target: string, targetType: 'territory' | 'sea'): void {
  const player = state.players[state.turn.currentPlayer];

  // Attack only allowed in stage 4
  if (state.turn.stage !== 4) {
    addEvent(state, player.id, 'Ataque só é permitido na fase de Combate (Estágio 4).', 'info');
    return;
  }

  // One attack per origin (territory/sea zone) per turn
  if (state.turn.attackedFrom.includes(from)) {
    addEvent(state, player.id, 'Esta origem já atacou neste turno.', 'info');
    return;
  }

  // Check supply cost (1 of each resource per battle)
  if (player.supplies.grain < RULES.COMBAT_SUPPLY_COST ||
      player.supplies.oil < RULES.COMBAT_SUPPLY_COST ||
      player.supplies.mineral < RULES.COMBAT_SUPPLY_COST) {
    addEvent(state, player.id, 'Suprimentos insuficientes para atacar.', 'info');
    return;
  }

  let defenderId: SuperpowerId | null = null;
  let attackerUnits = 0;
  let defenderUnits = 0;

  if (targetType === 'territory') {
    const territory = state.territories[target];
    if (!territory) return;

    // Adjacency check — engine enforces what the UI already filters
    const fromTerritory = state.territories[from];
    if (!fromTerritory || !fromTerritory.adjacentTerritories.includes(target)) {
      addEvent(state, player.id, 'Ataque inválido: território alvo não é adjacente.', 'info');
      return;
    }

    for (const [pid, p] of Object.entries(state.players) as [SuperpowerId, Player][]) {
      if (pid === player.id) continue;
      if ((p.armies[target] || 0) > 0) { defenderId = pid; break; }
    }
    // If no armies but territory has an owner, the owner defends
    if (!defenderId && territory.owner && territory.owner !== player.id) {
      defenderId = territory.owner;
    }
    if (!defenderId) return;
    attackerUnits = player.armies[from] || 0;
    defenderUnits = state.players[defenderId].armies[target] || 0;
  } else {
    // Naval combat — the defender holds navies in the target sea zone
    const sea = state.seaZones[target];
    if (!sea) return;

    // Adjacency check for naval combat
    const fromSea = state.seaZones[from];
    if (!fromSea || !fromSea.adjacentSeas.includes(target)) {
      addEvent(state, player.id, 'Ataque naval inválido: zona alvo não é adjacente.', 'info');
      return;
    }

    for (const [pid, p] of Object.entries(state.players) as [SuperpowerId, Player][]) {
      if (pid === player.id) continue;
      if ((p.navies[target] || 0) > 0) { defenderId = pid; break; }
    }
    if (!defenderId) return;
    attackerUnits = player.navies[from] || 0;
    defenderUnits = state.players[defenderId].navies[target] || 0;
  }

  state.combat = {
    active: true,
    attackerId: player.id,
    defenderId,
    fromId: from,
    targetId: target,
    targetType,
    attackerUnits,
    defenderUnits,
    attackerUnitsAfter: 0,
    defenderUnitsAfter: 0,
    conquered: false,
    attackerDice: [],
    defenderDice: [],
    attackerLosses: 0,
    defenderLosses: 0,
    phase: 'confirm',
    defenderChoice: null,
  };
}

function rollCombat(state: GameState): void {
  if (!state.combat.active || !state.combat.attackerId || !state.combat.defenderId) return;

  const attacker = state.players[state.combat.attackerId];
  const defender = state.players[state.combat.defenderId];

  // Pay supply cost
  attacker.supplies.grain -= RULES.COMBAT_SUPPLY_COST;
  attacker.supplies.oil -= RULES.COMBAT_SUPPLY_COST;
  attacker.supplies.mineral -= RULES.COMBAT_SUPPLY_COST;

  const defenderHasSupplies = defender.supplies.grain >= RULES.COMBAT_SUPPLY_COST &&
    defender.supplies.oil >= RULES.COMBAT_SUPPLY_COST &&
    defender.supplies.mineral >= RULES.COMBAT_SUPPLY_COST;

  if (defenderHasSupplies) {
    defender.supplies.grain -= RULES.COMBAT_SUPPLY_COST;
    defender.supplies.oil -= RULES.COMBAT_SUPPLY_COST;
    defender.supplies.mineral -= RULES.COMBAT_SUPPLY_COST;
  }

  // Calculate dice
  let attackerDiceCount: number = RULES.ATTACKER_BASE_DICE;
  let defenderDiceCount: number = defenderHasSupplies ? RULES.DEFENDER_BASE_DICE : RULES.DEFENDER_NO_SUPPLY_DICE;

  // Majority bonus
  if (state.combat.attackerUnits > state.combat.defenderUnits) attackerDiceCount += RULES.BONUS_DICE_MAJORITY;
  if (state.combat.defenderUnits > state.combat.attackerUnits) defenderDiceCount += RULES.BONUS_DICE_MAJORITY;

  // Laser-Star bonus
  if (attacker.laserStars > defender.laserStars) attackerDiceCount += RULES.BONUS_DICE_LASER_STAR;
  if (defender.laserStars > attacker.laserStars) defenderDiceCount += RULES.BONUS_DICE_LASER_STAR;

  attackerDiceCount = Math.min(attackerDiceCount, RULES.MAX_DICE);
  defenderDiceCount = Math.min(defenderDiceCount, RULES.MAX_DICE);

  const attackerDice = rollDice(attackerDiceCount);
  const defenderDice = rollDice(defenderDiceCount);

  const attackerTotal = sumDice(attackerDice);
  const defenderTotal = sumDice(defenderDice);

  const defenderLosses = Math.floor(attackerTotal / RULES.CASUALTIES_PER_POINTS);
  const attackerLosses = Math.floor(defenderTotal / RULES.CASUALTIES_PER_POINTS);

  state.combat.attackerDice = attackerDice;
  state.combat.defenderDice = defenderDice;
  state.combat.attackerLosses = attackerLosses;
  state.combat.defenderLosses = defenderLosses;
  state.combat.phase = 'result';

  // Apply losses to the correct force pool, using the recorded origin (fromId)
  const targetId = state.combat.targetId!;
  const fromId = state.combat.fromId;

  // Mark this origin as having attacked this turn (one attack per origin)
  if (fromId && !state.turn.attackedFrom.includes(fromId)) {
    state.turn.attackedFrom.push(fromId);
  }

  if (state.combat.targetType === 'territory') {
    if (fromId) {
      attacker.armies[fromId] = Math.max(0, (attacker.armies[fromId] || 0) - attackerLosses);
      if (attacker.armies[fromId] <= 0) delete attacker.armies[fromId];
    }
    defender.armies[targetId] = Math.max(0, (defender.armies[targetId] || 0) - defenderLosses);
    if (defender.armies[targetId] <= 0) delete defender.armies[targetId];
  } else {
    if (fromId) {
      attacker.navies[fromId] = Math.max(0, (attacker.navies[fromId] || 0) - attackerLosses);
      if (attacker.navies[fromId] <= 0) delete attacker.navies[fromId];
      dropOverCapacityEmbarked(attacker, fromId);
    }
    defender.navies[targetId] = Math.max(0, (defender.navies[targetId] || 0) - defenderLosses);
    if (defender.navies[targetId] <= 0) delete defender.navies[targetId];
    dropOverCapacityEmbarked(defender, targetId);
  }

  // Track post-combat unit counts for display
  const attackerAfter = state.combat.targetType === 'territory'
    ? (fromId ? (attacker.armies[fromId] || 0) : 0)
    : (fromId ? (attacker.navies[fromId] || 0) : 0);
  const defenderAfter = state.combat.targetType === 'territory'
    ? (defender.armies[targetId] || 0)
    : (defender.navies[targetId] || 0);
  state.combat.attackerUnitsAfter = attackerAfter;
  state.combat.defenderUnitsAfter = defenderAfter;

  const fromName = state.combat.targetType === 'territory'
    ? state.territories[fromId || '']?.name
    : state.seaZones[fromId || '']?.name;
  const targetName = state.combat.targetType === 'territory'
    ? state.territories[targetId]?.name
    : state.seaZones[targetId]?.name;
  addEvent(state, attacker.id,
    `${fromName}→${targetName}: [${attackerDice.join(',')}]=${attackerTotal} vs [${defenderDice.join(',')}]=${defenderTotal} — baixas atk -${attackerLosses} def -${defenderLosses}`,
    'combat'
  );

  // Only land territories can be occupied; naval battles just resolve.
  if (state.combat.targetType === 'territory') {
    if (defenderAfter <= 0) {
      // Pyrrhic: if attacker also wiped out, no occupation possible
      if (attackerAfter > 0) {
        state.combat.phase = 'occupy';
      }
      // else: both wiped out → stays at 'result', territory uncontested but attacker can't advance
    }
  }
}

function resetCombat(state: GameState): void {
  state.combat = {
    active: false, attackerId: null, defenderId: null, fromId: null, targetId: null,
    targetType: 'territory', attackerUnits: 0, defenderUnits: 0,
    attackerUnitsAfter: 0, defenderUnitsAfter: 0, conquered: false,
    attackerDice: [], defenderDice: [], attackerLosses: 0, defenderLosses: 0,
    phase: 'select_target', defenderChoice: null,
  };
}

function occupyTerritory(state: GameState, count: number = 1): void {
  if (!state.combat.active) return;
  const combat = state.combat;

  // Naval battles are never "occupied" — just close out the combat.
  if (combat.targetType === 'sea' || !combat.attackerId || !combat.targetId) {
    resetCombat(state);
    return;
  }

  const attacker = state.players[combat.attackerId];
  const targetId = combat.targetId;
  const territory = state.territories[targetId];

  // Only occupy when the territory is actually cleared of all enemy armies.
  // (Defender survived → "Encerrar Combate" just ends it without advancing.)
  const enemyStillThere = Object.entries(state.players).some(
    ([pid, p]) => pid !== attacker.id && ((p as Player).armies[targetId] || 0) > 0
  );
  if (enemyStillThere || !territory) {
    resetCombat(state);
    return;
  }

  // Move armies from the attacking origin into the conquered territory.
  // Per the original rules, normal movement costs (1 cereal/territory) apply.
  // TODO: confirmar regra original para caso sem cereal — por ora avança sem bloquear.
  const fromId = combat.fromId;
  if (fromId) {
    const available = attacker.armies[fromId] || 0;
    const toMove = Math.max(1, Math.min(count, available));
    // Pay grain cost (1 per army moved; territory is always adjacent = 1 hop)
    const grainCost = Math.min(toMove * RULES.LAND_MOVE_GRAIN_COST, attacker.supplies.grain);
    attacker.supplies.grain -= grainCost;

    attacker.armies[fromId] = available - toMove;
    if (attacker.armies[fromId] <= 0) delete attacker.armies[fromId];
    attacker.armies[targetId] = (attacker.armies[targetId] || 0) + toMove;
  }

  // Transfer territory ownership
  const previousOwner = territory.owner;
  territory.owner = attacker.id;
  state.combat.conquered = true;

  // Capture resource cards in this territory
  if (previousOwner) {
    const prevPlayer = state.players[previousOwner];
    const cardsInTerritory = prevPlayer.resourceCards.filter(cid => state.resourceCards[cid]?.territoryId === targetId);
    for (const cid of cardsInTerritory) {
      prevPlayer.resourceCards = prevPlayer.resourceCards.filter(id => id !== cid);
      attacker.resourceCards.push(cid);
      state.resourceCards[cid].ownerId = attacker.id;
    }

    // Check elimination (last homeland captured)
    const remainingHomeTerritories = Object.values(state.territories).filter(
      t => t.superpowerId === previousOwner && t.owner === previousOwner && !t.nuked
    );
    if (remainingHomeTerritories.length === 0) {
      eliminatePlayer(state, previousOwner, attacker.id);
    }
  }

  const movedCount = fromId ? (attacker.armies[targetId] || 0) : 1;
  addEvent(state, attacker.id, `Ocupou ${territory.name} com ${movedCount} exército(s)`, 'combat');
  resetCombat(state);
}

function eliminatePlayer(state: GameState, eliminatedId: SuperpowerId, conqueredBy: SuperpowerId): void {
  const eliminated = state.players[eliminatedId];
  const conqueror = state.players[conqueredBy];

  // Transfer assets
  conqueror.money += eliminated.money;
  conqueror.nukes += eliminated.nukes;
  conqueror.laserStars += eliminated.laserStars;
  conqueror.supplies.grain += eliminated.supplies.grain;
  conqueror.supplies.oil += eliminated.supplies.oil;
  conqueror.supplies.mineral += eliminated.supplies.mineral;

  // Transfer resource cards
  for (const cid of eliminated.resourceCards) {
    conqueror.resourceCards.push(cid);
    state.resourceCards[cid].ownerId = conqueredBy;
  }

  // Transfer armies and navies
  for (const [t, count] of Object.entries(eliminated.armies)) {
    conqueror.armies[t] = (conqueror.armies[t] || 0) + count;
  }
  for (const [s, count] of Object.entries(eliminated.navies)) {
    conqueror.navies[s] = (conqueror.navies[s] || 0) + count;
  }
  for (const [s, count] of Object.entries(eliminated.embarked)) {
    conqueror.embarked[s] = (conqueror.embarked[s] || 0) + count;
  }

  // Transfer territory ownership so the map reflects the new controller
  for (const t of Object.values(state.territories)) {
    if (t.owner === eliminatedId) t.owner = conqueredBy;
  }

  eliminated.isEliminated = true;
  eliminated.money = 0;
  eliminated.nukes = 0;
  eliminated.laserStars = 0;
  eliminated.supplies = { grain: 0, oil: 0, mineral: 0 };
  eliminated.resourceCards = [];
  eliminated.armies = {};
  eliminated.navies = {};
  eliminated.embarked = {};

  addEvent(state, conqueredBy, `${eliminated.name} foi eliminada! Ativos transferidos.`, 'elimination');

  // Check victory
  const activePlayers = Object.values(state.players).filter(p => !p.isEliminated);
  if (activePlayers.length === 1) {
    state.gameOver = true;
    state.winner = activePlayers[0].id;
    state.endCondition = 'supremacy';
  }
}

function launchNuke(state: GameState, target: string, targetType: 'territory' | 'sea'): void {
  const player = state.players[state.turn.currentPlayer];
  if (player.nukes <= 0) return;

  player.nukes--;

  state.nuclearAttack = {
    active: true,
    attackerId: player.id,
    targetId: target,
    targetType,
    laserStarDefense: false,
    defenseRolls: [],
    intercepted: false,
    phase: 'confirm',
  };

  // Check if defender has Laser-Stars
  if (targetType === 'territory') {
    const territory = state.territories[target];
    if (territory?.owner && territory.owner !== player.id) {
      const defender = state.players[territory.owner];
      if (defender.laserStars > 0) {
        state.nuclearAttack.laserStarDefense = true;
        state.nuclearAttack.phase = 'defense';
      }
    }
  }
}

function defendNuke(state: GameState): void {
  if (!state.nuclearAttack.active || !state.nuclearAttack.targetId) return;

  const targetId = state.nuclearAttack.targetId;
  const territory = state.territories[targetId];
  if (!territory?.owner) return;

  const defender = state.players[territory.owner];
  const rolls: number[] = [];

  for (let i = 0; i < defender.laserStars; i++) {
    const roll = rollDice(1)[0];
    rolls.push(roll);
    if (roll <= 5) {
      // Intercepted!
      state.nuclearAttack.intercepted = true;
      state.nuclearAttack.defenseRolls = rolls;
      state.nuclearAttack.phase = 'result';
      addEvent(state, defender.id, `Laser-Star interceptou bomba nuclear! (rolou ${roll})`, 'nuclear');
      return;
    }
  }

  state.nuclearAttack.defenseRolls = rolls;
  state.nuclearAttack.phase = 'result';
}

function resolveNuke(state: GameState): void {
  if (!state.nuclearAttack.active || !state.nuclearAttack.targetId || !state.nuclearAttack.attackerId) return;

  if (state.nuclearAttack.intercepted) {
    addEvent(state, state.nuclearAttack.attackerId, 'Bomba nuclear interceptada por Laser-Star!', 'nuclear');
    resetNuclearState(state);
    return;
  }

  const targetId = state.nuclearAttack.targetId;
  const attacker = state.players[state.nuclearAttack.attackerId];

  if (state.nuclearAttack.targetType === 'territory') {
    const territory = state.territories[targetId];
    territory.nuked = true;
    state.nukedTerritoryCount++;

    // Destroy all units and companies in territory
    for (const player of Object.values(state.players)) {
      if (player.armies[targetId]) {
        delete player.armies[targetId];
      }
      // Return resource cards to deck
      const cardsInTerritory = player.resourceCards.filter(cid => state.resourceCards[cid]?.territoryId === targetId);
      for (const cid of cardsInTerritory) {
        player.resourceCards = player.resourceCards.filter(id => id !== cid);
        state.resourceCards[cid].ownerId = null;
        state.resourceDeck.push(cid);
      }
    }

    territory.owner = null;
    addEvent(state, attacker.id, `BOMBA NUCLEAR em ${territory.name}! Território destruído.`, 'nuclear');

    // Check holocaust
    if (state.nukedTerritoryCount >= RULES.HOLOCAUST_THRESHOLD) {
      state.gameOver = true;
      state.winner = null;
      state.endCondition = 'holocaust';
      addEvent(state, attacker.id, 'HOLOCAUSTO NUCLEAR! Todos perdem.', 'nuclear');
    }

    // Check if this eliminates a player (last homeland destroyed)
    for (const player of Object.values(state.players)) {
      if (player.isEliminated) continue;
      const homelands = Object.values(state.territories).filter(
        t => t.superpowerId === player.id && !t.nuked
      );
      if (homelands.length === 0) {
        // Nuclear elimination - assets go to bank/deck
        player.isEliminated = true;
        player.money = 0;
        player.nukes = 0;
        player.laserStars = 0;
        for (const cid of player.resourceCards) {
          state.resourceCards[cid].ownerId = null;
          state.resourceDeck.push(cid);
        }
        player.resourceCards = [];
        player.armies = {};
        player.navies = {};
        player.embarked = {};
        addEvent(state, player.id, `${player.name} eliminada por destruição nuclear total!`, 'elimination');
      }
    }
  } else {
    // Sea zone nuke - destroy all navies AND any armies embarked aboard them
    for (const player of Object.values(state.players)) {
      if (player.navies[targetId]) {
        delete player.navies[targetId];
      }
      if (player.embarked[targetId]) {
        delete player.embarked[targetId];
      }
    }
    addEvent(state, attacker.id, `BOMBA NUCLEAR no mar ${state.seaZones[targetId]?.name}!`, 'nuclear');
  }

  resetNuclearState(state);
}

function resetNuclearState(state: GameState): void {
  state.nuclearAttack = {
    active: false, attackerId: null, targetId: null, targetType: 'territory',
    laserStarDefense: false, defenseRolls: [], intercepted: false, phase: 'select_target',
  };
}

function buildNuke(state: GameState): void {
  const player = state.players[state.turn.currentPlayer];
  if (!player.hasResearchedNuke) return;
  if (player.nukes >= RULES.MAX_NUKES) return;
  if (player.money < RULES.NUKE_COST) return;
  if (player.supplies.mineral < RULES.NUKE_MINERAL_COST) return;

  player.money -= RULES.NUKE_COST;
  player.supplies.mineral -= RULES.NUKE_MINERAL_COST;
  player.nukes++;
  addEvent(state, player.id, `Construiu bomba atômica (total: ${player.nukes})`, 'build');
}

function buildLaserStar(state: GameState): void {
  const player = state.players[state.turn.currentPlayer];
  if (!player.hasResearchedLaserStar) return;
  if (player.laserStars >= RULES.MAX_LASER_STARS) return;
  if (player.money < RULES.LASER_STAR_COST) return;
  if (player.supplies.mineral < RULES.LASER_STAR_MINERAL_COST) return;

  player.money -= RULES.LASER_STAR_COST;
  player.supplies.mineral -= RULES.LASER_STAR_MINERAL_COST;
  player.laserStars++;
  addEvent(state, player.id, `Construiu Laser-Star (total: ${player.laserStars})`, 'build');
}

function researchNuke(state: GameState, cardId: string): void {
  const player = state.players[state.turn.currentPlayer];
  if (player.hasResearchedNuke) return;
  if (player.money < RULES.RESEARCH_COST_PER_CARD) return;

  player.money -= RULES.RESEARCH_COST_PER_CARD;

  // Simulate finding a nuke card in the deck (simplified)
  // In the real game, you flip cards paying per flip until you find a nuke
  // Here we simplify: 33% chance per attempt (3 nuke cards in ~60 card deck)
  const found = Math.random() < 0.33;
  if (found) {
    player.hasResearchedNuke = true;
    let built = false;
    if (player.money >= RULES.NUKE_COST && player.supplies.mineral >= RULES.NUKE_MINERAL_COST) {
      player.money -= RULES.NUKE_COST;
      player.supplies.mineral -= RULES.NUKE_MINERAL_COST;
      player.nukes++;
      built = true;
    }
    addEvent(state, player.id, built
      ? 'Pesquisa nuclear concluída! Primeira bomba construída.'
      : 'Pesquisa nuclear concluída! (recursos insuficientes para construir a bomba agora)', 'build');
    state.drawnCard = {
      active: true,
      type: 'nuke',
      success: true,
      cardName: 'Ogiva Nuclear',
      cardEffect: built
        ? 'Tecnologia desbloqueada! Primeira bomba construída automaticamente.'
        : 'Tecnologia desbloqueada! Construa sua primeira bomba na fase de Construção.',
      context: 'Pesquisa de Bomba Atômica',
    };
  } else {
    addEvent(state, player.id, 'Pesquisa nuclear: carta virada, bomba não encontrada.', 'build');
    state.drawnCard = {
      active: true,
      type: 'nuke',
      success: false,
      cardName: 'Carta de Recurso',
      cardEffect: 'Nenhuma ogiva nuclear neste baralho. Tente novamente.',
      context: 'Pesquisa de Bomba Atômica',
    };
  }
}

function researchLaserStar(state: GameState, cardId: string): void {
  const player = state.players[state.turn.currentPlayer];
  if (player.hasResearchedLaserStar) return;
  if (player.money < RULES.RESEARCH_COST_PER_CARD) return;

  player.money -= RULES.RESEARCH_COST_PER_CARD;

  const found = Math.random() < 0.25; // 2 L-star cards in ~60 card deck
  if (found) {
    player.hasResearchedLaserStar = true;
    let built = false;
    if (player.money >= RULES.LASER_STAR_COST && player.supplies.mineral >= RULES.LASER_STAR_MINERAL_COST) {
      player.money -= RULES.LASER_STAR_COST;
      player.supplies.mineral -= RULES.LASER_STAR_MINERAL_COST;
      player.laserStars++;
      built = true;
    }
    addEvent(state, player.id, 'Pesquisa Laser-Star concluída!', 'build');
    state.drawnCard = {
      active: true,
      type: 'laser',
      success: true,
      cardName: 'Estrela Laser',
      cardEffect: built
        ? 'Guerra nas Estrelas desbloqueada! Primeira Laser-Star construída automaticamente.'
        : 'Guerra nas Estrelas desbloqueada! Construa sua Laser-Star na fase de Construção.',
      context: 'Pesquisa de Guerra nas Estrelas',
    };
  } else {
    addEvent(state, player.id, 'Pesquisa Laser-Star: carta virada, não encontrada.', 'build');
    state.drawnCard = {
      active: true,
      type: 'laser',
      success: false,
      cardName: 'Carta de Recurso',
      cardEffect: 'Nenhuma Estrela Laser neste baralho. Tente novamente.',
      context: 'Pesquisa de Guerra nas Estrelas',
    };
  }
}

function takeLoan(state: GameState, amount: number): void {
  const player = state.players[state.turn.currentPlayer];
  const loanAmount = Math.floor(amount / RULES.LOAN_MULTIPLE) * RULES.LOAN_MULTIPLE;
  if (loanAmount <= 0) return;

  player.money += loanAmount;
  player.loans += loanAmount;
  addEvent(state, player.id, `Empréstimo de ${loanAmount.toLocaleString()} tomado. Dívida total: ${player.loans.toLocaleString()}`, 'economy');
}

function payLoan(state: GameState, amount: number): void {
  const player = state.players[state.turn.currentPlayer];
  const payment = Math.min(amount, player.loans, player.money);
  if (payment <= 0) return;

  player.money -= payment;
  player.loans -= payment;
  addEvent(state, player.id, `Pagou ${payment.toLocaleString()} de empréstimo. Dívida restante: ${player.loans.toLocaleString()}`, 'economy');
}

function calculateWealth(state: GameState, playerId: SuperpowerId): number {
  const player = state.players[playerId];
  let wealth = player.money;
  wealth += player.supplies.grain * state.market.prices.grain;
  wealth += player.supplies.oil * state.market.prices.oil;
  wealth += player.supplies.mineral * state.market.prices.mineral;
  wealth += player.resourceCards.length * RULES.WEALTH_COMPANY_VALUE;
  wealth += countPlayerUnits(player) * RULES.WEALTH_UNIT_VALUE;
  wealth += player.nukes * RULES.WEALTH_NUKE_VALUE;
  wealth += player.laserStars * RULES.WEALTH_LASER_STAR_VALUE;
  wealth -= player.loans;
  return wealth;
}

// ============================================================
// CPU AI
// ============================================================

function cpuTurn(state: GameState): void {
  const player = state.players[state.turn.currentPlayer];
  if (player.isHuman || player.isEliminated) return;

  // Stage 1: Pay salaries (automatic)
  paySalaries(state);
  state.turn.stage = 2;

  // Stage 2: Transfer production
  transferProduction(state);

  // CPU chooses up to 3 optional stages
  const optionalChoices: TurnStage[] = [];

  // Always try to sell if has excess resources
  const totalSupplies = player.supplies.grain + player.supplies.oil + player.supplies.mineral;
  if (totalSupplies > 6) {
    optionalChoices.push(3);
  }

  // Build if has money and supplies
  if (player.money > 5000 && player.supplies.grain >= 1 && player.supplies.oil >= 1 && player.supplies.mineral >= 1) {
    optionalChoices.push(6);
  }

  // Buy resources if low
  if (player.supplies.grain < 2 || player.supplies.oil < 2 || player.supplies.mineral < 2) {
    if (player.money > 10000) {
      optionalChoices.push(7);
    }
  }

  // Attack if strong enough (not on first turn)
  if (!state.turn.isFirstTurn && optionalChoices.length < RULES.MAX_OPTIONAL_STAGES) {
    const canAttack = checkCpuAttackOpportunity(state, player);
    if (canAttack && !optionalChoices.includes(4)) {
      optionalChoices.push(4);
    }
  }

  // Execute chosen stages
  const sorted = optionalChoices.sort((a, b) => a - b).slice(0, RULES.MAX_OPTIONAL_STAGES);

  for (const stage of sorted) {
    state.turn.optionalStagesUsed.push(stage);
    state.turn.stage = stage;

    switch (stage) {
      case 3: // Sell
        cpuSell(state, player);
        break;
      case 4: // Attack
        cpuAttack(state, player);
        break;
      case 6: // Build
        cpuBuild(state, player);
        break;
      case 7: // Buy
        cpuBuy(state, player);
        break;
    }
  }

  // Research nukes if affordable and not yet researched
  if (!player.hasResearchedNuke && player.money > 15000 && sorted.includes(6)) {
    researchNuke(state, '');
  }

  // End turn
  advanceToNextPlayer(state);
}

function checkCpuAttackOpportunity(state: GameState, player: typeof state.players[SuperpowerId]): boolean {
  for (const [territoryId, armyCount] of Object.entries(player.armies)) {
    if (armyCount < 2) continue;
    const territory = state.territories[territoryId];
    if (!territory) continue;

    for (const adjId of territory.adjacentTerritories) {
      const adjTerritory = state.territories[adjId];
      if (!adjTerritory || adjTerritory.nuked) continue;
      if (adjTerritory.owner === player.id) continue;

      // Check enemy forces
      let enemyForces = 0;
      for (const [pid, p] of Object.entries(state.players)) {
        if (pid === player.id) continue;
        enemyForces += (p as any).armies[adjId] || 0;
      }

      if (armyCount > enemyForces + 1) return true;
    }
  }
  return false;
}

function cpuSell(state: GameState, player: typeof state.players[SuperpowerId]): void {
  // Sell excess resources (keep at least 2 of each)
  const resources: ResourceType[] = ['grain', 'oil', 'mineral'];
  for (const r of resources) {
    if (player.supplies[r] > 4) {
      sellResource(state, r, player.supplies[r] - 3);
    }
  }
}

interface CpuAttackResult {
  fromId: string;
  targetId: string;
  fromName: string;
  targetName: string;
  defenderName: string;
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  attackerUnitsInitial: number;
  defenderUnitsInitial: number;
  attackerUnitsAfter: number;
  defenderUnitsAfter: number;
  conquered: boolean;
}

function cpuAttack(state: GameState, player: typeof state.players[SuperpowerId]): CpuAttackResult | null {
  if (player.supplies.grain < 1 || player.supplies.oil < 1 || player.supplies.mineral < 1) return null;

  for (const [territoryId, armyCount] of Object.entries(player.armies)) {
    if (armyCount < 3) continue;
    const territory = state.territories[territoryId];
    if (!territory) continue;

    for (const adjId of territory.adjacentTerritories) {
      const adjTerritory = state.territories[adjId];
      if (!adjTerritory || adjTerritory.nuked) continue;
      if (adjTerritory.owner === player.id) continue;

      let enemyForces = 0;
      let defenderId: SuperpowerId | null = null;
      for (const [pid, p] of Object.entries(state.players)) {
        if (pid === player.id) continue;
        const forces = (p as Player).armies[adjId] || 0;
        if (forces > 0) { enemyForces += forces; defenderId = pid as SuperpowerId; }
      }

      if (armyCount > enemyForces + 1 && defenderId) {
        const attackerUnitsInitial = armyCount;
        const defenderUnitsInitial = enemyForces;

        // Use the same shared path as the human player
        initiateAttack(state, territoryId, adjId, 'territory');
        if (!state.combat.active) return null;
        rollCombat(state);

        const result: CpuAttackResult = {
          fromId: territoryId,
          targetId: adjId,
          fromName: territory.name,
          targetName: adjTerritory.name,
          defenderName: SUPERPOWERS[defenderId]?.shortName ?? 'desconhecido',
          attackerDice: [...state.combat.attackerDice],
          defenderDice: [...state.combat.defenderDice],
          attackerLosses: state.combat.attackerLosses,
          defenderLosses: state.combat.defenderLosses,
          attackerUnitsInitial,
          defenderUnitsInitial,
          attackerUnitsAfter: state.combat.attackerUnitsAfter,
          defenderUnitsAfter: state.combat.defenderUnitsAfter,
          conquered: false,
        };

        if (state.combat.phase === 'occupy') {
          occupyTerritory(state, 1); // AI always advances 1 army
          result.conquered = state.territories[adjId]?.owner === player.id;
        } else {
          resetCombat(state);
        }
        return result; // One attack per turn for CPU
      }
    }
  }
  return null;
}

function cpuBuild(state: GameState, player: typeof state.players[SuperpowerId]): void {
  // Build armies in home territories
  const setsAvailable = Math.min(player.supplies.grain, player.supplies.oil, player.supplies.mineral);
  const moneyForUnits = Math.floor(player.money / RULES.UNIT_COST);
  const maxUnits = Math.min(setsAvailable * RULES.UNITS_PER_SUPPLY_SET, moneyForUnits);

  if (maxUnits <= 0) return;

  const units: Array<{ type: UnitType; locationId: string }> = [];
  const homeTs = Object.values(state.territories)
    .filter(t => t.superpowerId === player.id && !t.nuked && t.owner === player.id);

  if (homeTs.length === 0) return;

  for (let i = 0; i < Math.min(maxUnits, 3); i++) {
    const t = homeTs[i % homeTs.length];
    units.push({ type: 'army', locationId: t.id });
  }

  // Maintain a small naval presence if the CPU controls a port (keeps naval
  // combat two-sided). Swaps one planned army for a navy until it holds a few.
  const navyCount = Object.values(player.navies).reduce((a: number, b: number) => a + b, 0);
  const portT = homeTs.find(t => t.hasPort && t.adjacentSeas.length > 0);
  if (portT && navyCount < 3 && units.length > 0) {
    units[units.length - 1] = { type: 'navy', locationId: portT.adjacentSeas[0] };
  }

  if (units.length > 0) {
    buildUnits(state, units);
  }
}

function cpuBuy(state: GameState, player: typeof state.players[SuperpowerId]): void {
  const resources: ResourceType[] = ['grain', 'oil', 'mineral'];
  for (const r of resources) {
    if (player.supplies[r] < 3 && player.money > state.market.prices[r] * 2) {
      buyResource(state, r, 2);
    }
  }
}

// ============================================================
// TURN PRESENTATION LAYER — AI Planner
// Runs AI logic on a clone of the game state, collecting
// PlannedStep[] (event + snapshot) for sequential visual replay.
// The real game state is only mutated one step at a time via
// APPLY_AI_STEP, keeping the presentation and game state in sync.
// ============================================================

export function planAiTurn(initialState: GameState): PlannedStep[] {
  const steps: PlannedStep[] = [];
  const state = JSON.parse(JSON.stringify(initialState)) as GameState;
  const playerId = state.turn.currentPlayer;
  const player = state.players[playerId];
  if (player.isHuman || player.isEliminated) return steps;

  const sp = SUPERPOWERS[playerId];
  const STEP_MS = 3000; // 3 s per announcement (matches user expectation)

  // Snapshot the working clone — drawnCard excluded from intermediate steps
  // to prevent modals from re-opening when steps are replayed.
  const snap = (): GameState => {
    const s = JSON.parse(JSON.stringify(state)) as GameState;
    s.drawnCard = null;
    return s;
  };

  const pushStep = (partial: Omit<PlayerActionEvent, 'id' | 'playerId' | 'playerName' | 'playerType'>): void => {
    steps.push({
      event: {
        id: nanoid(8),
        playerId,
        playerName: sp.name,
        playerType: 'ai',
        ...partial,
      } as PlayerActionEvent,
      stateAfter: snap(),
    });
  };

  // ── Stage 1: Pay salaries ────────────────────────────────
  const unitCount =
    Object.values(player.armies).reduce((a: number, b: number) => a + b, 0) +
    Object.values(player.navies).reduce((a: number, b: number) => a + b, 0) +
    Object.values(player.embarked || {}).reduce((a: number, b: number) => a + b, 0);
  const moneyBefore1 = player.money;
  paySalaries(state);
  state.turn.stage = 2;
  const salaryCost = moneyBefore1 - state.players[playerId].money;
  pushStep({
    phase: 1,
    actionType: 'pay_salaries',
    title: 'Pagou salários',
    description: salaryCost > 0
      ? `${salaryCost.toLocaleString()} — ${unitCount} unidades e ${player.resourceCards.length} companhias`
      : 'Nenhum custo de upkeep neste turno.',
    resourceChanges: { money: -salaryCost },
    soundKey: salaryCost > 0 ? 'resource-loss' : undefined,
    durationMs: STEP_MS,
  });

  // ── Stage 2: Transfer production ─────────────────────────
  const supBefore2 = { ...state.players[playerId].supplies };
  transferProduction(state);
  const supAfter2 = state.players[playerId].supplies;
  const grainGained = supAfter2.grain - supBefore2.grain;
  const oilGained = supAfter2.oil - supBefore2.oil;
  const mineralGained = supAfter2.mineral - supBefore2.mineral;
  const totalProduced = grainGained + oilGained + mineralGained;
  pushStep({
    phase: 2,
    actionType: 'transfer_production',
    title: 'Recebeu produção',
    description: totalProduced > 0
      ? `+${grainGained} cereal · +${oilGained} petróleo · +${mineralGained} minério`
      : 'Nenhuma produção disponível neste turno.',
    resourceChanges: { grain: grainGained, oil: oilGained, mineral: mineralGained },
    soundKey: totalProduced > 0 ? 'resource-gain' : undefined,
    durationMs: STEP_MS,
  });

  // ── Choose optional stages (mirrors cpuTurn logic exactly) ─
  const p = state.players[playerId];
  const optionalChoices: TurnStage[] = [];
  const totalSup = p.supplies.grain + p.supplies.oil + p.supplies.mineral;
  if (totalSup > 6) optionalChoices.push(3);
  if (p.money > 5000 && p.supplies.grain >= 1 && p.supplies.oil >= 1 && p.supplies.mineral >= 1) {
    optionalChoices.push(6);
  }
  if ((p.supplies.grain < 2 || p.supplies.oil < 2 || p.supplies.mineral < 2) && p.money > 10000) {
    optionalChoices.push(7);
  }
  if (!state.turn.isFirstTurn && optionalChoices.length < RULES.MAX_OPTIONAL_STAGES) {
    if (checkCpuAttackOpportunity(state, p) && !optionalChoices.includes(4)) {
      optionalChoices.push(4);
    }
  }
  const sorted = optionalChoices.sort((a, b) => a - b).slice(0, RULES.MAX_OPTIONAL_STAGES) as TurnStage[];

  for (const stage of sorted) {
    state.turn.optionalStagesUsed.push(stage);
    state.turn.stage = stage;

    switch (stage) {
      case 3: { // Sell — one announcement per resource type
        const resources: ResourceType[] = ['grain', 'oil', 'mineral'];
        const RESOURCE_PT: Record<ResourceType, string> = { grain: 'Cereal', oil: 'Petróleo', mineral: 'Minério' };
        for (const r of resources) {
          if (state.players[playerId].supplies[r] > 4) {
            const qty = state.players[playerId].supplies[r] - 3;
            const moneyBefore = state.players[playerId].money;
            sellResource(state, r, qty);
            const revenue = state.players[playerId].money - moneyBefore;
            pushStep({
              phase: 3,
              actionType: 'sell_resource',
              title: `Vendeu ${qty} ${RESOURCE_PT[r]}`,
              description: `Recebeu ${revenue.toLocaleString()} no mercado`,
              resourceChanges: { money: revenue, [r]: -qty },
              soundKey: 'resource-gain',
              durationMs: STEP_MS,
            });
          }
        }
        break;
      }

      case 4: { // Attack — cpuAttack returns full result for rich presentation
        const attackResult = cpuAttack(state, state.players[playerId]);
        if (attackResult) {
          const { fromName, targetName, defenderName, conquered } = attackResult;
          const attackerTotal = attackResult.attackerDice.reduce((a, b) => a + b, 0);
          const defenderTotal = attackResult.defenderDice.reduce((a, b) => a + b, 0);
          pushStep({
            phase: 4,
            actionType: conquered ? 'attack_result_victory' : 'attack_result_defeat',
            title: conquered ? `Conquistou ${targetName}!` : `Ataque em ${targetName} falhou`,
            description: conquered
              ? `[${attackResult.attackerDice.join(',')}]=${attackerTotal} vs [${attackResult.defenderDice.join(',')}]=${defenderTotal} — derrotou ${defenderName}`
              : `[${attackResult.attackerDice.join(',')}]=${attackerTotal} vs [${attackResult.defenderDice.join(',')}]=${defenderTotal} — ${defenderName} resistiu`,
            fromId: attackResult.fromId,
            toId: attackResult.targetId,
            soundKey: conquered ? 'territory-conquered' : 'combat-hit',
            durationMs: STEP_MS,
            combatDetails: {
              fromId: attackResult.fromId,
              toId: attackResult.targetId,
              attackerUnitsInitial: attackResult.attackerUnitsInitial,
              defenderUnitsInitial: attackResult.defenderUnitsInitial,
              attackerDice: attackResult.attackerDice,
              defenderDice: attackResult.defenderDice,
              attackerLosses: attackResult.attackerLosses,
              defenderLosses: attackResult.defenderLosses,
              attackerUnitsAfter: attackResult.attackerUnitsAfter,
              defenderUnitsAfter: attackResult.defenderUnitsAfter,
              conquered,
              defenderName,
            },
          });
        }
        break;
      }

      case 6: { // Build — one announcement per territory/sea zone
        const armiesBefore: Record<string, number> = JSON.parse(JSON.stringify(state.players[playerId].armies));
        const naviesBefore: Record<string, number> = JSON.parse(JSON.stringify(state.players[playerId].navies));
        const moneyBefore6 = state.players[playerId].money;
        cpuBuild(state, state.players[playerId]);
        const moneySpent6 = moneyBefore6 - state.players[playerId].money;

        // Diff armies: which territories got new armies?
        for (const [loc, newCount] of Object.entries(state.players[playerId].armies)) {
          const built = newCount - (armiesBefore[loc] || 0);
          if (built > 0) {
            const tName = state.territories[loc]?.name || loc;
            pushStep({
              phase: 6,
              actionType: 'build_armies',
              title: `Construiu ${built} exército${built > 1 ? 's' : ''}`,
              description: `em ${tName}`,
              toId: loc,
              armyDelta: built,
              resourceChanges: built === Object.values(state.players[playerId].armies).reduce((s: number, v: number) => s + v, 0) - Object.values(armiesBefore).reduce((s: number, v: number) => s + v, 0)
                ? { money: -moneySpent6 } : undefined,
              soundKey: 'resource-gain',
              durationMs: STEP_MS,
            });
          }
        }
        // Diff navies: which sea zones got new fleets?
        for (const [loc, newCount] of Object.entries(state.players[playerId].navies)) {
          const built = newCount - (naviesBefore[loc] || 0);
          if (built > 0) {
            const sName = state.seaZones[loc]?.name || loc;
            pushStep({
              phase: 6,
              actionType: 'build_navies',
              title: `Construiu ${built} esquadra${built > 1 ? 's' : ''}`,
              description: `em ${sName}`,
              toId: loc,
              navyDelta: built,
              soundKey: 'resource-gain',
              durationMs: STEP_MS,
            });
          }
        }
        break;
      }

      case 7: { // Buy — one announcement per resource type
        const resources7: ResourceType[] = ['grain', 'oil', 'mineral'];
        const RESOURCE_PT7: Record<ResourceType, string> = { grain: 'Cereal', oil: 'Petróleo', mineral: 'Minério' };
        for (const r of resources7) {
          if (state.players[playerId].supplies[r] < 3 && state.players[playerId].money > state.market.prices[r] * 2) {
            const supBefore = state.players[playerId].supplies[r];
            const moneyBefore = state.players[playerId].money;
            buyResource(state, r, 2);
            const bought = state.players[playerId].supplies[r] - supBefore;
            const spent = moneyBefore - state.players[playerId].money;
            if (bought > 0) {
              pushStep({
                phase: 7,
                actionType: 'buy_resource',
                title: `Comprou ${bought} ${RESOURCE_PT7[r]}`,
                description: `Pagou ${spent.toLocaleString()} no mercado`,
                resourceChanges: { money: -spent, [r]: bought },
                soundKey: 'resource-gain',
                durationMs: STEP_MS,
              });
            }
          }
        }
        break;
      }
    }
  }

  // ── Research nukes (mirrors cpuTurn) ─────────────────────
  if (!player.hasResearchedNuke && state.players[playerId].money > 15000 && sorted.includes(6)) {
    const hadNuke = state.players[playerId].hasResearchedNuke;
    researchNuke(state, '');
    if (!hadNuke && state.players[playerId].hasResearchedNuke) {
      const builtNuke = state.players[playerId].nukes > 0;
      pushStep({
        phase: 6,
        actionType: 'research',
        title: 'Pesquisa Nuclear concluída!',
        description: builtNuke
          ? 'Primeira ogiva nuclear construída'
          : 'Tecnologia nuclear desbloqueada',
        soundKey: 'missile-launch',
        durationMs: STEP_MS,
      });
    }
    state.drawnCard = null;
  }

  // ── End turn ─────────────────────────────────────────────
  advanceToNextPlayer(state);
  steps.push({
    event: {
      id: nanoid(8),
      playerId,
      playerName: sp.name,
      playerType: 'ai',
      phase: 1,
      actionType: 'end_turn',
      title: 'Fim de turno',
      description: `Turno de ${sp.name} concluído`,
      durationMs: 1500,
    } as PlayerActionEvent,
    stateAfter: JSON.parse(JSON.stringify(state)),
  });

  return steps;
}

// ============================================================
// STORE
// ============================================================

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  selectedTerritory: null,
  selectedSeaZone: null,
  uiMode: 'map',

  startGame: (humanPlayer: SuperpowerId, aiCount: number) => {
    const otherIds = shuffleArray(SUPERPOWER_IDS.filter(id => id !== humanPlayer));
    const activeAiIds = otherIds.slice(0, Math.min(aiCount, otherIds.length));
    const game = createInitialGameState(humanPlayer, activeAiIds);
    set({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });
    localStorage.setItem('supremacia_save', JSON.stringify(game));
  },

  dispatch: (action: GameAction) => {
    const { game } = get();
    if (!game || game.gameOver) return;

    // Clone state for immutability
    const state = JSON.parse(JSON.stringify(game)) as GameState;

    switch (action.type) {
      case 'PAY_SALARIES':
        paySalaries(state);
        state.turn.stageComplete = true;
        break;
      case 'TRANSFER_PRODUCTION':
        transferProduction(state);
        state.turn.stageComplete = true;
        break;
      case 'NEXT_STAGE':
        nextStage(state);
        break;
      case 'SKIP_STAGE':
        if (state.turn.stage > 2) {
          nextStage(state);
        }
        break;
      case 'SELECT_OPTIONAL_STAGE':
        selectOptionalStage(state, action.stage);
        break;
      case 'SET_ARMY_PLACEMENT': {
        // Apply the human player's initial army distribution from the setup screen
        const human = Object.values(state.players).find(p => p.isHuman);
        if (human) {
          const newArmies: Record<string, number> = {};
          for (const [tid, count] of Object.entries(action.placement)) {
            if (count > 0 && state.territories[tid]?.owner === human.id) {
              newArmies[tid] = count;
            }
          }
          human.armies = newArmies;
        }
        break;
      }
      case 'END_TURN':
        advanceToNextPlayer(state);
        break;
      case 'SELL_RESOURCE':
        sellResource(state, action.resource, action.quantity);
        break;
      case 'BUY_RESOURCE':
        buyResource(state, action.resource, action.quantity);
        break;
      case 'PROSPECT':
        prospect(state);
        break;
      case 'BUILD_UNITS':
        buildUnits(state, action.units);
        break;
      case 'BUILD_NUKE':
        buildNuke(state);
        break;
      case 'BUILD_LASER_STAR':
        buildLaserStar(state);
        break;
      case 'RESEARCH_NUKE':
        researchNuke(state, action.cardId);
        break;
      case 'RESEARCH_LASER_STAR':
        researchLaserStar(state, action.cardId);
        break;
      case 'MOVE_ARMY':
        moveArmy(state, action.from, action.to, action.count);
        break;
      case 'MOVE_NAVY':
        moveNavy(state, action.from, action.to, action.count);
        break;
      case 'EMBARK':
        embark(state, action.territoryId, action.seaZoneId, action.count);
        break;
      case 'DISEMBARK':
        disembark(state, action.seaZoneId, action.territoryId, action.count);
        break;
      case 'AIRLIFT':
        airlift(state, action.from, action.to, action.count);
        break;
      case 'ATTACK_TERRITORY':
        initiateAttack(state, action.from, action.target, 'territory');
        break;
      case 'ATTACK_SEA':
        initiateAttack(state, action.from, action.target, 'sea');
        break;
      case 'ROLL_COMBAT':
        rollCombat(state);
        break;
      case 'OCCUPY_TERRITORY':
        occupyTerritory(state, action.count ?? 1);
        break;
      case 'LAUNCH_NUKE':
        launchNuke(state, action.target, action.targetType);
        break;
      case 'DEFEND_NUKE':
        defendNuke(state);
        break;
      case 'RESOLVE_NUKE':
        resolveNuke(state);
        break;
      case 'TAKE_LOAN':
        takeLoan(state, action.amount);
        break;
      case 'PAY_LOAN':
        payLoan(state, action.amount);
        break;
      case 'CPU_TURN':
        cpuTurn(state);
        break;
      case 'DISMISS_DRAWN_CARD':
        state.drawnCard = null;
        break;
      case 'APPLY_AI_STEP':
        set({ game: action.state });
        localStorage.setItem('supremacia_save', JSON.stringify(action.state));
        return;
      case 'DECLARE_DETENTE': {
        state.gameOver = true;
        state.endCondition = 'detente';
        // Find richest player
        let maxWealth = -Infinity;
        let winner: SuperpowerId | null = null;
        for (const p of Object.values(state.players)) {
          if (p.isEliminated) continue;
          const w = calculateWealth(state, p.id);
          if (w > maxWealth) { maxWealth = w; winner = p.id; }
        }
        state.winner = winner;
        break;
      }
      case 'LOAD_GAME':
        set({ game: action.state });
        return;
    }

    set({ game: state });
    // Auto-save
    localStorage.setItem('supremacia_save', JSON.stringify(state));
  },

  selectTerritory: (id) => set({ selectedTerritory: id, selectedSeaZone: null }),
  selectSeaZone: (id) => set({ selectedSeaZone: id, selectedTerritory: null }),
  setUiMode: (mode) => set({ uiMode: mode }),

  loadGame: (state: GameState) => {
    // Migrate saves that pre-date the config field
    if (!state.config) {
      state.config = {
        humanPlayers: 1,
        aiPlayers: 5,
        totalActivePlayers: 6,
        maxPlayers: 6,
        multiplayerReady: false,
      };
    }
    // Migrate players that pre-date the type field
    for (const p of Object.values(state.players)) {
      if (!p.type) (p as any).type = p.isHuman ? 'human' : 'ai';
    }
    set({ game: state });
  },

  saveGame: () => {
    const { game } = get();
    if (!game) return '';
    const json = JSON.stringify(game);
    localStorage.setItem('supremacia_save', json);
    return json;
  },
}));
