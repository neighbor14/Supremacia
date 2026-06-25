import { useState } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { ScrollText, X, GripHorizontal } from 'lucide-react';
import { EventLogEntry } from '../game/types';
import { useDraggable } from '../hooks/useDraggable';
import { useT } from '../i18n/useI18n';
import { useNames } from '../i18n/names';

const TYPE_ICONS: Record<EventLogEntry['type'], string> = {
  info: '📋',
  combat: '⚔️',
  nuclear: '☢️',
  economy: '💰',
  build: '🏗️',
  move: '🚀',
  elimination: '💀',
};

export default function EventLogDrawer() {
  const { game } = useGameStore();
  const t = useT();
  const names = useNames();
  const [isOpen, setIsOpen] = useState(false);
  const { containerRef, dragHandleProps, containerStyle } = useDraggable(() => ({
    x: Math.max(52, window.innerWidth - 310),
    y: 8,
  }));

  if (!game) return null;

  const events = [...game.eventLog].reverse();

  return (
    <div ref={containerRef} style={containerStyle} className="z-30">
      {/* Toggle button — drag handle when panel is closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          {...dragHandleProps}
          style={{ ...dragHandleProps.style, cursor: events.length > 0 ? 'grab' : 'default' }}
          className={`
            relative w-9 h-9 rounded-full flex items-center justify-center
            bg-card/90 backdrop-blur-sm border border-border shadow-lg
            hover:bg-card active:scale-[0.93] transition-all
            ${events.length > 0 ? '' : 'opacity-50'}
          `}
          aria-label={t('eventLog.title')}
        >
          <ScrollText size={16} className="text-muted-foreground" />
          {events.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
              {Math.min(events.length, 99)}
            </span>
          )}
        </button>
      )}

      {/* Floating panel */}
      {isOpen && (
        <div
          className="w-72 sm:w-80 max-h-[60vh] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header — drag handle */}
          <div
            {...dragHandleProps}
            className="flex items-center justify-between px-3 py-2.5 border-b border-border rounded-t-lg hover:bg-secondary/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <GripHorizontal size={12} className="text-muted-foreground/50" />
              <h3
                className="text-xs font-bold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('eventLog.title')}
              </h3>
            </div>
            <button
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>

          {/* Events list */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {events.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {t('eventLog.empty')}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {events.map((event) => {
                  const sp = SUPERPOWERS[event.player];
                  return (
                    <div key={event.id} className="px-3 py-2 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs">{TYPE_ICONS[event.type]}</span>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sp.color }} />
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: sp.color, fontFamily: 'var(--font-display)' }}
                        >
                          {names.factionShort(event.player)}
                        </span>
                        <span className="text-[9px] text-muted-foreground ml-auto font-mono">
                          T{event.turn}
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground/90 leading-relaxed pl-5">
                        {event.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer toggle to re-close */}
          <div className="border-t border-border/50 flex justify-center py-1.5">
            <button
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onClick={() => setIsOpen(false)}
              className="text-[9px] text-muted-foreground hover:text-foreground uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
