# Auditoria de Exposição de Código e Mecânica — Supremacia Digital

**Data:** 2026-06-22
**Escopo:** frontend publicado em produção (https://commandthemap.com / VPS Hostinger), bundle `dist/public/assets/index-*.js`, configuração de build, secrets, mecânica de jogo, multiplayer/anti-cheat, banco de dados.
**Natureza:** somente auditoria + plano. Nenhuma alteração de código foi feita.

---

## TL;DR

| Eixo | Veredito |
|---|---|
| Vazamento de secrets | ✅ **Limpo.** Nenhuma chave sensível no bundle. |
| Sourcemaps em produção | ✅ **Limpo.** Não há `.map` nem `sourceMappingURL`. |
| Cópia da mecânica | 🔴 **Risco total.** 100% das regras, dados e IA estão no cliente e são totalmente legíveis/reconstruíveis. |
| Manipulação / cheat | 🔴 **Risco total (potencial).** Não existe servidor autoritativo. Hoje é single-player vs IA, então o "cheat" só afeta o próprio jogador — **mas qualquer multiplayer construído sobre a base atual é trivialmente trapaceável.** |
| Supabase / RLS | ⚪ **N/A hoje.** Não há banco nem Supabase integrado (apenas comentário de intenção futura em `types.ts:150`). Torna-se crítico no momento em que for adicionado. |

**Mensagem central:** o projeto está *seguro contra vazamento de credenciais*, mas *completamente exposto quanto à propriedade intelectual da mecânica* e *sem qualquer base de integridade para multiplayer*. Isso é esperado e aceitável para um MVP single-player; vira bloqueador antes de abrir multiplayer ou tratar a mecânica como ativo comercial protegido.

---

## 1. Build e exposição pública

| Verificação | Resultado | Evidência |
|---|---|---|
| `build.sourcemap` no Vite | ✅ Não definido → default `false` | `vite.config.ts:219-222` (bloco `build` só tem `outDir`/`emptyOutDir`) |
| Arquivos `.map` em `dist` | ✅ Nenhum | `find dist -name "*.map"` → vazio |
| Comentários `sourceMappingURL` no bundle | ✅ Nenhum | `grep sourceMappingURL dist` → vazio |
| Nomes de função/classe descritivos no bundle | ⚠️ Parcial | Funções minificadas (`claimTerritory`, `resolveCombat`, `rollDice`, `getMoveBlockReason` → 0 ocorrências). **Mas** chaves de dados sobrevivem: `resourceCards` (53×), `territories` (109×), `seaZones` (39×) |
| `console.*` com regras/estado/cartas/IA | ✅ Limpo | Os únicos `console.log` no bundle são do subsistema de áudio (`[Supremacia Audio] ...`). Nenhum log de estado de jogo, cartas, RNG ou decisões da IA |

**Observações:**
- A minificação esconde *nomes de funções* da lógica, mas **não protege a lógica em si** — todo o algoritmo continua presente e é reconstruível por engenharia reversa. Minificação ≠ proteção de PI.
- As **tabelas de dados completas** (40 territórios + adjacências + produção, 18 mares + conexões, 65 cartas) estão embutidas em texto claro no bundle. Qualquer pessoa extrai o dataset inteiro com um `JSON.stringify` no console. **Este é o maior vetor de cópia.**

**Achado BAIXO** — `dist/` está versionável? O `.gitignore` ignora `dist/` (linha 6), bom. Porém há um diretório `.netlify/` não rastreado no working tree; confirmar que não contém credenciais antes de qualquer commit acidental.

---

## 2. Secrets e chaves

✅ **Nenhum segredo proibido encontrado no frontend.**

| Item | Status |
|---|---|
| Supabase `service_role` / tokens admin / JWT secret | ✅ Ausente |
| `sk_live`/`sk_test`/AWS `AKIA…`/`-----BEGIN … KEY-----` | ✅ Ausente |
| Tokens longos embutidos | ✅ Só falsos positivos benignos: alfabeto do `nanoid` (`useandom-26T…`) e variáveis CSS do Radix |
| `"password"` no bundle | ✅ Falso positivo: detecção de `input type="password"` em libs de formulário |

**Variáveis `VITE_*` em uso:**
- `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` (`client/src/const.ts:5-6`) — config pública de OAuth (URL de portal + app id). **Aceitável** expor (equivalem a "client id" público).
- `VITE_FRONTEND_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_URL` (`client/src/components/Map.tsx:89-91`) — chave do proxy Google Maps da plataforma Manus/Forge. **No build atual de produção essa chave NÃO foi embutida** (estava indefinida no momento do build → vira `undefined` no bundle; `grep FORGE/forge` no bundle → 0). O acesso ao Maps passa por um *proxy* (`/v1/maps/proxy`), então mesmo se preenchida seria uma chave de proxy com restrição de origem, não a chave Google crua.
- `BUILT_IN_FORGE_API_KEY` (`vite.config.ts:166`) — usada **apenas em middleware de dev server** (`vitePluginStorageProxy`), nunca chega ao cliente.

**Arquivos `.env`:** nenhum `.env*` existe no repositório nem no working tree; `.gitignore` já cobre todas as variantes (`.env`, `.env.local`, etc.). ✅

**Risco residual (MÉDIO, condicional):** se algum dia o build de produção for executado **com** `VITE_FRONTEND_FORGE_API_KEY` definida, a chave será embutida em texto claro no bundle. Garantir que chaves de Maps tenham restrição de origem/HTTP referrer no console do provedor, independentemente do proxy.

---

## 3. Mecânica de jogo no cliente

**Conclusão estrutural:** o servidor (`server/index.ts`) é **apenas um servidor estático Express** (serve `dist/public` + fallback `index.html`). Em produção nem ele roda — é nginx servindo arquivos estáticos. **Não há nenhuma lógica de jogo no backend.** O jogo é 100% client-side, sem chamadas de rede no gameplay (não há `fetch`/`axios`/websocket na pasta `game/`).

Classificação por mecânica (estado atual: single-player vs IA):

| Mecânica | Onde está | OK no front (single-player) | Mover p/ backend (multiplayer) |
|---|---|---|---|
| Estrutura de turno (7 estágios, limite de 3 opcionais) | `store.ts` (3309 linhas) | OK | 🔴 Crítico |
| Pagamento de salário | `store.ts` | OK | 🔴 Crítico |
| Coleta/transferência de produção | `store.ts` + `resourceCards.ts` | OK | 🔴 Crítico |
| Compra de exército/navios (construção) | `store.ts` + `rulesConfig.ts` | OK | 🔴 Crítico |
| Movimento | `store.ts` (`getMoveBlockReason`) | OK | 🔴 Crítico |
| Ataque / Defesa / Combate | `store.ts` + `rng.ts` (`rollDice`) | OK | 🔴 Crítico |
| Prospecção / sorteio de cartas | `researchDeck.ts` + `rng.ts` (`shuffleArray`) | OK | 🔴 Crítico |
| Bomba atômica / Laser Star | `store.ts` + `resourceCards.ts` | OK | 🔴 Crítico |
| Mercado de commodities / preços | `store.ts` + `marketSetup.ts` | OK | 🔴 Crítico |
| **Tabela de preços** | `marketSetup.ts` / `rulesConfig.ts` | OK | 🟡 Melhor mover (balance) |
| **Tabela de territórios + produção** | `data/territories.ts` | OK | 🟡 Pode ficar (é "conteúdo"), mas é o ativo de cópia |
| **Oceanos e adjacências** | `data/seaZones.ts` | OK | 🟡 idem |
| **Algoritmo de IA** | `game/ai/aiEngine.ts` (625 linhas) + `aiConfig.ts` | OK | 🟡 Melhor mover (PI + evitar "ler" a IA) |
| **Algoritmo de combate** | `store.ts` | OK | 🔴 Crítico |
| **RNG / sorteio** | `rng.ts` | ⚠️ ver abaixo | 🔴 Crítico |

**Sobre o RNG (`rng.ts`) — achado MÉDIO/CRÍTICo-condicional:**
- Usa `Math.random()` puro (dados, shuffle de baralho, prospecção). O comentário do arquivo diz *"Seeded RNG for reproducibility in multiplayer future"*, **mas não há seed implementado** — é PRNG não-determinístico e não-seguro.
- Em single-player isso é inofensivo. Em multiplayer, RNG no cliente = trapaça garantida (jogador re-rola dados/cartas até obter o resultado desejado, ou prevê o próximo resultado). **Todo sorteio precisa migrar para o servidor com seed/commit-reveal.**

---

## 4. Multiplayer e anti-cheat

Como **não existe servidor autoritativo nem persistência de estado compartilhada**, hoje o cliente é dono absoluto da partida. Avaliação do que um cliente consegue fazer:

| O cliente consegue…? | Hoje (single-player) | Implicação para multiplayer |
|---|---|---|
| Alterar estado da partida diretamente | ✅ Sim (store em memória, editável via React DevTools / patch do bundle) | 🔴 Trapaça total |
| Enviar quantidade arbitrária de recurso/unidade | ✅ Sim | 🔴 |
| Alterar território conquistado | ✅ Sim | 🔴 |
| Alterar resultado de carta | ✅ Sim | 🔴 |
| Alterar resultado de combate | ✅ Sim | 🔴 |
| Alterar dinheiro / commodities / preço de mercado | ✅ Sim | 🔴 |
| Pular fases obrigatórias | ✅ Sim | 🔴 |
| Executar mais ações que o permitido por turno | ✅ Sim | 🔴 |

**Nota de mitigação atual:** o estado de jogo **não é persistido** (apenas preferências de áudio em `localStorage`; o estado da partida vive em memória no Zustand sem `persist`). Não há save-file manipulável, mas isso não é uma defesa — é só ausência de superfície. Qualquer multiplayer construído sobre a store atual herda 100% destes vetores.

**Veredito:** a base atual é **inadequada para multiplayer competitivo** sem reescrita do fluxo de ações para um modelo servidor-autoritativo (ver seção 6).

---

## 5. Supabase / banco de dados

⚪ **Não aplicável no estado atual.**
- Não há cliente Supabase, `createClient`, nem dependência `@supabase/*` (a única ocorrência da palavra "supabase" no código é um comentário de intenção futura em `client/src/game/types.ts:150`).
- Não existem as tabelas auditadas (`games`, `players`, `game_state`, `actions`, `cards`, `market_prices`, `territories`, `units`, `logs`). Não há RLS a auditar porque não há banco.

**Recomendação preventiva (quando for criado):**
- RLS **ligado em todas as tabelas** por padrão.
- Cliente: **somente leitura** de `game_state`/`logs` das partidas em que participa; **nenhum INSERT/UPDATE direto** em estado oficial.
- Toda escrita de estado passa por **Edge Function / RPC `SECURITY DEFINER`** que valida a regra — nunca por `update` direto do client com a `anon key`.
- `service_role` **jamais** no frontend (só em Edge Functions/servidor).
- `anon key` no front é aceitável (é pública por design); a proteção real é a RLS + RPC, não a chave.

---

## 6. Proposta de arquitetura segura (servidor autoritativo)

Modelo-alvo: **cliente envia intenção, servidor decide tudo.**

```
Cliente (render + intenção)                Servidor autoritativo
─────────────────────────                  ──────────────────────────────
dispatch(action) ───────────────────────▶  processGameAction(gameId, playerId, action)
                                              1. carrega estado oficial (DB)
                                              2. valida turno/fase/limite de estágios
                                              3. valida regra (rulesConfig + invariantes)
                                              4. resolve RNG (dados, sorteio de cartas) com seed server-side
                                              5. resolve combate
                                              6. atualiza mercado/preços
                                              7. roda IA (quando for a vez dela)
                                              8. grava novo estado + action_log (append-only)
◀─────────────── novo estado + delta ──────  retorna resultado
render(resultado)
```

**Princípios:**
- **Fonte única de verdade migra para o servidor.** `rulesConfig.ts`, validação de movimento, conquista, combate, mercado e RNG passam a rodar (ou ser re-validados) no backend. O cliente pode manter uma cópia para *previsão otimista de UI*, mas o servidor é quem decide.
- **`processGameAction` é o único ponto de escrita.** Nada de `update` direto em tabela de estado.
- **RNG server-side com auditabilidade** (seed por partida + commit-reveal para sorteios sensíveis), eliminando re-roll.
- **IA roda no servidor**, evitando que o oponente "leia" as decisões da IA no bundle.
- **`action_log` append-only** = replay, anti-cheat e base para o multiplayer descrito em `multiplayerSchema.md`.
- O código já ajuda: regras centralizadas em `store.ts`/`rulesConfig.ts` e o comentário de `types.ts` indicam que a estrutura foi pensada para isso. A migração é extrair a lógica pura da store para um módulo compartilhável (`shared/`) que rode tanto no cliente (previsão) quanto no servidor (autoridade).

---

## 7. Plano de correção em fases

### Fase 1 — Proteção rápida ANTES de compartilhar (single-player público)
*Objetivo: reduzir cópia trivial e higienizar o build. Baixo esforço.*
1. **Confirmar/forçar `build.sourcemap: false`** explicitamente no `vite.config.ts` (hoje é default; tornar explícito evita regressão).
2. **Remover/guardar `console.log`** atrás de flag de dev (mesmo os de áudio) para não dar pistas de runtime.
3. **Garantir restrição de origem** na chave Google Maps no provedor (independe do proxy).
4. **Confirmar que o build de prod nunca recebe `VITE_FRONTEND_FORGE_API_KEY`** preenchida; documentar no `deploy.sh`.
5. (Opcional, anti-cópia) **Ofuscar/empacotar os datasets** (`territories`/`seaZones`/`resourceCards`) ou movê-los para fetch sob demanda — não impede engenharia reversa, mas eleva o custo de cópia casual.
6. Conferir `.netlify/` (não rastreado) por credenciais antes de qualquer commit.

> Aceite honesto: nada na Fase 1 protege a *mecânica* de quem realmente quiser copiar — código client-side é sempre legível. A proteção real de PI é jurídica (licença/termos) + mover lógica para o servidor (Fase 2/3).

### Fase 2 — Preparação para multiplayer
*Objetivo: tornar o servidor a autoridade. Esforço alto.*
1. **Extrair a lógica pura da store** para `shared/` (funções determinísticas que recebem estado+ação e retornam novo estado).
2. **Implementar `processGameAction`** (Edge Function Supabase ou serviço Node) usando essa lógica compartilhada.
3. **Migrar RNG para o servidor** com seed por partida (combate, prospecção, shuffle).
4. **Mover a IA para o servidor.**
5. **Criar o banco** (`games`, `players`, `game_state`, `actions`, …) com **RLS estrita** e escrita só via RPC/Edge Function.
6. **`action_log` append-only** + replay determinístico.
7. Cliente passa a enviar **intenção** e renderizar resultado (com previsão otimista opcional).

### Fase 3 — Arquitetura comercial / produção
*Objetivo: robustez, anti-cheat forte, escala.*
1. **Commit-reveal / RNG verificável** para sorteios sensíveis.
2. **Validação de invariantes server-side** (as listadas em `.claude/rules/game-rules.md`: "Minhas Cartas" × produção × recursos; mapa × owner × cor × permissão; uma carta não pode estar em dois lugares; etc.) como *guardas* no servidor, não só no cliente.
3. **Rate limiting / detecção de anomalias** por jogador (ações impossíveis → flag).
4. **Matchmaking, reconexão, espectador** sobre o `action_log`.
5. **Proteção de PI**: lógica e datasets sensíveis nunca enviados completos ao cliente; só o necessário para render.
6. Telemetria + testes de regra automatizados (já há base em `game/__tests__/`) cobrindo o servidor.

---

## Anexo — Arquivos afetados (referência)

| Área | Arquivos |
|---|---|
| Build/exposição | `vite.config.ts`, `netlify.toml`, `deploy.sh`, `dist/public/assets/index-*.js` |
| Secrets/env | `client/src/const.ts`, `client/src/components/Map.tsx`, `vite.config.ts` (middleware dev) |
| Mecânica (mover p/ servidor) | `client/src/game/store.ts`, `rng.ts`, `marketSetup.ts`, `researchDeck.ts`, `setup.ts`, `rulesConfig.ts`, `ai/aiEngine.ts`, `ai/aiConfig.ts` |
| Dados (ativo de cópia) | `client/src/data/territories.ts`, `seaZones.ts`, `resourceCards.ts`, `initialPlayers.ts` |
| Servidor (hoje só estático) | `server/index.ts` |
| Futuro multiplayer | `multiplayerSchema.md`, `client/src/game/types.ts`, `client/src/stores/presentationStore.ts` |
