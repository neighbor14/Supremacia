import { useEffect, useRef, useState } from 'react';
import { SUPERPOWERS } from '../data/initialPlayers';
import { usePresentationStore } from '../stores/presentationStore';
import { ActionEventType, TurnStage } from '../game/types';
import { SkipForward, Zap, Clock, Pause, Play } from 'lucide-react';

const STAGE_NAMES: Record<TurnStage, string> = {
  1: 'Salários',
  2: 'Produção',
  3: 'Vender',
  4: 'Combate',
  5: 'Movimento',
  6: 'Construção',
  7: 'Mercado',
};

const ACTION_ICONS: Record<ActionEventType, string> = {
  pay_salaries:          '💸',
  transfer_production:   '🏭',
  sell_resource:         '📦',
  buy_resource:          '🛒',
  build_armies:          '⚔️',
  build_navies:          '🚢',
  move:                  '🪖',
  attack_result_victory: '🏆',
  attack_result_defeat:  '💥',
  research:              '☢️',
  card_reveal:           '🃏',
  end_turn:              '🔁',
};

const RESOURCE_LABELS: Record<string, string> = {
  money:   'M$',
  grain:   'cereal',
  oil:     'petróleo',
  mineral: 'minério',
};

function ResourceBadge({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[12px] font-mono px-2.5 py-1 rounded-full font-semibold ${
        positive
          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
          : 'bg-red-500/20 text-red-300 border border-red-500/30'
      }`}
    >
      {positive ? '+' : ''}
      {label === 'M$' ? value.toLocaleString() : value} {label}
    </span>
  );
}

// Animated countdown bar that resets each time `key` changes
function CountdownBar({ durationMs, color }: { durationMs: number; color: string }) {
  const [width, setWidth] = useState(100);
  const startTime = useRef(Date.now());

  useEffect(() => {
    startTime.current = Date.now();
    setWidth(100);
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setWidth(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [durationMs]);

  return (
    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-none"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function TurnPresentationPanel() {
  const {
    steps, currentIndex, isPresenting, isPaused, speed, completedEvents,
    pause, resume, setSpeed, skip,
  } = usePresentationStore();

  if (!isPresenting) return null;

  const currentStep = steps[currentIndex];
  if (!currentStep) return null;

  const ev = currentStep.event;
  const sp = SUPERPOWERS[ev.playerId];

  // How long this event actually lasts (used for countdown bar)
  const actualDuration = speed === 'fast' ? 2000 : (ev.durationMs ?? 3000);

  return (
    /* Full-screen dim overlay — blocks map interaction while AI is "thinking out loud" */
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-auto">
      {/* Darkened backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      {/* Announcement card — centered */}
      <div
        key={`${ev.id}-${currentIndex}`}
        className="relative w-full max-w-sm mx-4 animate-in zoom-in-95 fade-in duration-200"
      >
        <div
          className="bg-card/97 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden"
          style={{ borderWidth: 2, borderStyle: 'solid', borderColor: `${sp.color}60` }}
        >
          {/* Countdown bar at top */}
          {!isPaused && (
            <CountdownBar
              key={`bar-${ev.id}-${currentIndex}-${speed}`}
              durationMs={actualDuration}
              color={sp.color}
            />
          )}

          <div className="px-6 py-5">
            {/* Player identity row */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sp.color }} />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: sp.color, fontFamily: 'var(--font-display)' }}
              >
                {sp.name}
              </span>
              <span
                className="ml-auto text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider"
                style={{ backgroundColor: `${sp.color}22`, color: sp.color, fontFamily: 'var(--font-display)' }}
              >
                IA · Fase {ev.phase}: {STAGE_NAMES[ev.phase]}
              </span>
            </div>

            {/* Big icon + action */}
            <div className="flex flex-col items-center text-center gap-2 mb-4">
              <span className="text-5xl leading-none">{ACTION_ICONS[ev.actionType]}</span>

              {/* Title — the main announcement text */}
              <p
                className="text-xl font-bold text-foreground leading-tight mt-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {/* Strip player prefix if present */}
                {ev.title.includes(' — ')
                  ? ev.title.split(' — ').slice(1).join(' — ')
                  : ev.title}
              </p>

              {/* Description — the "where / how much / result" detail */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ev.description}
              </p>
            </div>

            {/* Resource change badges */}
            {ev.resourceChanges && Object.entries(ev.resourceChanges).some(([, v]) => v && v !== 0) && (
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {Object.entries(ev.resourceChanges).map(([key, val]) =>
                  val !== undefined && val !== 0 ? (
                    <ResourceBadge key={key} label={RESOURCE_LABELS[key] ?? key} value={val} />
                  ) : null
                )}
                {(ev.armyDelta ?? 0) !== 0 && (
                  <ResourceBadge label="exércitos" value={ev.armyDelta!} />
                )}
                {(ev.navyDelta ?? 0) !== 0 && (
                  <ResourceBadge label="esquadras" value={ev.navyDelta!} />
                )}
              </div>
            )}

            {/* Step progress dots */}
            <div className="flex justify-center gap-1.5 mb-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === currentIndex ? 16 : 6,
                    height: 6,
                    backgroundColor:
                      i < currentIndex
                        ? `${sp.color}60`
                        : i === currentIndex
                        ? sp.color
                        : 'rgba(255,255,255,0.15)',
                  }}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Pause / Resume */}
              <button
                onClick={isPaused ? resume : pause}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
              >
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
                {isPaused ? 'Retomar' : 'Pausar'}
              </button>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => setSpeed('normal')}
                  title="3 segundos por ação"
                  className={`flex items-center gap-1 text-xs px-2.5 py-2 rounded-lg transition-colors ${
                    speed === 'normal'
                      ? 'text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                  style={speed === 'normal' ? { backgroundColor: sp.color } : {}}
                >
                  <Clock size={11} /> 3s
                </button>
                <button
                  onClick={() => setSpeed('fast')}
                  title="1.5 segundos por ação"
                  className={`flex items-center gap-1 text-xs px-2.5 py-2 rounded-lg transition-colors ${
                    speed === 'fast'
                      ? 'text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                  style={speed === 'fast' ? { backgroundColor: sp.color } : {}}
                >
                  <Zap size={11} /> 1.5s
                </button>
                <button
                  onClick={skip}
                  title="Pular o turno inteiro"
                  className="flex items-center gap-1 text-xs px-2.5 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  <SkipForward size={11} /> Pular
                </button>
              </div>
            </div>

            {/* Completed mini-log */}
            {completedEvents.length > 0 && (
              <div className="mt-4 border-t border-border/30 pt-3 space-y-1">
                {completedEvents.slice(-3).map(cev => (
                  <div key={cev.id} className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
                    <span className="shrink-0">{ACTION_ICONS[cev.actionType]}</span>
                    <span className="truncate">
                      {cev.title.includes(' — ')
                        ? cev.title.split(' — ').slice(1).join(' — ')
                        : cev.title}
                    </span>
                    <span className="ml-auto shrink-0 text-green-500/60">✓</span>
                  </div>
                ))}
              </div>
            )}

            {/* Step counter */}
            <p
              className="text-center text-[10px] text-muted-foreground/40 mt-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {currentIndex + 1} / {steps.length}{isPaused ? ' · PAUSADO' : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
