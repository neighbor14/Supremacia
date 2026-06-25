// ============================================================
// SUPREMACIA DIGITAL — Multiplayer: adapter SUPABASE
// ------------------------------------------------------------
// Implementa o contrato MultiplayerAdapter sobre Postgres +
// Realtime + Anonymous Auth. Mesmo comportamento do
// LocalMultiplayerAdapter (turno + optimistic concurrency),
// mas com estado oficial no banco e RLS por membro da sala.
//
// MVP: o cliente valida a regra (reducer existente) e grava o
// snapshot. A concorrência é protegida por unique(room_id,version).
// Fase 2 (anti-cheat real): mover o submit para uma Edge Function
// service_role que roda o reducer no servidor — o contrato aqui
// já isola esse ponto (submitAction).
// ============================================================

import { nanoid } from 'nanoid';
import type { GameAction, GameState, SuperpowerId } from '../types';
import { ensureAnonAuth, getSupabase } from './supabaseClient';
import { isTurnExemptAction } from './types';
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

const SEAT_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

function genCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRoom(r: any): GameRoom {
  return {
    id: r.id, code: r.code, status: r.status, hostUserId: r.host_user_id,
    currentPlayerId: r.current_player_id, currentTurn: r.current_turn,
    currentPhase: r.current_phase, stateVersion: r.state_version,
    maxPlayers: r.max_players, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapSeat(p: any): GamePlayerSeat {
  return {
    id: p.id, roomId: p.room_id, userId: p.user_id, name: p.name, color: p.color,
    type: p.type, seatIndex: p.seat_index, superpowerId: p.superpower_id,
    isReady: p.is_ready, connectionStatus: p.connection_status, aiDifficulty: p.ai_difficulty,
  };
}
function mapState(s: any): RoomStateSnapshot {
  return {
    roomId: s.room_id, version: s.version, state: s.state_json as GameState,
    lastActionId: s.last_action_id, updatedAt: s.updated_at,
  };
}
function mapAction(a: any): MultiplayerAction {
  return {
    id: a.id, roomId: a.room_id, playerId: a.player_id, turn: a.turn, phase: a.phase,
    type: a.type, payload: a.payload as GameAction, expectedVersion: a.expected_version,
    clientRequestId: a.client_request_id, createdAt: a.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export class SupabaseMultiplayerAdapter implements MultiplayerAdapter {
  readonly kind = 'supabase' as const;
  private userId = '';
  private sb = getSupabase();

  async connect(): Promise<string> {
    this.userId = await ensureAnonAuth();
    return this.userId;
  }
  getUserId(): string {
    if (!this.userId) throw new Error('connect() não foi chamado');
    return this.userId;
  }

  // ── Sala / lobby ──────────────────────────────────────────
  async createRoom(opts: {
    hostName: string;
    maxPlayers: number;
    aiSeats: Array<{ difficulty: GamePlayerSeat['aiDifficulty'] }>;
  }): Promise<{ room: GameRoom; seat: GamePlayerSeat }> {
    await this.connect();
    let code = genCode();
    // tentativa simples de unicidade do código
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: exists } = await this.sb.from('game_rooms').select('id').eq('code', code).maybeSingle();
      if (!exists) break;
      code = genCode();
    }

    const { data: roomRow, error: roomErr } = await this.sb
      .from('game_rooms')
      .insert({ code, status: 'lobby', host_user_id: this.userId, max_players: opts.maxPlayers })
      .select()
      .single();
    if (roomErr) throw roomErr;
    const room = mapRoom(roomRow);

    const seatRows = [
      {
        room_id: room.id, user_id: this.userId, name: opts.hostName, color: SEAT_COLORS[0],
        type: 'human', seat_index: 0, is_ready: false, connection_status: 'online',
      },
      ...opts.aiSeats.map((ai, i) => ({
        room_id: room.id, user_id: null, name: `IA ${i + 1}`,
        color: SEAT_COLORS[(i + 1) % SEAT_COLORS.length], type: 'ai', seat_index: i + 1,
        is_ready: true, connection_status: 'online', ai_difficulty: ai.difficulty ?? null,
      })),
    ];
    const { data: seats, error: seatErr } = await this.sb.from('game_players').insert(seatRows).select();
    if (seatErr) throw seatErr;
    const hostSeat = mapSeat(seats.find((s: any) => s.seat_index === 0)); // eslint-disable-line @typescript-eslint/no-explicit-any
    return { room, seat: hostSeat };
  }

  async joinRoom(code: string, name: string): Promise<{ room: GameRoom; seat: GamePlayerSeat }> {
    await this.connect();
    const { data: roomRow, error } = await this.sb
      .from('game_rooms').select().eq('code', code.toUpperCase()).maybeSingle();
    if (error) throw error;
    if (!roomRow) throw new Error('Sala não encontrada');
    const room = mapRoom(roomRow);

    const { data: seatRows } = await this.sb.from('game_players').select().eq('room_id', room.id);
    const seats = (seatRows ?? []).map(mapSeat);

    // Reconexão: já tenho assento? volto online e retorno.
    const existing = seats.find(s => s.userId === this.userId);
    if (existing) {
      await this.sb.from('game_players').update({ connection_status: 'online' }).eq('id', existing.id);
      return { room, seat: { ...existing, connectionStatus: 'online' } };
    }
    if (seats.length >= room.maxPlayers) throw new Error('Sala cheia');
    const used = new Set(seats.map(s => s.seatIndex));
    let seatIndex = 0; while (used.has(seatIndex)) seatIndex++;

    const { data: seatRow, error: seatErr } = await this.sb
      .from('game_players')
      .insert({
        room_id: room.id, user_id: this.userId, name, color: SEAT_COLORS[seatIndex % SEAT_COLORS.length],
        type: 'human', seat_index: seatIndex, is_ready: false, connection_status: 'online',
      })
      .select().single();
    if (seatErr) throw seatErr;
    return { room, seat: mapSeat(seatRow) };
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.sb.from('game_players').delete().eq('room_id', roomId).eq('user_id', this.userId);
  }

  async getRoom(roomId: string): Promise<GameRoom | null> {
    const { data } = await this.sb.from('game_rooms').select().eq('id', roomId).maybeSingle();
    return data ? mapRoom(data) : null;
  }
  async listPlayers(roomId: string): Promise<GamePlayerSeat[]> {
    const { data } = await this.sb.from('game_players').select().eq('room_id', roomId).order('seat_index');
    return (data ?? []).map(mapSeat);
  }
  async setReady(roomId: string, ready: boolean): Promise<void> {
    await this.sb.from('game_players').update({ is_ready: ready })
      .eq('room_id', roomId).eq('user_id', this.userId);
  }

  async assignSeats(_roomId: string, assignments: Array<{ seatId: string; superpowerId: SuperpowerId }>): Promise<void> {
    for (const a of assignments) {
      await this.sb.from('game_players').update({ superpower_id: a.superpowerId }).eq('id', a.seatId);
    }
  }

  async startGame(roomId: string, initialState: GameState): Promise<RoomStateSnapshot> {
    const { data: stateRow, error } = await this.sb
      .from('game_states')
      .insert({ room_id: roomId, version: 1, state_json: initialState, last_action_id: null })
      .select().single();
    if (error) throw error;
    await this.sb.from('game_rooms').update({
      status: 'active', state_version: 1,
      current_turn: initialState.turn.turnNumber, current_phase: initialState.turn.stage,
      current_player_id: initialState.turn.currentPlayer, updated_at: new Date().toISOString(),
    }).eq('id', roomId);
    return mapState(stateRow);
  }

  // ── Estado / ações ────────────────────────────────────────
  async getLatestState(roomId: string): Promise<RoomStateSnapshot | null> {
    const { data } = await this.sb
      .from('game_states').select().eq('room_id', roomId)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    return data ? mapState(data) : null;
  }
  async getActionsSince(roomId: string, afterVersion: number): Promise<MultiplayerAction[]> {
    const { data } = await this.sb
      .from('game_actions').select().eq('room_id', roomId)
      .gte('expected_version', afterVersion).order('expected_version');
    return (data ?? []).map(mapAction);
  }

  async submitAction(input: {
    roomId: string;
    playerId: SuperpowerId;
    action: GameAction;
    expectedVersion: number;
    clientRequestId: string;
    computeNextState: (current: GameState) => GameState;
  }): Promise<SubmitActionResult> {
    const latest = await this.getLatestState(input.roomId);
    if (!latest) return { ok: false, reason: 'invalid', message: 'Estado inexistente' };

    const room = await this.getRoom(input.roomId);
    if (!room || room.status !== 'active') {
      return { ok: false, reason: 'room_not_active', message: 'Partida não está ativa' };
    }
    if (input.expectedVersion !== latest.version) {
      return { ok: false, reason: 'version_conflict', latest };
    }
    // Turn lock: só o jogador da vez age — exceto na Venda Simultânea (fase
    // global em que todos agem ao mesmo tempo, ver isTurnExemptAction).
    if (!isTurnExemptAction(input.action.type) &&
        latest.state.turn.currentPlayer !== input.playerId) {
      return { ok: false, reason: 'not_your_turn', message: 'Não é a sua vez' };
    }

    const nextState = input.computeNextState(latest.state);
    const actionId = nanoid(); // id lógico p/ last_action_id (uuid gerado no insert é o oficial)

    // 1) action log (idempotência via unique room_id+client_request_id)
    const { data: actRow, error: actErr } = await this.sb
      .from('game_actions')
      .insert({
        room_id: input.roomId, player_id: input.playerId,
        turn: latest.state.turn.turnNumber, phase: latest.state.turn.stage,
        type: input.action.type, payload: input.action,
        expected_version: input.expectedVersion, client_request_id: input.clientRequestId,
      })
      .select().single();
    if (actErr) {
      // 23505 = ação já processada (mesmo client_request_id) → idempotente.
      if ((actErr as any).code === '23505') { // eslint-disable-line @typescript-eslint/no-explicit-any
        const cur = await this.getLatestState(input.roomId);
        return cur ? { ok: true, snapshot: cur } : { ok: false, reason: 'invalid', message: 'estado ausente' };
      }
      return { ok: false, reason: 'invalid', message: actErr.message };
    }

    // 2) snapshot novo (unique room_id+version protege corrida de turno)
    const { data: stateRow, error: stErr } = await this.sb
      .from('game_states')
      .insert({ room_id: input.roomId, version: latest.version + 1, state_json: nextState, last_action_id: actRow.id })
      .select().single();
    if (stErr) {
      if ((stErr as any).code === '23505') { // eslint-disable-line @typescript-eslint/no-explicit-any
        const cur = await this.getLatestState(input.roomId);
        return { ok: false, reason: 'version_conflict', latest: cur ?? latest };
      }
      return { ok: false, reason: 'invalid', message: stErr.message };
    }

    // 3) metadados da sala
    await this.sb.from('game_rooms').update({
      state_version: latest.version + 1,
      current_turn: nextState.turn.turnNumber, current_phase: nextState.turn.stage,
      current_player_id: nextState.turn.currentPlayer,
      status: nextState.gameOver ? 'finished' : 'active',
      updated_at: new Date().toISOString(),
    }).eq('id', input.roomId);

    void actionId;
    return { ok: true, snapshot: mapState(stateRow) };
  }

  // ── Realtime ──────────────────────────────────────────────
  onStateChange(roomId: string, cb: (s: RoomStateSnapshot) => void): RoomSubscription {
    const ch = this.sb
      .channel(`state:${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_states', filter: `room_id=eq.${roomId}` },
        (payload) => cb(mapState(payload.new)))
      .subscribe();
    return { unsubscribe: () => { void this.sb.removeChannel(ch); } };
  }
  onAction(roomId: string, cb: (a: MultiplayerAction) => void): RoomSubscription {
    const ch = this.sb
      .channel(`action:${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_actions', filter: `room_id=eq.${roomId}` },
        (payload) => cb(mapAction(payload.new)))
      .subscribe();
    return { unsubscribe: () => { void this.sb.removeChannel(ch); } };
  }
  onPlayersChange(roomId: string, cb: (p: GamePlayerSeat[]) => void): RoomSubscription {
    const reload = async () => cb(await this.listPlayers(roomId));
    const ch = this.sb
      .channel(`players:${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `room_id=eq.${roomId}` },
        () => { void reload(); })
      .subscribe();
    return { unsubscribe: () => { void this.sb.removeChannel(ch); } };
  }

  // ── Presence ──────────────────────────────────────────────
  async trackPresence(roomId: string, presence: PresenceState): Promise<void> {
    const ch = this.sb.channel(`presence:${roomId}`, { config: { presence: { key: presence.userId } } });
    await new Promise<void>((resolve) => {
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { await ch.track(presence); resolve(); }
      });
    });
  }
  onPresence(roomId: string, cb: (states: PresenceState[]) => void): RoomSubscription {
    const ch = this.sb.channel(`presence:${roomId}`);
    ch.on('presence', { event: 'sync' }, () => {
      const raw = ch.presenceState<PresenceState>();
      const states = Object.values(raw).flat() as PresenceState[];
      cb(states);
    }).subscribe();
    return { unsubscribe: () => { void this.sb.removeChannel(ch); } };
  }
}
