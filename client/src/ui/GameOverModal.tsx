import { useLocation } from 'wouter';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { useT } from '../i18n/useI18n';

export default function GameOverModal() {
  const [, setLocation] = useLocation();
  const { game } = useGameStore();
  const t = useT();
  if (!game || !game.gameOver) return null;

  const winner = game.winner ? SUPERPOWERS[game.winner] : null;

  const endMessages: Record<string, string> = {
    supremacy: t('gameOver.supremacy'),
    detente: t('gameOver.detente'),
    holocaust: t('gameOver.holocaust'),
  };

  const handleNewGame = () => {
    localStorage.removeItem('supremacia_save');
    setLocation('/');
  };

  const handleExport = () => {
    const json = JSON.stringify(game, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supremacia_final_turno${game.turn.turnNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm text-center animate-in zoom-in-95 duration-200">
        {game.endCondition === 'holocaust' ? (
          <>
            <span className="text-5xl mb-3 block">☢</span>
            <h2 className="text-xl font-bold uppercase tracking-wider text-destructive mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              {t('gameOver.holocaustTitle')}
            </h2>
            <p className="text-xs text-muted-foreground mb-6">
              {t('gameOver.holocaustBody', { count: game.nukedTerritoryCount })}
            </p>
          </>
        ) : (
          <>
            {winner && (
              <div className="w-12 h-12 rounded-full mx-auto mb-3" style={{ backgroundColor: winner.color }} />
            )}
            <h2 className="text-xl font-bold uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-display)', color: winner?.color }}>
              {winner?.name || t('gameOver.draw')}
            </h2>
            <p className="text-xs text-muted-foreground mb-6">
              {endMessages[game.endCondition || 'supremacy']}
            </p>
          </>
        )}

        <div className="flex gap-2 justify-center">
          <button
            onClick={handleNewGame}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('menu.newGame')}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded text-xs uppercase tracking-wider font-semibold hover:opacity-90 active:scale-[0.97]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('common.export')}
          </button>
        </div>
      </div>
    </div>
  );
}
