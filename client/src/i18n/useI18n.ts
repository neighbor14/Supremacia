// ──────────────────────────────────────────────────────────────────────────
// Estado reativo do idioma (zustand, mesmo padrão de stores/presentationStore).
//
// Uso em componentes:    const t = useT();  t('menu.newGame')
// Uso fora de componente: import { t } from '@/i18n/useI18n';  t('error.badSave')
// ──────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import {
  Lang,
  TranslationKey,
  Vars,
  translate,
  detectInitialLang,
  htmlLangAttr,
  LANG_STORAGE_KEY,
} from './index';

interface I18nStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useI18nStore = create<I18nStore>(set => ({
  lang: detectInitialLang(),
  setLang: lang => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* localStorage indisponível — troca só em memória nesta sessão */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = htmlLangAttr(lang);
    }
    set({ lang });
  },
}));

export type TFn = (key: TranslationKey, vars?: Vars) => string;

/** Hook reativo: re-renderiza o componente quando o idioma muda. */
export function useT(): TFn {
  const lang = useI18nStore(s => s.lang);
  return (key, vars) => translate(lang, key, vars);
}

export function useLang(): Lang {
  return useI18nStore(s => s.lang);
}

export function useSetLang(): (lang: Lang) => void {
  return useI18nStore(s => s.setLang);
}

/** Tradução pontual fora do ciclo de render (toasts, alerts, callbacks). */
export function t(key: TranslationKey, vars?: Vars): string {
  return translate(useI18nStore.getState().lang, key, vars);
}
