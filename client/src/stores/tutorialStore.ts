// ──────────────────────────────────────────────────────────────────────────
// Estado do tutorial progressivo (zustand, mesmo padrão de presentationStore).
//
// Persistência local (não some no refresh):
//   - nível do tutorial   → localStorage('supremacia_tutorial_level')
//   - fases já vistas      → localStorage('supremacia_tutorial_seen')
//
// O tutorial é camada de apresentação: não toca em regra, turno ou economia.
// "Visto" é por chave de tópico (ex.: 'intro', 'phase.1'…'phase.7', 'topic.seas').
// ──────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';

export type TutorialLevel = 'full' | 'tips' | 'off';

const LEVEL_KEY = 'supremacia_tutorial_level';
const SEEN_KEY = 'supremacia_tutorial_seen';

/** Default para jogador novo (sem preferência salva): tutorial completo. */
const DEFAULT_LEVEL: TutorialLevel = 'full';

/** Quantas rodadas iniciais disparam cards automáticos. Constante de UI — NÃO
 *  é regra de jogo, então fica aqui e não em rulesConfig.ts. */
export const TUTORIAL_AUTO_ROUNDS = 3;

function loadLevel(): TutorialLevel {
  try {
    const v = localStorage.getItem(LEVEL_KEY);
    if (v === 'full' || v === 'tips' || v === 'off') return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_LEVEL;
}

function loadSeen(): Record<string, boolean> {
  try {
    const v = localStorage.getItem(SEEN_KEY);
    if (v) return JSON.parse(v) as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  return {};
}

function persistSeen(seen: Record<string, boolean>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}

interface TutorialStore {
  level: TutorialLevel;
  seen: Record<string, boolean>;
  /** Tópico do card aberto agora (null = nenhum). */
  activeKey: string | null;

  setLevel: (level: TutorialLevel) => void;
  /** Abre o card de um tópico (respeita o nível; 'off' não abre). */
  show: (key: string) => void;
  /** Fecha o card atual sem marcar como visto (pode reaparecer). */
  dismiss: () => void;
  /** Marca o tópico como visto e fecha o card (não reaparece sozinho). */
  markSeen: (key: string) => void;
  /** Limpa o histórico de vistos (reativar o tutorial do começo). */
  resetSeen: () => void;
}

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  level: loadLevel(),
  seen: loadSeen(),
  activeKey: null,

  setLevel: level => {
    try {
      localStorage.setItem(LEVEL_KEY, level);
    } catch {
      /* ignore */
    }
    // Desligar fecha qualquer card aberto.
    set({ level, activeKey: level === 'off' ? null : get().activeKey });
  },

  show: key => {
    if (get().level === 'off') return;
    set({ activeKey: key });
  },

  dismiss: () => set({ activeKey: null }),

  markSeen: key => {
    const seen = { ...get().seen, [key]: true };
    persistSeen(seen);
    set({ seen, activeKey: null });
  },

  resetSeen: () => {
    persistSeen({});
    set({ seen: {} });
  },
}));
