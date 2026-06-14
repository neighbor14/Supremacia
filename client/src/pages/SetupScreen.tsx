import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { playSound } from '../game/audio';
import { Plus, Minus } from 'lucide-react';

export default function SetupScreen() {
  const [, setLocation] = useLocation();
  const { game, dispatch } = useGameStore();
  const [armyPlacement, setArmyPlacement] = useState<Record<string, number>>({});

  if (!game) {
    setLocation('/');
    return null;
  }

  const humanPlayer = Object.values(game.players).find(p => p.isHuman);
  if (!humanPlayer) {
    setLocation('/game');
    return null;
  }

  const sp = SUPERPOWERS[humanPlayer.id];
  const homelands = sp.territories;

  // Initialize placement
  if (Object.keys(armyPlacement).length === 0) {
    const initial: Record<string, number> = {};
    homelands.forEach(t => {
      initial[t] = game.players[humanPlayer.id].armies[t] || 0;
    });
    setArmyPlacement(initial);
  }

  const totalArmies = Object.values(armyPlacement).reduce((a, b) => a + b, 0);
  const maxArmies = 5; // Starting armies per player

  const handleAddArmy = (territory: string) => {
    if (totalArmies < maxArmies) {
      playSound('button-click', 0.5);
      setArmyPlacement(prev => ({
        ...prev,
        [territory]: (prev[territory] || 0) + 1,
      }));
    }
  };

  const handleRemoveArmy = (territory: string) => {
    if (armyPlacement[territory] > 0) {
      playSound('button-click', 0.5);
      setArmyPlacement(prev => ({
        ...prev,
        [territory]: (prev[territory] || 0) - 1,
      }));
    }
  };

  const handleStartGame = () => {
    if (totalArmies === maxArmies) {
      playSound('turn-start', 0.7);
      // Start the game - armies are already placed in the store
      dispatch({ type: 'START_GAME' });
      setLocation('/game');
    }
  };

  return (
    <div className="h-screen w-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: sp.color }} />
          <h1 className="text-3xl font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', color: sp.color }}>
            {sp.shortName}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          Posicione seus exércitos iniciais
        </p>
      </div>

      {/* Territory cards */}
      <div className="grid grid-cols-2 gap-4 max-w-2xl mb-8">
        {homelands.map(territoryId => {
          const territory = game.territories[territoryId];
          const count = armyPlacement[territoryId] || 0;

          return (
            <div
              key={territoryId}
              className="bg-card border border-border rounded-lg p-4 flex flex-col items-center gap-3"
            >
              <h3 className="text-sm font-semibold uppercase text-center">{territory.name}</h3>

              {/* Army count display */}
              <div className="text-2xl font-bold font-mono-num" style={{ color: sp.color }}>
                {count}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRemoveArmy(territoryId)}
                  disabled={count === 0}
                  className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 active:scale-[0.9]"
                >
                  <Minus size={14} />
                </button>
                <button
                  onClick={() => handleAddArmy(territoryId)}
                  disabled={totalArmies >= maxArmies}
                  className="w-8 h-8 rounded bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 disabled:opacity-30 active:scale-[0.9]"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            Exércitos posicionados
          </span>
          <span className="text-xs font-mono-num text-primary">
            {totalArmies} / {maxArmies}
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(totalArmies / maxArmies) * 100}%` }}
          />
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={handleStartGame}
        disabled={totalArmies !== maxArmies}
        className={`
          px-8 py-3 rounded-lg font-semibold uppercase tracking-wider transition-all
          ${totalArmies === maxArmies
            ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97]'
            : 'bg-secondary text-muted-foreground opacity-50 cursor-not-allowed'
          }
        `}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Começar Jogo
      </button>
    </div>
  );
}
