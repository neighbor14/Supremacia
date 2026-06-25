# Regras do Supremacia Digital (resumo validado)

Resumo organizado das regras já validadas no projeto. Fonte de regra/mecânica:
[`referencias-oficiais.md`](referencias-oficiais.md). Constantes numéricas:
`client/src/game/rulesConfig.ts`. Tipos/estado: `client/src/game/types.ts`.

> **Adaptação digital** = divergência intencional do manual físico. Toda
> adaptação está marcada como tal aqui e no código.

---

## 1. Território controlado ≠ companhia

Estes são **conceitos diferentes** e nunca devem ser misturados na UI, no log ou
no estado:

- **Território controlado** = domínio militar/político. Definido pelo campo único
  `territory.owner`. Dá presença militar, movimentação e (se for terra do jogador
  e não nuclearizado) permissão de construção. Aparece na cor do controlador no
  mapa e na lista "Territórios controlados".
- **Companhia / carta de recurso** = uma empresa produtora localizada em um
  território. É uma `ResourceCard` com: `type` (cereal/petróleo/minério),
  `territoryId`, `production`, `companyName`, `ownerId`. Aparece em "Companhias /
  Minhas Cartas".

A **produção vem das cartas/companhias** que o jogador possui — nunca de "todos os
territórios que controla".

## 2. Como se obtém uma companhia

1. **Prospecção** (fase Comprar/Prospectar): vira cartas reais do baralho virtual
   (baralho **único e global** — não há "baralho por região"). Pode-se prospectar
   por tipo de recurso (vira até sair uma companhia do tipo escolhido, cobrando por
   carta; as demais voltam ao baralho).
2. **Conquista** de um território que já tinha uma companhia: a carta é
   **transferida** ao conquistador (`claimTerritory`/`occupyTerritory`).
3. **Negociação** (preparado para multiplayer futuro).

### Regra do manual Grow — território da carta (fiel)

> "A nova carta será devolvida ao maço, se ela estiver localizada num território
> que esteja ocupado por um oponente ou onde haja explodido uma bomba atômica."

Logo, **só se prospecta uma companhia se o território dela estiver neutro ou já
sob seu controle.** Companhia em território **inimigo** ou **nuclearizado** é
**devolvida ao baralho** (não é adquirida). O caminho para obter uma companhia em
terra inimiga é **conquistar o território** (captura via `claimTerritory`), nunca
a prospecção. Implementado em `isProspectableTerritory` (`store.ts`) e coberto por
testes em `__tests__/conquest.test.ts`.

Consequência geográfica: cada companhia tem localização fixa (ex.: `middle_east`
só tem petróleo "Golfo Persa"; não há cereal nem minério no Oriente Médio). A
prospecção por tipo entrega uma companhia daquele recurso **de qualquer lugar do
mapa**, desde que o território não esteja em mãos inimigas.

**Conquistar território neutro/vazio NÃO gera companhia automaticamente.** O
jogador controla o território, mas não produz até obter uma companhia ali.

## 3. Conquista — atualização consistente

`conquerTerritory`/`claimTerritory` (em `store.ts`) é a **função única** que, ao
mudar o controle de um território, atualiza de forma consistente:

- `owner`/controlador (fonte única → cor do mapa deriva disto);
- carta/companhia (transfere a do antigo dono, quando aplicável);
- produção futura (só se houver companhia ativa);
- permissão de construção (deriva de `owner` + tipo terrestre + não nuclearizado);
- log (registra "companhia capturada: X" ou "território sem companhia ativa");
- painel do território.

Mover/aerotransportar/desembarcar um exército para um território **neutro e
desguarnecido conquista-o** (adaptação digital explícita para territórios sem
defensores — o combate clássico exige defensor). Território **inimigo** só é
tomado pela **fase de Combate**.

## 4. Pesquisa tecnológica e armas especiais

