import { create } from 'zustand';
import { GameState, GameAction, SuperpowerId, ResourceType, ResourceCard, TurnStage, EventLogEntry, UnitType, Player, PlayerActionEvent, PlannedStep, ProspectingSession, AIDifficulty, MarketMode, SellDeclaration, SellResolutionPerPlayer } from './types';
import { createInitialGameState } from './setup';
import { RULES } from './rulesConfig';
import { rollDice, sumDice, shuffleArray } from './rng';
import { SUPERPOWER_IDS, SUPERPOWERS } from '../data/initialPlayers';
import { nanoid } from 'nanoid';
import { isNukeCard, isLaserCard, isTechCard, getTechCounts } from './researchDeck';
import { chooseOptionalStages, getPlayerAIConfig, shouldResearchTech, planAmphibiousInvasion, OptionalStage, AIConfig } from './ai';
import { isSimultaneousSellRound } from './simultaneousSell';
import { fmtNum, t } from '../i18n/useI18n';
import { TranslationKey } from '../i18n';
import { territoryName, seaName, locationName, factionName, factionShort, companyName } from '../i18n/names';

/**
 * Build-selection mode (fase Construir). When the player picks "Construir
 * Exército" or "Construir Esquadra", the HUD enters a target-selection mode and
 * the player taps a highlighted territory/sea directly on the map. `null` means
 * no pending build action (weapons research/build are one-click and never use it).
 */
export type BuildAction = 'army' | 'navy' | null;

interface GameStore {
  game: GameState | null;
  selectedTerritory: string | null;
  selectedSeaZone: string | null;
  uiMode: 'map' | 'market' | 'build' | 'move' | 'attack' | 'nuclear';
  /** Pending build action awaiting a map click (army/navy), or null. */
  buildAction: BuildAction;
  /** Private overlay showing which map territories relate to the player's company cards. */
  companyMapVisible: boolean;

  /**
   * Quando definido (partida online), as ações de jogo do humano são roteadas
   * para o servidor em vez de aplicadas localmente. Null = jogo local/IA.
   */
  onlineSubmit: ((action: GameAction) => void) | null;
  setOnlineSubmit: (fn: ((action: GameAction) => void) | null) => void;

  // Actions
  startGame: (humanPlayer: SuperpowerId, aiCount: number, aiDifficulty?: AIDifficulty, marketMode?: MarketMode) => void;
  dispatch: (action: GameAction) => void;
  selectTerritory: (id: string | null) => void;
  selectSeaZone: (id: string | null) => void;
  setUiMode: (mode: GameStore['uiMode']) => void;
  setBuildAction: (action: BuildAction) => void;
  setCompanyMapVisible: (v: boolean) => void;
  loadGame: (state: GameState) => void;
  saveGame: () => string;
}

/**
 * Single source of truth for where the current player may place a newly built
 * unit. Army → controlled, non-nuked land territories (home + foreign held).
 * Navy → sea zones adjacent to a port the player controls. The BuildPanel HUD
 * and the WorldMap highlight both read from here so they can never disagree.
 */
export function getBuildTargets(game: GameState, action: BuildAction): string[] {
  if (!action) return [];
  const player = game.players[game.turn.currentPlayer];
  const homeTs = Object.values(game.territories).filter(
    t => t.superpowerId === player.id && !t.nuked && t.owner === player.id
  );
  const foreignTs = Object.entries(player.armies)
    .filter(([tid, count]) => count > 0 && game.territories[tid]?.superpowerId !== player.id && game.territories[tid]?.owner === player.id)
    .map(([tid]) => game.territories[tid])
    .filter(Boolean);
  const allLand = [...homeTs, ...foreignTs];

  if (action === 'army') {
    return allLand.map(t => t.id);
  }

  // navy: sea zones adjacent to a controlled port
  const navalZoneIds = new Set<string>();
  allLand.forEach(t => {
    if (t.hasPort) t.adjacentSeas.forEach(s => navalZoneIds.add(s));
  });
  return Array.from(navalZoneIds).filter(id => !!game.seaZones[id]);
}

/** Nome do recurso no idioma atual (fonte única — evita mapas pt espalhados). */
function resName(r: ResourceType): string {
  return t(`resource.${r}` as TranslationKey);
}

