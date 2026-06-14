import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';

export default function PlayerStatusBar() {
  const { game } = useGameStore();
  if (!game) return null;

  const humanPlayer = Object.values(game.players).find(p => p.isHuman);
  if (!humanPlayer) return null;

  const sp = SUPERPOWERS[humanPlayer.id];

  return (
    <div className="absolute bottom-2 left-2 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-lg">
      <div className="flex items-center gap-3">
        {/* Money */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase" style={{ fontFamily: 'var(--font-display)' }}>$</span>
          <span className="text-sm font-bold font-mono-num" style={{ color: sp.color }}>
            {humanPlayer.money.toLocaleString()}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border" />

        {/* Supplies */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-[11px] font-mono-num">{humanPlayer.supplies.grain}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[11px] font-mono-num">{humanPlayer.supplies.oil}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-[11px] font-mono-num">{humanPlayer.supplies.mineral}</span>
          </div>
        </div>

        {/* Strategic */}
        {(humanPlayer.nukes > 0 || humanPlayer.laserStars > 0) && (
          <>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              {humanPlayer.nukes > 0 && (
                <span className="text-[10px] bg-destructive/20 text-destructive px-1 py-0.5 rounded font-mono-num">
                  ☢{humanPlayer.nukes}
                </span>
              )}
              {humanPlayer.laserStars > 0 && (
                <span className="text-[10px] bg-primary/20 text-primary px-1 py-0.5 rounded font-mono-num">
                  ★{humanPlayer.laserStars}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