- **Bomba Atômica** e **Laser-Star** saem do **baralho virtual real**
  (`resourceDeck`), nunca de probabilidade hardcoded. A chance exibida é derivada
  da composição atual do baralho (`researchDeck.ts`).
- Cartas viradas durante a pesquisa voltam ao baralho ao final da sessão.

## 5. Movimento consome cereal

- Mover tropas custa `LAND_MOVE_GRAIN_COST` (1) cereal por território. A UX mostra
  o custo e o saldo **antes** do clique.
- Sem cereal, o movimento é **bloqueado com explicação** (toast + log), nunca em
  silêncio. Validação central: `getMoveBlockReason` (fonte única usada pela UI e
  pelo engine).
- Voo (airlift) custa 2 petróleo/exército; mar custa 1 petróleo/zona.

## 6. Mercado

- Preço **muda conforme compra/venda** (sobe ao comprar, desce ao vender), sem
  preço fixo artificial, limitado por `MARKET_MIN_PRICE`/`MARKET_MAX_PRICE`.

### Modos de mercado (escolha no setup)

A partida tem dois modos de mercado (`config.marketMode`):

- **Clássico Grow** (`'classic'`) — fiel ao modo básico do manual: mercado abre
  em $5.000 e a venda acontece no **Estágio 3**, na ordem sequencial do turno do
  jogador. Mantido para puristas; **não é o default**.
- **Digital Balanceado** (`'balanced'`, **default de partidas novas**) — adaptação
  digital para reduzir a vantagem econômica do primeiro jogador em multiplayer/IA.
  No início de **cada rodada**, numa fase global: (1) todos pagam salários,
  (2) todos recebem produção, (3) abre a **Venda Simultânea de Recursos**. Todos
  declaram quanto vender de cada recurso **sem ver a declaração dos outros**;
  ao resolver, **todos recebem o mesmo preço** (snapshot tirado antes da
  resolução) e o mercado de cada recurso cai pelo **total vendido por todos**
  (clamp no piso). Vender ≥ 1 consome **1 das 3 ações opcionais** da rodada; o
  Estágio 3 sequencial fica indisponível neste modo (a venda é só a simultânea).
  Implementado em `game/simultaneousSell` (funções no `store.ts`); estado próprio
  `state.simultaneousSell` com as fases `SIMULTANEOUS_SELL_DECLARE`/`_RESOLVE`,
  preparado para multiplayer (Supabase futuro). Coberto por
  `__tests__/simultaneous-sell.test.ts`.

  > **Pendência sinalizada:** o manual Grow do projeto não traz a tabela oficial
  > de **preço inicial por dados (2d6)**. Por decisão registrada, o preço inicial
  > segue **fixo em $5.000 nos dois modos** por ora; a função `rollInitialMarketPrice`
  > (`game/marketSetup.ts`) existe isolada e documentada, marcada com TODO, mas
  > **ainda não conectada** ao setup — aguardando confirmação da tabela oficial.

## 7. Estrutura de turno (7 estágios)

1. Pagar salários (obrigatório) · 2. Transferir produção (obrigatório) ·
3. Vender · 4. Combate · 5. Movimentação · 6. Construção · 7. Comprar/Prospectar.
Máximo de **3 estágios opcionais** por turno.

### Salário × produção (fiel ao manual Grow)

> "Se um jogador não pagar os salários das suas companhias, ele não poderá
> transferir as unidades produzidas para a Central de Suprimentos no estágio 2."

No Estágio 1, se o dinheiro **não cobrir** todos os salários, a ordem de pagamento
é: (1) juros de empréstimo, (2) salário das **unidades** — tropas sem salário são
**dispensadas**, (3) salário das **companhias** — pagas da maior para a menor
produção; as que sobrarem ficam **dormentes** e **não produzem neste turno**
(`state.turn.unpaidCompanies`). A companhia **não é destruída** — volta a produzir
quando o salário for pago num turno seguinte (adaptação digital: o manual não
força fechar/devolver a carta nesse caso, só suspende a produção do turno).

