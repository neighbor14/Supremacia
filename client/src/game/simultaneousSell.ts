// ============================================================
// MODO DIGITAL BALANCEADO — Venda Simultânea: ESCOPO DE RODADA
// ------------------------------------------------------------
// A Venda Simultânea existe SOMENTE para neutralizar a vantagem econômica do
// primeiro jogador na largada da partida. Por isso ela vale APENAS na 1ª rodada.
// A partir da rodada 2 o jogo volta ao ciclo padrão do manual: cada jogador
// vende na sua própria vez (Estágio 3 sequencial), e o preço varia a cada venda
// individual. Não há mais fase coletiva nem espera por todos os jogadores.
//
// Esta é a FONTE ÚNICA DE VERDADE da regra. Engine (store), UI (GameScreen,
// SimultaneousSellModal) e IA (aiEngine) devem todos derivar a decisão daqui —
// nunca checar `marketMode === 'balanced'` sozinho para ativar a venda
// simultânea, pois isso a ativaria erradamente em todas as rodadas.
//
// round 1 == turn.turnNumber === 1 (turnNumber inicia em 1 no setup e é
// incrementado em startNewRound).
// ============================================================

import type { GameState } from './types';

/**
 * A Venda Simultânea se aplica nesta rodada?
 * Verdadeiro só quando o modo é 'balanced' E estamos na 1ª rodada (turnNumber 1).
 * Em qualquer round >= 2 retorna false → fluxo padrão de venda por turno.
 */
export function isSimultaneousSellRound(state: GameState): boolean {
  return state.config.marketMode === 'balanced' && state.turn.turnNumber === 1;
}
