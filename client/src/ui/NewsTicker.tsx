import { useRef, useEffect } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { EventLogEntry } from '../game/types';

const TYPE_ICONS: Record<EventLogEntry['type'], string> = {
  info: '📋',
  combat: '⚔️',
  nuclear: '☢️',
  economy: '💰',
  build: '🏗️',
  move: '🚀',
  elimination: '💀',
};

export default function NewsTicker() {
  const { game } = useGameStore();
  const trackRef = useRef<HTMLDivElement>(null);

  const events = game?.eventLog ?? [];

  useEffect(() => {
    const el = trackRef.current;
    if (!el || events.length === 0) return;
    // speed: ~120px/s — recalculated on each new event
    const halfWidth = el.scrollWidth / 2;
    const duration = Math.max(8, halfWidth / 120);
    el.style.animationDuration = `${duration}s`;
  }, [events.length]);

  if (!game || events.length === 0) return null;

  const recent = events.slice(-25);
  const text = recent
    .map(e => {
      const sp = SUPERPOWERS[e.player];
      return `${TYPE_ICONS[e.type]} ${sp.shortName}: ${e.message}`;
    })
    .join('   ◆   ');

  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-7 z-[9] flex items-center overflow-hidden"
      style={{ background: 'oklch(0.12 0.04 264.695 / 0.92)', backdropFilter: 'blur(6px)', borderTop: '1px solid oklch(0.3 0.03 264.695)' }}
    >
      {/* Label */}
      <div
        className="shrink-0 h-full flex items-center px-2.5 border-r"
        style={{ background: 'var(--color-primary)', borderColor: 'oklch(0.4 0.1 259.815)' }}
      >
        <span
          className="text-[9px] font-bold tracking-[0.18em] uppercase text-white leading-none"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          EVENTOS
        </span>
      </div>

      {/* Scrolling track */}
      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        <div
          ref={trackRef}
          key={events.length}
          className="whitespace-nowrap text-[10px] leading-none animate-ticker"
          style={{ color: 'oklch(0.82 0.015 252.894)', fontFamily: 'var(--font-display)' }}
        >
          {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
        </div>
      </div>
    </div>
  );
}
