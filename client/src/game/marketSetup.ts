// ============================================================
// SUPREMACIA DIGITAL — Preço inicial de mercado (setup)
// ============================================================
//
// O Modo Digital Balanceado prevê preços iniciais VARIÁVEIS por recurso (em vez
// do $5.000 fixo do Modo Clássico). O manual Grow usado como fonte do projeto
// menciona "preço inicial por rolagem de dados (2d6 × passo)" no Random Opening,
// porém **a tabela/mapeamento oficial exato (qual soma de 2d6 → qual preço na
// trilha) NÃO está disponível no código nem foi confirmada na fonte**.
//
// DECISÃO (2026-06-22, autorizada pelo usuário): manter o preço inicial FIXO em
// $5.000 nos dois modos por ora, e NÃO inventar a tabela. A função abaixo existe
// como estrutura isolada e documentada para restaurar a regra fiel assim que a
// tabela oficial for confirmada — mas **ainda não é chamada pelo setup**.
//
// TODO: confirmar regra original — localizar no manual Grow a tabela oficial de
// preço inicial por 2d6 e substituir o mapeamento provisório abaixo. Enquanto
// isso, esta função permanece desconectada do fluxo de criação de jogo.

import { ResourceType } from './types';
import { RULES } from './rulesConfig';
import { rollDice, sumDice } from './rng';

/**
 * Mapeamento PROVISÓRIO (não-oficial) de uma soma de 2d6 (2..12) para um preço
 * na trilha de $1.000, centrado em $5.000 e limitado a [MIN_PRICE, MAX_PRICE].
 * A soma 7 (mais provável) cai em $5.000; os extremos afastam ±$3.000.
 *
 * NÃO usar como fonte de verdade — ver o cabeçalho do arquivo. `roll` é
 * injetável para testes determinísticos.
 */
export function rollInitialMarketPrice(roll: number = sumDice(rollDice(2))): number {
  // offset em passos a partir do centro (7 → 0). Divide por 2 para suavizar a
  // variância (2d6 vai de -5 a +5 passos; aqui de ~-3 a +3).
  const stepsFromCenter = Math.round((roll - 7) / 2);
  const raw = RULES.MARKET_START_PRICE + stepsFromCenter * RULES.MARKET_PRICE_STEP;
  return Math.max(RULES.MARKET_MIN_PRICE, Math.min(RULES.MARKET_MAX_PRICE, raw));
}

/** Preços iniciais por recurso. Provisório — ver cabeçalho. */
export function rollInitialMarketPrices(): Record<ResourceType, number> {
  return {
    grain: rollInitialMarketPrice(),
    oil: rollInitialMarketPrice(),
    mineral: rollInitialMarketPrice(),
  };
}