A UX **avisa** o jogador: toast em `TurnPhaseBar` ao pagar salários + entrada no
log de eventos nomeando as companhias dormentes. Implementado em `paySalaries` e
`transferProduction` (`store.ts`); coberto por testes em `__tests__/conquest.test.ts`.

### Construção de unidades — 3 peças por conjunto (fiel ao manual Grow 3.7.1)

> "$1.000 por unidade (exército ou esquadra). Um conjunto de suprimentos (1 cereal
> + 1 petróleo + 1 minério) constrói **três** peças militares — três exércitos,
> três esquadras, ou qualquer combinação de três."

Cada unidade custa **$1.000**; o **conjunto de suprimentos** (1 de cada recurso) só
é debitado **a cada 3 peças**, em qualquer combinação de exércitos/esquadras. Como a
UI constrói 1 peça por clique, o estado de turno acumula `turn.unitsBuiltThisTurn` e
`buildUnits` (`store.ts`) só cobra um novo conjunto quando a contagem cruza um
múltiplo de `RULES.UNITS_PER_SUPPLY_SET` (3). O contador **reseta a cada turno**
(`advanceToNextPlayer`). Coberto por `__tests__/build-units.test.ts`.

> **Correção de fidelidade (bug P1):** antes, o despacho 1-a-1 chamava
> `Math.ceil(1/3) = 1` por clique, cobrando **1 conjunto inteiro por unidade** —
> triplicando o custo de suprimentos e drenando o minério. O `UNITS_PER_SUPPLY_SET:
> 3` estava correto; o erro era a UI não acumular as peças do turno.

## 8. Condições de vitória

- **Supremacia**: restar um único jogador não eliminado.
- **Détente**: declarada; vence o jogador de maior riqueza (dinheiro + suprimentos
  + companhias + unidades + armas − empréstimos).
- **Holocausto nuclear**: `HOLOCAUST_THRESHOLD` (12) territórios nuclearizados —
  derrota coletiva.

---

## Adaptações digitais registradas

- **Conquista de território neutro por movimento.** No tabuleiro, tomar território
  exige resolver combate; aqui, mover/desembarcar um exército para um território
  **neutro sem defensores** o conquista diretamente (não há defensor para rolar
  dados). Território com dono/guarnição inimiga continua exigindo a fase de
  Combate. Implementado em `claimTerritory`.
- **Prospecção por tipo de recurso.** Conveniência digital: o jogador escolhe
  cereal/petróleo/minério e o jogo vira cartas reais do baralho até achar uma
  companhia do tipo, cobrando por carta; as não-correspondentes voltam ao baralho.
- **Estoque inicial fixo (3 × 3 × 3).** Cada jogador começa com 3 cereal, 3
  petróleo e 3 minério (`STARTING_SUPPLIES = 3`). No Random Opening do manual
  Grow, o estoque inicial de cada recurso é determinado por rolagem de 1d6
  separada. O valor fixo evita variância extrema na abertura e simplifica o setup.
- **Preço inicial de mercado fixo ($5.000).** Os três mercados abrem em
  `MARKET_START_PRICE = 5.000`. No Random Opening, cada mercado tem seu preço
  inicial definido por rolagem de dois dados (2d6 × passo). O preço fixo garante
  abertura simétrica e previsível.

---

## Divergências implementadas (2026-06-21)

Todas as 8 divergências identificadas na auditoria do manual Grow foram corrigidas:

| # | Regra | Antes | Agora | Onde |
|---|---|---|---|---|
| D1 | Preço mínimo de mercado | $1.000 | $10 | `MARKET_MIN_PRICE` |
| D2 | Preço máximo de mercado | $12.000 | $10.000 | `MARKET_MAX_PRICE` |
| D3 | Prospecção por turno | 1× | 3× (`MAX_PROSPECT_ATTEMPTS`) | `prospect()` |
| D4 | Múltiplo de empréstimo | $5.000 | $10.000 | `LOAN_MULTIPLE` |
| D5 | Juros de empréstimo | 10% | 5% | `LOAN_INTEREST_RATE` |
| D6 | Reforço do defensor pós-combate | ausente | implementado (interativo) | `performReinforcement()` |
| D7 | Contra-ataque do defensor | ausente | implementado (interativo) | `performCounterAttack()` |
| D8 | Mar costeiro — uso restrito | sem restrição | 1 jogador por zona costeira | `moveNavy()` |

**D6/D7 — resposta do defensor pós-combate (implementação interativa):**

Quando o defensor mantém o território, abre-se a fase `combat.phase === 'defender_response'`:
- **Reforço (D6):** mover exércitos de território adjacente próprio para o defendido.
  Reação defensiva sem custo de cereal (≠ movimento do Estágio 5). Uma vez por combate.
- **Contra-ataque (D7):** o defensor ataca a origem do ataque, custando 1 conjunto de
  suprimentos; é uma troca de baixas. Uma vez por combate.

Fluxos:
- **Humano ataca IA** (síncrono): a IA defensora resolve a resposta automaticamente
  (`resolveDefenderResponseAuto` — reforça do vizinho mais forte; contra-ataca conforme
  a agressividade do perfil). O resultado do contra-ataque aparece no `CombatModal`.
- **IA ataca humano** (camada de apresentação): `planAiTurn` pausa no ataque, o humano
  responde no `CombatModal` (`REINFORCE_AFTER_COMBAT` / `COUNTER_ATTACK` / `FINISH_DEFENDER_RESPONSE`).

Marcadas com `// TODO: confirmar regra original`:
- Custo de suprimentos do reforço (assumido grátis).
- Se um contra-ataque vitorioso permite **avançar** para a origem (hoje é só dano, não conquista).

**Simplificação documentada:** quando a IA ataca o humano e o humano responde, o turno
da IA **encerra** após a resposta (abre mão dos estágios opcionais restantes). Evita o
replanejamento da apresentação pré-computada e o risco de exceder o limite de 3 estágios.

**D8 — nota:** combate naval em mares costeiros ainda não implementado. Entrar em mar
costeiro já ocupado por outro jogador é bloqueado com mensagem explicativa.

## Bombardeio naval — esquadra ataca território costeiro (fiel ao manual Grow)

> "As esquadras também podem atacar os exércitos a partir de um mar azul-claro
> adjacente." — manual transcrito ([referências oficiais](referencias-oficiais.md))

Uma esquadra num **mar costeiro** (`type: 'coastal'`, "azul-claro") pode atacar os
exércitos inimigos num **território costeiro adjacente** ao mar (ex.: esquadra no
Mar Amarelo → Xantung/`shantung`). É um **bombardeio**: rola o combate normal
(atacante = esquadras; defensor = exércitos em terra) e causa baixas, mas **não
conquista o território** — navio não ocupa terra. Para tomar o território é preciso
**desembarcar um exército** depois (Estágio 5). Baixas do atacante saem das
**esquadras** na origem; baixas do defensor saem dos **exércitos** no território.

- **Restrição:** só de mar **costeiro** (mares oceânicos/`deep` não bombardeiam terra).
- **Engine:** `initiateAttack(..., bombardment = true)`; `combat.bombardment` mantém
  `targetType: 'territory'` mas redireciona as baixas do atacante para `navies`.
- **Sem ocupação nem resposta do defensor (D6/D7)** no bombardeio — simplificação de
  MVP marcada com `// TODO: confirmar regra original` em `store.ts`.
- **UI:** ao selecionar um mar costeiro próprio na fase de Combate, o painel lista os
  territórios costeiros adjacentes com inimigos como alvos de bombardeio (💥).
- Coberto por `__tests__/naval-bombardment.test.ts`.
