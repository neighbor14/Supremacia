// ============================================================
// SUPREMACIA DIGITAL — AIEngine
// ============================================================
// Motor de decisão da IA. Funções PURAS e read-only: analisam o
// estado, listam as ações opcionais legais, dão um score a cada uma
// (e a pares), e escolhem quais executar conforme o perfil.
//
// O motor NÃO muta o estado e NÃO executa ações — quem executa são
// os executores já existentes no store (cpuSell/cpuAttack/cpuBuild/
// cpuBuy). Assim a IA usa exatamente o mesmo caminho de regras do
// humano; a dificuldade vem só da QUALIDADE da escolha.
//
// Unidade de decisão = "ação opcional" = um estágio opcional do turno
// (3 vender, 4 combate, 5 movimento, 6 construção, 7 mercado). O spec
// fala em evaluateAction/evaluateActionPair; aqui "action" é um
// AICandidate (estágio + metadados), fiel à estrutura de turno real.
// ============================================================

import { GameState, Player, ResourceType, SuperpowerId } from '../types';
import { RULES } from '../rulesConfig';
import { AIConfig, getConfigForDifficulty } from './aiConfig';
import { isSimultaneousSellRound } from '../simultaneousSell';

export type OptionalStage = 3 | 4 | 5 | 6 | 7;

// Estágios opcionais que a IA sabe EXECUTAR (mesmos executores do humano).
// 3 vender · 4 combate · 5 movimento (terrestre + naval) · 6 construção · 7 mercado.
export const EXECUTABLE_OPTIONAL_STAGES: OptionalStage[] = [3, 4, 5, 6, 7];

const RESOURCES: ResourceType[] = ['grain', 'oil', 'mineral'];

export interface AICandidate {
  stage: OptionalStage;
}

export interface AIEvaluation {
  stage: OptionalStage;
  score: number;
  /** Texto curto para o log: por que a IA quer este estágio. */
  reason: string;
  /** Sub-scores para debug/tuning. */
  breakdown: {
    economyScore: number;
    militaryScore: number;
    defenseScore: number;
    expansionScore: number;
    marketScore: number;
    techScore: number;
    salaryRiskPenalty: number;
    vulnerabilityPenalty: number;
    opportunityScore: number;
  };
}

export interface AIDecision {
  stage: OptionalStage;
  reason: string;
  score: number;
}

export interface AIChoice {
  stages: OptionalStage[];
  decisions: AIDecision[];
}

// ────────────────────────────────────────────────────────────
// Análise read-only do estado (mesma informação visível ao humano)
// ────────────────────────────────────────────────────────────

function unitTotal(player: Player): number {
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  return sum(player.armies) + sum(player.navies) + sum(player.embarked || {});
}

/** Salário projetado para o PRÓXIMO upkeep (mesma fórmula do store). */
function salaryForecast(player: Player): number {
  const units = unitTotal(player);
  const companies = player.resourceCards.length;
  return (
    units * RULES.SALARY_PER_UNIT +
    companies * RULES.SALARY_PER_COMPANY +
    Math.floor(player.loans * RULES.LOAN_INTEREST_RATE)
  );
}

/** Quanto falta para ter pelo menos `keep` de cada recurso (0 = ok). */
function shortage(player: Player, keep = 2): number {
  return RESOURCES.reduce((acc, r) => acc + Math.max(0, keep - player.supplies[r]), 0);
}

/** Excedente acima de `keep` de cada recurso. */
function excess(player: Player, keep = 3): number {
  return RESOURCES.reduce((acc, r) => acc + Math.max(0, player.supplies[r] - keep), 0);
}

function marketMid(state: GameState): number {
  return (state.market.minPrice + state.market.maxPrice) / 2;
}

// ────────────────────────────────────────────────────────────
// Leitura da ECONOMIA PÚBLICA dos rivais (mesma info que o humano vê no
// placar de jogadores). NÃO é informação oculta: dinheiro, recursos, nº de
// companhias, unidades, ogivas/laser e empréstimos são todos públicos.
// ────────────────────────────────────────────────────────────

/**
 * Riqueza pública de um jogador — MESMA fórmula da vitória por Détente
 * (`calculateWealth` no store), calculada só sobre informação pública.
 * É a régua que a IA usa para comparar a sua posição com a dos rivais.
 */
