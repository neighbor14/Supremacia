# Multiplayer Supabase — Status & Handoff

**Última atualização:** 2026-06-22
**Skill:** `supremacia-multiplayer-supabase`
**Modo:** MVP por turnos, salas, IA como player, mobile-first. Preserva o modo local/IA atual.

---

## Decisões tomadas
- **Backend:** projeto Supabase **"Waiting List"** (`wodqfcvseurdgczvujnq`) reaproveitado, **sem custo novo**. A tabela `waitlist` existente **não foi tocada**; as tabelas do jogo usam prefixo `game_` em `public`.
- **Auth:** **Anonymous Auth** (cada convidado ganha `auth.uid()` real → RLS forte sem tela de login). Habilitado no dashboard ✅.

**⚠️ Nota RLS:** a função `supremacia_is_room_member` é `SECURITY INVOKER` com `EXECUTE` para `authenticated`. **Não revogar esse EXECUTE** — as policies de `game_states`/`game_actions` chamam a função e, sem permissão de execução, o role `authenticated` não consegue avaliar a policy e os inserts são negados (bug encontrado e corrigido no teste E2E).
- **Sincronização:** ações válidas + snapshot versionado. Nunca UI/pixels.
- **Sem InstantDB, sem servidor Node próprio** nesta fase (conforme skill).

## Arquitetura da auditoria (por que foi viável sem reescrever o jogo)
- `dispatch(action: GameAction)` em [store.ts](../client/src/game/store.ts) já é um **reducer**: clona o estado, aplica regra pura, faz `set()` + autosave. Efeitos colaterais isolados.
- IA já produz passos serializáveis: `planAiTurn(state) → PlannedStep[]` (cada passo com `stateAfter`).
- Estado 100% serializável (`saveGame`/`loadGame`), `GameAction` é union type, `PlayerType` já tem `'remote'`.

---

## O que JÁ está pronto (verificado: `tsc` limpo, 64/64 testes passando)

| Camada | Arquivo | Estado |
|---|---|---|
| Contrato + tipos (espelham as tabelas) | [multiplayer/types.ts](../client/src/game/multiplayer/types.ts) | ✅ |
| Adapter LOCAL simulado (localStorage + BroadcastChannel) | [multiplayer/LocalMultiplayerAdapter.ts](../client/src/game/multiplayer/LocalMultiplayerAdapter.ts) | ✅ |
| Cliente Supabase + Anonymous Auth | [multiplayer/supabaseClient.ts](../client/src/game/multiplayer/supabaseClient.ts) | ✅ |
| Adapter SUPABASE (turn lock + optimistic concurrency + realtime + presence) | [multiplayer/SupabaseMultiplayerAdapter.ts](../client/src/game/multiplayer/SupabaseMultiplayerAdapter.ts) | ✅ |
| Factory (Supabase se houver env; senão Local) | [multiplayer/index.ts](../client/src/game/multiplayer/index.ts) | ✅ |
| Migrations Supabase (`game_rooms/players/states/actions` + RLS + Realtime) | aplicadas no projeto | ✅ |
| Env | `.env.local` (preenchido), `.env.example` | ✅ |
| Segurança Fase 1: `sourcemap:false` explícito | [vite.config.ts](../vite.config.ts) | ✅ |
| Reducer puro extraído (`applyGameAction`) + roteamento online no `dispatch` | [store.ts](../client/src/game/store.ts) | ✅ |
| Estado inicial multi-humano (`createMultiplayerGameState`) | [setup.ts](../client/src/game/setup.ts) | ✅ |
| Store de sessão (lobby, submit, host-AI, presence, reconexão) | [multiplayer/session.ts](../client/src/game/multiplayer/session.ts) | ✅ |
| Tela de Lobby (criar/entrar/sala, ready, convite) | [pages/Lobby.tsx](../client/src/pages/Lobby.tsx) | ✅ |
| Home "Jogar Online" + rota `/lobby` | [Home.tsx](../client/src/pages/Home.tsx), [App.tsx](../client/src/App.tsx) | ✅ |
| GameScreen: turn lock, banner de vez, IA dirigida pelo host, reconexão | [GameScreen.tsx](../client/src/pages/GameScreen.tsx) | ✅ |

