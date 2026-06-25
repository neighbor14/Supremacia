// ──────────────────────────────────────────────────────────────────────────
// Resolver de NOMES DE DADOS (territórios, mares, facções, companhias).
//
// O `id` canônico continua sendo a fonte de verdade na lógica do jogo; estes
// helpers só traduzem o RÓTULO exibido. Nunca usar o nome traduzido como chave
// de lógica/estado — sempre o `id`.
//
// Convenção de chaves i18n (ver locales/*.json):
//   terr.<id>            território terrestre
//   sea.<id>             zona marítima
//   faction.<id>         nome da superpotência
//   faction.<id>.short   sigla da superpotência
//   company.<cardId>     nome da companhia (OPCIONAL — ver nota abaixo)
//
// COMPANHIAS: os nomes em `resourceCards.ts` são marcas inventadas (criadas para
// evitar copyright do jogo físico). Por serem nomes de marca, são mantidos
// constantes entre idiomas POR ENQUANTO — `companyName(...)` roteia pelo i18n
// com fallback para `card.companyName`, então localizar no futuro é só adicionar
// as chaves `company.<cardId>` nos três locales, sem tocar em nenhum call site.
// ──────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { Lang, TranslationKey, translate } from './index';
import { useI18nStore, useLang } from './useI18n';
import { TERRITORIES } from '../data/territories';
import { SEA_ZONES } from '../data/seaZones';
import { SUPERPOWERS } from '../data/initialPlayers';
import { SuperpowerId } from '../game/types';

/**
 * Traduz `key`; se ela não existir em nenhum idioma (translate devolve a própria
 * chave) cai no `fallback` — garante que nunca aparece a chave crua na tela.
 */
function resolve(lang: Lang, key: string, fallback: string): string {
  const out = translate(lang, key as TranslationKey);
  return out === key ? fallback : out;
}

export function territoryNameOf(lang: Lang, id: string): string {
  return resolve(lang, `terr.${id}`, TERRITORIES[id]?.name ?? id);
}

export function seaNameOf(lang: Lang, id: string): string {
  return resolve(lang, `sea.${id}`, SEA_ZONES[id]?.name ?? id);
}

/** Resolve um id que pode ser território OU mar (usado em logs/movimento). */
export function locationNameOf(lang: Lang, id: string): string {
  if (TERRITORIES[id]) return territoryNameOf(lang, id);
  if (SEA_ZONES[id]) return seaNameOf(lang, id);
  return id;
}

export function factionNameOf(lang: Lang, id: SuperpowerId): string {
  return resolve(lang, `faction.${id}`, SUPERPOWERS[id]?.name ?? id);
}

export function factionShortOf(lang: Lang, id: SuperpowerId): string {
  return resolve(lang, `faction.${id}.short`, SUPERPOWERS[id]?.shortName ?? id);
}

export function companyNameOf(lang: Lang, cardId: string, fallback: string): string {
  return resolve(lang, `company.${cardId}`, fallback);
}

// ── Versões NÃO-reativas (motor, callbacks, fora do render) ────────────────
// Leem o idioma atual do store. Não disparam re-render — use os hooks no React.
const cur = (): Lang => useI18nStore.getState().lang;

export const territoryName = (id: string) => territoryNameOf(cur(), id);
export const seaName = (id: string) => seaNameOf(cur(), id);
export const locationName = (id: string) => locationNameOf(cur(), id);
export const factionName = (id: SuperpowerId) => factionNameOf(cur(), id);
export const factionShort = (id: SuperpowerId) => factionShortOf(cur(), id);
export const companyName = (cardId: string, fallback: string) =>
  companyNameOf(cur(), cardId, fallback);

export interface NameResolvers {
  territory: (id: string) => string;
  sea: (id: string) => string;
  location: (id: string) => string;
  faction: (id: SuperpowerId) => string;
  factionShort: (id: SuperpowerId) => string;
  company: (cardId: string, fallback: string) => string;
}

/**
 * Hook REATIVO: devolve resolvers ligados ao idioma atual. O componente
 * re-renderiza ao trocar de idioma (subscreve `useLang`).
 */
export function useNames(): NameResolvers {
  const lang = useLang();
  return useMemo<NameResolvers>(
    () => ({
      territory: id => territoryNameOf(lang, id),
      sea: id => seaNameOf(lang, id),
      location: id => locationNameOf(lang, id),
      faction: id => factionNameOf(lang, id),
      factionShort: id => factionShortOf(lang, id),
      company: (cardId, fallback) => companyNameOf(lang, cardId, fallback),
    }),
    [lang],
  );
}
