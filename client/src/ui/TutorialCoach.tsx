import { useEffect, useState } from 'react';
import { HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useGameStore } from '../game/store';
import { useTutorialStore, TUTORIAL_AUTO_ROUNDS } from '../stores/tutorialStore';
import { useT } from '../i18n/useI18n';
import { TranslationKey } from '../i18n';

// Ícones por tópico (visual livre — não é regra de jogo).
const TOPIC_ICONS: Record<string, string> = {
  intro: '🌍',
  'phase.1': '💰',
  'phase.2': '🏭',
  'phase.3': '📈',
  'phase.4': '⚔️',
  'phase.5': '🚀',
  'phase.6': '🏗️',
  'phase.7': '🛒',
  'topic.territory': '🃏',
  'topic.seas': '🌊',
};

// Base de chaves i18n para cada tópico.
function i18nBase(key: string): string {
  if (key === 'intro') return 'tutorial.intro';
  if (key.startsWith('phase.')) return `tutorial.phase.${key.slice(6)}`;
  return `tutorial.${key}`; // topic.territory / topic.seas
}

const EXTRA_TOPICS = ['topic.territory', 'topic.seas'] as const;

export default function TutorialCoach() {
  const { game } = useGameStore();
  const t = useT();
  const { level, seen, activeKey, show, dismiss, markSeen, setLevel } = useTutorialStore();
  const [showRules, setShowRules] = useState(false);
  const [lastStage, setLastStage] = useState(0);
  const [pulse, setPulse] = useState(false);

  const isHumanTurn = !!game && game.players[game.turn.currentPlayer]?.isHuman;
  const blockedByModal =
    !!game &&
    (game.combat.active ||
      game.nuclearAttack.active ||
      game.drawnCard?.active ||
      game.gameOver);

  // ── Disparo progressivo: 1ª visita a cada fase nas primeiras rodadas ───────
  useEffect(() => {
    if (!game || !isHumanTurn || blockedByModal) return;
    if (level === 'off') return;
    if (game.turn.turnNumber > TUTORIAL_AUTO_ROUNDS) return;

    // Introdução tem precedência no começo da partida.
    if (!seen['intro']) {
      show('intro');
      return;
    }
    const key = `phase.${game.turn.stage}`;
    if (!seen[key]) show(key);
    // dismiss() (fechar sem marcar) não reabre: deps não mudam até a próxima fase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.turn.stage, game?.turn.currentPlayer, game?.turn.turnNumber, level, seen, blockedByModal]);

  // ── Pulso no botão de ajuda quando a fase muda (chama atenção) ─────────────
  useEffect(() => {
    if (game && game.turn.stage !== lastStage) {
      setLastStage(game.turn.stage);
      if (isHumanTurn) {
        setPulse(true);
        const timer = setTimeout(() => setPulse(false), 2000);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.turn.stage, game?.turn.currentPlayer]);

  if (!game || !isHumanTurn) return null;

  // Abertura manual: alterna o card do tópico contextual da fase atual.
  const contextualKey = !seen['intro'] ? 'intro' : `phase.${game.turn.stage}`;
  const handleHelpClick = () => {
    if (activeKey) dismiss();
    else show(contextualKey);
  };

  const open = activeKey !== null && level !== 'off';
  const base = activeKey ? i18nBase(activeKey) : '';
  const isPhase = !!activeKey && activeKey.startsWith('phase.');
  const compact = level === 'tips';

  const tk = (suffix: string) => t(`${base}.${suffix}` as TranslationKey);

  // Fechar/Entendi: o card de introdução é uma boas-vindas única — marcá-lo como
  // visto evita que ele reapareça e bloqueie os cards de fase. Cards de fase só
  // são dispensados (podem reaparecer ao revisitar a fase dentro das 1ªs rodadas);
  // "Não mostrar novamente" é que os marca como vistos de vez.
  const closeCard = () => {
    if (activeKey === 'intro') markSeen('intro');
    else dismiss();
  };

  return (
    <>
      {/* Botão de ajuda flutuante — referência manual sempre disponível */}
      <button
        onClick={handleHelpClick}
        className={`
          absolute top-2 left-3 z-20 w-9 h-9 rounded-full flex items-center justify-center
          bg-card/90 backdrop-blur-sm border border-border shadow-lg
          hover:bg-card active:scale-[0.93] transition-all
          ${pulse && !open ? 'animate-pulse ring-2 ring-primary/60' : ''}
        `}
        aria-label={t('tutorial.helpAria')}
      >
        <HelpCircle size={18} className="text-primary" />
      </button>

      {open && (
        <div className="absolute top-12 left-3 right-14 z-20 max-w-sm animate-in slide-in-from-top-2 duration-200">
          <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl overflow-hidden">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-primary/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">{activeKey ? TOPIC_ICONS[activeKey] : '🌍'}</span>
                <h3
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {tk('title')}
                </h3>
              </div>
              <button
                onClick={closeCard}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="px-3 py-2.5 space-y-2 max-h-[55vh] overflow-y-auto">
              {activeKey === 'intro' ? (
                // Introdução: blurb sem rótulos de seção.
                <>
                  <p className="text-xs text-foreground leading-relaxed">{tk('whatFor')}</p>
                  <p className="text-xs text-foreground leading-relaxed">{tk('actions')}</p>
                  {!compact && (
                    <>
                      <p className="text-xs text-foreground leading-relaxed">{tk('strategy')}</p>
                      <div className="bg-primary/5 border border-primary/20 rounded px-2 py-1.5">
                        <p className="text-[11px] text-primary font-medium">🏆 {tk('ifIgnored')}</p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Section label={t('tutorial.sectionWhatFor')} value={tk('whatFor')} />
                  <Section label={t('tutorial.sectionActions')} value={tk('actions')} accent />
                  {!compact && (
                    <>
                      <Section label={t('tutorial.sectionStrategy')} value={tk('strategy')} icon="💡" />
                      <Section label={t('tutorial.sectionIfIgnored')} value={tk('ifIgnored')} />
                      {isPhase && (
                        <Section label={t('tutorial.sectionCost')} value={tk('cost')} icon="🪙" />
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Ações do card */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
              {activeKey && activeKey !== 'intro' && (
                <button
                  onClick={() => markSeen(activeKey)}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  {t('tutorial.dontShowAgain')}
                </button>
              )}
              <button
                onClick={closeCard}
                className="ml-auto px-3 py-1 rounded bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider active:scale-[0.96]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('common.gotIt')}
              </button>
            </div>

            {/* Outros tópicos */}
            <div className="border-t border-border px-3 py-2 flex flex-wrap gap-1.5">
              {EXTRA_TOPICS.filter(k => k !== activeKey).map(k => (
                <button
                  key={k}
                  onClick={() => show(k)}
                  className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {TOPIC_ICONS[k]} {t(`${i18nBase(k)}.title` as TranslationKey)}
                </button>
              ))}
            </div>

            {/* Regras gerais (colapsável) */}
            <div className="border-t border-border">
              <button
                onClick={() => setShowRules(!showRules)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span>{t('tutorial.generalRulesTitle')}</span>
                {showRules ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showRules && (
                <div className="px-3 pb-3 space-y-1.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <p
                      key={i}
                      className="text-[10px] text-muted-foreground leading-relaxed flex gap-1.5"
                    >
                      <span className="text-primary font-bold shrink-0">{i}.</span>
                      <span>{t(`tutorial.rules.${i}` as TranslationKey)}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Desligar tutorial */}
            <div className="border-t border-border px-3 py-2">
              <button
                onClick={() => setLevel('off')}
                className="text-[10px] text-muted-foreground/70 hover:text-destructive transition-colors"
              >
                {t('tutorial.disable')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: string;
}) {
  if (accent) {
    return (
      <div className="bg-primary/5 border border-primary/20 rounded px-2 py-1.5">
        <p className="text-[10px] text-primary/80 font-bold uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="text-[11px] text-primary font-medium leading-relaxed">▶ {value}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-xs text-foreground leading-relaxed">
        {icon ? `${icon} ` : ''}
        {value}
      </p>
    </div>
  );
}
