import { create } from 'zustand';
import { GameState, GameAction, SuperpowerId, ResourceType, TurnStage, EventLogEntry, UnitType } from './types';
import { createInitialGameState } from './setup';
import { RULES } from './rulesConfig';
import { rollDice, sumDice, shuffleArray } from './rng';
import { nanoid } from 'nanoid';

interface GameStore {
  game: GameState | null;
  selectedTerritory: string | null;
  selectedSeaZone: string | null;
  uiMode: 'map' | 'market' | 'build' | 'move' | 'attack' | 'nuclear';

  // Actions
  startGame: (humanPlayer?: SuperpowerId) => void;
  dispatch: (action: GameAction) => void;
  selectTerritory: (id: string | null) => void;
  selectSeaZone: (id: string | null) => void;
  setUiMode: (mode: GameStore['uiMode']) => void;
  loadGame: (state: GameState) => void;
  saveGame: () => string;
}

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



function countPlayerUnits(player: { armies: Record<string, number>; navies: Record<string, number> }): number {
  const armies = Object.values(player.armies).reduce((sum: number, n: number) => sum + n, 0);
  const navies = Object.values(player.navies).reduce((sum: number, n: number) => sum + n, 0);
  return armies + navies;
}

function paySalaries(state: GameState): void {
  const player = state.players[state.turn.currentPlayer];
  const unitCount = countPlayerUnits(player);
  const companyCount = player.resourceCards.length;
  const unitCost = unitCount * RULES.SALARY_PER_UNIT;
  const companyCost = companyCount * RULES.SALARY_PER_COMPANY;
  const loanInterest = Math.floor(player.loans * RULES.LOAN_INTEREST_RATE);
  const totalCost = unitCost + companyCost + loanInterest;

  if (player.money >= totalCost) {
    player.money -= totalCost;
    addEvent(state, player.id, `Pagou salários: ${unitCost.toLocaleString()} (unidades) + ${companyCost.toLocaleString()} (companhias) + ${loanInterest.toLocaleString()} (juros)`, 'economy');
  } else {
    // Pay what can be paid, remove unpaid units
    player.money = 0;
    addEvent(state, player.id, `Fundos insuficientes para salários. Unidades removidas.`, 'economy');
    // Remove some armies proportionally
    const deficit = totalCost - player.money;
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

  let totalRevenue = 0;
  for (let i = 0; i < toSell; i++) {
    totalRevenue += state.market.prices[resource];
    state.market.prices[resource] = Math.max(
      state.market.minPrice,
      state.market.prices[resource] - state.market.priceStep
    );
  }

  player.supplies[resource] -= toSell;
  player.money += totalRevenue;
  addEvent(state, player.id, `Vendeu ${toSell} ${resource} por ${totalRevenue.toLocaleString()}`, 'economy');
}

function buyResource(state: GameState, resource: ResourceType, quantity: number): void {
  const player = state.players[state.turn.currentPlayer];
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
    addEvent(state, player.id, `Comprou ${bought} ${resource} por ${totalCost.toLocaleString()}`, 'economy');
  }
}

function advanceToNextPlayer(state: GameState): void {
  const nextIndex = state.turn.currentPlayerIndex + 1;
  if (nextIndex >= state.turn.playerOrder.length) {
    // New turn
    state.turn.turnNumber++;
    state.turn.currentPlayerIndex = 0;
    state.turn.isFirstTurn = false;
    // Filter eliminated players
    state.turn.playerOrder = state.turn.playerOrder.filter(id => !state.players[id].isEliminated);
    if (state.turn.playerOrder.length <= 1) {
      state.gameOver = true;
      state.winner = state.turn.playerOrder[0] || null;
      state.endCondition = 'supremacy';
      return;
    }
  } else {
    state.turn.currentPlayerIndex = nextIndex;
  }
  state.turn.currentPlayer = state.turn.playerOrder[state.turn.currentPlayerIndex];
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
  return true;
}

