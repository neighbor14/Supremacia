import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useGameStore, planAiTurn } from '../game/store';
import { playSound, SoundEffect } from '../game/audio';
import { useAudioInit } from '../hooks/useAudio';
import { usePresentationStore } from '../stores/presentationStore';
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
import AudioControls from '../ui/AudioControls';
import ResourceCardsPanel from '../ui/ResourceCardsPanel';
import NewsTicker from '../ui/NewsTicker';
import MarketDrawer from '../ui/MarketDrawer';
import DrawnCardModal from '../ui/DrawnCardModal';
import TurnPresentationPanel from '../ui/TurnPresentationPanel';

export default function GameScreen() {
  const [, setLocation] = useLocation();
  const { game, dispatch } = useGameStore();
  const presentation = usePresentationStore();
  useAudioInit();

  // Track previous state for sound triggers
  const prevPlayerRef = useRef<string>('');
  const prevCombatRef = useRef<boolean>(false);
  const prevNukeRef = useRef<boolean>(false);
  const prevGameOverRef = useRef<boolean>(false);
  const prevResearchedNukeRef = useRef<boolean>(false);
  const prevResearchedLaserRef = useRef<boolean>(false);
  const prevNukeCountRef = useRef<number>(0);
  const prevLaserCountRef = useRef<number>(0);

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
    const human = Object.values(game.players).find(p => p.isHuman);

    // Turn changed to human player
    if (isHumanTurn && prevPlayerRef.current !== currentPlayer) {
      playSound('turn-start', 0.7);
    }
    prevPlayerRef.current = currentPlayer;

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

    if (human) {
      if (human.hasResearchedNuke && !prevResearchedNukeRef.current) {
        playSound('missile-launch', 0.65);
      }
      prevResearchedNukeRef.current = human.hasResearchedNuke;

      if (human.hasResearchedLaserStar && !prevResearchedLaserRef.current) {
        playSound('diplomacy-alert', 0.9);
      }
      prevResearchedLaserRef.current = human.hasResearchedLaserStar;

      if (human.nukes > prevNukeCountRef.current) {
        playSound('explosion', 0.45);
      }
      prevNukeCountRef.current = human.nukes;

      if (human.laserStars > prevLaserCountRef.current) {
        playSound('territory-conquered', 0.65);
      }
      prevLaserCountRef.current = human.laserStars;
    }

    if (game.gameOver && !prevGameOverRef.current) {
      if (human && game.winner === human.id) {
        playSound('victory');
      } else {
        playSound('defeat');
      }
    }
    prevGameOverRef.current = !!game.gameOver;
  }, [game]);

  // ── AI Turn: start presentation when it's an AI player's turn ──────────────
  useEffect(() => {
    if (!game || game.gameOver) return;
    const currentPlayer = game.players[game.turn.currentPlayer];
    if (currentPlayer.isHuman || currentPlayer.isEliminated) return;
    if (presentation.isPresenting) return; // already presenting (or skip in progress)

    const timer = setTimeout(() => {
      const steps = planAiTurn(game);
      if (steps.length > 0) {
        presentation.startPresentation(steps);
      } else {
        // Fallback: no steps generated, run turn directly
        dispatch({ type: 'CPU_TURN' });
      }
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.turn.currentPlayer, game?.turn.turnNumber, game?.gameOver]);

  // ── Presentation: play sound when a new event appears ───────────────────────
  useEffect(() => {
    if (!presentation.isPresenting) return;
    const currentStep = presentation.steps[presentation.currentIndex];
    if (!currentStep) return;
    const soundKey = currentStep.event.soundKey;
    if (soundKey) {
      playSound(soundKey as SoundEffect, 0.8);
    }
  }, [presentation.currentIndex, presentation.isPresenting]);

  // ── Presentation: apply each step after its delay ───────────────────────────
  useEffect(() => {
    if (!presentation.isPresenting || presentation.isPaused) return;
    // Wait for any modal (e.g. drawn card from research) to be dismissed first
    if (game?.drawnCard?.active) return;

    const currentStep = presentation.steps[presentation.currentIndex];
    if (!currentStep) {
      presentation.clear();
      return;
    }

    const delay = presentation.skipRequested
      ? 0
      : presentation.speed === 'fast' ? 1500 : (currentStep.event.durationMs ?? 3000);

    const timer = setTimeout(() => {
      dispatch({ type: 'APPLY_AI_STEP', state: currentStep.stateAfter });
      presentation.advance();
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    presentation.currentIndex,
    presentation.isPresenting,
    presentation.isPaused,
    presentation.speed,
    presentation.skipRequested,
    game?.drawnCard?.active,
  ]);

  if (!game) return null;

  return (
    <>
      {/* Landscape prompt for mobile portrait */}
      <LandscapePrompt />

      {/* Full-screen game layout — height uses --app-height (set by useIosChromeCollapse)
          which tracks window.visualViewport.height so the container never exceeds
          the visible area on iOS Safari landscape (where the chrome doesn't auto-collapse). */}
      <div className="fixed inset-x-0 top-0 overflow-hidden flex flex-col bg-background"
        style={{ height: 'var(--app-height, 100dvh)' }}>
        {/* Top: Turn Phase Bar - compact, always visible */}
        <TurnPhaseBar />

        {/* Main area: Map fills ALL remaining space */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          <WorldMap />

          {/* Overlays on top of map */}
          <AudioControls />
          <ResourceCardsPanel />
          <TurnTutorial />
          <EventLogDrawer />
          <PlayerStatusBar />
          <MarketDrawer />
          <NewsTicker />

          {/* AI turn presentation panel — replaces CpuTurnOverlay */}
          <TurnPresentationPanel />
        </div>

        {/* Bottom Sheet for territory/action details - only shows when needed */}
        <BottomSheet />

        {/* Modals */}
        {game.drawnCard?.active && <DrawnCardModal />}
        {game.combat.active && <CombatModal />}
        {game.nuclearAttack.active && <NuclearModal />}
        {game.gameOver && <GameOverModal />}
      </div>
    </>
  );
}
