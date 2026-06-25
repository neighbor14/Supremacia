import { LANGS, LANG_LABELS } from '../i18n';
import { useLang, useSetLang } from '../i18n/useI18n';

/** Seletor de idioma reutilizável (menu inicial e, futuramente, em jogo). */
export default function LanguageSelector() {
  const lang = useLang();
  const setLang = useSetLang();

  return (
    <div className="grid grid-cols-3 gap-2">
      {LANGS.map(l => {
        const active = l === lang;
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`py-2 px-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.96] ${
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
            aria-pressed={active}
          >
            {LANG_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
