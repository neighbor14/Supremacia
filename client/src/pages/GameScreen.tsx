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
import LandscapePrompt from '../ui/LandscapePrompt';
import EventLogDrawer from '../ui/EventLogDrawer';
import CpuTurnOverlay from '../ui/CpuTurnOverlay';

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
      }, 1200); // Slightly longer to show the overlay
      return () => clearTimeout(timer);
    }
  }, [game?.turn.currentPlayer, game?.turn.turnNumber, game?.gameOver]);

  if (!game) return null;

  return (
    <>
      {/* Landscape prompt for mobile portrait */}
      <LandscapePrompt />

      <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-background relative">
        {/* Top: Turn Phase Bar - compact */}
        <TurnPhaseBar />

        {/* Main area: Map fills everything */}
        <div className="flex-1 relative overflow-hidden">
          <WorldMap />
          {/* Tutorial overlay inside map area */}
          <TurnTutorial />
          {/* Event log drawer */}
          <EventLogDrawer />
          {/* CPU turn overlay */}
          <CpuTurnOverlay />
          {/* Player status overlay - bottom left */}
          <PlayerStatusBar />
        </div>

        {/* Bottom Sheet for territory/action details */}
        <BottomSheet />

        {/* Modals */}
        {game.combat.active && <CombatModal />}
        {game.nuclearAttack.active && <NuclearModal />}
        {game.gameOver && <GameOverModal />}
      </div>
    </>
  );
}
