import { useState } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { RULES } from '../game/rulesConfig';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const RESOURCE_CONFIG = [
  { key: 'grain' as const,   label: 'Cereal',   icon: '🌾', color: '#eab308', bg: '#eab30840' },
  { key: 'oil' as const,     label: 'Petróleo', icon: '🛢',  color: '#ef4444', bg: '#ef444440' },
  { key: 'mineral' as const, label: 'Minério',  icon: '⛏',  color: '#a855f7', bg: '#a855f740' },
];

const MAX = RULES.MAX_SUPPLY; // 12

export default function PlayerStatusBar() {
  const { game } = useGameStore();
  const [expanded, setExpanded] = useState(true);

  if (!game) return null;

  const humanPlayer = Object.values(game.players).find(p => p.isHuman);
  if (!humanPlayer) return null;

  const sp = SUPERPOWERS[humanPlayer.id];

  return (
    <div className="absolute left-2 top-1/3 -translate-y-1/2 z-20 flex items-start gap-0">
      {/* Main panel */}
      <div
        className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl overflow-hidden transition-all duration-200"
        style={{ width: expanded ? 160 : 42 }}
      >
        {expanded ? (
          <div className="p-2.5">
            {/* Money */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">$</span>
              <span className="text-sm font-bold font-mono leading-none" style={{ color: sp.color }}>
                {humanPlayer.money >= 1000
                  ? `${Math.floor(humanPlayer.money / 1000)}k`
                  : humanPlayer.money.toLocaleString()}
              </span>
              {humanPlayer.loans > 0 && (
                <span className="text-[9px] text-destructive font-mono ml-auto">-{(humanPlayer.loans / 1000).toFixed(0)}k dív</span>
              )}
            </div>

            {/* Supply tracks */}
            <div className="space-y-1.5">
              {RESOURCE_CONFIG.map(({ key, label, icon, color, bg }) => {
                const val = humanPlayer.supplies[key];
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                        {icon} {label}
                      </span>
                      <span className="text-[10px] font-bold font-mono" style={{ color }}>
                        {val}/{MAX}
                      </span>
                    </div>
                    {/* Track cells */}
                    <div className="flex gap-[2px]">
                      {Array.from({ length: MAX }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 h-2.5 rounded-[2px] transition-colors"
                          style={{
                            backgroundColor: i < val ? color : bg,
                            opacity: i < val ? 1 : 0.35,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weapons row */}
            {(humanPlayer.nukes > 0 || humanPlayer.laserStars > 0) && (
              <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                {humanPlayer.nukes > 0 && (
                  <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-mono font-bold">
                    ☢ {humanPlayer.nukes}
                  </span>
                )}
                {humanPlayer.laserStars > 0 && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">
                    ★ {humanPlayer.laserStars}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Collapsed: vertical stack of resource dots + money */
          <div className="py-2.5 px-1 flex flex-col items-center gap-1.5">
            <span className="text-[9px] font-bold font-mono" style={{ color: sp.color }}>
              {humanPlayer.money >= 1000 ? `${Math.floor(humanPlayer.money / 1000)}k` : humanPlayer.money}
            </span>
            {RESOURCE_CONFIG.map(({ key, icon, color }) => (
              <div key={key} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px]">{icon}</span>
                <span className="text-[9px] font-mono font-bold" style={{ color }}>
                  {humanPlayer.supplies[key]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toggle tab */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-3 w-5 h-8 bg-card/95 border border-border rounded-r-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shadow-lg"
      >
        {expanded ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
      </button>
    </div>
  );
}
