# Supremacia Digital — Guia para Agentes

## Regra central

**Pode mudar a cara do jogo. Não pode mudar o esqueleto do jogo.**

Arte, layout, ícones, cores, animações, experiência mobile e organização de telas são livres.
Matemática, estrutura de turnos, quantidade de territórios/mares/cartas, regras de combate e condições de vitória são protegidos.

---

## Diretrizes permanentes do projeto

- **Mobile-first.** Todo modal, carta, painel e mensagem precisa funcionar bem no celular. Tooltips não podem ser a única forma de explicar uma regra no mobile — prefira clicar e mostrar a explicação.
- **Não inventar regras novas sem marcar claramente como adaptação digital.** Use `// TODO: confirmar regra original` em vez de inventar comportamento, e marque toda simplificação de MVP com comentário explícito.
- **Antes de alterar mecânicas de jogo, consulte [`docs/regras-supremacia.md`](docs/regras-supremacia.md).**
- **Antes de alterar cartas, prospecção, produção, conquista, movimento, ataque ou mercado, verifique as referências oficiais** em [`docs/referencias-oficiais.md`](docs/referencias-oficiais.md).
- **Toda regra tem fonte única de verdade no código.** Constantes em `rulesConfig.ts`; controle de território é sempre o campo `territory.owner`; companhias/produção vêm sempre das `resourceCards`. Não duplique lógica de conquista/movimento/produção em componentes.
- **UI, log, estado do jogo e cálculos devem sempre bater.** "Minhas Cartas", produção real e recursos recebidos não podem divergir; mapa, `owner`, cor e permissão de construção não podem divergir.
- **Bugs de regra têm prioridade P0/P1** — nunca corrija só a UI quando o bug é de regra.
- **Preparado para multiplayer futuro**, mesmo que o MVP seja contra IA (ver `multiplayerSchema.md` e a Turn Presentation Layer).
- **Não copiar arte, texto longo ou material protegido** do jogo original; usar apenas como referência de regra e criar arte/interface própria.

Regras detalhadas para alterações de mecânica: [`.claude/rules/game-rules.md`](.claude/rules/game-rules.md).

---

## Fonte de verdade

Antes de alterar qualquer mecânica, leia esses arquivos — eles são a referência canônica:

| Arquivo | Conteúdo |
|---|---|
| `client/src/data/territories.ts` | 40 territórios, adjacências, portos, produção |
| `client/src/data/seaZones.ts` | 18 zonas marítimas (10 costeiras + 8 oceânicas), conexões |
| `client/src/data/resourceCards.ts` | 65 cartas (20 grão + 20 petróleo + 20 mineral + 3 nuke + 2 laser) |
| `client/src/game/rulesConfig.ts` | Todas as constantes numéricas do jogo |
| `client/src/game/types.ts` | Tipos e estrutura de dados |

---

## Inventário do jogo (estado atual)

### Superpotências (6)
`south_america`, `africa`, `europe`, `china`, `usa`, `ussr`

### Territórios (40)
Distribuídos entre as 6 superpotências + neutros. Conexões definidas em `territories.ts`.

### Zonas marítimas (18)
**Costeiras (10):** Caribe, Golfo do México, Mar do Norte, Mediterrâneo, Mar Negro, Mar Vermelho, Golfo da Guiné, Mar Amarelo, Mar do Japão, Mar da China
**Oceânicas (8):** Atlântico Norte, Atlântico Sul, Pacífico Norte, Pacífico Sul, Pacífico Leste, Oceano Índico, Ártico Atlântico, Ártico Pacífico

### Recursos (3 tipos)
`grain` (grão), `oil` (petróleo), `mineral`

### Cartas (65 total)
- 60 cartas de empresa (20 grão + 20 petróleo + 20 mineral)
- 3 cartas de ogiva nuclear
- 2 cartas de estrela laser

### Estrutura de turno (7 estágios)
| Estágio | Ação | Tipo |
|---|---|---|
| 1 | Pagar salários | Obrigatório |
| 2 | Transferir produção | Obrigatório |
| 3 | Vender recursos | Opcional |
| 4 | Combate | Opcional |
| 5 | Movimentação | Opcional |
| 6 | Construção | Opcional |
| 7 | Comprar no mercado | Opcional |

Máximo de 3 estágios opcionais por turno.

### Condições de vitória
- **Supremacia:** conquistar territórios suficientes
- **Détente:** declarar détente (riqueza calculada em unidades + cartas + armas)
- **Holocausto nuclear:** 12+ territórios nuclearizados (derrota coletiva)

---

## Classificação de mudanças

### Permitido sem autorização — mudanças visuais
- Cores, ícones, ilustrações, fontes
- Layout de painéis e telas
- Redesenho do mapa (visual, não estrutural)
- Animações e transições
- Textos explicativos e nomes de exibição
- Experiência mobile, responsividade

### Requer autorização explícita — mudanças mecânicas
- Quantidade de territórios, zonas marítimas ou cartas
- Conexões entre territórios ou mares
- Custo de qualquer ação (`rulesConfig.ts`)
- Regras de combate, movimentação ou produção
- Fases do turno ou limite de estágios opcionais
- Condições de vitória
- Produção por território

Se a mudança afeta a matemática, estratégia ou equilíbrio do jogo, **pedir confirmação antes de implementar**.

---

## Regras de implementação

**Ambiguidade de regra:** usar `// TODO: confirmar regra original` em vez de inventar comportamento.

**Simplificação provisória no MVP:** marcar com comentário explícito e não remover a estrutura que permitiria restaurar a regra fiel depois.

**Proibido:** transformar o jogo em War/Risk genérico removendo mares, fundindo territórios ou eliminando a economia de recursos.

**O motor de jogo deve sempre ler dos arquivos de fonte de verdade**, nunca hardcodar valores mecânicos fora do `rulesConfig.ts`.
