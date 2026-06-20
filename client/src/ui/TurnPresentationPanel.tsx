import { SUPERPOWERS } from '../data/initialPlayers';
import { usePresentationStore } from '../stores/presentationStore';
import { ActionEventType, PlayerActionEvent, TurnStage } from '../game/types';
import { Pause, Play, SkipForward, Zap, Clock } from 'lucide-react';

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
  pay_salaries: '💸',
  transfer_production: '🏭',
  sell_resource: '📦',
  buy_resource: '🛒',
  build_armies: '⚔️',
  build_navies: '🚢',
  attack_result_victory: '🏆',
  attack_result_defeat: '💥',
  research: '☢️',
  end_turn: '🔁',
};

const RESOURCE_LABELS: Record<string, string> = {
  money: 'M$',
  grain: 'cereal',
  oil: 'petróleo',
  mineral: 'minério',
};

function ResourceBadge({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full ${
        positive
          ? 'bg-green-500/15 text-green-400 border border-green-500/20'
          : 'bg-red-500/15 text-red-400 border border-red-500/20'
      }`}
    >
      {positive ? '+' : ''}{label === 'M$' ? value.toLocaleString() : value} {label}
    </span>
  );
}

function CompletedMiniLog({ events }: { events: PlayerActionEvent[] }) {
  if (events.length === 0) return null;
  const recent = events.slice(-3);
  return (
    <div className="border-t border-border/30 px-4 pt-2 pb-1">
      {recent.map(ev => (
        <div key={ev.id} className="flex items-center gap-1.5 py-0.5">
          <span className="text-xs opacity-60">{ACTION_ICONS[ev.actionType]}</span>
          <span className="text-[11px] text-muted-foreground truncate">{ev.title.split(' — ')[1] ?? ev.title}</span>
          <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">✓</span>
        </div>
      ))}
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
  const progress = steps.length > 0 ? (currentIndex / steps.length) * 100 : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-auto animate-in slide-in-from-bottom duration-300">
      {/* Completed actions mini-log */}
      <div className="bg-card/90 backdrop-blur-md border-t border-border/40">
        <CompletedMiniLog events={completedEvents} />

        {/* Main action card */}
        <div className="px-4 py-3">
          {/* Header: player + phase */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sp.color }} />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: sp.color, fontFamily: 'var(--font-display)' }}
            >
              {sp.shortName}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              — Fase {ev.phase}: {STAGE_NAMES[ev.phase]}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <span
                className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold"
                style={{ backgroundColor: `${sp.color}22`, color: sp.color, fontFamily: 'var(--font-display)' }}
              >
                IA
              </span>
            </div>
          </div>

          {/* Action content */}
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5 shrink-0">{ACTION_ICONS[ev.actionType]}</span>
            <div className="min-w-0">
              <p
                className="text-sm font-bold text-foreground leading-snug"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {ev.title.split(' — ')[1] ?? ev.title}
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                {ev.description}
              </p>
              {/* Resource changes */}
              {ev.resourceChanges && (
                <div className="flex flex-wrap gap-1.5 mt-2">
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
            </div>
          </div>
        </div>

        {/* Progress bar + controls */}
        <div className="px-4 pb-3">
          {/* Progress bar */}
          <div className="w-full bg-border/30 rounded-full h-0.5 mb-3">
            <div
              className="h-0.5 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%`, backgroundColor: sp.color }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Pause / Resume */}
            <button
              onClick={isPaused ? resume : pause}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
            >
              {isPaused ? <Play size={12} /> : <Pause size={12} />}
              {isPaused ? 'Retomar' : 'Pausar'}
            </button>

            <div className="flex items-center gap-1 ml-auto">
              {/* Speed: Normal */}
              <button
                onClick={() => setSpeed('normal')}
                title="Velocidade normal: 5 segundos por ação"
                className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md transition-colors ${
                  speed === 'normal'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <Clock size={11} />
                5s
              </button>
              {/* Speed: Fast */}
              <button
                onClick={() => setSpeed('fast')}
                title="Velocidade rápida: 2 segundos por ação"
                className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md transition-colors ${
                  speed === 'fast'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <Zap size={11} />
                2s
              </button>
              {/* Skip */}
              <button
                onClick={skip}
                title="Pular apresentação — aplicar turno imediatamente"
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                <SkipForward size={11} />
                Pular
              </button>
            </div>
          </div>

          {/* Step counter */}
          <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5" style={{ fontFamily: 'var(--font-display)' }}>
            {currentIndex + 1} / {steps.length}
            {isPaused && ' · PAUSADO'}
          </p>
        </div>
      </div>
    </div>
  );
}
