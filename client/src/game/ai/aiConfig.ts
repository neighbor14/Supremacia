// ============================================================
// SUPREMACIA DIGITAL — AI Difficulty Profiles
// ============================================================
// Cada perfil controla SÓ a qualidade da decisão da IA (análise,
// profundidade, erro, aleatoriedade, prioridades). NENHUM perfil
// concede bônus de recurso, dado ou informação oculta — a IA joga
// exatamente com as mesmas regras do humano (ver .claude/rules/game-rules.md).
//
// O número de estágios opcionais por turno NÃO é um knob: é sempre
// RULES.MAX_OPTIONAL_STAGES (3), igual ao humano. A dificuldade vem da
// QUALIDADE da escolha, não da quantidade de ações.
// ============================================================

import { AIDifficulty } from '../types';

export interface AIConfig {
  difficulty: AIDifficulty;

  /** Quantos turnos à frente a heurística pondera (0 = só o turno atual). */
  planningDepth: number;
  /** 0..1 — ruído adicionado ao score de cada candidato (erro de leitura). */
  randomness: number;
  /** 0..1 — chance de descartar a melhor jogada e pegar a 2ª (erro leve). */
  mistakeRate: number;
  /** Avalia combinações de 2 ações opcionais buscando sinergia. */
  evaluatesActionPairs: boolean;
  /** Considera o preço de mercado ao comprar/vender. */
  usesMarketStrategy: boolean;
  /** Investe em pesquisa de bomba/laser quando faz sentido. */
  usesTechStrategy: boolean;
  /**
   * Lê a economia PÚBLICA dos rivais (dinheiro, recursos, nº de companhias,
   * unidades, ogivas/laser — a mesma régua da vitória por Détente, e a mesma
   * informação que o humano vê no placar de jogadores) para priorizar jogadas:
   * frear o líder de riqueza, mirar o competidor mais forte ao atacar e reagir
   * à corrida nuclear. NÃO é informação oculta — só a leitura da info já pública.
   */
  usesOpponentIntel: boolean;

  // Pesos de personalidade (0..1) — moldam o estilo, não a regra.
  aggression: number;
  defensePriority: number;
  expansionPriority: number;
  economyPriority: number;

  /** Quantos candidatos o motor mantém para avaliar (limita custo em mobile). */
  maxCandidateActions: number;
  /** Delay visível por ação na camada de apresentação (ms). */
  thinkingDelayMs: number;
}

export const AI_PROFILES: Record<AIDifficulty, AIConfig> = {
  beginner: {
    difficulty: 'beginner',
    planningDepth: 0,
    randomness: 0.6,
    mistakeRate: 0.35,
    evaluatesActionPairs: false,
    usesMarketStrategy: false,
    usesTechStrategy: false,
    usesOpponentIntel: false,
    aggression: 0.5,
    defensePriority: 0.3,
    expansionPriority: 0.5,
    economyPriority: 0.4,
    maxCandidateActions: 4,
    thinkingDelayMs: 1600,
  },
  intermediate: {
    difficulty: 'intermediate',
    planningDepth: 1,
    randomness: 0.3,
    mistakeRate: 0.15,
    evaluatesActionPairs: true,
    usesMarketStrategy: true,
    usesTechStrategy: true,
    usesOpponentIntel: true,
    aggression: 0.5,
    defensePriority: 0.6,
    expansionPriority: 0.5,
    economyPriority: 0.6,
    maxCandidateActions: 5,
    thinkingDelayMs: 2200,
  },
  advanced: {
    difficulty: 'advanced',
    planningDepth: 2,
    randomness: 0.12,
    mistakeRate: 0.05,
    evaluatesActionPairs: true,
    usesMarketStrategy: true,
    usesTechStrategy: true,
    usesOpponentIntel: true,
    aggression: 0.65,
    defensePriority: 0.7,
    expansionPriority: 0.65,
    economyPriority: 0.65,
    maxCandidateActions: 6,
    thinkingDelayMs: 2600,
  },
  god: {
    difficulty: 'god',
    planningDepth: 3,
    randomness: 0.0,
    mistakeRate: 0.0,
    evaluatesActionPairs: true,
    usesMarketStrategy: true,
    usesTechStrategy: true,
    usesOpponentIntel: true,
    aggression: 0.7,
    defensePriority: 0.8,
    expansionPriority: 0.7,
    economyPriority: 0.75,
    maxCandidateActions: 8,
    thinkingDelayMs: 3000,
  },
};

export const DEFAULT_AI_DIFFICULTY: AIDifficulty = 'intermediate';

export const AI_DIFFICULTY_LABELS: Record<AIDifficulty, { label: string; hint: string }> = {
  beginner: { label: 'Iniciante', hint: 'Joga simples, comete erros, pouca estratégia.' },
  intermediate: { label: 'Intermediário', hint: 'Joga corretamente, protege e economiza.' },
  advanced: { label: 'Avançado', hint: 'Avalia ameaças e planeja alguns turnos à frente.' },
  god: { label: 'Deus', hint: 'Joga quase perfeito, sem trapacear.' },
};

export function getConfigForDifficulty(difficulty: AIDifficulty | undefined): AIConfig {
  return AI_PROFILES[difficulty ?? DEFAULT_AI_DIFFICULTY];
}