export function publicWealth(state: GameState, p: Player): number {
  return (
    p.money +
    p.supplies.grain * state.market.prices.grain +
    p.supplies.oil * state.market.prices.oil +
    p.supplies.mineral * state.market.prices.mineral +
    p.resourceCards.length * RULES.WEALTH_COMPANY_VALUE +
    unitTotal(p) * RULES.WEALTH_UNIT_VALUE +
    p.nukes * RULES.WEALTH_NUKE_VALUE +
    p.laserStars * RULES.WEALTH_LASER_STAR_VALUE -
    p.loans
  );
}

function livePlayers(state: GameState): Player[] {
  return Object.values(state.players).filter(p => !(p as Player).isEliminated) as Player[];
}

/**
 * Proximidade da VITÓRIA de um jogador (0..1) sobre info pública. Não há um
 * número fixo de territórios p/ vencer (Supremacia = sobrar sozinho), então
 * usamos dois proxies e pegamos o maior:
 *  - fração de territórios controlados (rumo à Supremacia);
 *  - fração da riqueza pública total (rumo à Détente).
 */
export function victoryThreat(state: GameState, p: Player): number {
  const totalLand = Object.keys(state.territories).length || 1;
  const owned = Object.values(state.territories).filter(t => t.owner === p.id).length;
  const terrShare = owned / totalLand;

  const live = livePlayers(state);
  const wealths = live.map(x => Math.max(0, publicWealth(state, x)));
  const sumW = wealths.reduce((a, b) => a + b, 0) || 1;
  const wealthShare = Math.max(0, publicWealth(state, p)) / sumW;

  return Math.max(terrShare, wealthShare);
}

/**
 * "Pressão de fim de jogo" (0..1): perto de 0 no começo (expansão/economia
 * importam mais), perto de 1 quando alguém está dominando ou o relógio avançou
 * (conter quem vai vencer importa mais). Tudo de info pública. Pegamos o MAIOR
 * sinal — qualquer ameaça de fim de jogo já eleva a pressão.
 */
export function gamePressure(state: GameState): number {
  const totalLand = Object.keys(state.territories).length || 1;
  const ownedCount: Record<string, number> = {};
  for (const t of Object.values(state.territories)) {
    if (t.owner) ownedCount[t.owner] = (ownedCount[t.owner] || 0) + 1;
  }
  const maxTerrShare = Object.values(ownedCount).reduce((m, c) => Math.max(m, c / totalLand), 0);

  const live = livePlayers(state);
  const wealths = live.map(p => Math.max(0, publicWealth(state, p)));
  const sumW = wealths.reduce((a, b) => a + b, 0) || 1;
  const maxW = wealths.reduce((m, w) => Math.max(m, w), 0);
  const fair = 1 / Math.max(live.length, 1);
  const wealthDom = sumW > 0 ? Math.max(0, (maxW / sumW - fair) / (1 - fair || 1)) : 0;

  const nuked = Object.values(state.territories).filter(t => t.nuked).length;
  const nukeSat = nuked / RULES.HOLOCAUST_THRESHOLD;

  const turnProg = Math.min((state.turn.turnNumber ?? 1) / 14, 1);

  return Math.max(0, Math.min(1, Math.max(maxTerrShare, wealthDom, nukeSat, turnProg)));
}

export interface OpponentIntel {
  leaderId: SuperpowerId | null; // rival vivo MAIS PERTO de vencer (maior ameaça)
  leaderThreat: number;          // 0..1 — proximidade da vitória do líder
  behindBy: number;              // riqueza pública do líder − a minha (0 se a IA lidera)
  myWealth: number;
  nukeArmedEnemies: number;      // rivais vivos com ogiva já produzida (nukes > 0)
}

/** Resume a posição PÚBLICA dos adversários vivos (read-only). O "líder" é quem
 *  está mais perto de uma condição de vitória — não simplesmente o mais rico. */
