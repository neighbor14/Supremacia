# Regras para alterações em mecânicas de jogo

Instruções específicas para qualquer agente que altere regras do Supremacia
Digital. Complementa `CLAUDE.md`, `docs/regras-supremacia.md` e
`docs/referencias-oficiais.md`.

## Princípios

- **Sempre auditar estado lógico e estado visual juntos.** Nunca corrigir apenas a
  UI se o bug for de regra. Um bug "visual" (cor errada, painel divergente) quase
  sempre é um sintoma de estado lógico inconsistente.
- **Fonte única de verdade:**
  - Controle de território = `territory.owner`. A cor do mapa, a lista de
    territórios e a permissão de construção **derivam** desse campo. Nunca manter
    um "estado visual" separado que possa desatualizar.
  - Companhia/produção = `resourceCards` (com `ownerId` e `territoryId`).
  - Constantes numéricas = `rulesConfig.ts`.
  - Validação de movimento = `getMoveBlockReason` (store).
  - Conquista/captura = `claimTerritory` (store). Não duplicar conquista em
    componentes.

## Identidade (ids únicos)

- Todo território tem **id canônico único** consistente entre mapa/SVG, game
  state, cartas, log, movimento, conquista, construção e painel. O mesmo id é
  usado em todos os lugares (ex.: `central_america`, `central_africa`,
  `south_africa`). O nome exibido (`name`) é só rótulo.
- Toda carta tem **id único** consistente entre baralho, jogador, produção e log.
- Território terrestre vs zona marítima são datasets separados (`territories.ts`
  vs `seaZones.ts`). Regra terrestre não se aplica a mar; ação naval não captura
  terra. Ex.: `central_america` (terra) ≠ `caribbean` (mar).

## Invariantes que não podem divergir

- "Minhas Cartas" × produção real × recursos recebidos.
- Mapa × `owner` × cor do território × permissão de construção × painel × log.
- Uma mesma carta não pode estar ao mesmo tempo no baralho e na mão de um jogador.
- Uma mesma companhia não pode produzir para dois jogadores.
- Território não pode indicar companhia ativa sem a carta existir em estado válido.
- Nenhuma ação pode ser bloqueada em silêncio — sempre há motivo visível (a regra
  retorna o motivo; a UI mostra esse motivo, não uma mensagem genérica).

## Processo

1. Se a mudança afeta matemática, estratégia ou equilíbrio, **pedir confirmação**
   antes de implementar (ver classificação em `CLAUDE.md`).
2. Ambiguidade de regra → `// TODO: confirmar regra original`, não inventar.
3. Simplificação de MVP → comentário explícito, sem remover a estrutura que
   permita restaurar a regra fiel depois.
4. Ao implementar/corrigir regra, **criar testes automatizados** (vitest, ver
   `client/src/game/__tests__/`) ou um checklist manual documentado em
   `docs/checklists/`.
5. Rodar `pnpm check` (tsc) e `pnpm test` (vitest) antes de concluir.
