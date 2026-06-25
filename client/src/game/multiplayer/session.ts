// ============================================================
// SUPREMACIA DIGITAL — Multiplayer: store de sessão (orquestração)
// ------------------------------------------------------------
// Liga a UI (lobby + jogo) ao MultiplayerAdapter. Responsável por:
//  - criar/entrar/lobby/ready/iniciar partida
//  - rotear ações do humano para o servidor (turn lock + versão)
//  - aplicar snapshots autoritativos no useGameStore (loadGame)
//  - dirigir a IA (apenas o host)
//  - presence + reconexão
//
// NUNCA sincroniza UI: só ações válidas + snapshot versionado.
// O modo local/IA (sem sala) ignora este store por completo.
// ============================================================

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { getMultiplayerAdapter } from './index';
import { isTurnExemptAction } from './types';
import type {
  GamePlayerSeat, GameRoom, MultiplayerAction, MultiplayerAdapter,
  PresenceState, RoomSubscription,
} from './types';
import type { AIDifficulty, GameAction, GameState, MarketMode, SuperpowerId } from '../types';
import { applyGameAction, useGameStore } from '../store';
import { createMultiplayerGameState } from '../setup';
import { SUPERPOWER_IDS } from '../../data/initialPlayers';
import { shuffleArray } from '../rng';

export type MpStatus = 'idle' | 'connecting' | 'lobby' | 'active' | 'error';

interface MpSession {
  online: boolean;
  status: MpStatus;
  error: string | null;
  room: GameRoom | null;
  mySeat: GamePlayerSeat | null;
  players: GamePlayerSeat[];
  presence: PresenceState[];
  recentActions: MultiplayerAction[];
  version: number;
  mySuperpower: SuperpowerId | null;
  isHost: boolean;
  kind: 'local' | 'supabase' | null;

  // internos
  _adapter: MultiplayerAdapter | null;
  _subs: RoomSubscription[];

  createRoom(opts: {
    hostName: string;
    humanSlots: number;
    aiSeats: Array<{ difficulty: AIDifficulty }>;
  }): Promise<void>;
  joinRoom(code: string, name: string): Promise<void>;
  setReady(ready: boolean): Promise<void>;
  startMatch(marketMode: MarketMode): Promise<void>;
  submit(action: GameAction): Promise<void>;
  submitAiStep(stateAfter: GameState, aiPlayerId: SuperpowerId): Promise<boolean>;
  leave(): Promise<void>;
}

function inviteFromRoom(room: GameRoom): string {
  return `${window.location.origin}/lobby?code=${room.code}`;
}