function nextStage(state: GameState): void {
  const current = state.turn.stage;
  if (current === 1) {
    state.turn.stage = 2;
  } else if (current === 2) {
    // After mandatory stages, player can choose optional or end turn
    state.turn.stage = 3; // Default to first optional
  } else {
    // Find next available optional stage
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

  if (player.supplies.oil < RULES.SEA_MOVE_OIL_COST) {
    addEvent(state, player.id, 'Petróleo insuficiente para movimento naval.', 'info');
    return;
  }

  player.supplies.oil -= RULES.SEA_MOVE_OIL_COST;
  player.navies[from] -= toMove;
  if (player.navies[from] <= 0) delete player.navies[from];
  player.navies[to] = (player.navies[to] || 0) + toMove;

  addEvent(state, player.id, `Moveu ${toMove} esquadra(s) para ${state.seaZones[to]?.name || to}`, 'move');
}

function initiateAttack(state: GameState, from: string, target: string): void {
  const player = state.players[state.turn.currentPlayer];

  // Check supply cost
  if (player.supplies.grain < RULES.COMBAT_SUPPLY_COST ||
      player.supplies.oil < RULES.COMBAT_SUPPLY_COST ||
      player.supplies.mineral < RULES.COMBAT_SUPPLY_COST) {
    addEvent(state, player.id, 'Suprimentos insuficientes para atacar.', 'info');
    return;
  }

  // Determine defender
  const territory = state.territories[target];
  if (!territory) return;

  let defenderId: SuperpowerId | null = null;
  for (const [pid, p] of Object.entries(state.players)) {
    if (pid === player.id) continue;
    if ((p as any).armies[target] > 0) {
      defenderId = pid as SuperpowerId;
      break;
    }
  }
  // If no armies but territory has owner
  if (!defenderId && territory.owner && territory.owner !== player.id) {
    defenderId = territory.owner;
  }
  if (!defenderId) return;

  const attackerUnits = player.armies[from] || 0;
  const defenderUnits = state.players[defenderId].armies[target] || 0;

  state.combat = {
    active: true,
    attackerId: player.id,
    defenderId,
    targetId: target,
    targetType: 'territory',
    attackerUnits,
    defenderUnits,
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

  // Apply losses
  const targetId = state.combat.targetId!;
  const fromTerritory = Object.keys(attacker.armies).find(t =>
    state.territories[t]?.adjacentTerritories.includes(targetId) && attacker.armies[t] > 0
  );

  if (fromTerritory) {
    attacker.armies[fromTerritory] = Math.max(0, (attacker.armies[fromTerritory] || 0) - attackerLosses);
    if (attacker.armies[fromTerritory] <= 0) delete attacker.armies[fromTerritory];
  }

  defender.armies[targetId] = Math.max(0, (defender.armies[targetId] || 0) - defenderLosses);
  if (defender.armies[targetId] <= 0) delete defender.armies[targetId];

  addEvent(state, attacker.id,
    `Atacou ${state.territories[targetId]?.name}: ${attackerDice.join('+')}=${attackerTotal} vs ${defenderDice.join('+')}=${defenderTotal}. Baixas: atk ${attackerLosses}, def ${defenderLosses}`,
    'combat'
  );

  // Check if defender lost all forces
  if (!defender.armies[targetId] || defender.armies[targetId] <= 0) {
    state.combat.phase = 'occupy';
  }
}

function occupyTerritory(state: GameState): void {
  if (!state.combat.active || !state.combat.attackerId || !state.combat.targetId) return;

  const attacker = state.players[state.combat.attackerId];
  const targetId = state.combat.targetId;
  const territory = state.territories[targetId];

  // Move 1 army into territory
  const fromTerritory = Object.keys(attacker.armies).find(t =>
    state.territories[t]?.adjacentTerritories.includes(targetId) && attacker.armies[t] > 0
  );

  if (fromTerritory && attacker.armies[fromTerritory] > 0) {
    attacker.armies[fromTerritory]--;
    if (attacker.armies[fromTerritory] <= 0) delete attacker.armies[fromTerritory];
    attacker.armies[targetId] = (attacker.armies[targetId] || 0) + 1;
  }

  // Transfer territory ownership
  const previousOwner = territory.owner;
  territory.owner = attacker.id;

  // Capture resource cards in this territory
  if (previousOwner) {
    const prevPlayer = state.players[previousOwner];
    const cardsInTerritory = prevPlayer.resourceCards.filter(cid => state.resourceCards[cid]?.territoryId === targetId);
    for (const cid of cardsInTerritory) {
      prevPlayer.resourceCards = prevPlayer.resourceCards.filter(id => id !== cid);
      attacker.resourceCards.push(cid);
      state.resourceCards[cid].ownerId = attacker.id;
    }

    // Check elimination
    const remainingHomeTerritories = Object.values(state.territories).filter(
      t => t.superpowerId === previousOwner && t.owner === previousOwner && !t.nuked
    );
    if (remainingHomeTerritories.length === 0) {
      eliminatePlayer(state, previousOwner, attacker.id);
    }
  }

  addEvent(state, attacker.id, `Ocupou ${territory.name}`, 'combat');

  // Reset combat
  state.combat = {
    active: false, attackerId: null, defenderId: null, targetId: null,
    targetType: 'territory', attackerUnits: 0, defenderUnits: 0,
    attackerDice: [], defenderDice: [], attackerLosses: 0, defenderLosses: 0,
    phase: 'select_target', defenderChoice: null,
  };
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

  eliminated.isEliminated = true;
  eliminated.money = 0;
  eliminated.nukes = 0;
  eliminated.laserStars = 0;
  eliminated.supplies = { grain: 0, oil: 0, mineral: 0 };
  eliminated.resourceCards = [];
  eliminated.armies = {};
  eliminated.navies = {};

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
        addEvent(state, player.id, `${player.name} eliminada por destruição nuclear total!`, 'elimination');
      }
    }
  } else {
    // Sea zone nuke - destroy all navies there
    for (const player of Object.values(state.players)) {
      if (player.navies[targetId]) {
        delete player.navies[targetId];
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
    if (player.money >= RULES.NUKE_COST && player.supplies.mineral >= RULES.NUKE_MINERAL_COST) {
      player.money -= RULES.NUKE_COST;
      player.supplies.mineral -= RULES.NUKE_MINERAL_COST;
      player.nukes++;
    }
    addEvent(state, player.id, 'Pesquisa nuclear concluída! Primeira bomba construída.', 'build');
  } else {
    addEvent(state, player.id, 'Pesquisa nuclear: carta virada, bomba não encontrada.', 'build');
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
    if (player.money >= RULES.LASER_STAR_COST && player.supplies.mineral >= RULES.LASER_STAR_MINERAL_COST) {
      player.money -= RULES.LASER_STAR_COST;
      player.supplies.mineral -= RULES.LASER_STAR_MINERAL_COST;
      player.laserStars++;
    }
    addEvent(state, player.id, 'Pesquisa Laser-Star concluída!', 'build');
  } else {
    addEvent(state, player.id, 'Pesquisa Laser-Star: carta virada, não encontrada.', 'build');
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
  if (!state.turn.isFirstTurn && optionalChoices.length < 3) {
    const canAttack = checkCpuAttackOpportunity(state, player);
    if (canAttack && !optionalChoices.includes(4)) {
      optionalChoices.push(4);
    }
  }

  // Execute chosen stages
  const sorted = optionalChoices.sort((a, b) => a - b).slice(0, 3);

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

function cpuAttack(state: GameState, player: typeof state.players[SuperpowerId]): void {
  if (player.supplies.grain < 1 || player.supplies.oil < 1 || player.supplies.mineral < 1) return;

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
        const forces = (p as any).armies[adjId] || 0;
        if (forces > 0) {
          enemyForces += forces;
          defenderId = pid as SuperpowerId;
        }
      }

      if (armyCount > enemyForces + 1 && defenderId) {
        // Execute attack directly
        state.combat.attackerId = player.id;
        state.combat.defenderId = defenderId;
        state.combat.targetId = adjId;
        state.combat.attackerUnits = armyCount;
        state.combat.defenderUnits = enemyForces;
        state.combat.active = true;
        rollCombat(state);

        // Auto-occupy if won
        if (state.combat.phase === 'occupy') {
          occupyTerritory(state);
        } else {
          // Reset combat
          state.combat = {
            active: false, attackerId: null, defenderId: null, targetId: null,
            targetType: 'territory', attackerUnits: 0, defenderUnits: 0,
            attackerDice: [], defenderDice: [], attackerLosses: 0, defenderLosses: 0,
            phase: 'select_target', defenderChoice: null,
          };
        }
        return; // One attack per turn for CPU
      }
    }
  }
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
// STORE
// ============================================================

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  selectedTerritory: null,
  selectedSeaZone: null,
  uiMode: 'map',

  startGame: (humanPlayer: SuperpowerId = 'usa') => {
    const game = createInitialGameState(humanPlayer);
    set({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });
    // Auto-save
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
      case 'END_TURN':
        advanceToNextPlayer(state);
        break;
      case 'SELL_RESOURCE':
        sellResource(state, action.resource, action.quantity);
        break;
      case 'BUY_RESOURCE':
        buyResource(state, action.resource, action.quantity);
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
      case 'AIRLIFT':
        airlift(state, action.from, action.to, action.count);
        break;
      case 'ATTACK_TERRITORY':
        initiateAttack(state, action.from, action.target);
        break;
      case 'ROLL_COMBAT':
        rollCombat(state);
        break;
      case 'OCCUPY_TERRITORY':
        occupyTerritory(state);
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

  loadGame: (state: GameState) => set({ game: state }),

  saveGame: () => {
    const { game } = get();
    if (!game) return '';
    const json = JSON.stringify(game);
    localStorage.setItem('supremacia_save', json);
    return json;
  },
}));
