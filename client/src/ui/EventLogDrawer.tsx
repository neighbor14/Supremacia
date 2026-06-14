import { useState } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { ScrollText, X } from 'lucide-react';
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

export default function EventLogDrawer() {
  const { game } = useGameStore();
  const [isOpen, setIsOpen] = useState(false);

  if (!game) return null;

  const events = [...game.eventLog].reverse();

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          absolute top-2 right-14 z-20 w-9 h-9 rounded-full flex items-center justify-center
          bg-card/90 backdrop-blur-sm border border-border shadow-lg
          hover:bg-card active:scale-[0.93] transition-all
          ${events.length > 0 ? '' : 'opacity-50'}
        `}
        aria-label="Log de eventos"
      >
        <ScrollText size={16} className="text-muted-foreground" />
        {events.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
            {Math.min(events.length, 99)}
          </span>
        )}
      </button>

      {/* Drawer panel */}
      {isOpen && (
        <div className="absolute top-0 right-0 bottom-0 w-72 sm:w-80 z-30 animate-in slide-in-from-right duration-200">
          <div className="h-full bg-card/95 backdrop-blur-md border-l border-border flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                Log de Eventos
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            {/* Events list */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {events.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum evento ainda.
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
                          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: sp.color, fontFamily: 'var(--font-display)' }}>
                            {sp.shortName}
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
          </div>
        </div>
      )}
    </>
  );
}
