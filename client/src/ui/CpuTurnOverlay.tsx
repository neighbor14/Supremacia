import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { Loader2 } from 'lucide-react';

export default function CpuTurnOverlay() {
  const { game } = useGameStore();
  if (!game) return null;

  const currentPlayer = game.players[game.turn.currentPlayer];
  if (currentPlayer.isHuman || currentPlayer.isEliminated || game.gameOver) return null;

  const sp = SUPERPOWERS[game.turn.currentPlayer];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
      {/* Subtle dark overlay */}
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] animate-in fade-in duration-300" />

      {/* CPU indicator card */}
      <div className="relative bg-card/95 backdrop-blur-md border border-border rounded-lg px-6 py-4 shadow-2xl animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center gap-3">
        {/* Spinning loader with player color */}
        <div className="relative">
          <Loader2
            size={32}
            className="animate-spin"
            style={{ color: sp.color }}
          />
          <div
            className="absolute inset-0 rounded-full blur-md opacity-30 animate-pulse"
            style={{ backgroundColor: sp.color }}
          />
        </div>

        {/* Player name */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sp.color }} />
          <span
            className="text-sm font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)', color: sp.color }}
          >
            {sp.shortName}
          </span>
        </div>

        {/* Status text */}
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          Executando turno...
        </p>

        {/* Animated dots */}
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{
                backgroundColor: sp.color,
                animationDelay: `${i * 150}ms`,
                animationDuration: '800ms',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
