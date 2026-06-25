// ============================================================
// SUPREMACIA DIGITAL — Multiplayer: tipos compartilhados
// ------------------------------------------------------------
// Espelham as tabelas Supabase (game_rooms / game_players /
// game_states / game_actions) descritas na skill, mas são
// AGNÓSTICOS de backend: o LocalMultiplayerAdapter (simulado) e
// o SupabaseMultiplayerAdapter implementam o mesmo contrato.
//
// Princípio: sincronizamos AÇÕES VÁLIDAS + SNAPSHOT do estado,
// nunca pixels nem estado visual. O estado oficial vive em
// game_states/game_actions; o jogo local atual (vs IA) não é
// tocado por este módulo.
// ============================================================

import type { GameAction, GameState, SuperpowerId } from '../types';

// ── Venda Simultânea: ações isentas do turn lock ────────────────────────────
// A fase de Venda Simultânea (Modo Digital Balanceado) é GLOBAL: acontece antes
// da vez do 1º jogador, mas todos os jogadores agem nela ao mesmo tempo. Logo,
// estas ações NÃO seguem o turn lock — cada humano declara a própria venda e as
// transições abrir/resolver/confirmar são idempotentes (qualquer membro dispara,
// o reducer ignora se já passou da fase). Quem pode declarar por quem é validado
// na camada de sessão (só a própria superpotência).
const TURN_EXEMPT_TYPES: ReadonlySet<GameAction['type']> = new Set<GameAction['type']>([
  'OPEN_SIMULTANEOUS_SELL',
  'SUBMIT_SELL_DECLARATION',
  'RESOLVE_SIMULTANEOUS_SELL',
  'ACK_SIMULTANEOUS_SELL',
]);

export function isTurnExemptAction(type: GameAction['type']): boolean {
  return TURN_EXEMPT_TYPES.has(type);
}

// ── game_rooms ──────────────────────────────────────────────
export type RoomStatus = 'lobby' | 'active' | 'paused' | 'finished';

export interface GameRoom {
  id: string;
  code: string;                  // código curto p/ convite (ex.: "K7QF2")
  status: RoomStatus;
  hostUserId: string;
  currentPlayerId: SuperpowerId | null; // de quem é a vez (turn lock)
  currentTurn: number;
  currentPhase: number;          // TurnStage (1..7)
  stateVersion: number;          // optimistic concurrency
  maxPlayers: number;
  createdAt: string;
  updatedAt: string;
}

// ── game_players (assentos da sala) ─────────────────────────
export type SeatType = 'human' | 'ai';
export type ConnectionStatus = 'online' | 'offline' | 'disconnected';

export interface GamePlayerSeat {
  id: string;
  roomId: string;
  userId: string | null;         // null p/ assento de IA
  name: string;
  color: string;
  type: SeatType;
  seatIndex: number;
  superpowerId: SuperpowerId | null; // superpotência atribuída no início
  isReady: boolean;
  connectionStatus: ConnectionStatus;
  aiDifficulty?: 'beginner' | 'intermediate' | 'advanced' | 'god';
}

// ── game_states (snapshot oficial versionado) ───────────────
export interface RoomStateSnapshot {
  roomId: string;
  version: number;
  state: GameState;
  lastActionId: string | null;
  updatedAt: string;
}

// ── game_actions (action log append-only) ───────────────────
export interface MultiplayerAction {
  id: string;
  roomId: string;
  playerId: SuperpowerId;        // assento/superpotência que agiu
  turn: number;
  phase: number;
  type: GameAction['type'];
  payload: GameAction;           // a ação de jogo completa (intenção)
  expectedVersion: number;       // versão que o cliente assumiu ao agir
  clientRequestId: string;       // idempotência (evita ação duplicada)
  createdAt: string;
}

// Resultado de submeter uma ação (optimistic concurrency).
export type SubmitActionResult =
  | { ok: true; snapshot: RoomStateSnapshot }
  // versão divergiu: o cliente deve recarregar o estado e reavaliar.
  | { ok: false; reason: 'version_conflict'; latest: RoomStateSnapshot }
  | { ok: false; reason: 'not_your_turn' | 'room_not_active' | 'invalid' | 'not_in_room'; message: string };

// Presence (estado EFÊMERO — nunca guarda estado de jogo).
export interface PresenceState {
  userId: string;
  seatIndex: number | null;
  name: string;
  status: ConnectionStatus;
  isReady: boolean;
}

// ── Contrato do adapter ─────────────────────────────────────
// Tudo que a UI/jogo precisa para multiplayer, independente de
// estarmos no adapter Local (simulado) ou no Supabase.
export interface RoomSubscription {
  unsubscribe(): void;
}

export interface MultiplayerAdapter {
  readonly kind: 'local' | 'supabase';

  // Garante sessão (Anonymous Auth no Supabase; no-op no Local) e retorna o
  // userId. Deve ser chamado antes de qualquer operação de sala.
  connect(): Promise<string>;

  // Identidade do jogador nesta sessão (convidado ou autenticado).
  // Só é confiável após connect().
  getUserId(): string;

  // ── Sala / lobby ──
  createRoom(opts: {
    hostName: string;
    maxPlayers: number;
    aiSeats: Array<{ difficulty: GamePlayerSeat['aiDifficulty'] }>;
  }): Promise<{ room: GameRoom; seat: GamePlayerSeat }>;

  joinRoom(code: string, name: string): Promise<{ room: GameRoom; seat: GamePlayerSeat }>;
  leaveRoom(roomId: string): Promise<void>;

  getRoom(roomId: string): Promise<GameRoom | null>;
  listPlayers(roomId: string): Promise<GamePlayerSeat[]>;
  setReady(roomId: string, ready: boolean): Promise<void>;

  // Host atribui as superpotências aos assentos antes de iniciar a partida.
  assignSeats(roomId: string, assignments: Array<{ seatId: string; superpowerId: SuperpowerId }>): Promise<void>;

  // Host inicia a partida: grava o estado inicial (version 1) e ativa a sala.
  startGame(roomId: string, initialState: GameState): Promise<RoomStateSnapshot>;

  // ── Estado / ações ──
  getLatestState(roomId: string): Promise<RoomStateSnapshot | null>;
  getActionsSince(roomId: string, afterVersion: number): Promise<MultiplayerAction[]>;

  // Submete a ação do jogador da vez. O adapter valida turno/versão e,
  // se ok, persiste a ação + o novo snapshot e incrementa a versão.
  // `computeNextState` aplica o reducer existente sobre o estado atual.
  submitAction(input: {
    roomId: string;
    playerId: SuperpowerId;
    action: GameAction;
    expectedVersion: number;
    clientRequestId: string;
    computeNextState: (current: GameState) => GameState;
  }): Promise<SubmitActionResult>;

  // ── Realtime ──
  onStateChange(roomId: string, cb: (snapshot: RoomStateSnapshot) => void): RoomSubscription;
  onAction(roomId: string, cb: (action: MultiplayerAction) => void): RoomSubscription;
  onPlayersChange(roomId: string, cb: (players: GamePlayerSeat[]) => void): RoomSubscription;

  // ── Presence ──
  trackPresence(roomId: string, presence: PresenceState): Promise<void>;
  onPresence(roomId: string, cb: (states: PresenceState[]) => void): RoomSubscription;
}