export function readOpponentIntel(state: GameState, player: Player): OpponentIntel {
  const myWealth = publicWealth(state, player);
  let leaderId: SuperpowerId | null = null;
  let leaderThreat = -1;
  let leaderWealth = 0;
  let nukeArmedEnemies = 0;
  for (const [pid, p0] of Object.entries(state.players)) {
    if (pid === player.id) continue;
    const p = p0 as Player;
    if (p.isEliminated) continue;
    if (p.nukes > 0) nukeArmedEnemies++;
    const th = victoryThreat(state, p);
    if (th > leaderThreat) { leaderThreat = th; leaderId = pid as SuperpowerId; leaderWealth = publicWealth(state, p); }
  }
  return {
    leaderId,
    leaderThreat: leaderId ? leaderThreat : 0,
    behindBy: leaderId ? Math.max(0, leaderWealth - myWealth) : 0,
    myWealth,
    nukeArmedEnemies,
  };
}

/** -1..1: o quão bom está o preço médio de mercado para VENDER. */
function sellPriceEdge(state: GameState): number {
  const mid = marketMid(state);
  const avg = RESOURCES.reduce((a, r) => a + state.market.prices[r], 0) / RESOURCES.length;
  return (avg - mid) / mid;
}

interface AttackRead {
  opportunities: number; // alvos onde a IA tem vantagem clara
  bestMargin: number;    // maior (meusExércitos - inimigos) entre os alvos
}

/** Lê oportunidades de ataque a partir das fronteiras (read-only). */
function readAttacks(state: GameState, player: Player): AttackRead {
  let opportunities = 0;
  let bestMargin = 0;
  for (const [territoryId, armyCount] of Object.entries(player.armies)) {
    if (armyCount < 2) continue;
    const territory = state.territories[territoryId];
    if (!territory) continue;
    for (const adjId of territory.adjacentTerritories) {
      const adj = state.territories[adjId];
      if (!adj || adj.nuked || adj.owner === player.id) continue;
      let enemyForces = 0;
      for (const [pid, p] of Object.entries(state.players)) {
        if (pid === player.id) continue;
        enemyForces += (p as Player).armies[adjId] || 0;
      }
      const margin = armyCount - enemyForces;
      if (margin > 1) {
        opportunities++;
        if (margin > bestMargin) bestMargin = margin;
      }
    }
  }
  return { opportunities, bestMargin };
}

/** Quantas fronteiras próprias estão sob ameaça (inimigo adjacente mais forte). */
function readBorderThreat(state: GameState, player: Player): number {
  let threatened = 0;
  for (const [territoryId, armyCount] of Object.entries(player.armies)) {
    const territory = state.territories[territoryId];
    if (!territory) continue;
    for (const adjId of territory.adjacentTerritories) {
      const adj = state.territories[adjId];
      if (!adj || adj.owner === player.id || adj.owner === null) continue;
      let enemyForces = 0;
      for (const [pid, p] of Object.entries(state.players)) {
        if (pid === player.id) continue;
        enemyForces += (p as Player).armies[adjId] || 0;
      }
      if (enemyForces >= armyCount) { threatened++; break; }
    }
  }
  return threatened;
}

function enemyForcesOn(state: GameState, territoryId: string, selfId: string): number {
  let forces = 0;
  for (const [pid, p] of Object.entries(state.players)) {
    if (pid === selfId) continue;
    forces += (p as Player).armies[territoryId] || 0;
  }
  return forces;
}

interface MovementRead {
  expansionTargets: number;  // exércitos sobrando ao lado de terra neutra a ocupar
  reinforceTargets: number;  // fronteiras próprias ameaçadas com doador adjacente
  navalRepositions: number;  // frotas que podem se aproximar de um mar contestado
  amphibiousTargets: number; // desembarques possíveis em terra neutra além-mar
}

/** Algum território próprio é adjacente por TERRA a este território? */
function landAdjacentToOwn(state: GameState, territoryId: string, selfId: string): boolean {
  const t = state.territories[territoryId];
  if (!t) return false;
  return t.adjacentTerritories.some(adj => state.territories[adj]?.owner === selfId);
}

// Limite de pernas navais de uma invasão anfíbia (legibilidade no mobile + custo de
// petróleo sob controle). Cobre travessias intercontinentais (costa→oceano→costa).
const AMPHIBIOUS_MAX_LEGS = 3;

