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

import { GameState, Player, ResourceType } from '../types';
import { RULES } from '../rulesConfig';
import { AIConfig, getConfigForDifficulty } from './aiConfig';

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

/**
 * Lê oportunidades de INVASÃO ANFÍBIA (read-only): embarcar tropa de um território
 * costeiro próprio, navegar e desembarcar em terra costeira NEUTRA e desguarnecida
 * que NÃO seja alcançável por terra (senão a expansão terrestre, mais barata, já
 * resolve). Fiel ao manual: desembarque só toma terra neutra/vazia — território
 * inimigo continua exigindo a fase de Combate (ver docs/regras-supremacia.md §3).
 * Conta cenários de 0 pernas (mesmo mar costeiro toca as duas praias) e de 1 perna
 * (uma zona naval adjacente, que custa petróleo).
 */
function readAmphibious(state: GameState, player: Player): number {
  const oilForLeg = player.supplies.oil >= RULES.SEA_MOVE_OIL_COST;
  let count = 0;

  for (const [seaId, navies] of Object.entries(player.navies)) {
    if (navies <= 0) continue;
    const sea = state.seaZones[seaId];
    if (!sea) continue;

    // Precisa de carga: tropa embarcável (território próprio adjacente com ≥2) ou
    // tropa já embarcada nesta zona.
    const hasEmbarkSource = sea.adjacentTerritories.some(
      t => state.territories[t]?.owner === player.id && (player.armies[t] || 0) >= 2,
    );
    const alreadyEmbarked = (player.embarked?.[seaId] || 0) > 0;
    if (!hasEmbarkSource && !alreadyEmbarked) continue;

    // Mares de onde dá para desembarcar: o próprio (0 pernas) e, se houver
    // petróleo, os adjacentes (1 perna).
    const reachableSeas = oilForLeg ? [seaId, ...sea.adjacentSeas] : [seaId];
    const hasLanding = reachableSeas.some(sid => {
      const s = state.seaZones[sid];
      if (!s) return false;
      return s.adjacentTerritories.some(t => {
        const terr = state.territories[t];
        return terr && !terr.nuked && terr.owner === null &&
          enemyForcesOn(state, t, player.id) === 0 &&
          !landAdjacentToOwn(state, t, player.id);
      });
    });
    if (hasLanding) count++;
  }

  return count;
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

  const amphibiousTargets = readAmphibious(state, player);

  return { expansionTargets, reinforceTargets, navalRepositions, amphibiousTargets };
}

// ────────────────────────────────────────────────────────────
// Legalidade — só estágios realmente possíveis viram candidatos
// ────────────────────────────────────────────────────────────

export function getLegalOptionalStages(state: GameState, player: Player): OptionalStage[] {
  const legal: OptionalStage[] = [];
  const hasCombatSupplies =
    player.supplies.grain >= 1 && player.supplies.oil >= 1 && player.supplies.mineral >= 1;

  // 3 — Vender: precisa ter excedente.
  if (excess(player) > 0) legal.push(3);

  // 4 — Combate: não no 1º turno, precisa de suprimentos e de um alvo viável.
  if (!state.turn.isFirstTurn && hasCombatSupplies && readAttacks(state, player).opportunities > 0) {
    legal.push(4);
  }

  // 5 — Movimento: terra precisa de cereal; naval precisa de petróleo.
  const move = readMovement(state, player);
  const canLandMove = player.supplies.grain >= RULES.LAND_MOVE_GRAIN_COST &&
    (move.expansionTargets > 0 || move.reinforceTargets > 0);
  if (canLandMove || move.navalRepositions > 0) legal.push(5);

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
        ? 'vender excedente porque o preço está alto'
        : cushion < 0
          ? 'vender recursos para cobrir salários'
          : 'vender o excedente de recursos';
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
        ? 'atacar um alvo claramente mais fraco'
        : 'preparar um ataque com vantagem';
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
        ? 'construir unidades para reforçar a fronteira'
        : 'construir unidades para expandir';
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
        ? 'comprar recursos com o preço baixo'
        : 'comprar recursos em falta';
      break;
    }
    case 5: { // Movimento (terrestre + naval)
      const move = readMovement(state, player);
      // Ocupar terra neutra é progresso direto rumo à supremacia.
      b.expansionScore = move.expansionTargets * 14 * config.expansionPriority;
      // Reforçar fronteira ameaçada é defesa concreta.
      b.defenseScore = move.reinforceTargets * 12 * config.defensePriority;
      // Aproximar a frota de terra inimiga prepara combate/projeção naval.
      b.militaryScore = move.navalRepositions * 8 * config.aggression;
      reason = move.expansionTargets > 0
        ? 'expandir ocupando território neutro'
        : move.reinforceTargets > 0
          ? 'reforçar a fronteira ameaçada'
          : 'reposicionar a frota para o mar contestado';
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
