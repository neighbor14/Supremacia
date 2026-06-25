import { useState } from 'react';
import { LANGS, LANG_LABELS, Lang } from '../i18n';
import { useLang, useSetLang, useT } from '../i18n/useI18n';
import { useGameStore } from '../game/store';

/**
 * Seletor de idioma reutilizável (menu inicial e tela de escolha de potência).
 *
 * As mensagens do log são geradas no idioma ativo no momento da ação e NÃO são
 * re-traduzidas depois. Por isso: antes do jogo começar, trocar é livre; com uma
 * partida em andamento, a troca passa por um aviso explícito de que o histórico
 * do log não muda de idioma (só os eventos novos).
 */
/**
 * @param warnIfSaved no menu inicial há o botão CONTINUAR; trocar o idioma e
 * retomar mistura idiomas no log. Passe `warnIfSaved` onde existe esse risco
 * (menu). Na escolha de potência de uma partida NOVA não passe — a troca é livre.
 */
export default function LanguageSelector({ warnIfSaved = false }: { warnIfSaved?: boolean }) {
  const lang = useLang();
  const setLang = useSetLang();
  const t = useT();
  // Partida em andamento: jogo carregado em memória e não encerrado, OU (no menu)
  // um save retomável via CONTINUAR.
  const inGame = useGameStore(s => !!s.game && !s.game.gameOver);
  const hasSave = (() => {
    try { return !!localStorage.getItem('supremacia_save'); } catch { return false; }
  })();
  const shouldWarn = inGame || (warnIfSaved && hasSave);
  const [pending, setPending] = useState<Lang | null>(null);

  const choose = (l: Lang) => {
    if (l === lang) return;
    if (shouldWarn) setPending(l); // pede confirmação
    else setLang(l);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {LANGS.map(l => {
        const active = l === lang;
        return (
          <button
            key={l}
            onClick={() => choose(l)}
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

      {/* Aviso de troca de idioma com partida em andamento */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-xs animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              {t('menu.langWarnTitle')}
            </h3>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              {t('menu.langWarnBody')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPending(null)}
                className="flex-1 py-2 px-3 rounded-md border border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-secondary active:scale-[0.97]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => { setLang(pending); setPending(null); }}
                className="flex-1 py-2 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-wider hover:opacity-90 active:scale-[0.97]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('menu.langWarnConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