### Fluxo de sincronização implementado (no adapter)
1. valida sala ativa → 2. optimistic concurrency (`expected_version`) → 3. turn lock (`currentPlayer`) → 4. aplica reducer existente → 5. grava `game_actions` (idempotência por `client_request_id`) → 6. grava snapshot `game_states` (unique `room_id,version` protege corrida) → 7. atualiza `game_rooms` → 8. Realtime notifica os clientes.

---

## ⚠️ Passo manual OBRIGATÓRIO (não dá via MCP)
**Habilitar Anonymous Sign-ins** no painel Supabase:
Dashboard → projeto *Waiting List* → **Authentication → Sign In / Providers → Anonymous sign-ins → Enable**.
Sem isso, criar/entrar em sala falha com erro de auth.

---

## Como testar
**Sem Supabase (adapter Local, 2 abas):** comente as envs `VITE_SUPABASE_*` em
`.env.local` e rode `pnpm dev`. Home → "Jogar Online" → "Criar partida". Abra
outra aba no mesmo navegador → "Entrar por código". Salas sincronizam via
BroadcastChannel (mesmo dispositivo).

**Com Supabase (2 navegadores/celulares — real):**
1. Habilite Anonymous sign-ins (passo manual acima).
2. `.env.local` já preenchido → `pnpm dev` (ou `./deploy.sh` para produção).
3. Navegador A: Home → Jogar Online → Criar partida → copiar código.
4. Navegador B (ou celular): Jogar Online → Entrar por código.
5. Ambos clicam "Estou pronto"; o host inicia. Cada um joga só na sua vez
   (banner "Sua vez / Vez de X"); a IA é dirigida pelo host.

---

## Limitações conhecidas do MVP (próximos passos)
1. **Online só no Modo Clássico.** O Digital Balanceado depende da fase de Venda
   Simultânea (declaração privada por jogador) — feature MP à parte. O lobby online
   oferece apenas Clássico; o single-player mantém os dois modos.
2. **Combate humano-vs-humano:** a resposta interativa do defensor (D6/D7 — reforço/
   contra-ataque) hoje só é interativa quando a IA é o defensor. Em PvP o combate
   resolve do lado do atacante. Tornar a defesa interativa entre clientes é o
   próximo passo de combate.
3. **Anti-cheat:** o cliente ainda grava o snapshot (RLS por membro). Mover o
   `submitAction` para Edge Function `service_role` (rodando o reducer + RNG no
   servidor) é a Fase 2 — o contrato já isola esse ponto.
4. **Reconexão:** ao recarregar a página do jogo, o app redireciona ao lobby com o
   código pré-preenchido (`supremacia_mp_active`); o assento é reaproveitado pelo
   `userId`. Reentrada 1-clique (sem redigitar nome) é um polimento futuro.
5. **Apresentação da IA:** o host vê os passos com delay; os demais clientes recebem
   os snapshots (estado + log), sem o painel rico de apresentação. Broadcastar o
   `PlayerActionEvent` por ação é uma melhoria.

---

## Riscos técnicos / notas de fidelidade
- **RNG client-side (`rng.ts`, `Math.random`)**: no MVP, o cliente da vez calcula `stateAfter` e publica o snapshot — ele é autoritativo sobre o resultado da própria ação, então não há divergência entre clientes. **Mas isso é trapaceável**; Fase 2 deve mover RNG + reducer para Edge Function (`service_role`). O contrato (`submitAction`) já isola esse ponto.
- **RLS MVP**: `game_states` é gravável pelo cliente (membro da sala) — intencional nesta fase. Fase 2: revogar write de `authenticated` e gravar só via Edge Function.
- **Conflito regra×manual:** nenhum encontrado nesta fase (só leitura/auditoria do engine).
