import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useGameStore } from '../game/store';
import { playSound } from '../game/audio';
import { useAudioInit } from '../hooks/useAudio';
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
import AudioControls from '../ui/AudioControls';

export default function GameScreen() {
  const [, setLocation] = useLocation();
  const { game, dispatch } = useGameStore();
  useAudioInit();

  // Track previous state for sound triggers
  const prevTurnRef = useRef<number>(0);
  const prevPlayerRef = useRef<string>('');
  const prevCombatRef = useRef<boolean>(false);
  const prevNukeRef = useRef<boolean>(false);
  const prevGameOverRef = useRef<boolean>(false);

  useEffect(() => {
    if (!game) {
      setLocation('/');
    }
  }, [game, setLocation]);

  // Sound effects based on game state changes
  useEffect(() => {
    if (!game) return;

    const currentPlayer = game.turn.currentPlayer;
    const isHumanTurn = game.players[currentPlayer]?.isHuman;

    // Turn changed to human player
    if (isHumanTurn && prevPlayerRef.current !== currentPlayer) {
      playSound('turn-start', 0.7);
    }
    prevPlayerRef.current = currentPlayer;

    // Turn number changed
    if (game.turn.turnNumber !== prevTurnRef.current && prevTurnRef.current > 0) {
      // New round
    }
    prevTurnRef.current = game.turn.turnNumber;

    // Combat started
    if (game.combat.active && !prevCombatRef.current) {
      playSound('combat-start');
    }
    prevCombatRef.current = game.combat.active;

    // Nuclear attack started
    if (game.nuclearAttack.active && !prevNukeRef.current) {
      playSound('missile-launch');
    }
    prevNukeRef.current = game.nuclearAttack.active;

    // Game over
    if (game.gameOver && !prevGameOverRef.current) {
      const humanPlayer = Object.values(game.players).find(p => p.isHuman);
      if (humanPlayer && game.winner === humanPlayer.id) {
        playSound('victory');
      } else {
        playSound('defeat');
      }
    }
    prevGameOverRef.current = game.gameOver;
  }, [game]);

  // Auto-run CPU turns
  useEffect(() => {
    if (!game || game.gameOver) return;
    const currentPlayer = game.players[game.turn.currentPlayer];
    if (!currentPlayer.isHuman && !currentPlayer.isEliminated) {
      const timer = setTimeout(() => {
        dispatch({ type: 'CPU_TURN' });
      }, 1200);
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
          {/* Audio controls - top right */}
          <AudioControls />
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