export const useMultiplayerStore = create<MpSession>((set, get) => ({
  online: false,
  status: 'idle',
  error: null,
  room: null,
  mySeat: null,
  players: [],
  presence: [],
  recentActions: [],
  version: 0,
  mySuperpower: null,
  isHost: false,
  kind: null,
  _adapter: null,
  _subs: [],

  async createRoom(opts) {
    try {
      set({ status: 'connecting', error: null });
      const adapter = getMultiplayerAdapter();
      await adapter.connect();
      const maxPlayers = opts.humanSlots + opts.aiSeats.length;
      const { room, seat } = await adapter.createRoom({
        hostName: opts.hostName, maxPlayers, aiSeats: opts.aiSeats,
      });
      set({
        _adapter: adapter, kind: adapter.kind, room, mySeat: seat, isHost: true,
        status: 'lobby', version: 0,
      });
      localStorage.setItem('supremacia_mp_active', room.code);
      subscribeRoom(set, get, adapter, room.id);
      const players = await adapter.listPlayers(room.id);
      set({ players });
      await adapter.trackPresence(room.id, presenceOf(seat));
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
      toast.error(`Falha ao criar sala: ${(e as Error).message}`);
    }
  },

  async joinRoom(code, name) {
    try {
      set({ status: 'connecting', error: null });
      const adapter = getMultiplayerAdapter();
      await adapter.connect();
      const { room, seat } = await adapter.joinRoom(code, name);
      set({
        _adapter: adapter, kind: adapter.kind, room, mySeat: seat,
        isHost: room.hostUserId === adapter.getUserId(),
        status: room.status === 'active' ? 'active' : 'lobby',
      });
      localStorage.setItem('supremacia_mp_active', room.code);
      subscribeRoom(set, get, adapter, room.id);
      const players = await adapter.listPlayers(room.id);
      const mySeat = players.find(s => s.id === seat.id) ?? seat;
      set({ players, mySeat, mySuperpower: mySeat.superpowerId });
      await adapter.trackPresence(room.id, presenceOf(seat));

      // Reconexão / entrada em partida já iniciada: carrega o estado atual.
      if (room.status === 'active') {
        const snap = await adapter.getLatestState(room.id);
        if (snap) { set({ version: snap.version }); goOnline(get); useGameStore.getState().loadGame(snap.state); }
      }
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
      toast.error(`Falha ao entrar: ${(e as Error).message}`);
    }
  },

  async setReady(ready) {
    const { _adapter, room, mySeat } = get();
    if (!_adapter || !room || !mySeat) return;
    await _adapter.setReady(room.id, ready);
    set({ mySeat: { ...mySeat, isReady: ready } });
  },

  async startMatch(marketMode) {
    const { _adapter, room, players, isHost } = get();
    if (!_adapter || !room || !isHost) return;
    try {
      // Atribui superpotências aos assentos (ordem aleatória, fiel ao setup local).
      const ids = shuffleArray([...SUPERPOWER_IDS]).slice(0, players.length);
      const assignments = players.map((s, i) => ({ seatId: s.id, superpowerId: ids[i] }));
      await _adapter.assignSeats(room.id, assignments);
      const assigned = players.map((s, i) => ({ ...s, superpowerId: ids[i] }));

      const humans = assigned.filter(s => s.type === 'human').map(s => s.superpowerId!) as SuperpowerId[];
      const ai = assigned.filter(s => s.type === 'ai')
        .map(s => ({ id: s.superpowerId as SuperpowerId, difficulty: (s.aiDifficulty ?? 'intermediate') as AIDifficulty }));

      const state = createMultiplayerGameState({ humans, ai, marketMode });
      const snap = await _adapter.startGame(room.id, state);
      const mySeat = assigned.find(s => s.id === get().mySeat?.id) ?? null;
      set({
        players: assigned, mySeat, mySuperpower: mySeat?.superpowerId ?? null,
        version: snap.version, status: 'active',
      });
      goOnline(get);
      useGameStore.getState().loadGame(snap.state);
    } catch (e) {
      toast.error(`Falha ao iniciar: ${(e as Error).message}`);
    }
  },

  async submit(action) {
    const { _adapter, room, mySuperpower } = get();
    if (!_adapter || !room || !mySuperpower) return;
    const game = useGameStore.getState().game;
    if (!game) return;

    // Venda Simultânea (Modo Digital Balanceado): fase global, isenta do turn
    // lock. Cada humano só declara a PRÓPRIA venda; abrir/resolver/confirmar são
    // idempotentes (qualquer membro dispara). Como vários humanos podem agir ao
    // mesmo tempo, há retry curto em conflito de versão.
    const sellAction = isTurnExemptAction(action.type);
    if (action.type === 'SUBMIT_SELL_DECLARATION' && action.playerId !== mySuperpower) {
      return; // não declaro a venda de outro jogador
    }
    if (!sellAction && game.turn.currentPlayer !== mySuperpower) {
      toast.message('Não é a sua vez.');
      return;
    }

    const attempts = sellAction ? 4 : 1;
    for (let i = 0; i < attempts; i++) {
      const res = await _adapter.submitAction({
        roomId: room.id, playerId: mySuperpower, action,
        expectedVersion: get().version, clientRequestId: nanoid(),
        computeNextState: (cur) => applyGameAction(cur, action),
      });
      if (res.ok) {
        set({ version: res.snapshot.version });
        useGameStore.getState().loadGame(res.snapshot.state);
        return;
      }
      if (res.reason === 'version_conflict') {
        set({ version: res.latest.version });
        useGameStore.getState().loadGame(res.latest.state);
        // Outra declaração chegou primeiro: reaplica sobre o estado novo e tenta
        // de novo (a fase ainda está aberta). Esgotou as tentativas → avisa.
        if (sellAction && i < attempts - 1) {
          await new Promise(r => setTimeout(r, 60));
          continue;
        }
        if (!sellAction) toast.message('Estado atualizado — tente novamente.');
        return;
      }
      toast.message(res.message);
      return;
    }
  },

  async submitAiStep(stateAfter, aiPlayerId) {
    const { _adapter, room, version } = get();
    if (!_adapter || !room) return false;
    const res = await _adapter.submitAction({
      roomId: room.id, playerId: aiPlayerId,
      action: { type: 'APPLY_AI_STEP', state: stateAfter },
      expectedVersion: version, clientRequestId: nanoid(),
      computeNextState: () => stateAfter,
    });
    if (res.ok) {
      set({ version: res.snapshot.version });
      useGameStore.getState().loadGame(res.snapshot.state);
      return true;
    }
    if (res.reason === 'version_conflict') {
      set({ version: res.latest.version });
      useGameStore.getState().loadGame(res.latest.state);
    }
    return false;
  },

  async leave() {
    const { _adapter, room, _subs } = get();
    _subs.forEach(s => s.unsubscribe());
    if (_adapter && room) { try { await _adapter.leaveRoom(room.id); } catch { /* ignore */ } }
    localStorage.removeItem('supremacia_mp_active');
    useGameStore.getState().setOnlineSubmit(null);
    set({
      online: false, status: 'idle', error: null, room: null, mySeat: null,
      players: [], presence: [], recentActions: [], version: 0, mySuperpower: null,
      isHost: false, _subs: [],
    });
  },
}));

