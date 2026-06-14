import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGameStore } from '../game/store';
import WorldMap from '../ui/WorldMap';
import TurnPhaseBar from '../ui/TurnPhaseBar';
import PlayerStatusBar from '../ui/PlayerStatusBar';
import BottomSheet from '../ui/BottomSheet';
import CombatModal from '../ui/CombatModal';
import NuclearModal from '../ui/NuclearModal';
import GameOverModal from '../ui/GameOverModal';
import TurnTutorial from '../ui/TurnTutorial';

export default function GameScreen() {
  const [, setLocation] = useLocation();
  const { game, dispatch } = useGameStore();

  useEffect(() => {
    if (!game) {
      setLocation('/');
    }
  }, [game, setLocation]);

  // Auto-run CPU turns
  useEffect(() => {
    if (!game || game.gameOver) return;
    const currentPlayer = game.players[game.turn.currentPlayer];
    if (!currentPlayer.isHuman && !currentPlayer.isEliminated) {
      const timer = setTimeout(() => {
        dispatch({ type: 'CPU_TURN' });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [game?.turn.currentPlayer, game?.turn.turnNumber, game?.gameOver]);

  if (!game) return null;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background relative">
      {/* Top: Turn Phase Bar */}
      <TurnPhaseBar />

      {/* Middle: Map */}
      <div className="flex-1 relative overflow-hidden">
        <WorldMap />
        {/* Tutorial overlay inside map area */}
        <TurnTutorial />
      </div>

      {/* Bottom: Player Status */}
      <PlayerStatusBar />

      {/* Bottom Sheet for territory/action details */}
      <BottomSheet />

      {/* Modals */}
      {game.combat.active && <CombatModal />}
      {game.nuclearAttack.active && <NuclearModal />}
      {game.gameOver && <GameOverModal />}
    </div>
  );
}
