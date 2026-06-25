// ============================================================
// SUPREMACIA DIGITAL — Multiplayer: adapter LOCAL (simulado)
// ------------------------------------------------------------
// Implementa o contrato MultiplayerAdapter SEM backend, usando
// localStorage (persistência) + BroadcastChannel (realtime entre
// abas). Serve para:
//   1. desenvolver/testar o fluxo multiplayer sem Supabase;
//   2. abrir 2 abas/dois navegadores no mesmo dispositivo e
//      validar turno/versão/log/reconexão.
//
// O contrato é IDÊNTICO ao SupabaseMultiplayerAdapter, então a
// UI e o jogo não sabem qual está em uso. Mesma validação de
// turno e optimistic concurrency (expected_version) do servidor.
// ============================================================

import { nanoid } from 'nanoid';
import type { GameAction, GameState, SuperpowerId } from '../types';
import type {
  GamePlayerSeat,
  GameRoom,
  MultiplayerAction,
  MultiplayerAdapter,
  PresenceState,
  RoomStateSnapshot,
  RoomSubscription,
  SubmitActionResult,
} from './types';

const LS_PREFIX = 'supremacia_mp_';
const roomKey = (id: string) => `${LS_PREFIX}room_${id}`;
const playersKey = (id: string) => `${LS_PREFIX}players_${id}`;
const stateKey = (id: string) => `${LS_PREFIX}state_${id}`;
const actionsKey = (id: string) => `${LS_PREFIX}actions_${id}`;
const codeIndexKey = (code: string) => `${LS_PREFIX}code_${code.toUpperCase()}`;
const userIdKey = `${LS_PREFIX}userId`;

type ChannelMsg =
  | { kind: 'state'; snapshot: RoomStateSnapshot }
  | { kind: 'action'; action: MultiplayerAction }
  | { kind: 'players'; players: GamePlayerSeat[] }
  | { kind: 'presence'; states: PresenceState[] };

function readJSON<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}
function genCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I/O/0/1
  let s = '';
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
function nowIso(): string {
  // Date.now indireto via performance origin não é necessário aqui (runtime do browser).
  return new Date().toISOString();
}

const SEAT_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

export class LocalMultiplayerAdapter implements MultiplayerAdapter {
  readonly kind = 'local' as const;
  private channels = new Map<string, BroadcastChannel>();
  private presenceByRoom = new Map<string, Map<string, PresenceState>>();

  async connect(): Promise<string> {
    return this.getUserId();
  }

  getUserId(): string {
    let id = localStorage.getItem(userIdKey);
    if (!id) { id = `guest_${nanoid(8)}`; localStorage.setItem(userIdKey, id); }
    return id;
  }

  private channel(roomId: string): BroadcastChannel {
    let ch = this.channels.get(roomId);
    if (!ch) { ch = new BroadcastChannel(`${LS_PREFIX}${roomId}`); this.channels.set(roomId, ch); }
    return ch;
  }
  private broadcast(roomId: string, msg: ChannelMsg) {
    this.channel(roomId).postMessage(msg);
  }

  // ── Sala / lobby ──────────────────────────────────────────
  async createRoom(opts: {
    hostName: string;
    maxPlayers: number;
    aiSeats: Array<{ difficulty: GamePlayerSeat['aiDifficulty'] }>;
  }): Promise<{ room: GameRoom; seat: GamePlayerSeat }> {
    const id = nanoid(10);
    let code = genCode();
    while (localStorage.getItem(codeIndexKey(code))) code = genCode();

    const room: GameRoom = {
      id, code, status: 'lobby', hostUserId: this.getUserId(),
      currentPlayerId: null, currentTurn: 0, currentPhase: 1,
      stateVersion: 0, maxPlayers: opts.maxPlayers,
      createdAt: nowIso(), updatedAt: nowIso(),
    };

    const hostSeat: GamePlayerSeat = {
      id: nanoid(8), roomId: id, userId: this.getUserId(), name: opts.hostName,
      color: SEAT_COLORS[0], type: 'human', seatIndex: 0, superpowerId: null,
      isReady: false, connectionStatus: 'online',
    };
    const seats: GamePlayerSeat[] = [hostSeat];
    opts.aiSeats.forEach((ai, i) => {
      seats.push({
        id: nanoid(8), roomId: id, userId: null, name: `IA ${i + 1}`,
        color: SEAT_COLORS[(i + 1) % SEAT_COLORS.length], type: 'ai',
        seatIndex: i + 1, superpowerId: null, isReady: true,
        connectionStatus: 'online', aiDifficulty: ai.difficulty,
      });
    });

    writeJSON(roomKey(id), room);
    writeJSON(playersKey(id), seats);
    localStorage.setItem(codeIndexKey(code), id);
    return { room, seat: hostSeat };
  }

