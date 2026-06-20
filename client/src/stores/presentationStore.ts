import { create } from 'zustand';
import { PlannedStep, PlayerActionEvent } from '../game/types';

export type PresentationSpeed = 'normal' | 'fast';

interface PresentationStore {
  steps: PlannedStep[];
  currentIndex: number;
  isPresenting: boolean;
  isPaused: boolean;
  speed: PresentationSpeed;
  skipRequested: boolean;
  completedEvents: PlayerActionEvent[];

  startPresentation: (steps: PlannedStep[]) => void;
  advance: () => void;
  pause: () => void;
  resume: () => void;
  setSpeed: (speed: PresentationSpeed) => void;
  skip: () => void;
  clear: () => void;
  currentEvent: () => PlayerActionEvent | null;
}

export const usePresentationStore = create<PresentationStore>((set, get) => ({
  steps: [],
  currentIndex: 0,
  isPresenting: false,
  isPaused: false,
  speed: 'normal',
  skipRequested: false,
  completedEvents: [],

  startPresentation: (steps) => {
    if (steps.length === 0) return;
    set({
      steps,
      currentIndex: 0,
      isPresenting: true,
      isPaused: false,
      skipRequested: false,
      completedEvents: [],
    });
  },

  advance: () => {
    const { steps, currentIndex, completedEvents } = get();
    const done = steps[currentIndex];
    const nextIndex = currentIndex + 1;
    if (nextIndex >= steps.length) {
      set({
        steps: [],
        currentIndex: 0,
        isPresenting: false,
        isPaused: false,
        skipRequested: false,
        completedEvents: done ? [...completedEvents, done.event] : completedEvents,
      });
    } else {
      set({
        currentIndex: nextIndex,
        skipRequested: false,
        completedEvents: done ? [...completedEvents, done.event] : completedEvents,
      });
    }
  },

  pause: () => set({ isPaused: true }),
  resume: () => set({ isPaused: false }),
  setSpeed: (speed) => set({ speed }),

  skip: () => {
    const { steps } = get();
    if (steps.length === 0) return;
    set({ currentIndex: steps.length - 1, skipRequested: true, isPaused: false });
  },

  clear: () => set({
    steps: [],
    currentIndex: 0,
    isPresenting: false,
    isPaused: false,
    skipRequested: false,
    completedEvents: [],
  }),

  currentEvent: () => {
    const { steps, currentIndex, isPresenting } = get();
    if (!isPresenting || currentIndex >= steps.length) return null;
    return steps[currentIndex]?.event ?? null;
  },
}));