/** Plano completo de uma invasão anfíbia, partilhado por leitura e execução. */
export interface AmphibiousPlan {
  embarkTerritory: string | null; // origem do embarque (null = usa tropa já embarcada)
  startSea: string;               // mar onde a frota está agora
  route: string[];                // caminho de mares [startSea, …, landSea]; legs = len-1
  landSea: string;                // mar de onde se desembarca
  landTerritory: string;          // terra neutra desguarnecida a conquistar
  spareArmies: number;            // tropa embarcável na origem (mantém ≥1 em casa)
  navies: number;                 // esquadras na frota (capacidade de transporte)
}

/** Terra costeira NEUTRA, desguarnecida e fora do alcance terrestre = alvo de desembarque. */
function isAmphibiousLandTarget(state: GameState, player: Player, territoryId: string): boolean {
  const terr = state.territories[territoryId];
  return !!terr && !terr.nuked && terr.owner === null &&
    enemyForcesOn(state, territoryId, player.id) === 0 &&
    !landAdjacentToOwn(state, territoryId, player.id);
}

/** Mar costeiro ocupado por outro jogador → moveNavy recusa entrar (D8). Oceano nunca bloqueia. */
function seaBlockedForPlayer(state: GameState, player: Player, seaId: string): boolean {
  const s = state.seaZones[seaId];
  if (!s) return true;
  if (s.type !== 'coastal') return false;
  return Object.entries(state.players).some(
    ([pid, p]) => pid !== player.id && ((p as Player).navies[seaId] || 0) > 0,
  );
}

/**
 * BFS no grafo de mares a partir de `startSea`, achando o caminho MAIS CURTO até um
 * mar que toque um alvo de desembarque. `maxLegs` limita o nº de movimentos navais
 * (= len do caminho − 1); mares bloqueados (costeiros ocupados) são evitados, igual
 * ao que moveNavy faria. Retorna o caminho + mar/território de desembarque, ou null.
 */
