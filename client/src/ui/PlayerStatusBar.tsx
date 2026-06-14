import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';

export default function PlayerStatusBar() {
  const { game } = useGameStore();
  if (!game) return null;

  const humanPlayer = Object.values(game.players).find(p => p.isHuman);
  if (!humanPlayer) return null;

  const sp = SUPERPOWERS[humanPlayer.id];

  return (
    <div className="flex-shrink-0 bg-card border-t border-border px-3 py-2 safe-bottom">
      <div className="flex items-center justify-between">
        {/* Money */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase" style={{ fontFamily: 'var(--font-display)' }}>$</span>
          <span className="text-sm font-bold font-mono-num" style={{ color: sp.color }}>
            {humanPlayer.money.toLocaleString()}
          </span>
        </div>

        {/* Supplies */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-xs font-mono-num">{humanPlayer.supplies.grain}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-600" />
            <span className="text-xs font-mono-num">{humanPlayer.supplies.oil}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-xs font-mono-num">{humanPlayer.supplies.mineral}</span>
          </div>
        </div>

        {/* Strategic */}
        <div className="flex items-center gap-2">
          {humanPlayer.nukes > 0 && (
            <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-mono-num">
              ☢{humanPlayer.nukes}
            </span>
          )}
          {humanPlayer.laserStars > 0 && (
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono-num">
              ★{humanPlayer.laserStars}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