function addEvent(state: GameState, player: SuperpowerId, message: string, type: EventLogEntry['type'] = 'info', kind?: EventLogEntry['kind']): void {
  state.eventLog.push({
    id: nanoid(8),
    turn: state.turn.turnNumber,
    stage: state.turn.stage,
    player,
    message,
    timestamp: Date.now(),
    type,
    kind,
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

// Modo Digital Balanceado: no início da rodada, salários e produção de TODOS os
// jogadores já foram processados na fase global (openSimultaneousSell). Logo, os
// Estágios 1 e 2 individuais de cada jogador viram confirmações no-op.
function upkeepAlreadyDone(state: GameState): boolean {
  return state.config.marketMode === 'balanced' && state.turn.upkeepPreprocessed === true;
}

function paySalaries(state: GameState): void {
  if (upkeepAlreadyDone(state)) {
    // Salário já cobrado na fase global da rodada — nada a fazer.
    state.turn.unpaidCompanies = [];
    addEvent(state, state.turn.currentPlayer, t('log.salaryAlreadyPaid'), 'economy');
    return;
  }
  state.turn.unpaidCompanies = paySalariesFor(state, state.turn.currentPlayer);
}

// Cobra salários de um jogador específico e devolve os ids das companhias que
// ficaram DORMENTES por falta de pagamento (não produzem nesta rodada). Fonte
// única de upkeep — usada pelo Estágio 1 individual e pela fase global do Modo
// Digital Balanceado.
function paySalariesFor(state: GameState, playerId: SuperpowerId): string[] {
  const player = state.players[playerId];
  const { unitCost, companyCost, loanInterest, total: totalCost } = computeSalaryDue(player);

  if (player.money >= totalCost) {
    player.money -= totalCost;
    addEvent(state, player.id, t('log.salaryPaid', { units: fmtNum(unitCost), companies: fmtNum(companyCost), interest: fmtNum(loanInterest) }), 'economy');
    return [];
  }

  // ── Fundos insuficientes ── Prioridade fiel ao manual:
  // 1) juros (serviço de dívida), 2) salário das unidades — tropas sem salário são
  //    dispensadas, 3) salário das companhias — as não pagas ficam DORMENTES (não
  //    produzem neste turno, mas não são destruídas). Pagamos as companhias de
  //    maior produção primeiro para o jogador preservar suas melhores fontes.
  let money = player.money;

  // 1) Juros (melhor esforço).
  const paidInterest = Math.min(money, loanInterest);
  money -= paidInterest;

  // 2) Salário das unidades — dispensa proporcional ao que não couber.
  let removedUnits = 0;
  if (money >= unitCost) {
    money -= unitCost;
  } else {
    const unpaidUnitSalary = unitCost - money;
    money = 0;
    let toRemove = Math.ceil(unpaidUnitSalary / RULES.SALARY_PER_UNIT);
    const territories = Object.keys(player.armies);
    for (const t of territories) {
      if (toRemove <= 0) break;
      const remove = Math.min(player.armies[t], toRemove);
      player.armies[t] -= remove;
      toRemove -= remove;
      removedUnits += remove;
      if (player.armies[t] <= 0) delete player.armies[t];
    }
  }

  // 3) Salário das companhias — maiores produtoras primeiro; o resto fica dormente.
  const companies = player.resourceCards
    .map(id => state.resourceCards[id])
    .filter((c): c is ResourceCard => !!c)
    .sort((a, b) => b.production - a.production);
  const dormant: string[] = [];
  for (const c of companies) {
    if (money >= RULES.SALARY_PER_COMPANY) {
      money -= RULES.SALARY_PER_COMPANY;
    } else {
      dormant.push(c.id);
    }
  }
  player.money = money;

  const parts: string[] = [t('log.salaryShortfall')];
  if (removedUnits > 0) parts.push(t('log.salaryUnitsDismissed', { n: removedUnits }));
  if (dormant.length > 0) {
    const names = dormant.map(id => companyName(id, state.resourceCards[id]?.companyName ?? id)).join(', ');
    parts.push(t('log.salaryDormant', { n: dormant.length, names }));
  }
  addEvent(state, player.id, parts.join(' '), 'economy');
  return dormant;
}

function transferProduction(state: GameState): void {
  if (upkeepAlreadyDone(state)) {
    // Produção já transferida na fase global da rodada — nada a fazer.
    addEvent(state, state.turn.currentPlayer, t('log.productionAlreadyReceived'), 'economy');
    return;
  }
  transferProductionFor(state, state.turn.currentPlayer, state.turn.unpaidCompanies);
}

// Transfere a produção das companhias de um jogador para a Central de
// Suprimentos. `dormantIds` = companhias sem salário pago (não produzem).
function transferProductionFor(state: GameState, playerId: SuperpowerId, dormantIds: string[]): void {
  const player = state.players[playerId];
  let produced = { grain: 0, oil: 0, mineral: 0 };
  const dormant = new Set(dormantIds);
  let dormantCount = 0;

  for (const cardId of player.resourceCards) {
    const card = state.resourceCards[cardId];
    if (!card || !card.revealed) continue;
    if (dormant.has(cardId)) { dormantCount++; continue; }
    const space = player.maxSupply - player.supplies[card.type];
    const amount = Math.min(card.production, space);
    player.supplies[card.type] += amount;
    produced[card.type] += amount;
  }

  const suffix = dormantCount > 0
    ? t('log.productionDormantSuffix', { n: dormantCount })
    : '';
  addEvent(state, player.id, t('log.production', {
    grain: produced.grain, gn: resName('grain'),
    oil: produced.oil, on: resName('oil'),
    mineral: produced.mineral, mn: resName('mineral'), suffix,
  }), 'economy');
}

// ============================================================
// MODO DIGITAL BALANCEADO — Venda Simultânea de Recursos
// Estado: state.simultaneousSell (ver types.ts). Fluxo por rodada:
//   OPEN  → salários+produção globais; snapshot de preços; IA auto-declara.
//   SUBMIT→ cada humano declara/atualiza sua venda (validada).
//   RESOLVE→ preço único de snapshot p/ todos; mercado cai pelo total; conta
//            1 ação opcional de venda para quem vendeu ≥ 1.
//   ACK   → fecha o resumo; segue a rodada normal.
// ============================================================

const RESOURCE_TYPES: ResourceType[] = ['grain', 'oil', 'mineral'];

function activePlayerIds(state: GameState): SuperpowerId[] {
  return state.turn.playerOrder.filter(id => !state.players[id].isEliminated);
}

// Declaração automática da IA (decisão simples inicial, evoluível): vende todo
// excedente acima de 3 de cada recurso — espelha cpuSell, mas na fase global.
function computeAiSellDeclaration(state: GameState, playerId: SuperpowerId): SellDeclaration {
  const p = state.players[playerId];
  const over = (r: ResourceType) => Math.max(0, p.supplies[r] - 3);
  return {
    playerId,
    grain: over('grain'),
    oil: over('oil'),
    mineral: over('mineral'),
    confirmed: true,
    timestamp: nowMs(),
  };
}

// Date.now isolado num único ponto (facilita futura semente determinística p/
// multiplayer e mantém o resto do engine puro).
function nowMs(): number {
  return Date.now();
}

// Abre a fase de Venda Simultânea no início de uma rodada (idempotente).
// Só dispara na 1ª rodada (ver isSimultaneousSellRound). Em round >= 2 é no-op:
// o jogo usa o fluxo padrão de venda por turno (Estágio 3 sequencial).
function openSimultaneousSell(state: GameState): void {
  if (!isSimultaneousSellRound(state)) return;
  const ss = state.simultaneousSell;
  // Já aberta ou já resolvida nesta rodada → não reabrir.
  if (ss.phase !== 'inactive') return;
  if (ss.lastResolvedRound >= state.turn.turnNumber) return;

  const actives = activePlayerIds(state);

  // 1) Salários + 2) Produção de TODOS os jogadores ativos (ordem da rodada).
  for (const id of actives) {
    const dormant = paySalariesFor(state, id);
    transferProductionFor(state, id, dormant);
  }
  // A partir daqui os Estágios 1 e 2 individuais viram no-op nesta rodada.
  state.turn.upkeepPreprocessed = true;

  // 3) Abre a declaração: snapshot de preços + IA auto-declara, humanos pendentes.
  const snapshot: Record<ResourceType, number> = { ...state.market.prices };
  const declarations: Partial<Record<SuperpowerId, SellDeclaration>> = {};
  for (const id of actives) {
    const pl = state.players[id];
    declarations[id] = pl.isHuman
      ? { playerId: id, grain: 0, oil: 0, mineral: 0, confirmed: false, timestamp: 0 }
      : computeAiSellDeclaration(state, id);
  }

  ss.phase = 'declare';
  ss.round = state.turn.turnNumber;
  ss.priceSnapshot = snapshot;
  ss.declarations = declarations;
  ss.soldThisRound = [];
  ss.resolution = null;

  addEvent(state, state.turn.currentPlayer, t('log.simSellStarted'), 'economy');
}

// Valida e registra a declaração de um jogador. Clampa ao estoque, sem
// negativos, zero permitido. Idempotente enquanto phase==='declare'.
function submitSellDeclaration(
  state: GameState,
  playerId: SuperpowerId,
  grain: number, oil: number, mineral: number,
): void {
  const ss = state.simultaneousSell;
  if (ss.phase !== 'declare') return; // impede confirmação fora da fase
  const p = state.players[playerId];
  if (!p || p.isEliminated) return;

  const clamp = (q: number, r: ResourceType) =>
    Math.max(0, Math.min(Math.floor(q) || 0, p.supplies[r]));
  const decl: SellDeclaration = {
    playerId,
    grain: clamp(grain, 'grain'),
    oil: clamp(oil, 'oil'),
    mineral: clamp(mineral, 'mineral'),
    confirmed: true,
    timestamp: nowMs(),
  };
  ss.declarations[playerId] = decl;
}

function allDeclarationsConfirmed(state: GameState): boolean {
  const ss = state.simultaneousSell;
  if (ss.phase !== 'declare') return false;
  return activePlayerIds(state).every(id => ss.declarations[id]?.confirmed === true);
}

// Resolve a venda simultânea: todos recebem o preço de SNAPSHOT; o mercado de
// cada recurso cai pelo total vendido por todos; quem vendeu ≥ 1 gasta 1 ação.
function resolveSimultaneousSell(state: GameState): void {
  const ss = state.simultaneousSell;
  if (ss.phase !== 'declare') return;
  if (!allDeclarationsConfirmed(state)) return;

  const actives = activePlayerIds(state);
  addEvent(state, state.turn.currentPlayer, t('log.simSellAllConfirmed'), 'economy');

  // Preço único por recurso = snapshot tirado na abertura (antes de qualquer venda).
  const perResource: Record<ResourceType, { totalSold: number; priceBefore: number; priceAfter: number }> = {
    grain: { totalSold: 0, priceBefore: ss.priceSnapshot.grain, priceAfter: ss.priceSnapshot.grain },
    oil: { totalSold: 0, priceBefore: ss.priceSnapshot.oil, priceAfter: ss.priceSnapshot.oil },
    mineral: { totalSold: 0, priceBefore: ss.priceSnapshot.mineral, priceAfter: ss.priceSnapshot.mineral },
  };

  // 1) Paga cada jogador ao preço de snapshot e debita o estoque.
  const perPlayer: SellResolutionPerPlayer[] = [];
  const soldThisRound: SuperpowerId[] = [];
  for (const id of actives) {
    const decl = ss.declarations[id]!;
    const pl = state.players[id];
    let revenue = 0;
    for (const r of RESOURCE_TYPES) {
      const qty = Math.min(decl[r], pl.supplies[r]); // segurança extra contra estoque vencido
      if (qty <= 0) continue;
      const price = ss.priceSnapshot[r];
      revenue += qty * price;
      pl.supplies[r] -= qty;
      perResource[r].totalSold += qty;
    }
    const soldAny = (decl.grain + decl.oil + decl.mineral) > 0;
    if (soldAny) {
      pl.money += revenue;
      soldThisRound.push(id);
      const pieces = RESOURCE_TYPES
        .filter(r => decl[r] > 0)
        .map(r => `${decl[r]} ${resName(r)}`)
        .join(t('log.listSep'));
      // NB: sem kind 'sell' — a venda simultânea tem painel próprio; o MarketDrawer
      // lista apenas as vendas/compras individuais (Estágios 3/7).
      addEvent(state, id, t('log.simSold', { player: factionName(id), pieces, revenue: fmtNum(revenue) }), 'economy');
    }
    perPlayer.push({
      playerId: id, playerName: pl.name,
      grain: decl.grain, oil: decl.oil, mineral: decl.mineral,
      revenue, soldAny,
      // 3 ações opcionais por rodada; a venda consome 1 quando soldAny.
      optionalActionsRemaining: RULES.MAX_OPTIONAL_STAGES - (soldAny ? 1 : 0),
    });
  }

  // 2) Mercado cai pelo total vendido (em posições de priceStep), clamp no mínimo.
  for (const r of RESOURCE_TYPES) {
    const before = perResource[r].priceBefore;
    const after = Math.max(
      state.market.minPrice,
      before - perResource[r].totalSold * state.market.priceStep,
    );
    state.market.prices[r] = after;
    perResource[r].priceAfter = after;
    if (perResource[r].totalSold > 0) {
      addEvent(
        state, state.turn.currentPlayer,
        t('log.simPriceDrop', { res: resName(r), sold: perResource[r].totalSold, before: fmtNum(before), after: fmtNum(after) }),
        'economy',
      );
    }
  }

  // 3) Log de ações opcionais consumidas pela venda.
  for (const pp of perPlayer) {
    if (pp.soldAny) {
      addEvent(
        state, pp.playerId,
        t('log.simSoldAction', { player: factionName(pp.playerId), remaining: pp.optionalActionsRemaining }),
        'economy',
      );
    }
  }

  ss.phase = 'resolve';
  ss.soldThisRound = soldThisRound;
  ss.lastResolvedRound = state.turn.turnNumber;
  ss.resolution = { round: state.turn.turnNumber, perResource, perPlayer };

  // O primeiro jogador da rodada já é o currentPlayer: aplica a pré-consumação
  // da ação de venda (os demais recebem ao entrar no turno via advanceToNextPlayer).
  applySoldOptionalStage(state, state.turn.currentPlayer);
}

// Pré-consome o Estágio 3 (venda) para um jogador que vendeu na fase simultânea,
// deixando-o com 2 ações opcionais na sua vez. No Modo Digital Balanceado o
// Estágio 3 individual fica indisponível (a venda é só a simultânea).
function applySoldOptionalStage(state: GameState, playerId: SuperpowerId): void {
  // Só na 1ª rodada: em round >= 2 não há venda simultânea, e o soldThisRound
  // remanescente da rodada 1 não pode pré-consumir o Estágio 3 indevidamente.
  if (!isSimultaneousSellRound(state)) return;
  if (state.turn.currentPlayer !== playerId) return;
  if (state.simultaneousSell.soldThisRound.includes(playerId)) {
    if (!state.turn.optionalStagesUsed.includes(3)) {
      state.turn.optionalStagesUsed = [3, ...state.turn.optionalStagesUsed];
    }
  }
}

function ackSimultaneousSell(state: GameState): void {
  const ss = state.simultaneousSell;
  if (ss.phase !== 'resolve') return;
  ss.phase = 'inactive';
  // resolution permanece para consulta no log/UI até a próxima abertura.
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
    ? t('log.priceTag', { res: resName(resource), beforeK: (previousPrice / 1000).toFixed(0), afterK: (newPrice / 1000).toFixed(0) })
    : '';
  addEvent(
    state, player.id,
    t('log.sold', { n: toSell, res: resName(resource), revenue: fmtNum(totalRevenue), priceTag }),
    'economy', 'sell',
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
      ? t('log.priceTag', { res: resName(resource), beforeK: (previousPrice / 1000).toFixed(0), afterK: (newPrice / 1000).toFixed(0) })
      : '';
    addEvent(
      state, player.id,
      t('log.bought', { n: bought, res: resName(resource), cost: fmtNum(totalCost), priceTag }),
      'economy', 'buy',
    );
  }
}


/**
 * Fidelidade ao manual Grow: "A nova carta será devolvida ao maço, se ela estiver
 * localizada num território que esteja ocupado por um oponente ou onde haja
 * explodido uma bomba atômica." Logo, uma companhia só é prospectável se o
 * território dela NÃO estiver sob controle de um oponente nem nuclearizado.
 * Território neutro (sem dono) ou já controlado pelo próprio jogador → OK.
 * A captura por conquista (claimTerritory) é o caminho para obter companhias de
 * territórios inimigos — não a prospecção.
 */
function isProspectableTerritory(state: GameState, card: ResourceCard, playerId: SuperpowerId): boolean {
  const t = state.territories[card.territoryId];
  if (!t) return false;
  if (t.nuked) return false;
  if (t.owner && t.owner !== playerId) return false; // ocupado por oponente
  return true;
}

function acquireCompany(state: GameState, player: Player, cardId: string): void {
  const card = state.resourceCards[cardId];
  if (!card) return;
  card.ownerId = player.id;
  card.revealed = true;
  if (!player.resourceCards.includes(cardId)) player.resourceCards.push(cardId);
  const res = resName(card.type);
  const where = territoryName(card.territoryId);
  const coName = companyName(card.id, card.companyName);
  addEvent(state, player.id, t('log.acquired', { company: coName, prod: card.production, res, where }), 'economy');
  state.drawnCard = {
    active: true,
    type: 'resource',
    success: true,
    cardName: coName,
    cardEffect: t('draw.eff.companyAt', { prod: card.production, res, where }),
    context: t('draw.ctx.prospect'),
    cardId: card.id,
    resourceType: card.type,
    companyName: card.companyName,
    production: card.production,
  };
}

/**
 * Prospecting draws real cards from the virtual deck (no hardcoded odds).
 *
 * - Without a target type: reveals the single top card. A company is acquired; a
 *   tech card is returned to the deck (cost refunded — tech only via research).
 * - With a target type (grain/oil/mineral): opens a ProspectingSession and flips
 *   one card at a time. Each flip sets state.drawnCard so DrawnCardModal can show
 *   the card to the player. Non-matching cards are set aside and reshuffled back
 *   into the deck when the session ends (found, stopped, or exhausted).
 *
 * TODO: confirmar regra original — manual Grow diz "até 3 vezes por jogada" no
 * Estágio 7. A implementação atual trata o Estágio 7 como um único slot opcional,
 * permitindo apenas 1 sessão de prospecção por turno. Para fidelizar: permitir
 * que o jogador inicie até 3 sessões distintas dentro do Estágio 7 (uma por tipo
 * de recurso, ou repetindo o mesmo tipo). Cada sessão começa um novo baralho
 * embaralhado.
 */
function prospect(state: GameState, targetType?: ResourceType): void {
  const player = state.players[state.turn.currentPlayer];
  if (state.resourceDeck.length === 0) {
    addEvent(state, player.id, t('log.deckEmpty'), 'info');
    return;
  }
  if (player.money < RULES.RESEARCH_COST_PER_CARD) {
    addEvent(state, player.id, t('log.prospectNoMoney'), 'info');
    return;
  }
  // D3 fidelidade: limite de 3 tentativas de prospecção por turno (manual Grow).
  // Cada nova sessão iniciada (ou carta avulsa no modo sem tipo) conta como 1 tentativa.
  if (!state.prospectingSession && state.turn.prospectAttemptsUsed >= RULES.MAX_PROSPECT_ATTEMPTS) {
    addEvent(state, player.id,
      t('log.prospectLimit', { max: RULES.MAX_PROSPECT_ATTEMPTS }), 'info');
    return;
  }

  // ── Targeted prospecting: step-by-step, one card per dispatch ──
  if (targetType) {
    if (!state.prospectingSession) {
      state.prospectingSession = { targetType, cardsSetAside: [], found: false, totalCost: 0, cardsFlipped: 0 };
      state.turn.prospectAttemptsUsed++;
    }
    drawProspectCardInternal(state);
    return;
  }

  // ── Untargeted prospecting: reveal a single top card (conta como 1 tentativa) ──
  state.turn.prospectAttemptsUsed++;
  player.money -= RULES.RESEARCH_COST_PER_CARD;
  const cardId = state.resourceDeck.shift()!;

  if (isTechCard(cardId)) {
    state.resourceDeck.push(cardId);
    player.money += RULES.RESEARCH_COST_PER_CARD;
    const techName = t(isNukeCard(cardId) ? 'tech.nuke' : 'tech.laser');
    addEvent(state, player.id, t('log.prospectTechReturned', { tech: techName }), 'info');
    state.drawnCard = {
      active: true,
      type: isNukeCard(cardId) ? 'nuke' : 'laser',
      success: false,
      cardName: techName,
      cardEffect: t('draw.eff.techReturned'),
      context: t('draw.ctx.prospect'),
      cardId,
    };
    return;
  }

  // Fidelidade Grow: companhia em território inimigo/nuclearizado é devolvida ao
  // maço (não pode ser prospectada). Espelha o tratamento das cartas de tecnologia.
  const drawn = state.resourceCards[cardId];
  if (drawn && !isProspectableTerritory(state, drawn, player.id)) {
    state.resourceDeck.push(cardId);
    state.resourceDeck = shuffleArray(state.resourceDeck);
    player.money += RULES.RESEARCH_COST_PER_CARD; // estorno
    const where = territoryName(drawn.territoryId);
    const coName = companyName(drawn.id, drawn.companyName);
    const motivo = t(state.territories[drawn.territoryId]?.nuked ? 'reason.nuked' : 'reason.enemy');
    addEvent(state, player.id, t('log.prospectReturned', { company: coName, where, reason: motivo }), 'info');
    state.drawnCard = {
      active: true,
      type: 'resource',
      success: false,
      cardName: t('draw.name.unavailable', { company: coName }),
      cardEffect: t('draw.eff.unavailable', { where, reason: motivo }),
      context: t('draw.ctx.prospect'),
      cardId,
    };
    return;
  }

  acquireCompany(state, player, cardId);
}

function startNewRound(state: GameState): void {
  state.turn.turnNumber++;
  state.turn.isFirstTurn = false;
  // Modo Digital Balanceado: a nova rodada reabre a fase global de upkeep+venda.
  state.turn.upkeepPreprocessed = false;
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

// Returns all cards drawn during a research session to the deck and reshuffles.
// Called whenever a research session ends (found, stopped, or forced).
function finalizeResearch(state: GameState): void {
  const session = state.researchSession;
  if (!session) return;
  if (session.cardsRevealed.length > 0) {
    state.resourceDeck.push(...session.cardsRevealed);
    state.resourceDeck = shuffleArray(state.resourceDeck);
  }
  state.researchSession = null;
}

// Returns all set-aside cards from a targeted prospecting session to the deck.
// Called when prospecting ends (found+dismissed, stopped, or deck exhausted).
function finalizeProspect(state: GameState): void {
  const session = state.prospectingSession;
  if (!session) return;
  if (session.cardsSetAside.length > 0) {
    state.resourceDeck.push(...session.cardsSetAside);
    state.resourceDeck = shuffleArray(state.resourceDeck);
  }
  state.prospectingSession = null;
}


/**
 * Flip one card from the deck for a targeted prospecting session.
 * Sets state.drawnCard so the DrawnCardModal shows the card.
 * When the matching card is found, the session.found flag is set and the card is
 * acquired immediately; the session is NOT finalized here — finalizeProspect() is
 * called by DISMISS_DRAWN_CARD so the set-aside cards return to the deck.
 */
function drawProspectCardInternal(state: GameState): void {
  const session = state.prospectingSession;
  if (!session || session.found) return;

  const player = state.players[state.turn.currentPlayer];
  const typeLabel = resName(session.targetType);
  const typeIcon = typeLabel;

  // Deck exhausted — finalize immediately, show failure card
  if (state.resourceDeck.length === 0) {
    addEvent(state, player.id,
      t('log.prospectDeckExhausted', { res: typeLabel, n: session.cardsFlipped, cost: fmtNum(session.totalCost) }), 'info');
    state.drawnCard = {
      active: true,
      type: 'resource',
      success: false,
      cardName: t('draw.name.notFound', { res: typeLabel }),
      cardEffect: t('draw.eff.deckExhausted', { n: session.cardsFlipped }),
      context: t('draw.ctx.prospectType', { res: typeLabel }),
      prospectTarget: session.targetType,
      prospectCardsFlipped: session.cardsFlipped,
      prospectCostSoFar: session.totalCost,
    };
    finalizeProspect(state);
    return;
  }

  // Insufficient funds — finalize immediately, show failure card
  if (player.money < RULES.RESEARCH_COST_PER_CARD) {
    addEvent(state, player.id,
      t('log.prospectNoMoneyMid', { res: typeLabel, n: session.cardsFlipped, cost: fmtNum(session.totalCost) }), 'info');
    state.drawnCard = {
      active: true,
      type: 'resource',
      success: false,
      cardName: t('draw.name.notFound', { res: typeLabel }),
      cardEffect: t('draw.eff.noMoneyMid'),
      context: t('draw.ctx.prospectType', { res: typeLabel }),
      prospectTarget: session.targetType,
      prospectCardsFlipped: session.cardsFlipped,
      prospectCostSoFar: session.totalCost,
    };
    finalizeProspect(state);
    return;
  }

  player.money -= RULES.RESEARCH_COST_PER_CARD;
  session.totalCost += RULES.RESEARCH_COST_PER_CARD;
  session.cardsFlipped++;

  const cardId = state.resourceDeck.shift()!;
  const context = t('draw.ctx.prospectCard', { res: typeLabel, n: session.cardsFlipped });

  // ── Tech card (nuke or laser): set aside, show it ──
  if (isTechCard(cardId)) {
    session.cardsSetAside.push(cardId);
    const techName = t(isNukeCard(cardId) ? 'tech.nuke' : 'tech.laser');
    addEvent(state, player.id,
      t('log.prospectTechAside', { res: typeIcon, n: session.cardsFlipped, tech: techName, target: typeLabel }), 'economy');
    state.drawnCard = {
      active: true,
      type: isNukeCard(cardId) ? 'nuke' : 'laser',
      success: false,
      cardName: techName,
      cardEffect: t('draw.eff.techNotType', { res: typeLabel }),
      context,
      cardId,
      prospectTarget: session.targetType,
      prospectCardsFlipped: session.cardsFlipped,
      prospectCostSoFar: session.totalCost,
    };
    return;
  }

  const card = state.resourceCards[cardId];

  // ── Matching type AND territory available: SUCCESS ──
  if (card && card.type === session.targetType && isProspectableTerritory(state, card, player.id)) {
    session.found = true;
    const where = territoryName(card.territoryId);
    const icon = resName(card.type);
    const coName = companyName(card.id, card.companyName);

    card.ownerId = player.id;
    card.revealed = true;
    if (!player.resourceCards.includes(cardId)) player.resourceCards.push(cardId);

    addEvent(state, player.id,
      t('log.prospectFound', { res: typeLabel, company: coName, prod: card.production, icon, where, n: session.cardsFlipped, cost: fmtNum(session.totalCost) }), 'economy');

    state.drawnCard = {
      active: true,
      type: 'resource',
      success: true,
      cardName: coName,
      cardEffect: t('draw.eff.companyAt', { prod: card.production, res: icon, where }),
      context,
      cardId,
      resourceType: card.type,
      companyName: card.companyName,
      production: card.production,
      prospectTarget: session.targetType,
      prospectCardsFlipped: session.cardsFlipped,
      prospectCostSoFar: session.totalCost,
    };
    // Session kept alive until DISMISS_DRAWN_CARD so set-aside cards are returned
    return;
  }

  // ── Non-matching or blocked: set aside, show it ──
  session.cardsSetAside.push(cardId);

  if (!card) {
    addEvent(state, player.id, t('log.prospectUnknown', { res: typeIcon, n: session.cardsFlipped, target: typeLabel }), 'economy');
    state.drawnCard = {
      active: true,
      type: 'resource',
      success: false,
      cardName: t('draw.name.unknown'),
      cardEffect: t('draw.eff.notType', { res: typeLabel }),
      context,
      cardId,
      prospectTarget: session.targetType,
      prospectCardsFlipped: session.cardsFlipped,
      prospectCostSoFar: session.totalCost,
    };
    return;
  }

  const resourceLabel = resName(card.type);
  const where = territoryName(card.territoryId);
  const coName = companyName(card.id, card.companyName);

  if (card.type !== session.targetType) {
    addEvent(state, player.id,
      t('log.prospectWrongType', { res: typeIcon, n: session.cardsFlipped, company: coName, res2: resourceLabel, target: typeLabel }), 'economy');
    state.drawnCard = {
      active: true,
      type: 'resource',
      success: false,
      cardName: coName,
      cardEffect: t('draw.eff.wrongType', { res: resourceLabel, prod: card.production, where, target: typeLabel }),
      context,
      cardId,
      resourceType: card.type,
      companyName: card.companyName,
      production: card.production,
      prospectTarget: session.targetType,
      prospectCardsFlipped: session.cardsFlipped,
      prospectCostSoFar: session.totalCost,
    };
  } else {
    // Right type, but territory is blocked (enemy-held or nuked)
    const territory = state.territories[card.territoryId];
    const motivo = t(territory?.nuked ? 'reason.nuked' : 'reason.enemy');
    addEvent(state, player.id,
      t('log.prospectBlocked', { res: typeIcon, n: session.cardsFlipped, company: coName, target: typeLabel, where, reason: motivo }), 'economy');
    state.drawnCard = {
      active: true,
      type: 'resource',
      success: false,
      cardName: coName,
      cardEffect: t('draw.eff.blockedType', { res: typeLabel, where, reason: motivo }),
      context,
      cardId,
      resourceType: card.type,
      companyName: card.companyName,
      production: card.production,
      prospectTarget: session.targetType,
      prospectCardsFlipped: session.cardsFlipped,
      prospectCostSoFar: session.totalCost,
    };
  }
}

function advanceToNextPlayer(state: GameState): void {
  // Clear any orphaned sessions before changing players
  if (state.researchSession) finalizeResearch(state);
  if (state.prospectingSession) finalizeProspect(state);
  // Reset per-turn tracking
  state.turn.attackedFrom = [];
  state.turn.prospectAttemptsUsed = 0;
  state.turn.unitsBuiltThisTurn = 0;

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

  // Modo Digital Balanceado: se a venda simultânea desta rodada já resolveu e
  // este jogador vendeu, pré-consome o Estágio 3 (resta 2 ações opcionais).
  applySoldOptionalStage(state, state.turn.currentPlayer);
}

function canUseOptionalStage(state: GameState, stage: TurnStage): boolean {
  if (stage <= 2) return true; // mandatory
  // Modo Digital Balanceado: o Estágio 3 (venda sequencial) só fica indisponível
  // na 1ª rodada, quando a venda acontece na fase de Venda Simultânea. A partir
  // da rodada 2 a venda por turno volta ao normal e o Estágio 3 é selecionável.
  if (stage === 3 && isSimultaneousSellRound(state)) return false;
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
  // Fidelidade 3.7.1 (manual Grow): 1 conjunto de suprimentos (1 cereal +
  // 1 petróleo + 1 minério) constrói 3 peças militares. Como a UI constrói 1
  // unidade por clique, acumulamos as unidades do turno e só cobramos um novo
  // conjunto quando a contagem cruza um múltiplo de UNITS_PER_SUPPLY_SET — assim
  // 3 unidades avulsas custam 1 conjunto, não 3.
  const alreadyBuilt = state.turn.unitsBuiltThisTurn;
  const newTotal = alreadyBuilt + units.length;
  const setsAlreadyPaid = Math.ceil(alreadyBuilt / RULES.UNITS_PER_SUPPLY_SET);
  const setsAfter = Math.ceil(newTotal / RULES.UNITS_PER_SUPPLY_SET);
  const setsNeeded = setsAfter - setsAlreadyPaid;
  const moneyCost = units.length * RULES.UNIT_COST;

  if (player.supplies.grain < setsNeeded || player.supplies.oil < setsNeeded || player.supplies.mineral < setsNeeded) {
    addEvent(state, player.id, t('log.buildNoSupplies'), 'info');
    return;
  }
  if (player.money < moneyCost) {
    addEvent(state, player.id, t('log.buildNoMoney'), 'info');
    return;
  }

  player.supplies.grain -= setsNeeded;
  player.supplies.oil -= setsNeeded;
  player.supplies.mineral -= setsNeeded;
  player.money -= moneyCost;
  state.turn.unitsBuiltThisTurn = newTotal;

  for (const unit of units) {
    if (unit.type === 'army') {
      player.armies[unit.locationId] = (player.armies[unit.locationId] || 0) + 1;
    } else {
      player.navies[unit.locationId] = (player.navies[unit.locationId] || 0) + 1;
    }
  }

  addEvent(state, player.id, t('log.built', { n: units.length, cost: fmtNum(moneyCost) }), 'build');
}

// ── Territory control: single source of truth ────────────────────────────────
// A territory's controller is `territory.owner`. The map color, build permission,
// and territory panel all derive from this single field, so claiming must always
// go through here. Claiming a neutral/empty territory does NOT grant a company —
// production only ever comes from resource cards (companies) the player holds.

function enemyArmiesPresent(state: GameState, territoryId: string, playerId: SuperpowerId): boolean {
  return Object.entries(state.players).some(
    ([pid, p]) => pid !== playerId && ((p as Player).armies[territoryId] || 0) > 0
  );
}

/**
 * Returns the company cards (resource cards) located in a territory, optionally
 * filtered to a specific owner. Used for capture/transfer + UI panels.
 */
export function companiesInTerritory(state: GameState, territoryId: string, ownerId?: SuperpowerId | null): string[] {
  return Object.values(state.resourceCards)
    .filter(c => c.territoryId === territoryId && (ownerId === undefined || c.ownerId === ownerId))
    .map(c => c.id);
}

/**
 * Claim control of a territory the player entered unopposed (neutral, or already
 * theirs). Sets owner → map color + build permission update automatically from
 * this single field. Transfers any company that belonged to the previous owner
 * and logs whether a company was captured. Returns true if ownership changed.
 */
function claimTerritory(state: GameState, territoryId: string, playerId: SuperpowerId): boolean {
  const territory = state.territories[territoryId];
  if (!territory || territory.nuked) return false;
  const previousOwner = territory.owner;
  if (previousOwner === playerId) return false;

  const attacker = state.players[playerId];
  territory.owner = playerId;

  // Capturing a territory captures ALL companies located there, regardless of
  // who holds the card. This covers: (a) cards owned by the previous territory
  // controller, and (b) cards prospected by a third player from when the
  // territory was neutral — without this, those players would keep producing
  // from a territory they no longer control.
  const capturedNames: string[] = [];
  for (const cid of companiesInTerritory(state, territoryId)) {
    const card = state.resourceCards[cid];
    if (!card || card.ownerId === null || card.ownerId === playerId) continue;
    const cardOwner = state.players[card.ownerId];
    if (cardOwner) {
      cardOwner.resourceCards = cardOwner.resourceCards.filter(id => id !== cid);
    }
    if (!attacker.resourceCards.includes(cid)) attacker.resourceCards.push(cid);
    card.ownerId = playerId;
    capturedNames.push(companyName(card.id, card.companyName));
  }

  if (capturedNames.length > 0) {
    addEvent(state, playerId, t('log.conqueredWithCompany', { terr: territoryName(territoryId), companies: capturedNames.join(', ') }), 'move');
  } else {
    addEvent(state, playerId, t('log.conqueredNoCompany', { terr: territoryName(territoryId) }), 'move');
  }
  return true;
}

export type MoveBlockReason =
  | 'no_units' | 'invalid' | 'not_adjacent' | 'nuked' | 'no_grain' | 'enemy_held';


/**
 * Single source of truth for land-move validation. Returns null when the move is
 * allowed, otherwise a structured reason. The UI calls this BEFORE dispatching so
 * the player always sees WHY a move is blocked (esp. "sem cereal"); the engine
 * re-checks it for defense in depth.
 */
export function getMoveBlockReason(state: GameState, from: string, to: string): MoveBlockReason | null {
  const player = state.players[state.turn.currentPlayer];
  if ((player.armies[from] || 0) <= 0) return 'no_units';
  const fromT = state.territories[from];
  const toT = state.territories[to];
  if (!fromT || !toT) return 'invalid';
  if (!fromT.adjacentTerritories.includes(to)) return 'not_adjacent';
  if (toT.nuked) return 'nuked';
  if (player.supplies.grain < RULES.LAND_MOVE_GRAIN_COST) return 'no_grain';
  // Enemy-controlled or enemy-garrisoned territory must be taken via combat.
  if ((toT.owner && toT.owner !== player.id) || enemyArmiesPresent(state, to, player.id)) return 'enemy_held';
  return null;
}

export function moveBlockMessage(reason: MoveBlockReason): string {
  return t(`moveblock.${reason}` as TranslationKey, { grain: RULES.LAND_MOVE_GRAIN_COST });
}

function moveArmy(state: GameState, from: string, to: string, count: number): void {
  const player = state.players[state.turn.currentPlayer];
  const available = player.armies[from] || 0;
  const toMove = Math.min(count, available);
  if (toMove <= 0) return;

  // Centralized validation — engine refuses the move and explains why.
  const block = getMoveBlockReason(state, from, to);
  if (block) {
    if (block === 'no_grain') {
      addEvent(state, player.id, t('log.moveNoGrain', { player: factionName(player.id), need: RULES.LAND_MOVE_GRAIN_COST }), 'move');
    } else {
      addEvent(state, player.id, moveBlockMessage(block), 'info');
    }
    return;
  }

  player.supplies.grain -= RULES.LAND_MOVE_GRAIN_COST;
  player.armies[from] -= toMove;
  if (player.armies[from] <= 0) delete player.armies[from];
  player.armies[to] = (player.armies[to] || 0) + toMove;

  addEvent(state, player.id, t('log.moved', { n: toMove, to: territoryName(to), grain: RULES.LAND_MOVE_GRAIN_COST }), 'move');

  // Entering an unopposed neutral/own territory takes control of it (updates map
  // color + build permission through the single owner field).
  claimTerritory(state, to, player.id);
}

function airlift(state: GameState, from: string, to: string, count: number): void {
  const player = state.players[state.turn.currentPlayer];
  const available = player.armies[from] || 0;
  const toMove = Math.min(count, available);
  if (toMove <= 0) return;

  const toT = state.territories[to];
  if (toT && ((toT.owner && toT.owner !== player.id) || enemyArmiesPresent(state, to, player.id))) {
    addEvent(state, player.id, moveBlockMessage('enemy_held'), 'info');
    return;
  }

  const oilCost = RULES.AIRLIFT_OIL_COST * toMove;
  if (player.supplies.oil < oilCost) {
    addEvent(state, player.id, t('log.airliftNoOil'), 'info');
    return;
  }

  player.supplies.oil -= oilCost;
  player.armies[from] -= toMove;
  if (player.armies[from] <= 0) delete player.armies[from];
  player.armies[to] = (player.armies[to] || 0) + toMove;

  addEvent(state, player.id, t('log.airlifted', { n: toMove, to: territoryName(to) }), 'move');

  // Airlifting into an unopposed neutral/own territory takes control of it.
  claimTerritory(state, to, player.id);
}

// D8 fidelidade: manual Grow — mares costeiros ("azul-claro") têm uso compartilhado
// restrito: somente esquadras de UM jogador podem ocupar a zona por vez (como um
// território). Mares oceânicos ("azul-escuro") aceitam esquadras de qualquer jogador.
// Naval combat em mares costeiros está pendente (TODO); por ora bloqueia a entrada.
function moveNavy(state: GameState, from: string, to: string, count: number): void {
  const player = state.players[state.turn.currentPlayer];
  const available = player.navies[from] || 0;
  const toMove = Math.min(count, available);
  if (toMove <= 0) return;

  // Validate adjacency between sea zones
  const fromSea = state.seaZones[from];
  if (!fromSea || !fromSea.adjacentSeas.includes(to)) {
    addEvent(state, player.id, t('log.navalMoveInvalid'), 'info');
    return;
  }

  // D8: mar costeiro — verifica se outro jogador já ocupa a zona
  const toSea = state.seaZones[to];
  if (toSea?.type === 'coastal') {
    const occupier = Object.entries(state.players).find(
      ([pid, p]) => pid !== player.id && ((p as Player).navies[to] || 0) > 0
    );
    if (occupier) {
      const occupierName = factionName(occupier[0] as SuperpowerId);
      addEvent(state, player.id,
        t('log.coastalOccupied', { sea: seaName(to), who: occupierName }),
        'info');
      return;
    }
  }

  if (player.supplies.oil < RULES.SEA_MOVE_OIL_COST) {
    addEvent(state, player.id, t('log.navalNoOil'), 'info');
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

  const carriedNote = (player.embarked[to] || 0) > 0 ? t('log.carriedSuffix', { n: player.embarked[to] }) : '';
  addEvent(state, player.id, t('log.movedFleet', { n: toMove, to: seaName(to), carried: carriedNote }), 'move');
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
    addEvent(state, player.id, t('log.embarkInvalidCoastal'), 'info');
    return;
  }
  const available = player.armies[territoryId] || 0;
  if (available <= 0) {
    addEvent(state, player.id, t('log.embarkInvalidNoArmy'), 'info');
    return;
  }
  const navies = player.navies[seaZoneId] || 0;
  if (navies <= 0) {
    addEvent(state, player.id, t('log.embarkInvalidNoFleet'), 'info');
    return;
  }
  const capacity = navies * RULES.NAVY_TRANSPORT_CAPACITY;
  const used = player.embarked[seaZoneId] || 0;
  const freeCapacity = capacity - used;
  if (freeCapacity <= 0) {
    addEvent(state, player.id, t('log.embarkInvalidNoCap'), 'info');
    return;
  }

  const toEmbark = Math.min(count, available, freeCapacity);
  if (toEmbark <= 0) return;

  player.armies[territoryId] -= toEmbark;
  if (player.armies[territoryId] <= 0) delete player.armies[territoryId];
  player.embarked[seaZoneId] = used + toEmbark;

  addEvent(state, player.id, t('log.embarked', { n: toEmbark, sea: seaName(seaZoneId) }), 'move');
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
    addEvent(state, player.id, t('log.disembarkInvalidAdj'), 'info');
    return;
  }
  if (territory.nuked) {
    addEvent(state, player.id, t('log.disembarkInvalidNuked'), 'info');
    return;
  }
  const embarkedHere = player.embarked[seaZoneId] || 0;
  if (embarkedHere <= 0) {
    addEvent(state, player.id, t('log.disembarkInvalidNoEmbarked'), 'info');
    return;
  }
  // Only onto own territory or one without enemy armies (no amphibious assault yet).
  if (territory.owner && territory.owner !== player.id && enemyArmiesPresent(state, territoryId, player.id)) {
    addEvent(state, player.id, t('log.disembarkInvalidEnemy'), 'info');
    return;
  }

  const toLand = Math.min(count, embarkedHere);
  if (toLand <= 0) return;

  player.embarked[seaZoneId] -= toLand;
  if (player.embarked[seaZoneId] <= 0) delete player.embarked[seaZoneId];
  player.armies[territoryId] = (player.armies[territoryId] || 0) + toLand;

  addEvent(state, player.id, t('log.disembarked', { n: toLand, terr: territoryName(territoryId) }), 'move');

  // Landing unopposed on a neutral/empty territory takes control of it (and any
  // company there), going through the single claim path.
  if (!enemyArmiesPresent(state, territoryId, player.id)) {
    claimTerritory(state, territoryId, player.id);
  }
}

function initiateAttack(state: GameState, from: string, target: string, targetType: 'territory' | 'sea', bombardment = false): void {
  const player = state.players[state.turn.currentPlayer];

  // Attack only allowed in stage 4
  if (state.turn.stage !== 4) {
    addEvent(state, player.id, t('log.attackOnlyStage4'), 'info');
    return;
  }

  // One attack per origin (territory/sea zone) per turn
  if (state.turn.attackedFrom.includes(from)) {
    addEvent(state, player.id, t('log.originAlreadyAttacked'), 'info');
    return;
  }

  // Check supply cost (1 of each resource per battle)
  if (player.supplies.grain < RULES.COMBAT_SUPPLY_COST ||
      player.supplies.oil < RULES.COMBAT_SUPPLY_COST ||
      player.supplies.mineral < RULES.COMBAT_SUPPLY_COST) {
    addEvent(state, player.id, t('log.combatNoSupplies'), 'info');
    return;
  }

  let defenderId: SuperpowerId | null = null;
  let attackerUnits = 0;
  let defenderUnits = 0;

  if (bombardment) {
    // Bombardeio naval (manual Grow): "As esquadras também podem atacar os
    // exércitos a partir de um mar azul-claro adjacente." Uma esquadra num mar
    // COSTEIRO ataca exércitos inimigos num território costeiro adjacente. É só
    // dano — o território NÃO é conquistado (navio não ocupa terra; para ocupar,
    // desembarque um exército depois).
    const fromSea = state.seaZones[from];
    const territory = state.territories[target];
    if (!fromSea || !territory) return;
    if (fromSea.type !== 'coastal') {
      addEvent(state, player.id, t('log.bombardInvalidCoastal'), 'info');
      return;
    }
    if (!fromSea.adjacentTerritories.includes(target)) {
      addEvent(state, player.id, t('log.bombardInvalidAdj'), 'info');
      return;
    }
    if (territory.nuked) return;

    for (const [pid, p] of Object.entries(state.players) as [SuperpowerId, Player][]) {
      if (pid === player.id) continue;
      if ((p.armies[target] || 0) > 0) { defenderId = pid; break; }
    }
    // Sem exércitos mas com dono inimigo: o dono defende (sem unidades em campo).
    if (!defenderId && territory.owner && territory.owner !== player.id) {
      defenderId = territory.owner;
    }
    if (!defenderId) return;
    attackerUnits = player.navies[from] || 0;
    defenderUnits = state.players[defenderId].armies[target] || 0;
  } else if (targetType === 'territory') {
    const territory = state.territories[target];
    if (!territory) return;

    // Adjacency check — engine enforces what the UI already filters
    const fromTerritory = state.territories[from];
    if (!fromTerritory || !fromTerritory.adjacentTerritories.includes(target)) {
      addEvent(state, player.id, t('log.attackInvalidAdj'), 'info');
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
      addEvent(state, player.id, t('log.navalAttackInvalidAdj'), 'info');
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
    bombardment,
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
    reinforceAvailable: false,
    reinforceUsed: false,
    counterAttackAvailable: false,
    counterAttackUsed: false,
    counterResult: null,
  };
}

// TODO: confirmar regra original — manual Grow diz que, após o combate, o defensor
// pode mover reforços de territórios adjacentes para o território atacado. Não
// implementado: o combate resolve e o turno segue sem essa janela de reforço.
//
// TODO: confirmar regra original — manual Grow diz que o defensor pode contra-atacar
// uma vez por combate. Não implementado: apenas o atacante inicia combates. Para
// fidelizar seria necessário uma fase de "resposta do defensor" após o resultado do
// dado, com custo de suprimentos próprio.
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

  if (state.combat.bombardment) {
    // Bombardeio: atacante perde NAVIES (na origem-mar); defensor perde ARMIES (na terra).
    if (fromId) {
      attacker.navies[fromId] = Math.max(0, (attacker.navies[fromId] || 0) - attackerLosses);
      if (attacker.navies[fromId] <= 0) delete attacker.navies[fromId];
      dropOverCapacityEmbarked(attacker, fromId);
    }
    defender.armies[targetId] = Math.max(0, (defender.armies[targetId] || 0) - defenderLosses);
    if (defender.armies[targetId] <= 0) delete defender.armies[targetId];
  } else if (state.combat.targetType === 'territory') {
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
  // No bombardeio o atacante é uma esquadra (navies); o defensor é exército (armies).
  const attackerAfter = state.combat.bombardment
    ? (fromId ? (attacker.navies[fromId] || 0) : 0)
    : state.combat.targetType === 'territory'
    ? (fromId ? (attacker.armies[fromId] || 0) : 0)
    : (fromId ? (attacker.navies[fromId] || 0) : 0);
  const defenderAfter = state.combat.targetType === 'territory'
    ? (defender.armies[targetId] || 0)
    : (defender.navies[targetId] || 0);
  state.combat.attackerUnitsAfter = attackerAfter;
  state.combat.defenderUnitsAfter = defenderAfter;

  const fromName = locationName(fromId || '');
  const targetName = locationName(targetId);
  addEvent(state, attacker.id,
    t('log.combatResult', {
      from: fromName, to: targetName,
      atkDice: attackerDice.join(','), atkTotal: attackerTotal,
      defDice: defenderDice.join(','), defTotal: defenderTotal,
      atkLoss: attackerLosses, defLoss: defenderLosses,
    }),
    'combat'
  );

  // Bombardeio naval só causa dano: nunca ocupa nem abre resposta do defensor.
  // (manual Grow: navio não toma terra; para ocupar é preciso desembarcar exército)
  // TODO: confirmar regra original — reforço/contra-ataque do defensor após
  // bombardeio naval não implementado (simplificação de MVP).
  if (state.combat.bombardment) {
    if (defenderAfter <= 0) {
      addEvent(state, attacker.id,
        t('log.bombardCleared', { to: targetName }), 'combat');
    }
  // Only land territories can be occupied; naval battles just resolve.
  } else if (state.combat.targetType === 'territory') {
    if (defenderAfter <= 0) {
      // Pyrrhic: if attacker also wiped out, no occupation possible
      if (attackerAfter > 0) {
        state.combat.phase = 'occupy';
      }
      // else: both wiped out → stays at 'result', territory uncontested but attacker can't advance
    } else {
      // Defensor manteve o território → calcula disponibilidade de D6/D7.
      // Apenas SETA flags; não muta unidades nem reseta o combate, porque
      // rollCombat é compartilhado pelo fluxo humano (CombatModal lê 'result')
      // e por cpuAttack/planAiTurn (que leem os dados logo após). A resolução
      // (auto p/ IA, interativa p/ humano) é feita pelo caller.
      markDefenderResponseAvailability(state);
    }
  }
}

// ── D6/D7: disponibilidade da resposta do defensor ───────────────────────────
// Calcula se o defensor (que manteve o território) pode reforçar e/ou
// contra-atacar. Só land combat. Não muta unidades.
function markDefenderResponseAvailability(state: GameState): void {
  const { defenderId, targetId, fromId, targetType } = state.combat;
  if (targetType !== 'territory' || state.combat.bombardment || !defenderId || !targetId || !fromId) return;
  const defender = state.players[defenderId];
  const territory = state.territories[targetId];
  if (!territory) return;

  // Reforço: existe território adjacente do defensor com exército disponível?
  const hasReinforcement = territory.adjacentTerritories.some(
    tid => (defender.armies[tid] || 0) > 0 && state.territories[tid]?.owner === defenderId,
  );

  // Contra-ataque: precisa de 1 conjunto de suprimentos e de unidades no território.
  const hasSupplies = defender.supplies.grain >= RULES.COMBAT_SUPPLY_COST &&
    defender.supplies.oil >= RULES.COMBAT_SUPPLY_COST &&
    defender.supplies.mineral >= RULES.COMBAT_SUPPLY_COST;
  const hasUnits = (defender.armies[targetId] || 0) > 0;

  state.combat.reinforceAvailable = hasReinforcement && !state.combat.reinforceUsed;
  state.combat.counterAttackAvailable = hasSupplies && hasUnits && !state.combat.counterAttackUsed;
}

// Executa um reforço: move `count` exércitos de `from` para o território defendido
// (combat.targetId). Reforço pós-combate é uma reação defensiva — NÃO custa cereal
// (diferente do movimento do Estágio 5). // TODO: confirmar regra original sobre custo.
function performReinforcement(state: GameState, from: string, count: number): boolean {
  const { defenderId, targetId } = state.combat;
  if (!defenderId || !targetId) return false;
  const defender = state.players[defenderId];
  const territory = state.territories[targetId];
  const source = state.territories[from];
  // Só de território adjacente, do próprio defensor.
  if (!territory || !source || !territory.adjacentTerritories.includes(from)) return false;
  if (state.territories[from]?.owner !== defenderId) return false;

  const available = defender.armies[from] || 0;
  const toMove = Math.min(count, available);
  if (toMove <= 0) return false;

  defender.armies[from] = available - toMove;
  if (defender.armies[from] <= 0) delete defender.armies[from];
  defender.armies[targetId] = (defender.armies[targetId] || 0) + toMove;

  state.combat.reinforceUsed = true;
  state.combat.reinforceAvailable = false;
  addEvent(state, defenderId,
    t('log.reinforcement', { n: toMove, from: territoryName(from), to: territoryName(targetId) }), 'combat');
  return true;
}

// Executa o contra-ataque do defensor: rola dados do território defendido
// (combat.targetId) contra a origem do ataque original (combat.fromId). É uma
// troca de baixas (manual: "defensor pode contra-atacar uma vez"); NÃO conquista
// o território de origem mesmo se o limpar. // TODO: confirmar regra original —
// se um contra-ataque vitorioso permite AVANÇAR para a origem.
function performCounterAttack(state: GameState): boolean {
  const { attackerId, defenderId, fromId, targetId } = state.combat;
  if (!attackerId || !defenderId || !fromId || !targetId) return false;
  if (state.combat.counterAttackUsed) return false;

  const counterAttacker = state.players[defenderId]; // defensor original
  const counterDefender = state.players[attackerId]; // atacante original

  const caHasSupplies = counterAttacker.supplies.grain >= RULES.COMBAT_SUPPLY_COST &&
    counterAttacker.supplies.oil >= RULES.COMBAT_SUPPLY_COST &&
    counterAttacker.supplies.mineral >= RULES.COMBAT_SUPPLY_COST;
  if (!caHasSupplies) return false;

  // Custo de suprimentos do contra-atacante.
  counterAttacker.supplies.grain -= RULES.COMBAT_SUPPLY_COST;
  counterAttacker.supplies.oil -= RULES.COMBAT_SUPPLY_COST;
  counterAttacker.supplies.mineral -= RULES.COMBAT_SUPPLY_COST;

  const cdHasSupplies = counterDefender.supplies.grain >= RULES.COMBAT_SUPPLY_COST &&
    counterDefender.supplies.oil >= RULES.COMBAT_SUPPLY_COST &&
    counterDefender.supplies.mineral >= RULES.COMBAT_SUPPLY_COST;
  if (cdHasSupplies) {
    counterDefender.supplies.grain -= RULES.COMBAT_SUPPLY_COST;
    counterDefender.supplies.oil -= RULES.COMBAT_SUPPLY_COST;
    counterDefender.supplies.mineral -= RULES.COMBAT_SUPPLY_COST;
  }

  const caUnits = counterAttacker.armies[targetId] || 0; // defende em targetId
  const cdUnits = counterDefender.armies[fromId] || 0;   // atacante em fromId

  let caDice: number = RULES.ATTACKER_BASE_DICE;
  let cdDice: number = cdHasSupplies ? RULES.DEFENDER_BASE_DICE : RULES.DEFENDER_NO_SUPPLY_DICE;
  if (caUnits > cdUnits) caDice += RULES.BONUS_DICE_MAJORITY;
  if (cdUnits > caUnits) cdDice += RULES.BONUS_DICE_MAJORITY;
  if (counterAttacker.laserStars > counterDefender.laserStars) caDice += RULES.BONUS_DICE_LASER_STAR;
  if (counterDefender.laserStars > counterAttacker.laserStars) cdDice += RULES.BONUS_DICE_LASER_STAR;
  caDice = Math.min(caDice, RULES.MAX_DICE);
  cdDice = Math.min(cdDice, RULES.MAX_DICE);

  const caRoll = rollDice(caDice);
  const cdRoll = rollDice(cdDice);
  const caTotal = sumDice(caRoll);
  const cdTotal = sumDice(cdRoll);
  const caLosses = Math.floor(cdTotal / RULES.CASUALTIES_PER_POINTS);
  const cdLosses = Math.floor(caTotal / RULES.CASUALTIES_PER_POINTS);

  counterAttacker.armies[targetId] = Math.max(0, (counterAttacker.armies[targetId] || 0) - caLosses);
  if (counterAttacker.armies[targetId] <= 0) delete counterAttacker.armies[targetId];
  counterDefender.armies[fromId] = Math.max(0, (counterDefender.armies[fromId] || 0) - cdLosses);
  if (counterDefender.armies[fromId] <= 0) delete counterDefender.armies[fromId];

  const clearedTarget = (counterDefender.armies[fromId] || 0) <= 0;
  const targetName = territoryName(targetId);
  const fromName = territoryName(fromId);

  state.combat.counterResult = {
    counterAttackerId: defenderId,
    fromId: targetId,
    targetId: fromId,
    attackerDice: caRoll,
    defenderDice: cdRoll,
    counterAttackerLosses: caLosses,
    counterDefenderLosses: cdLosses,
    clearedTarget,
  };
  state.combat.counterAttackUsed = true;
  state.combat.counterAttackAvailable = false;

  addEvent(state, defenderId,
    t('log.counterAttack', {
      from: targetName, to: fromName,
      caDice: caRoll.join(','), caTotal, cdDice: cdRoll.join(','), cdTotal,
      caLoss: caLosses, cdLoss: cdLosses,
      cleared: clearedTarget ? t('log.counterCleared') : '',
    }),
    'combat');
  return true;
}

// Resolve a resposta do defensor automaticamente (defensor controlado por IA).
// Reforça se houver fronteira a segurar; contra-ataca conforme a agressividade.
// NÃO reseta o combate — o caller decide (mantém 'result' p/ apresentação humana).
function resolveDefenderResponseAuto(state: GameState): void {
  const { defenderId, targetId } = state.combat;
  if (!defenderId || !targetId) return;
  const defender = state.players[defenderId];
  const territory = state.territories[targetId];
  if (!territory) return;
  const aiConfig = getPlayerAIConfig(defender);

  // Reforço: traz metade do exército do vizinho mais populoso.
  if (state.combat.reinforceAvailable) {
    const sources = territory.adjacentTerritories.filter(
      tid => (defender.armies[tid] || 0) > 0 && state.territories[tid]?.owner === defenderId,
    );
    if (sources.length > 0) {
      const best = sources.reduce((a, b) => (defender.armies[a] || 0) >= (defender.armies[b] || 0) ? a : b);
      performReinforcement(state, best, Math.ceil((defender.armies[best] || 0) / 2));
    }
  }

  // Contra-ataque: decide por agressividade do perfil.
  if (state.combat.counterAttackAvailable && Math.random() < aiConfig.aggression) {
    performCounterAttack(state);
  }
}

function resetCombat(state: GameState): void {
  state.combat = {
    active: false, attackerId: null, defenderId: null, fromId: null, targetId: null,
    targetType: 'territory', bombardment: false, attackerUnits: 0, defenderUnits: 0,
    attackerUnitsAfter: 0, defenderUnitsAfter: 0, conquered: false,
    attackerDice: [], defenderDice: [], attackerLosses: 0, defenderLosses: 0,
    phase: 'select_target', defenderChoice: null,
    reinforceAvailable: false, reinforceUsed: false,
    counterAttackAvailable: false, counterAttackUsed: false, counterResult: null,
  };
}

function occupyTerritory(state: GameState, count: number = 1): void {
  if (!state.combat.active) return;
  const combat = state.combat;

  // Naval battles and naval bombardment are never "occupied" — just close out.
  if (combat.targetType === 'sea' || combat.bombardment || !combat.attackerId || !combat.targetId) {
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

  // Transfer ownership + capture company through the single claim path (also logs
  // whether a company was captured), then mark the combat as a conquest.
  const previousOwner = territory.owner;
  claimTerritory(state, targetId, attacker.id);
  state.combat.conquered = true;

  // Check elimination (last homeland captured)
  if (previousOwner) {
    const remainingHomeTerritories = Object.values(state.territories).filter(
      t => t.superpowerId === previousOwner && t.owner === previousOwner && !t.nuked
    );
    if (remainingHomeTerritories.length === 0) {
      eliminatePlayer(state, previousOwner, attacker.id);
    }
  }

  const movedCount = fromId ? (attacker.armies[targetId] || 0) : 1;
  addEvent(state, attacker.id, t('log.occupied', { terr: territoryName(targetId), n: movedCount }), 'combat');
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

  addEvent(state, conqueredBy, t('log.eliminated', { player: factionName(eliminatedId) }), 'elimination');

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
      addEvent(state, defender.id, t('log.nukeIntercepted', { roll }), 'nuclear');
      return;
    }
  }

  state.nuclearAttack.defenseRolls = rolls;
  state.nuclearAttack.phase = 'result';
}

function resolveNuke(state: GameState): void {
  if (!state.nuclearAttack.active || !state.nuclearAttack.targetId || !state.nuclearAttack.attackerId) return;

  if (state.nuclearAttack.intercepted) {
    addEvent(state, state.nuclearAttack.attackerId, t('log.nukeInterceptedShort'), 'nuclear');
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
    addEvent(state, attacker.id, t('log.nukeTerritory', { terr: territoryName(targetId) }), 'nuclear');

    // Check holocaust
    if (state.nukedTerritoryCount >= RULES.HOLOCAUST_THRESHOLD) {
      state.gameOver = true;
      state.winner = null;
      state.endCondition = 'holocaust';
      addEvent(state, attacker.id, t('log.holocaust'), 'nuclear');
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
        addEvent(state, player.id, t('log.nukeEliminated', { player: factionName(player.id) }), 'elimination');
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
    addEvent(state, attacker.id, t('log.nukeSea', { sea: seaName(targetId) }), 'nuclear');
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
  addEvent(state, player.id, t('log.builtNuke', { n: player.nukes }), 'build');
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
  addEvent(state, player.id, t('log.builtLaser', { n: player.laserStars }), 'build');
}

// ── Research: deck-based card draw system ─────────────────────────────────────

function drawResearchCardInternal(state: GameState): void {
  const session = state.researchSession;
  if (!session || session.found) return;

  const player = state.players[state.turn.currentPlayer];

  if (state.resourceDeck.length === 0) {
    addEvent(state, player.id, t('log.researchDeckEmpty'), 'build');
    finalizeResearch(state);
    return;
  }
  if (player.money < RULES.RESEARCH_COST_PER_CARD) {
    addEvent(state, player.id, t('log.researchNoMoney'), 'build');
    finalizeResearch(state);
    return;
  }

  player.money -= RULES.RESEARCH_COST_PER_CARD;
  session.totalCost += RULES.RESEARCH_COST_PER_CARD;
  const cardId = state.resourceDeck.shift()!;
  session.cardsRevealed.push(cardId);

  const foundNuke = isNukeCard(cardId);
  const foundLaser = isLaserCard(cardId);
  const foundTarget =
    (session.target === 'nuke' && foundNuke) ||
    (session.target === 'laser' && foundLaser);

  const { nukeCount, laserCount } = getTechCounts(state.resourceDeck);
  const targetName = t(session.target === 'nuke' ? 'tech.nukeTarget' : 'tech.laserTarget');
  const cardContext = t('draw.ctx.research', { tech: targetName, n: session.cardsRevealed.length });

  if (foundTarget) {
    session.found = true;
    if (session.target === 'nuke') {
      player.hasResearchedNuke = true;
    } else {
      player.hasResearchedLaserStar = true;
    }
    addEvent(state, player.id, t('log.researchFound', { tech: targetName, n: session.cardsRevealed.length, cost: fmtNum(session.totalCost) }), 'build');
    state.drawnCard = {
      active: true,
      type: session.target,
      success: true,
      cardName: t(session.target === 'nuke' ? 'tech.nuke' : 'tech.laser'),
      cardEffect: t('draw.eff.techUnlocked', { tech: targetName }),
      context: cardContext,
      cardId,
      researchTarget: session.target,
      researchCardsDrawn: session.cardsRevealed.length,
      researchCostSoFar: session.totalCost,
      deckRemaining: state.resourceDeck.length,
      nukeCardsRemaining: nukeCount,
      laserCardsRemaining: laserCount,
    };
    // Session is kept alive; finalizeResearch() is called in DISMISS_DRAWN_CARD
    // so the found tech card + all drawn cards return to the deck (per manual).
    return;
  }

  // Drew a tech card that isn't the target — discard it (consumed from deck)
  if (isTechCard(cardId)) {
    const otherName = t(foundNuke ? 'tech.nuke' : 'tech.laser');
    addEvent(state, player.id, t('log.researchOtherTech', { tech: otherName }), 'build');
    state.drawnCard = {
      active: true,
      type: foundNuke ? 'nuke' : 'laser',
      success: false,
      cardName: otherName,
      cardEffect: t('draw.eff.otherTech', { tech: targetName }),
      context: cardContext,
      cardId,
      researchTarget: session.target,
      researchCardsDrawn: session.cardsRevealed.length,
      researchCostSoFar: session.totalCost,
      deckRemaining: state.resourceDeck.length,
      nukeCardsRemaining: nukeCount,
      laserCardsRemaining: laserCount,
    };
    return;
  }

  // Regular resource card — reveal and discard
  const card = state.resourceCards[cardId];
  const resourceLabel = card ? resName(card.type) : t('draw.resourceFallback');
  const coName = card ? companyName(card.id, card.companyName) : t('draw.name.resourceCard');
  addEvent(state, player.id,
    t('log.researchResourceCard', { company: coName, res: resourceLabel, tech: targetName }), 'build');
  state.drawnCard = {
    active: true,
    type: 'resource',
    success: false,
    cardName: coName,
    cardEffect: card
      ? t('draw.eff.resourceInfo', { res: resourceLabel, prod: card.production, where: territoryName(card.territoryId) })
      : t('draw.eff.resourceReturn'),
    context: cardContext,
    cardId,
    resourceType: card?.type,
    companyName: card?.companyName,
    production: card?.production,
    researchTarget: session.target,
    researchCardsDrawn: session.cardsRevealed.length,
    researchCostSoFar: session.totalCost,
    deckRemaining: state.resourceDeck.length,
    nukeCardsRemaining: nukeCount,
    laserCardsRemaining: laserCount,
  };
}

function startResearch(state: GameState, target: 'nuke' | 'laser'): void {
  const player = state.players[state.turn.currentPlayer];
  const alreadyFound = target === 'nuke' ? player.hasResearchedNuke : player.hasResearchedLaserStar;
  if (alreadyFound) return;
  if (player.money < RULES.RESEARCH_COST_PER_CARD) return;

  if (!state.researchSession) {
    state.researchSession = { target, cardsRevealed: [], found: false, totalCost: 0 };
  }

  drawResearchCardInternal(state);
}

// AI-only: draw cards until the target tech card is found or money/deck runs out.
// All drawn cards return to the deck afterwards (per manual).
function researchInstant(state: GameState, target: 'nuke' | 'laser'): void {
  const player = state.players[state.turn.currentPlayer];
  const alreadyFound = target === 'nuke' ? player.hasResearchedNuke : player.hasResearchedLaserStar;
  if (alreadyFound) return;

  const techName = t(target === 'nuke' ? 'tech.nukeTarget' : 'tech.laserTarget');
  const drawnCardIds: string[] = [];
  let totalCost = 0;
  let found = false;

  while (
    state.resourceDeck.length > 0 &&
    player.money >= RULES.RESEARCH_COST_PER_CARD
  ) {
    player.money -= RULES.RESEARCH_COST_PER_CARD;
    totalCost += RULES.RESEARCH_COST_PER_CARD;
    const cardId = state.resourceDeck.shift()!;
    drawnCardIds.push(cardId);

    const foundTarget =
      (target === 'nuke' && isNukeCard(cardId)) ||
      (target === 'laser' && isLaserCard(cardId));

    if (foundTarget) {
      if (target === 'nuke') player.hasResearchedNuke = true;
      else player.hasResearchedLaserStar = true;
      addEvent(state, player.id,
        t('log.aiResearchFound', { tech: techName, n: drawnCardIds.length, cost: fmtNum(totalCost) }), 'build');
      found = true;
      break;
    }
  }

  // Return all drawn cards to deck and reshuffle (per manual: cards always return)
  if (drawnCardIds.length > 0) {
    state.resourceDeck.push(...drawnCardIds);
    state.resourceDeck = shuffleArray(state.resourceDeck);
  }

  if (!found && drawnCardIds.length > 0) {
    addEvent(state, player.id,
      t('log.aiResearchNotFound', { tech: techName, n: drawnCardIds.length, cost: fmtNum(totalCost) }), 'build');
  }
}

function researchNuke(state: GameState, _cardId: string): void {
  startResearch(state, 'nuke');
}

function researchLaserStar(state: GameState, _cardId: string): void {
  startResearch(state, 'laser');
}

function takeLoan(state: GameState, amount: number): void {
  const player = state.players[state.turn.currentPlayer];
  const loanAmount = Math.floor(amount / RULES.LOAN_MULTIPLE) * RULES.LOAN_MULTIPLE;
  if (loanAmount <= 0) return;

  player.money += loanAmount;
  player.loans += loanAmount;
  addEvent(state, player.id, t('log.loanTaken', { amount: fmtNum(loanAmount), total: fmtNum(player.loans) }), 'economy');
}

function payLoan(state: GameState, amount: number): void {
  const player = state.players[state.turn.currentPlayer];
  const payment = Math.min(amount, player.loans, player.money);
  if (payment <= 0) return;

  player.money -= payment;
  player.loans -= payment;
  addEvent(state, player.id, t('log.loanPaid', { payment: fmtNum(payment), remaining: fmtNum(player.loans) }), 'economy');
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

  // Decisão de estágios opcionais delegada ao AIEngine, conforme o perfil de
  // dificuldade deste jogador. O motor já respeita RULES.MAX_OPTIONAL_STAGES.
  const aiConfig = getPlayerAIConfig(player);
  // Modo Digital Balanceado: se a venda simultânea já consumiu 1 ação, restam 2.
  const cpuCap = RULES.MAX_OPTIONAL_STAGES - state.turn.optionalStagesUsed.length;
  const { stages: sorted, decisions } = chooseOptionalStages(state, player, aiConfig, cpuCap);
  for (const d of decisions) {
    addEvent(state, player.id, t('log.aiDecision', { player: factionName(player.id), reason: t(d.reason as TranslationKey) }), 'info');
  }

  for (const stage of sorted) {
    state.turn.optionalStagesUsed.push(stage);
    state.turn.stage = stage;

    switch (stage) {
      case 3: // Sell
        cpuSell(state, player);
        break;
      case 4: { // Attack
        const atk = cpuAttack(state, player);
        // D6/D7: se o defensor é humano e pode responder, pausa o turno da IA.
        // O humano age via CombatModal; FINISH_DEFENDER_RESPONSE avança o turno.
        if (atk?.awaitingDefenderResponse) return;
        break;
      }
      case 5: // Move (land + naval)
        cpuMove(state, player, aiConfig);
        break;
      case 6: // Build
        cpuBuild(state, player);
        break;
      case 7: // Buy
        cpuBuy(state, player);
        break;
    }
  }

  // Research nukes if affordable and not yet researched (AI instant resolve).
  // Só perfis com usesTechStrategy investem na corrida tecnológica.
  if (sorted.includes(6) && shouldResearchTech(player, aiConfig)) {
    researchInstant(state, 'nuke');
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
  // D6/D7: true se o defensor é HUMANO e a IA precisa pausar para a resposta dele.
  awaitingDefenderResponse?: boolean;
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
          fromName: territoryName(territoryId),
          targetName: territoryName(adjId),
          defenderName: factionShort(defenderId),
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
          // Defensor sobreviveu → D6/D7.
          const defender = state.players[defenderId];
          const hasResponse = state.combat.reinforceAvailable || state.combat.counterAttackAvailable;
          if (defender.isHuman && hasResponse) {
            // Pausa: humano decide reforçar/contra-atacar pela CombatModal.
            // Não reseta — o combate fica em 'defender_response' para o snapshot.
            state.combat.phase = 'defender_response';
            result.awaitingDefenderResponse = true;
          } else {
            // Defensor IA (ou humano sem opções) → resolve automaticamente.
            resolveDefenderResponseAuto(state);
            resetCombat(state);
          }
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

interface CpuMoveResult {
  kind: 'land' | 'naval' | 'embark' | 'amphibious';
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  count: number;
  claimed: boolean; // ocupou um território neutro
}

// Movimento da IA (Estágio 5) — terrestre + naval. Usa EXATAMENTE os mesmos
// executores do humano (moveArmy/moveNavy), que validam adjacência, custo de
// cereal/petróleo e bloqueio por território inimigo. A IA só PLANEJA leituras
// read-only e depois executa, no máximo 2 movimentos terrestres + 1 naval por
// turno (mantém o turno legível no mobile e o custo de recursos sob controle).
function cpuMove(state: GameState, player: typeof state.players[SuperpowerId], config: AIConfig): CpuMoveResult[] {
  const results: CpuMoveResult[] = [];
  const enemyForces = (tid: string): number => {
    let f = 0;
    for (const [pid, p] of Object.entries(state.players)) {
      if (pid === player.id) continue;
      f += (p as Player).armies[tid] || 0;
    }
    return f;
  };

  // Planeja (read-only): expansão para terra neutra e reforço de fronteira.
  const expansion: Array<{ from: string; to: string }> = [];
  const reinforce: Array<{ from: string; to: string }> = [];

  for (const [tid, count] of Object.entries(player.armies)) {
    const t = state.territories[tid];
    if (!t) continue;
    // Expansão: tropa sobrando (≥2) ao lado de terra neutra e livre de inimigo.
    if (count >= 2) {
      const to = t.adjacentTerritories.find(adj => {
        const at = state.territories[adj];
        return at && !at.nuked && at.owner === null && enemyForces(adj) === 0;
      });
      if (to) expansion.push({ from: tid, to });
    }
    // Reforço: território próprio ameaçado com um vizinho próprio doador (≥2).
    if (t.owner === player.id) {
      const threatened = t.adjacentTerritories.some(adj => {
        const at = state.territories[adj];
        return at && at.owner && at.owner !== player.id && enemyForces(adj) >= count;
      });
      if (threatened) {
        const donor = t.adjacentTerritories.find(adj =>
          state.territories[adj]?.owner === player.id && (player.armies[adj] || 0) >= 2);
        if (donor) reinforce.push({ from: donor, to: tid });
      }
    }
  }

  // Perfis defensivos reforçam primeiro; os demais expandem primeiro.
  const landPlan = (config.defensePriority > config.expansionPriority
    ? [...reinforce, ...expansion]
    : [...expansion, ...reinforce]
  ).slice(0, 2);

  for (const mv of landPlan) {
    if (player.supplies.grain < RULES.LAND_MOVE_GRAIN_COST) break;
    if ((player.armies[mv.from] || 0) < 2) continue; // mantém ao menos 1 na origem
    const fromT = state.territories[mv.from];
    const toT = state.territories[mv.to];
    const beforeOwner = toT?.owner ?? null;
    const beforeCount = player.armies[mv.to] || 0;
    moveArmy(state, mv.from, mv.to, 1);
    if ((player.armies[mv.to] || 0) > beforeCount) {
      results.push({
        kind: 'land',
        fromId: mv.from, toId: mv.to,
        fromName: territoryName(mv.from), toName: territoryName(mv.to),
        count: 1,
        claimed: state.territories[mv.to]?.owner === player.id && beforeOwner !== player.id,
      });
    }
  }

  // Invasão anfíbia (no máximo UMA por turno): embarca tropa de um território
  // costeiro próprio, navega (se preciso) e desembarca em terra costeira NEUTRA e
  // desguarnecida que não dá para alcançar por terra. Usa os MESMOS executores do
  // humano (embark/moveNavy/disembark); disembark conquista terra neutra/vazia e
  // recusa terra inimiga — assalto a inimigo continua só pela fase de Combate.
  const didAmphibious = tryAmphibiousInvasion(state, player, results);

  // Naval (reposição): só se NÃO houve invasão anfíbia (a frota já teria sido usada).
  // Aproxima UMA frota de um mar adjacente que toque terra inimiga.
  if (!didAmphibious && player.supplies.oil >= RULES.SEA_MOVE_OIL_COST) {
    for (const [seaId, navies] of Object.entries(player.navies)) {
      if (navies <= 0) continue;
      const sea = state.seaZones[seaId];
      if (!sea) continue;
      const to = sea.adjacentSeas.find(adjSea => {
        const target = state.seaZones[adjSea];
        return target && target.adjacentTerritories.some(t => {
          const terr = state.territories[t];
          return terr && terr.owner && terr.owner !== player.id;
        });
      });
      if (to) {
        const beforeCount = player.navies[to] || 0;
        moveNavy(state, seaId, to, 1);
        if ((player.navies[to] || 0) > beforeCount) {
          results.push({
            kind: 'naval',
            fromId: seaId, toId: to,
            fromName: seaName(seaId), toName: seaName(to),
            count: 1, claimed: false,
          });
        }
        break; // um movimento naval por turno
      }
    }
  }

  return results;
}

// Executa UMA invasão anfíbia a partir do plano do engine (planAmphibiousInvasion,
// fonte única read-only). Embarca → navega a rota (0..N pernas) → desembarca, usando
// os MESMOS executores do humano (embark/moveNavy/disembark). disembark conquista
// terra neutra/vazia e recusa terra inimiga — assalto a inimigo só pela fase de
// Combate. Retorna true se comprometeu a frota (mesmo que a rota falhe no meio, as
// tropas ficam embarcadas em estado válido p/ continuar no próximo turno).
function tryAmphibiousInvasion(
  state: GameState,
  player: typeof state.players[SuperpowerId],
  results: CpuMoveResult[],
): boolean {
  const plan = planAmphibiousInvasion(state, player);
  if (!plan) return false;

  const startLen = results.length;

  // 1) Embarca, se há origem (mantém ≥1 defendendo; até 3 por legibilidade).
  if (plan.embarkTerritory) {
    const capacity = plan.navies * RULES.NAVY_TRANSPORT_CAPACITY;
    const toEmbark = Math.min(plan.spareArmies, capacity - (player.embarked[plan.startSea] || 0), 3);
    if (toEmbark > 0) {
      const before = player.embarked[plan.startSea] || 0;
      embark(state, plan.embarkTerritory, plan.startSea, toEmbark);
      const embarked = (player.embarked[plan.startSea] || 0) - before;
      if (embarked > 0) {
        results.push({
          kind: 'embark',
          fromId: plan.embarkTerritory, toId: plan.startSea,
          fromName: territoryName(plan.embarkTerritory),
          toName: seaName(plan.startSea),
          count: embarked, claimed: false,
        });
      }
    }
  }
  if ((player.embarked[plan.startSea] || 0) <= 0) return results.length > startLen;

  // 2) Navega cada perna da rota, carregando a tropa embarcada (move a frota inteira
  //    → a capacidade de transporte acompanha). Para se uma perna for bloqueada.
  let currentSea = plan.startSea;
  for (let i = 0; i < plan.route.length - 1; i++) {
    const to = plan.route[i + 1];
    const navHere = player.navies[currentSea] || 0;
    if (navHere <= 0) break;
    const beforeNavy = player.navies[to] || 0;
    moveNavy(state, currentSea, to, navHere);
    if ((player.navies[to] || 0) <= beforeNavy) break; // bloqueado / sem petróleo
    results.push({
      kind: 'naval',
      fromId: currentSea, toId: to,
      fromName: seaName(currentSea),
      toName: seaName(to),
      count: navHere, claimed: false,
    });
    currentSea = to;
  }

  // 3) Desembarca → conquista a terra neutra desguarnecida (mesma regra do humano).
  //    Só se a frota de fato chegou a um mar que toca o alvo (rota pode ter parado antes).
  const landed = player.embarked[currentSea] || 0;
  const touchesTarget = state.seaZones[currentSea]?.adjacentTerritories.includes(plan.landTerritory);
  if (landed > 0 && touchesTarget) {
    const beforeOwner = state.territories[plan.landTerritory]?.owner ?? null;
    disembark(state, currentSea, plan.landTerritory, landed);
    const claimed = state.territories[plan.landTerritory]?.owner === player.id && beforeOwner !== player.id;
    results.push({
      kind: 'amphibious',
      fromId: currentSea, toId: plan.landTerritory,
      fromName: seaName(currentSea),
      toName: territoryName(plan.landTerritory),
      count: landed, claimed,
    });
  }

  return results.length > startLen; // comprometeu a frota → não faz reposição naval
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
  const aiConfig = getPlayerAIConfig(player);
  const STEP_MS = aiConfig.thinkingDelayMs; // delay visível por ação, conforme a dificuldade

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
    title: t('present.step.salaryTitle'),
    description: salaryCost > 0
      ? t('present.step.salaryDesc', { cost: fmtNum(salaryCost), units: unitCount, companies: player.resourceCards.length })
      : t('present.step.salaryNone'),
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
    title: t('present.step.productionTitle'),
    description: totalProduced > 0
      ? t('present.step.productionDesc', { grain: grainGained, gn: resName('grain'), oil: oilGained, on: resName('oil'), mineral: mineralGained, mn: resName('mineral') })
      : t('present.step.productionNone'),
    resourceChanges: { grain: grainGained, oil: oilGained, mineral: mineralGained },
    soundKey: totalProduced > 0 ? 'resource-gain' : undefined,
    durationMs: STEP_MS,
  });

  // ── Choose optional stages via AIEngine (perfil de dificuldade) ──────────
  const p = state.players[playerId];
  const planCap = RULES.MAX_OPTIONAL_STAGES - state.turn.optionalStagesUsed.length;
  const { stages: sorted, decisions } = chooseOptionalStages(state, p, aiConfig, planCap);
  const reasonByStage = new Map<OptionalStage, string>(decisions.map(d => [d.stage, d.reason]));
  let actionIndex = 0;

  for (const stage of sorted) {
    state.turn.optionalStagesUsed.push(stage);
    state.turn.stage = stage;
    actionIndex++;
    const reason = reasonByStage.get(stage);
    if (reason) {
      // Log visível "ação X/N: motivo" — mobile-first, não depende de tooltip.
      addEvent(state, playerId, t('log.aiAction', { player: factionName(playerId), i: actionIndex, n: sorted.length, reason: t(reason as TranslationKey) }), 'info');
    }

    switch (stage) {
      case 3: { // Sell — one announcement per resource type
        const resources: ResourceType[] = ['grain', 'oil', 'mineral'];
        for (const r of resources) {
          if (state.players[playerId].supplies[r] > 4) {
            const qty = state.players[playerId].supplies[r] - 3;
            const moneyBefore = state.players[playerId].money;
            sellResource(state, r, qty);
            const revenue = state.players[playerId].money - moneyBefore;
            pushStep({
              phase: 3,
              actionType: 'sell_resource',
              title: t('present.step.sellTitle', { qty, res: resName(r) }),
              description: t('present.step.sellDesc', { revenue: fmtNum(revenue) }),
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
            title: conquered ? t('present.step.attackVictory', { to: targetName }) : t('present.step.attackFailed', { to: targetName }),
            description: conquered
              ? t('present.step.attackDescVictory', { atkDice: attackResult.attackerDice.join(','), atkTotal: attackerTotal, defDice: attackResult.defenderDice.join(','), defTotal: defenderTotal, defender: defenderName })
              : t('present.step.attackDescFailed', { atkDice: attackResult.attackerDice.join(','), atkTotal: attackerTotal, defDice: attackResult.defenderDice.join(','), defTotal: defenderTotal, defender: defenderName }),
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
          // D6/D7: defensor humano pode responder. O combate fica pausado em
          // 'defender_response' no snapshot. Para a apresentação aqui: o humano
          // age via CombatModal e FINISH_DEFENDER_RESPONSE encerra o turno da IA.
          if (attackResult.awaitingDefenderResponse) return steps;
        }
        break;
      }

      case 5: { // Move (land + naval + anfíbio) — one announcement per move
        const moves = cpuMove(state, state.players[playerId], aiConfig);
        for (const mv of moves) {
          let title: string;
          let description: string;
          switch (mv.kind) {
            case 'naval':
              title = t('present.step.navalTitle', { to: mv.toName });
              description = t('present.step.navalDesc', { from: mv.fromName });
              break;
            case 'embark':
              title = t('present.step.embarkTitle');
              description = t('present.step.embarkDesc', { count: mv.count, from: mv.fromName, to: mv.toName });
              break;
            case 'amphibious':
              title = mv.claimed ? t('present.step.amphibiousOccupied', { to: mv.toName }) : t('present.step.amphibiousLanded', { to: mv.toName });
              description = t('present.step.amphibiousDesc', { count: mv.count, from: mv.fromName });
              break;
            default: // 'land'
              title = mv.claimed ? t('present.step.landOccupied', { to: mv.toName }) : t('present.step.landReinforced', { to: mv.toName });
              description = t('present.step.landDesc', { count: mv.count, from: mv.fromName });
          }
          pushStep({
            phase: 5,
            actionType: 'move',
            title,
            description,
            fromId: mv.fromId,
            toId: mv.toId,
            armyDelta: mv.kind === 'land' || mv.kind === 'amphibious' ? mv.count : undefined,
            navyDelta: mv.kind === 'naval' ? mv.count : undefined,
            soundKey: mv.claimed ? 'territory-conquered' : 'resource-gain',
            durationMs: STEP_MS,
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
            const tName = territoryName(loc);
            pushStep({
              phase: 6,
              actionType: 'build_armies',
              title: t('present.step.buildArmiesTitle', { n: built }),
              description: t('present.step.buildAt', { place: tName }),
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
            const sName = seaName(loc);
            pushStep({
              phase: 6,
              actionType: 'build_navies',
              title: t('present.step.buildNaviesTitle', { n: built }),
              description: t('present.step.buildAt', { place: sName }),
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
                title: t('present.step.buyTitle', { n: bought, res: resName(r) }),
                description: t('present.step.buyDesc', { spent: fmtNum(spent) }),
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

  // ── Research nukes — card-by-card so human player sees each draw ────────────
  // Só perfis com usesTechStrategy entram na corrida tecnológica.
  if (sorted.includes(6) && shouldResearchTech(state.players[playerId], aiConfig)) {
    const techName = t('tech.nukeTarget');
    const drawnForResearch: string[] = [];
    let researchCost = 0;
    let foundNuke = false;

    while (
      state.resourceDeck.length > 0 &&
      state.players[playerId].money >= RULES.RESEARCH_COST_PER_CARD
    ) {
      state.players[playerId].money -= RULES.RESEARCH_COST_PER_CARD;
      researchCost += RULES.RESEARCH_COST_PER_CARD;
      const cardId = state.resourceDeck.shift()!;
      drawnForResearch.push(cardId);

      const isTargetCard = isNukeCard(cardId);
      const card = state.resourceCards[cardId];
      const cardEmoji = isNukeCard(cardId) ? '☢️'
        : isLaserCard(cardId) ? '🛡️'
        : card?.type === 'grain' ? '🌾'
        : card?.type === 'oil' ? '🛢️'
        : '⛏️';
      const cardName = isNukeCard(cardId) ? t('tech.nuke')
        : isLaserCard(cardId) ? t('tech.laser')
        : card ? companyName(card.id, card.companyName) : t('draw.name.resourceCard');

      pushStep({
        phase: 6,
        actionType: 'card_reveal',
        title: isTargetCard ? t('present.step.techFound', { tech: techName }) : t('present.step.cardRevealed', { emoji: cardEmoji, card: cardName }),
        description: isTargetCard
          ? t('present.step.techFoundDesc', { player: factionShort(playerId), n: drawnForResearch.length, cost: fmtNum(researchCost) })
          : t('present.step.searchingTech', { tech: techName, n: drawnForResearch.length }),
        soundKey: isTargetCard ? 'territory-conquered' : 'resource-gain',
        durationMs: STEP_MS,
      });

      if (isTargetCard) {
        state.players[playerId].hasResearchedNuke = true;
        foundNuke = true;
        break;
      }
    }

    // Return all drawn cards to deck (per manual: cards always return)
    if (drawnForResearch.length > 0) {
      state.resourceDeck.push(...drawnForResearch);
      state.resourceDeck = shuffleArray(state.resourceDeck);
    }

    if (!foundNuke && drawnForResearch.length > 0) {
      addEvent(state, playerId,
        t('log.aiResearchNotFound', { tech: techName, n: drawnForResearch.length, cost: fmtNum(researchCost) }), 'build');
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
      title: t('present.step.endTurnTitle'),
      description: t('present.step.endTurnDesc', { player: factionName(playerId) }),
      durationMs: 1500,
    } as PlayerActionEvent,
    stateAfter: JSON.parse(JSON.stringify(state)),
  });

  return steps;
}

// ============================================================
// STORE
// ============================================================

// Migração de saves anteriores ao Modo Digital Balanceado. Saves antigos não
// têm marketMode (→ 'classic', preserva o comportamento original) nem a fatia
// simultaneousSell (→ inativa). Nunca dispara a fase nova em jogos antigos.
function migrateBalancedFields(state: GameState): void {
  if (!state.config.marketMode) state.config.marketMode = 'classic';
  if (state.simultaneousSell === undefined) {
    state.simultaneousSell = {
      phase: 'inactive',
      round: 0,
      lastResolvedRound: 0,
      priceSnapshot: { ...state.market.prices },
      declarations: {},
      soldThisRound: [],
      resolution: null,
    };
  }
  if (state.turn && (state.turn as any).upkeepPreprocessed === undefined) {
    state.turn.upkeepPreprocessed = false;
  }
}

// ============================================================
// REDUCER PURO — fonte única de verdade da transição de estado.
// (state, action) => novo state, SEM efeitos colaterais (sem set/
// localStorage). Usado tanto pelo dispatch local quanto pelo
// multiplayer (computeNextState no servidor/adapter). As ações
// APPLY_AI_STEP e LOAD_GAME são tratadas no dispatch (substituem o
// estado direto) e não passam por aqui.
// ============================================================
export function applyGameAction(game: GameState, action: GameAction): GameState {
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
      prospect(state, action.resourceType);
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
    case 'ATTACK_LAND_FROM_SEA':
      initiateAttack(state, action.from, action.target, 'territory', true);
      break;
    case 'ROLL_COMBAT':
      rollCombat(state);
      if (state.combat.active && state.combat.phase === 'result') {
        resolveDefenderResponseAuto(state);
      }
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
      finalizeResearch(state);
      finalizeProspect(state);
      state.drawnCard = null;
      break;
    case 'DRAW_RESEARCH_CARD':
      state.drawnCard = null;
      drawResearchCardInternal(state);
      break;
    case 'STOP_RESEARCH':
      finalizeResearch(state);
      state.drawnCard = null;
      break;
    case 'DRAW_PROSPECT_CARD':
      state.drawnCard = null;
      drawProspectCardInternal(state);
      break;
    case 'STOP_PROSPECT':
      finalizeProspect(state);
      state.drawnCard = null;
      break;
    case 'REINFORCE_AFTER_COMBAT': {
      if (state.combat.phase !== 'defender_response') break;
      performReinforcement(state, action.from, action.count);
      break;
    }
    case 'COUNTER_ATTACK': {
      if (state.combat.phase !== 'defender_response') break;
      performCounterAttack(state);
      break;
    }
    case 'FINISH_DEFENDER_RESPONSE': {
      if (state.combat.phase !== 'defender_response') break;
      const wasAiTurn = !state.players[state.turn.currentPlayer].isHuman;
      resetCombat(state);
      if (wasAiTurn) advanceToNextPlayer(state);
      break;
    }
    case 'OPEN_SIMULTANEOUS_SELL':
      openSimultaneousSell(state);
      break;
    case 'SUBMIT_SELL_DECLARATION':
      submitSellDeclaration(state, action.playerId, action.grain, action.oil, action.mineral);
      break;
    case 'RESOLVE_SIMULTANEOUS_SELL':
      resolveSimultaneousSell(state);
      break;
    case 'ACK_SIMULTANEOUS_SELL':
      ackSimultaneousSell(state);
      break;
    case 'DECLARE_DETENTE': {
      state.gameOver = true;
      state.endCondition = 'detente';
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
  }

  return state;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  selectedTerritory: null,
  selectedSeaZone: null,
  uiMode: 'map',
  buildAction: null,
  companyMapVisible: false,
  onlineSubmit: null,

  setOnlineSubmit: (fn) => set({ onlineSubmit: fn }),
  setCompanyMapVisible: (v) => set({ companyMapVisible: v }),

  startGame: (humanPlayer: SuperpowerId, aiCount: number, aiDifficulty?: AIDifficulty, marketMode?: MarketMode) => {
    const otherIds = shuffleArray(SUPERPOWER_IDS.filter(id => id !== humanPlayer));
    const activeAiIds = otherIds.slice(0, Math.min(aiCount, otherIds.length));
    const game = createInitialGameState(humanPlayer, activeAiIds, aiDifficulty, marketMode);
    set({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map', buildAction: null, companyMapVisible: false });
    localStorage.setItem('supremacia_save', JSON.stringify(game));
  },

  dispatch: (action: GameAction) => {
    const { game, onlineSubmit } = get();
    if (!game || game.gameOver) return;

    // Multiplayer online: as ações de jogo do humano vão para o servidor (turn
    // lock + versão lá). O snapshot autoritativo volta via loadGame. APPLY_AI_STEP
    // e LOAD_GAME substituem o estado direto e permanecem locais.
    if (onlineSubmit && action.type !== 'APPLY_AI_STEP' && action.type !== 'LOAD_GAME') {
      onlineSubmit(action);
      return;
    }

    // APPLY_AI_STEP / LOAD_GAME aplicam um GameState pronto (não passam pelo reducer).
    if (action.type === 'APPLY_AI_STEP') {
      set({ game: action.state, buildAction: null });
      localStorage.setItem('supremacia_save', JSON.stringify(action.state));
      return;
    }
    if (action.type === 'LOAD_GAME') {
      const loaded = action.state;
      if (loaded.researchSession === undefined) loaded.researchSession = null;
      if (loaded.prospectingSession === undefined) loaded.prospectingSession = null;
      migrateBalancedFields(loaded);
      set({ game: loaded });
      return;
    }

    const state = applyGameAction(game, action);

    // A pending build target selection only makes sense within the same stage of
    // the same player's turn — drop it whenever either changes so the map never
    // stays in "tap to build" mode in another phase.
    const stageOrPlayerChanged =
      state.turn.stage !== game.turn.stage || state.turn.currentPlayer !== game.turn.currentPlayer;

    // Auto-reveal the company-map overlay the instant the human acquires a new
    // company card (prospecting hit or conquest capture) so the territory's
    // turquoise/amber highlight is already on when the card modal is dismissed —
    // no manual toggle, phase change, or click needed. The toggle still resets
    // between turns (hotseat privacy) and can be turned off manually.
    const actor = game.turn.currentPlayer;
    const gainedCard =
      !!game.players[actor]?.isHuman &&
      (state.players[actor]?.resourceCards.length ?? 0) > (game.players[actor]?.resourceCards.length ?? 0);

    set({
      game: state,
      ...(stageOrPlayerChanged ? { buildAction: null } : {}),
      ...(gainedCard ? { companyMapVisible: true } : {}),
    });
    // Auto-save
    localStorage.setItem('supremacia_save', JSON.stringify(state));
  },

  selectTerritory: (id) => set({ selectedTerritory: id, selectedSeaZone: null }),
  selectSeaZone: (id) => set({ selectedSeaZone: id, selectedTerritory: null }),
  setUiMode: (mode) => set({ uiMode: mode }),
  setBuildAction: (action) => set({ buildAction: action, selectedTerritory: null, selectedSeaZone: null }),

  loadGame: (state: GameState) => {
    // Migrate saves that pre-date the config field
    if (!state.config) {
      state.config = {
        humanPlayers: 1,
        aiPlayers: 5,
        totalActivePlayers: 6,
        maxPlayers: 6,
        multiplayerReady: false,
        marketMode: 'classic',
      };
    }
    migrateBalancedFields(state);
    // Migrate players that pre-date the type field
    for (const p of Object.values(state.players)) {
      if (!p.type) (p as any).type = p.isHuman ? 'human' : 'ai';
    }
    if (state.prospectingSession === undefined) (state as any).prospectingSession = null;
    // Migrate saves that pre-date the per-turn unit-build counter
    if (state.turn && (state.turn as any).unitsBuiltThisTurn === undefined) {
      (state.turn as any).unitsBuiltThisTurn = 0;
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