  async joinRoom(code: string, name: string): Promise<{ room: GameRoom; seat: GamePlayerSeat }> {
    const id = localStorage.getItem(codeIndexKey(code));
    if (!id) throw new Error('Sala não encontrada');
    const room = readJSON<GameRoom>(roomKey(id));
    if (!room) throw new Error('Sala não encontrada');
    const seats = readJSON<GamePlayerSeat[]>(playersKey(id)) ?? [];

    // Reconexão: se este userId já tem assento, retorna o existente.
    const existing = seats.find(s => s.userId === this.getUserId());
    if (existing) {
      existing.connectionStatus = 'online';
      writeJSON(playersKey(id), seats);
      this.broadcast(id, { kind: 'players', players: seats });
      return { room, seat: existing };
    }

    if (seats.length >= room.maxPlayers) throw new Error('Sala cheia');
    const usedIdx = new Set(seats.map(s => s.seatIndex));
    let seatIndex = 0; while (usedIdx.has(seatIndex)) seatIndex++;
    const seat: GamePlayerSeat = {
      id: nanoid(8), roomId: id, userId: this.getUserId(), name,
      color: SEAT_COLORS[seatIndex % SEAT_COLORS.length], type: 'human',
      seatIndex, superpowerId: null, isReady: false, connectionStatus: 'online',
    };
    seats.push(seat);
    seats.sort((a, b) => a.seatIndex - b.seatIndex);
    writeJSON(playersKey(id), seats);
    this.broadcast(id, { kind: 'players', players: seats });
    return { room, seat };
  }

  async leaveRoom(roomId: string): Promise<void> {
    const seats = readJSON<GamePlayerSeat[]>(playersKey(roomId)) ?? [];
    const next = seats.filter(s => s.userId !== this.getUserId());
    writeJSON(playersKey(roomId), next);
    this.broadcast(roomId, { kind: 'players', players: next });
  }

  async getRoom(roomId: string): Promise<GameRoom | null> {
    return readJSON<GameRoom>(roomKey(roomId));
  }
  async listPlayers(roomId: string): Promise<GamePlayerSeat[]> {
    return readJSON<GamePlayerSeat[]>(playersKey(roomId)) ?? [];
  }

  async assignSeats(roomId: string, assignments: Array<{ seatId: string; superpowerId: SuperpowerId }>): Promise<void> {
    const seats = readJSON<GamePlayerSeat[]>(playersKey(roomId)) ?? [];
    for (const a of assignments) {
      const s = seats.find(x => x.id === a.seatId);
      if (s) s.superpowerId = a.superpowerId;
    }
    writeJSON(playersKey(roomId), seats);
    this.broadcast(roomId, { kind: 'players', players: seats });
  }

  async setReady(roomId: string, ready: boolean): Promise<void> {
    const seats = readJSON<GamePlayerSeat[]>(playersKey(roomId)) ?? [];
    const me = seats.find(s => s.userId === this.getUserId());
    if (me) { me.isReady = ready; writeJSON(playersKey(roomId), seats); this.broadcast(roomId, { kind: 'players', players: seats }); }
  }

  async startGame(roomId: string, initialState: GameState): Promise<RoomStateSnapshot> {
    const room = readJSON<GameRoom>(roomKey(roomId));
    if (!room) throw new Error('Sala não encontrada');
    const snapshot: RoomStateSnapshot = {
      roomId, version: 1, state: initialState, lastActionId: null, updatedAt: nowIso(),
    };
    writeJSON(stateKey(roomId), snapshot);
    writeJSON(actionsKey(roomId), []);
    room.status = 'active';
    room.stateVersion = 1;
    room.currentTurn = initialState.turn.turnNumber;
    room.currentPhase = initialState.turn.stage;
    room.currentPlayerId = initialState.turn.currentPlayer;
    room.updatedAt = nowIso();
    writeJSON(roomKey(roomId), room);
    this.broadcast(roomId, { kind: 'state', snapshot });
    return snapshot;
  }

  // ── Estado / ações ────────────────────────────────────────
  async getLatestState(roomId: string): Promise<RoomStateSnapshot | null> {
    return readJSON<RoomStateSnapshot>(stateKey(roomId));
  }
  async getActionsSince(roomId: string, afterVersion: number): Promise<MultiplayerAction[]> {
    const all = readJSON<MultiplayerAction[]>(actionsKey(roomId)) ?? [];
    return all.filter(a => a.expectedVersion >= afterVersion);
  }