// ── helpers ─────────────────────────────────────────────────
function presenceOf(seat: GamePlayerSeat): PresenceState {
  return {
    userId: seat.userId ?? `ai_${seat.id}`, seatIndex: seat.seatIndex,
    name: seat.name, status: 'online', isReady: seat.isReady,
  };
}

// Ativa o roteamento de ações do humano para o servidor (idempotente).
function goOnline(get: () => MpSession) {
  if (get().online) return;
  useGameStore.getState().setOnlineSubmit((action) => { void useMultiplayerStore.getState().submit(action); });
  useMultiplayerStore.setState({ online: true });
}

function subscribeRoom(
  set: (partial: Partial<MpSession>) => void,
  get: () => MpSession,
  adapter: MultiplayerAdapter,
  roomId: string,
) {
  // limpa assinaturas anteriores
  get()._subs.forEach(s => s.unsubscribe());

  const subs: RoomSubscription[] = [
    adapter.onStateChange(roomId, (snap) => {
      if (snap.version < get().version) return; // ignora snapshots antigos
      set({ version: snap.version, status: 'active' });
      goOnline(get);
      useGameStore.getState().loadGame(snap.state);
    }),
    adapter.onAction(roomId, (a) => {
      const list = [...get().recentActions, a].slice(-30);
      set({ recentActions: list });
    }),
    adapter.onPlayersChange(roomId, (players) => {
      const uid = adapter.getUserId();
      const mySeat = players.find(s => s.userId === uid) ?? get().mySeat;
      set({ players, mySeat, mySuperpower: mySeat?.superpowerId ?? get().mySuperpower });
    }),
    adapter.onPresence(roomId, (states) => set({ presence: states })),
  ];
  set({ _subs: subs });
}

export { inviteFromRoom };
