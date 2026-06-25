// ──────────────────────────────────────────────────────────────────────────
// i18n — núcleo do sistema de internacionalização do Supremacia Digital.
//
// Sem biblioteca externa: motor leve baseado em arquivos JSON (um por idioma) +
// uma função `translate()` com interpolação de variáveis e fallback em cadeia.
//
// REGRA DO PROJETO: nenhum texto novo de UI pode ser hardcoded. Toda string
// visível vem de `locales/pt.json` (fonte canônica) e precisa existir nos três
// idiomas. `pt.json` define o conjunto de chaves; en/es são tipados contra ele
// (chave faltando em en/es quebra o `tsc`).
// ──────────────────────────────────────────────────────────────────────────
import ptRaw from './locales/pt.json';
import enRaw from './locales/en.json';
import esRaw from './locales/es.json';

export type Lang = 'pt' | 'en' | 'es';

export const LANGS: Lang[] = ['pt', 'en', 'es'];

/** Rótulo de cada idioma no próprio idioma (para o seletor do menu). */
export const LANG_LABELS: Record<Lang, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
};

/** `pt.json` é a fonte canônica de chaves. */
export type TranslationKey = keyof typeof ptRaw;

// Assinatura por atribuição (não cast): força en/es a conter TODAS as chaves de
// pt — chave ausente é erro de compilação. Chaves extras são toleradas.
const pt: Record<TranslationKey, string> = ptRaw;
const en: Record<TranslationKey, string> = enRaw;
const es: Record<TranslationKey, string> = esRaw;

const DICT: Record<Lang, Record<TranslationKey, string>> = { pt, en, es };

export type Vars = Record<string, string | number>;

/** Substitui `{var}` pelos valores em `vars`; preserva o token se faltar. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/**
 * Traduz `key` para `lang`. Fallback em cadeia: idioma escolhido → pt → a
 * própria chave (nunca quebra a tela com texto vazio).
 */
export function translate(lang: Lang, key: TranslationKey, vars?: Vars): string {
  const raw = DICT[lang]?.[key] ?? pt[key] ?? (key as string);
  return interpolate(raw, vars);
}

export const LANG_STORAGE_KEY = 'supremacia_lang';

/**
 * Idioma inicial: preferência salva > sugestão do navegador > pt (default).
 * O jogador sempre pode trocar manualmente depois (a sugestão não é imposta).
 */
export function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY) as Lang | null;
    if (stored && LANGS.includes(stored)) return stored;
  } catch {
    /* localStorage indisponível (modo privado) — segue para detecção */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'pt').toLowerCase();
  if (nav.startsWith('en')) return 'en';
  if (nav.startsWith('es')) return 'es';
  return 'pt';
}

/** Atributo `lang` do `<html>` correspondente ao idioma do app. */
export function htmlLangAttr(lang: Lang): string {
  return lang === 'pt' ? 'pt-BR' : lang;
}
