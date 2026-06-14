# Supremacia Digital — Schema para Multiplayer Futuro

## Visão Geral

Este documento define a estrutura de dados e o protocolo de comunicação necessários para transformar o protótipo single-player atual em uma versão multiplayer real-time. O objetivo é permitir que 2-6 jogadores humanos participem de uma mesma partida via WebSocket, com o servidor atuando como autoridade de estado.

---

## Arquitetura Proposta

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│  Client A   │ ◄───────────────► │                  │
├─────────────┤                    │   Game Server    │
│  Client B   │ ◄───────────────► │  (Node.js)       │
├─────────────┤                    │                  │
│  Client C   │ ◄───────────────► │  - State Store   │
├─────────────┤                    │  - Rules Engine  │
│  ...        │ ◄───────────────► │  - RNG (seeded)  │
└─────────────┘                    └──────────────────┘
```

O motor de regras (`game/store.ts`) é reutilizado no servidor sem alterações na lógica. O cliente envia **ações** (GameAction) e recebe **patches de estado** (delta ou snapshot completo).

---

## Protocolo WebSocket

### Mensagens Client → Server

| Tipo | Payload | Descrição |
|------|---------|-----------|
| `JOIN_ROOM` | `{ roomId: string, playerId: string, token: string }` | Entrar em uma sala |
| `CREATE_ROOM` | `{ playerName: string, superpowerId: SuperpowerId }` | Criar nova sala |
| `GAME_ACTION` | `{ action: GameAction, seq: number }` | Enviar ação de jogo |
| `CHAT` | `{ message: string }` | Mensagem de chat |
| `PING` | `{ timestamp: number }` | Heartbeat |

### Mensagens Server → Client

| Tipo | Payload | Descrição |
|------|---------|-----------|
| `ROOM_JOINED` | `{ roomId: string, players: PlayerInfo[], state: GameState }` | Confirmação de entrada |
| `PLAYER_JOINED` | `{ playerId: string, superpowerId: SuperpowerId }` | Outro jogador entrou |
| `STATE_UPDATE` | `{ state: GameState, seq: number }` | Estado atualizado |
| `STATE_PATCH` | `{ patch: JsonPatch[], seq: number }` | Delta de estado (otimização) |
| `ACTION_REJECTED` | `{ seq: number, reason: string }` | Ação inválida rejeitada |
| `GAME_OVER` | `{ winner: SuperpowerId | null, condition: string }` | Fim de jogo |
| `CHAT` | `{ playerId: string, message: string }` | Chat recebido |
| `PONG` | `{ timestamp: number, serverTime: number }` | Resposta heartbeat |
| `TURN_TIMER` | `{ playerId: string, remainingMs: number }` | Timer do turno |

---

## Schema de Dados

### Room (Sala)

```typescript
interface Room {
  id: string;                    // nanoid(12)
  createdAt: number;             // timestamp
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;            // 2-6
  players: RoomPlayer[];
  gameState: GameState | null;
  settings: RoomSettings;
  turnTimerMs: number;           // tempo máximo por turno (default: 300000 = 5min)
  seed: string;                  // seed para RNG determinístico
}

interface RoomPlayer {
  id: string;                    // nanoid(8)
  name: string;
  superpowerId: SuperpowerId;
  connected: boolean;
  lastPing: number;
  isHost: boolean;
}

interface RoomSettings {
  turnTimerEnabled: boolean;
  turnTimerMs: number;
  allowSpectators: boolean;
  cpuFillEmpty: boolean;         // preencher slots vazios com CPU
  nuclearEnabled: boolean;
  maxTurns: number;              // 0 = sem limite
}
```

### GameState (reutilizado do protótipo)

O `GameState` definido em `client/src/game/types.ts` é usado diretamente no servidor. A única adição é:

```typescript
interface MultiplayerGameState extends GameState {
  roomId: string;
  connectedPlayers: string[];    // IDs dos jogadores conectados
  spectators: string[];
  actionHistory: GameAction[];   // log completo para replay
  rngSeed: string;
  rngCounter: number;            // para RNG determinístico
}
```

---

## Fluxo de Jogo Multiplayer

1. **Lobby**: Host cria sala, outros jogadores entram via código/link
2. **Seleção**: Cada jogador escolhe uma superpotência (sem repetição)
3. **Início**: Host clica "Iniciar" quando todos estão prontos
4. **Turnos**: Servidor gerencia a ordem dos turnos e valida cada ação
5. **Timer**: Se o jogador não agir dentro do tempo, turno é encerrado automaticamente
6. **Desconexão**: Jogador desconectado tem 60s para reconectar; após isso, CPU assume
7. **Fim**: Servidor detecta condição de vitória e notifica todos

---

## RNG Determinístico

Para garantir que todos os clientes possam verificar resultados de dados:

```typescript
// Usar seed compartilhada + contador sequencial
import { createPRNG } from './rng';

const prng = createPRNG(room.seed);

function rollDice(count: number): number[] {
  return Array.from({ length: count }, () => prng.nextInt(1, 6));
}
```

O servidor é a autoridade final. Clientes podem verificar localmente mas não podem rejeitar resultados do servidor.

---

## Persistência

| Dado | Storage | TTL |
|------|---------|-----|
| Salas ativas | Redis | 24h |
| Estado do jogo | Redis + PostgreSQL | Permanente |
| Histórico de ações | PostgreSQL | Permanente |
| Replays | S3/Object Storage | 30 dias |

---

## API REST (complementar ao WebSocket)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/rooms` | POST | Criar sala |
| `/api/rooms/:id` | GET | Info da sala |
| `/api/rooms/:id/join` | POST | Entrar na sala |
| `/api/rooms` | GET | Listar salas públicas |
| `/api/games/:id/replay` | GET | Obter replay completo |
| `/api/games/:id/state` | GET | Estado atual (para reconexão) |

---

## Migração do Protótipo

Para implementar multiplayer a partir do código atual:

1. **Extrair motor de regras** para pacote compartilhado (`shared/game/`)
2. **Substituir `Math.random()`** por PRNG com seed
3. **Adicionar servidor WebSocket** (Socket.IO ou ws nativo)
4. **Validação server-side** de todas as ações antes de aplicar
5. **Implementar reconciliação** de estado no cliente (optimistic updates)
6. **Adicionar lobby UI** com criação/entrada de salas
7. **Timer de turno** com countdown visual

---

## Estimativa de Esforço

| Componente | Complexidade | Horas estimadas |
|------------|-------------|-----------------|
| Servidor WebSocket | Média | 16h |
| RNG determinístico | Baixa | 4h |
| Lobby/Salas | Média | 12h |
| Reconciliação de estado | Alta | 20h |
| Timer de turno | Baixa | 4h |
| Reconexão/Desconexão | Média | 8h |
| Testes E2E | Alta | 16h |
| **Total** | | **~80h** |
