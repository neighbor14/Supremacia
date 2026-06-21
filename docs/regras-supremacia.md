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