function findAmphibiousRoute(
  state: GameState,
  player: Player,
  startSea: string,
  maxLegs: number,
): { route: string[]; landSea: string; landTerritory: string } | null {
  const visited = new Set<string>([startSea]);
  let frontier: string[][] = [[startSea]];

  for (let legs = 0; legs <= maxLegs && frontier.length > 0; legs++) {
    const next: string[][] = [];
    for (const path of frontier) {
      const cur = path[path.length - 1];
      const s = state.seaZones[cur];
      if (!s) continue;
      // Dá para desembarcar daqui?
      const target = s.adjacentTerritories.find(t => isAmphibiousLandTarget(state, player, t));
      if (target) return { route: path, landSea: cur, landTerritory: target };
      // Expande para os mares adjacentes (próxima perna), se ainda há orçamento.
      if (legs < maxLegs) {
        for (const adj of s.adjacentSeas) {
          if (visited.has(adj) || seaBlockedForPlayer(state, player, adj)) continue;
          visited.add(adj);
          next.push([...path, adj]);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * PLANNER PURO da invasão anfíbia (fonte única usada pela leitura/score do engine E
 * pelo executor no store). Acha uma frota própria com carga (território costeiro
 * próprio com tropa sobrando, ou tropa já embarcada) e uma rota naval — de 0 a
 * AMPHIBIOUS_MAX_LEGS pernas, limitada pelo petróleo — até terra costeira NEUTRA e
 * desguarnecida fora do alcance terrestre. Fiel ao manual: desembarque só toma terra
 * neutra/vazia; território inimigo continua exigindo a fase de Combate (§3). Read-only.
 */
export function planAmphibiousInvasion(state: GameState, player: Player): AmphibiousPlan | null {
  const cost = RULES.SEA_MOVE_OIL_COST;
  const oilLegs = player.supplies.oil >= cost
    ? Math.min(Math.floor(player.supplies.oil / cost), AMPHIBIOUS_MAX_LEGS)
    : 0;

  for (const [seaId, navies] of Object.entries(player.navies)) {
    if (navies <= 0) continue;
    const sea = state.seaZones[seaId];
    if (!sea) continue;

    const embarkTerritory = sea.adjacentTerritories.find(
      t => state.territories[t]?.owner === player.id && (player.armies[t] || 0) >= 2,
    ) ?? null;
    const alreadyEmbarked = (player.embarked?.[seaId] || 0) > 0;
    if (!embarkTerritory && !alreadyEmbarked) continue;

    const route = findAmphibiousRoute(state, player, seaId, oilLegs);
    if (!route) continue;

    return {
      embarkTerritory,
      startSea: seaId,
      route: route.route,
      landSea: route.landSea,
      landTerritory: route.landTerritory,
      spareArmies: embarkTerritory ? Math.max(0, (player.armies[embarkTerritory] || 0) - 1) : 0,
      navies,
    };
  }
  return null;
}

/**
 * Lê oportunidades de movimento (read-only). Mantido alinhado com o executor
 * cpuMove no store — se a heurística marcar "legal" mas o executor não achar
 * nada, no pior caso a IA gasta um estágio sem efeito (raro), nunca trava.
 */
function readMovement(state: GameState, player: Player): MovementRead {
  let expansionTargets = 0;
  let reinforceTargets = 0;

  for (const [tid, count] of Object.entries(player.armies)) {
    const t = state.territories[tid];
    if (!t) continue;

    // Expansão: tropa sobrando (≥2) ao lado de terra neutra, livre de inimigo.
    if (count >= 2) {
      const canExpand = t.adjacentTerritories.some(adj => {
        const at = state.territories[adj];
        return at && !at.nuked && at.owner === null && enemyForcesOn(state, adj, player.id) === 0;
      });
      if (canExpand) expansionTargets++;
    }

    // Reforço: território próprio ameaçado que tenha um vizinho próprio doador.
    const threatened = t.adjacentTerritories.some(adj => {
      const at = state.territories[adj];
      return at && at.owner && at.owner !== player.id && enemyForcesOn(state, adj, player.id) >= count;
    });
    if (threatened) {
      const hasDonor = t.adjacentTerritories.some(adj => (player.armies[adj] || 0) >= 2);
      if (hasDonor) reinforceTargets++;
    }
  }

  // Naval: frota que pode avançar para um mar adjacente que toque terra inimiga.
  let navalRepositions = 0;
  const hasOil = player.supplies.oil >= RULES.SEA_MOVE_OIL_COST;
  if (hasOil) {
    for (const [seaId, navies] of Object.entries(player.navies)) {
      if (navies <= 0) continue;
      const sea = state.seaZones[seaId];
      if (!sea) continue;
      const canAdvance = sea.adjacentSeas.some(adjSea => {
        const target = state.seaZones[adjSea];
        if (!target) return false;
        return target.adjacentTerritories.some(t => {
          const terr = state.territories[t];
          return terr && terr.owner && terr.owner !== player.id;
        });
      });
      if (canAdvance) navalRepositions++;
    }
  }

  // Invasão anfíbia: 1 se há um plano viável (a IA faz no máx. 1 op/turno).
  const amphibiousTargets = planAmphibiousInvasion(state, player) ? 1 : 0;

  return { expansionTargets, reinforceTargets, navalRepositions, amphibiousTargets };
}

// ────────────────────────────────────────────────────────────
// Legalidade — só estágios realmente possíveis viram candidatos
// ────────────────────────────────────────────────────────────

export function getLegalOptionalStages(state: GameState, player: Player): OptionalStage[] {
  const legal: OptionalStage[] = [];
  const hasCombatSupplies =
    player.supplies.grain >= 1 && player.supplies.oil >= 1 && player.supplies.mineral >= 1;

  // 3 — Vender: precisa ter excedente. No Modo Digital Balanceado a venda é só
  // na fase de Venda Simultânea apenas na 1ª rodada; a partir da rodada 2 a IA
  // volta a vender no Estágio 3 do próprio turno, como o humano.
  if (!isSimultaneousSellRound(state) && excess(player) > 0) legal.push(3);

  // 4 — Combate: não no 1º turno, precisa de suprimentos e de um alvo viável.
  if (!state.turn.isFirstTurn && hasCombatSupplies && readAttacks(state, player).opportunities > 0) {
    legal.push(4);
  }

  // 5 — Movimento: terra precisa de cereal; naval precisa de petróleo. A invasão
  // anfíbia (embarcar→navegar→desembarcar) já vem com o petróleo conferido em
  // readAmphibious quando exige perna naval; o caso de 0 pernas não custa nada.
  const move = readMovement(state, player);
  const canLandMove = player.supplies.grain >= RULES.LAND_MOVE_GRAIN_COST &&
    (move.expansionTargets > 0 || move.reinforceTargets > 0);
  if (canLandMove || move.navalRepositions > 0 || move.amphibiousTargets > 0) legal.push(5);

  // 6 — Construção: precisa de dinheiro + 1 conjunto de suprimentos.
  const minSupply = Math.min(player.supplies.grain, player.supplies.oil, player.supplies.mineral);
  if (player.money >= RULES.UNIT_COST && minSupply >= 1) legal.push(6);

  // 7 — Mercado: precisa estar em falta e ter caixa.
  if (shortage(player) > 0 && player.money > marketMid(state) * 2) legal.push(7);

  return legal.filter(s => EXECUTABLE_OPTIONAL_STAGES.includes(s));
}

// ────────────────────────────────────────────────────────────
// Score de uma ação (estágio) — spec: evaluateAction
// ────────────────────────────────────────────────────────────

const zeroBreakdown = (): AIEvaluation['breakdown'] => ({
  economyScore: 0, militaryScore: 0, defenseScore: 0, expansionScore: 0,
  marketScore: 0, techScore: 0, salaryRiskPenalty: 0, vulnerabilityPenalty: 0, opportunityScore: 0,
});

export function evaluateAction(
  candidate: AICandidate,
  state: GameState,
  player: Player,
  config: AIConfig,
): AIEvaluation {
  const b = zeroBreakdown();
  let reason = '';

  const threat = readBorderThreat(state, player);
  const nextSalary = salaryForecast(player);
  // Caixa "folgado" = quanto sobra acima do próximo salário (peso planningDepth).
  const cushion = player.money - nextSalary * (1 + config.planningDepth * 0.25);

  switch (candidate.stage) {
    case 3: { // Vender
      const ex = excess(player);
      b.economyScore = ex * 6 * config.economyPriority;
      const edge = config.usesMarketStrategy ? sellPriceEdge(state) : 0;
      b.marketScore = edge * 40; // preço alto → vender vale mais
      // Se está sem caixa para o próximo salário, vender é defensivo (levantar caixa).
      if (cushion < 0) b.economyScore += 20 * config.economyPriority;
      reason = config.usesMarketStrategy && edge > 0.15
        ? 'aireason.sellHighPrice'
        : cushion < 0
          ? 'aireason.sellCoverSalary'
          : 'aireason.sellExcess';
      break;
    }
    case 4: { // Combate
      const atk = readAttacks(state, player);
      b.militaryScore = atk.opportunities * 12 * config.aggression;
      b.opportunityScore = atk.bestMargin * 8 * config.aggression;
      b.expansionScore = atk.opportunities * 6 * config.expansionPriority;
      // Atacar com a fronteira ameaçada enfraquece a defesa.
      b.vulnerabilityPenalty = -threat * 10 * config.defensePriority;
      reason = atk.bestMargin >= 3
        ? 'aireason.attackWeaker'
        : 'aireason.attackAdvantage';
      // Inteligência situacional: conter quem está PERTO de vencer pesa mais
      // conforme o jogo avança (gamePressure). Cedo, a agressão geral vale menos
      // que expansão/economia; tarde, frear o líder vira prioridade.
      if (config.usesOpponentIntel) {
        const intel = readOpponentIntel(state, player);
        const pressure = gamePressure(state);
        b.militaryScore *= 0.7 + 0.6 * pressure;
        b.opportunityScore += intel.leaderThreat * (0.5 + 1.5 * pressure) * 16 * config.aggression;
        if (intel.leaderThreat > 0.4 && pressure > 0.4) reason = 'aireason.attackLeader';
      }
      break;
    }
    case 6: { // Construção
      b.expansionScore = 18 * config.expansionPriority;
      b.militaryScore = 10 * config.aggression;
      b.defenseScore = threat * 12 * config.defensePriority;
      // Gastar com a defesa ameaçada vale mais; gastar sem caixa pesa.
      if (cushion < RULES.UNIT_COST * 3) b.salaryRiskPenalty = -22 * config.economyPriority;
      // Corrida tecnológica: bomba quando rico e ainda não pesquisada.
      if (config.usesTechStrategy && !player.hasResearchedNuke && player.money > 15000) {
        b.techScore = 10;
      }
      reason = threat > 0
        ? 'aireason.buildReinforce'
        : 'aireason.buildExpand';
      // Dissuasão nuclear: se um rival JÁ tem ogiva e a IA não, correr atrás da
      // paridade vira prioridade (info pública: arsenal alheio é visível).
      if (config.usesOpponentIntel && config.usesTechStrategy &&
          player.nukes === 0 && player.money > RULES.NUKE_COST * 2) {
        const intel = readOpponentIntel(state, player);
        if (intel.nukeArmedEnemies > 0) {
          b.techScore += 16;
          reason = 'aireason.buildDeterrent';
        }
      }
      break;
    }
    case 7: { // Mercado (comprar)
      const sh = shortage(player);
      b.economyScore = sh * 8 * config.economyPriority;
      const edge = config.usesMarketStrategy ? -sellPriceEdge(state) : 0; // preço baixo → comprar bom
      b.marketScore = edge * 30;
      // Comprar sem caixa para o salário é arriscado.
      if (cushion < RULES.UNIT_COST * 2) b.salaryRiskPenalty = -16 * config.economyPriority;
      reason = config.usesMarketStrategy && edge > 0.15
        ? 'aireason.buyLowPrice'
        : 'aireason.buyShortage';
      break;
    }
    case 5: { // Movimento (terrestre + naval + anfíbio)
      const move = readMovement(state, player);
      // Ocupar terra neutra (por terra ou por desembarque) é progresso direto rumo
      // à supremacia. O desembarque além-mar vale um pouco menos por custar a frota.
      b.expansionScore =
        move.expansionTargets * 14 * config.expansionPriority +
        move.amphibiousTargets * 13 * config.expansionPriority;
      // Reforçar fronteira ameaçada é defesa concreta.
      b.defenseScore = move.reinforceTargets * 12 * config.defensePriority;
      // Aproximar a frota de terra inimiga prepara combate/projeção naval.
      b.militaryScore = move.navalRepositions * 8 * config.aggression;
      // Consciência de fase: expandir/ocupar terra neutra vale MAIS no começo
      // (corrida por território e produção) e perde força quando o jogo já está
      // dominado (aí defender/conter o líder importa mais).
      if (config.usesOpponentIntel) {
        const pressure = gamePressure(state);
        b.expansionScore *= 1.3 - 0.6 * pressure;
        b.defenseScore *= 0.8 + 0.5 * pressure;
      }
      reason = move.expansionTargets > 0
        ? 'aireason.moveExpand'
        : move.amphibiousTargets > 0
          ? 'aireason.moveAmphibious'
          : move.reinforceTargets > 0
            ? 'aireason.moveReinforce'
            : 'aireason.moveNaval';
      break;
    }
  }

  const score =
    b.economyScore + b.militaryScore + b.defenseScore + b.expansionScore +
    b.marketScore + b.techScore + b.salaryRiskPenalty + b.vulnerabilityPenalty + b.opportunityScore;

  return { stage: candidate.stage, score, reason, breakdown: b };
}

// ────────────────────────────────────────────────────────────
// Sinergia entre duas ações — spec: evaluateActionPair
// ────────────────────────────────────────────────────────────

export function evaluateActionPair(a: OptionalStage, b: OptionalStage): number {
  const pair = new Set([a, b]);
  // Comprar (7) e construir (6): comprar abastece a construção.
  if (pair.has(7) && pair.has(6)) return 14;
  // Atacar (4) e construir (6): reforça o que foi conquistado/gasto.
  if (pair.has(4) && pair.has(6)) return 8;
  // Vender (3) e comprar (7): girar o mercado no mesmo turno é redundante.
  if (pair.has(3) && pair.has(7)) return -16;
  // Vender (3) e construir (6): levantar caixa e gastar — leve sinergia.
  if (pair.has(3) && pair.has(6)) return 4;
  // Mover (5) e atacar (4): posicionar tropas antes do golpe.
  if (pair.has(5) && pair.has(4)) return 12;
  // Mover (5) e construir (6): consolidar a fronteira reforçada.
  if (pair.has(5) && pair.has(6)) return 5;
  return 0;
}

function pairSynergy(stages: OptionalStage[]): number {
  let total = 0;
  for (let i = 0; i < stages.length; i++) {
    for (let j = i + 1; j < stages.length; j++) {
      total += evaluateActionPair(stages[i], stages[j]);
    }
  }
  return total;
}

// ────────────────────────────────────────────────────────────
// Escolha final — respeitando o limite de estágios opcionais
// ────────────────────────────────────────────────────────────

type RNG = () => number;

function subsets<T>(arr: T[], maxSize: number): T[][] {
  const out: T[][] = [];
  const n = arr.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset: T[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(arr[i]);
    if (subset.length <= maxSize) out.push(subset);
  }
  return out;
}

/**
 * Escolhe os estágios opcionais que a IA vai executar.
 * `cap` permite ao chamador (store) impor RULES.MAX_OPTIONAL_STAGES.
 * `rng` é injetável para testes determinísticos (default Math.random).
 */
export function chooseOptionalStages(
  state: GameState,
  player: Player,
  config: AIConfig,
  cap: number = RULES.MAX_OPTIONAL_STAGES,
  rng: RNG = aiRand,
): AIChoice {
  // Limite SEMPRE = regra do jogo (3), igual ao humano. `cap` é só uma
  // salvaguarda extra para o chamador; nunca acima de RULES.MAX_OPTIONAL_STAGES.
  const limit = Math.min(cap, RULES.MAX_OPTIONAL_STAGES);
  if (limit <= 0) return { stages: [], decisions: [] };

  const legal = getLegalOptionalStages(state, player);
  if (legal.length === 0) return { stages: [], decisions: [] };

  // 1) Avalia cada ação e aplica ruído (erro de leitura do iniciante).
  const evals = legal
    .map(stage => {
      const ev = evaluateAction({ stage }, state, player, config);
      const noise = (rng() * 2 - 1) * config.randomness * 25;
      return { ...ev, noisy: ev.score + noise };
    })
    .sort((x, y) => y.noisy - x.noisy)
    .slice(0, config.maxCandidateActions);

  // 2) Erro leve: às vezes descarta a melhor jogada.
  if (evals.length > 1 && rng() < config.mistakeRate) {
    const [top, ...rest] = evals;
    evals.splice(0, evals.length, ...rest, top);
  }

  const byStage = new Map(evals.map(e => [e.stage, e]));
  const pool = evals.map(e => e.stage);

  // 3) Seleção final.
  let chosen: OptionalStage[];
  if (config.evaluatesActionPairs && pool.length > 1) {
    // Avalia subconjuntos (≤ limit) somando scores individuais + sinergia.
    let best: OptionalStage[] = [];
    let bestVal = -Infinity;
    for (const sub of subsets(pool, limit)) {
      const val = sub.reduce((a, s) => a + (byStage.get(s)!.noisy), 0) + pairSynergy(sub);
      if (val > bestVal) { bestVal = val; best = sub; }
    }
    chosen = best;
  } else {
    // Iniciante: simplesmente pega os melhores individuais.
    chosen = pool.slice(0, limit);
  }

  // 4) Ordena por estágio (a estrutura de turno exige ordem crescente).
  chosen = chosen.slice(0, limit).sort((a, b) => a - b);

  const decisions: AIDecision[] = chosen.map(stage => {
    const ev = byStage.get(stage)!;
    return { stage, reason: ev.reason, score: Math.round(ev.score) };
  });

  return { stages: chosen, decisions };
}

// ────────────────────────────────────────────────────────────
// RNG da IA — hoje Math.random.
// TODO: quando o multiplayer entrar, trocar por um PRNG semeado
// (ver rng.ts / multiplayerSchema.md) para resultados determinísticos
// sincronizáveis entre clientes. A injeção de `rng` já está pronta.
// ────────────────────────────────────────────────────────────
function aiRand(): number {
  return Math.random();
}

export function getPlayerAIConfig(player: Player): AIConfig {
  return getConfigForDifficulty(player.aiDifficulty);
}

// Reexport util para o store decidir pesquisa tecnológica etc.
export function shouldResearchTech(player: Player, config: AIConfig): boolean {
  return config.usesTechStrategy && !player.hasResearchedNuke && player.money > 15000;
}
