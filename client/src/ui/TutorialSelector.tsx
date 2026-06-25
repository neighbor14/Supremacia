import { useTutorialStore, TutorialLevel } from '../stores/tutorialStore';
import { useT } from '../i18n/useI18n';
import { TranslationKey } from '../i18n';

const LEVELS: TutorialLevel[] = ['full', 'tips', 'off'];

/** Seletor de nível de tutorial — decisão antes de jogar, persistida localmente. */
export default function TutorialSelector() {
  const t = useT();
  const { level, setLevel, resetSeen } = useTutorialStore();

  return (
    <div className="grid grid-cols-3 gap-2">
      {LEVELS.map(l => {
        const active = l === level;
        return (
          <button
            key={l}
            onClick={() => {
              setLevel(l);
              // Ao (re)ligar o tutorial, permite que os cards apareçam de novo.
              if (l !== 'off') resetSeen();
            }}
            className={`py-2 px-1 rounded-md border text-[11px] font-bold uppercase tracking-wider transition-all active:scale-[0.96] ${
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
            aria-pressed={active}
          >
            {t(`tutorial.level.${l}` as TranslationKey)}
          </button>
        );
      })}
    </div>
  );
}