  async submitAction(input: {
    roomId: string;
    playerId: SuperpowerId;
    action: GameAction;
    expectedVersion: number;
    clientRequestId: string;
    computeNextState: (current: GameState) => GameState;
  }): Promise<SubmitActionResult> {
    const room = readJSON<GameRoom>(roomKey(input.roomId));
    const snapshot = readJSON<RoomStateSnapshot>(stateKey(input.roomId));
    if (!room || !snapshot) return { ok: false, reason: 'invalid', message: 'Sala/estado inexistente' };
    if (room.status !== 'active') return { ok: false, reason: 'room_not_active', message: 'Partida não está ativa' };

    // Idempotência: se já processamos este clientRequestId, devolve o snapshot atual.
    const actions = readJSON<MultiplayerAction[]>(actionsKey(input.roomId)) ?? [];
    if (actions.some(a => a.clientRequestId === input.clientRequestId)) {
      return { ok: true, snapshot };
    }

    // Optimistic concurrency: a versão precisa bater.
    if (input.expectedVersion !== snapshot.version) {
      return { ok: false, reason: 'version_conflict', latest: snapshot };
    }
    // Turn lock: só o jogador da vez age.
    if (snapshot.state.turn.currentPlayer !== input.playerId) {
      return { ok: false, reason: 'not_your_turn', message: 'Não é a sua vez' };
    }

    // Aplica o reducer existente sobre o estado oficial.
    const nextState = input.computeNextState(snapshot.state);

    const mpAction: MultiplayerAction = {
      id: nanoid(10), roomId: input.roomId, playerId: input.playerId,
      turn: snapshot.state.turn.turnNumber, phase: snapshot.state.turn.stage,
      type: input.action.type, payload: input.action,
      expectedVersion: input.expectedVersion, clientRequestId: input.clientRequestId,
      createdAt: nowIso(),
    };
    const newSnapshot: RoomStateSnapshot = {
      roomId: input.roomId, version: snapshot.version + 1, state: nextState,
      lastActionId: mpAction.id, updatedAt: nowIso(),
    };

    actions.push(mpAction);
    writeJSON(actionsKey(input.roomId), actions);
    writeJSON(stateKey(input.roomId), newSnapshot);
    room.stateVersion = newSnapshot.version;
    room.currentTurn = nextState.turn.turnNumber;
    room.currentPhase = nextState.turn.stage;
    room.currentPlayerId = nextState.turn.currentPlayer;
    if (nextState.gameOver) room.status = 'finished';
    room.updatedAt = nowIso();
    writeJSON(roomKey(input.roomId), room);

    this.broadcast(input.roomId, { kind: 'action', action: mpAction });
    this.broadcast(input.roomId, { kind: 'state', snapshot: newSnapshot });
    return { ok: true, snapshot: newSnapshot };
  }

  // ── Realtime (BroadcastChannel entre abas) ────────────────
  private listen(roomId: string, kind: ChannelMsg['kind'], handler: (m: ChannelMsg) => void): RoomSubscription {
    const ch = this.channel(roomId);
    const fn = (ev: MessageEvent<ChannelMsg>) => { if (ev.data?.kind === kind) handler(ev.data); };
    ch.addEventListener('message', fn);
    return { unsubscribe: () => ch.removeEventListener('message', fn) };
  }

  onStateChange(roomId: string, cb: (s: RoomStateSnapshot) => void): RoomSubscription {
    return this.listen(roomId, 'state', m => m.kind === 'state' && cb(m.snapshot));
  }
  onAction(roomId: string, cb: (a: MultiplayerAction) => void): RoomSubscription {
    return this.listen(roomId, 'action', m => m.kind === 'action' && cb(m.action));
  }
  onPlayersChange(roomId: string, cb: (p: GamePlayerSeat[]) => void): RoomSubscription {
    return this.listen(roomId, 'players', m => m.kind === 'players' && cb(m.players));
  }

  // ── Presence (efêmero) ────────────────────────────────────
  async trackPresence(roomId: string, presence: PresenceState): Promise<void> {
    let map = this.presenceByRoom.get(roomId);
    if (!map) { map = new Map(); this.presenceByRoom.set(roomId, map); }
    map.set(presence.userId, presence);
    this.broadcast(roomId, { kind: 'presence', states: Array.from(map.values()) });
  }
  onPresence(roomId: string, cb: (states: PresenceState[]) => void): RoomSubscription {
    return this.listen(roomId, 'presence', m => m.kind === 'presence' && cb(m.states));
  }
}
