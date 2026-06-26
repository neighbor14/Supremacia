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
- **i18n obrigatório (pt/en/es) — daqui pra frente, sem exceção.** Nenhum texto novo de UI pode ser hardcoded. Todo rótulo, botão, tooltip, alerta, erro, menu, fase, tutorial e explicação vem de `client/src/i18n/locales/{pt,en,es}.json` via `useT()`/`t()`. `pt.json` é a fonte canônica de chaves; en/es são tipados contra ela (chave faltando quebra o `tsc`). **Qualquer texto novo precisa ser escrito nas três línguas no mesmo commit.** Ver [`docs/i18n.md`](docs/i18n.md).
- **Tutorial acompanha as features.** Sempre que uma feature ou função for **criada, editada, corrigida ou removida**, revise o tutorial progressivo (`ui/TutorialCoach.tsx` + chaves `tutorial.*` nos 3 idiomas) para que continue fiel ao comportamento atual: o que a fase/ação faz, quando aparece, custo e boa jogada. Tutorial desatualizado é considerado bug.

Regras detalhadas para alterações de mecânica: [`.claude/rules/game-rules.md`](.claude/rules/game-rules.md).

---

## Geração de arte (OpenRouter + Gemini)

O projeto tem uma chave OpenRouter configurada para gerar/aprimorar arte (texturas,
ícones, ilustrações de carta, marcadores de exército/frota) via modelos de imagem do
Gemini. Isso é **ferramenta de produção de assets**, não uma feature de runtime do jogo.

**Variável de ambiente:** `OPENROUTER_API_KEY` em `.env.local` (gitignored). É um
**secret de cobrança** — exemplo documentado em `.env.example`.

**Modelos de imagem disponíveis** (endpoint `POST https://openrouter.ai/api/v1/chat/completions`):
- `google/gemini-3-pro-image` — qualidade máxima (arte final).
- `google/gemini-3.1-flash-image` — rápido/barato (iteração e rascunho).
- Aceitam **imagem + texto na entrada** → dá para *editar/aprimorar* um asset
  existente (image-to-image), não só criar do zero.

**Regras invioláveis:**
- **NUNCA prefixar a chave com `VITE_`** nem usá-la em código do cliente. Vite injeta
  qualquer `VITE_*` no bundle do navegador → a chave vazaria e gastaria créditos de
  terceiros. A chave só pode ser lida por **scripts Node locais** (tempo de dev/build).
- **Geração é offline, nunca em runtime.** O jogo é um SPA estático servido por nginx,
  sem backend para esconder a chave. Fluxo correto: script local chama o Gemini →
  salva os arquivos em `client/public/` → o jogo consome assets prontos. O navegador
  e o deploy nunca tocam a chave nem a API.
- **Arte gerada respeita a Regra central:** só muda a *cara* do jogo. Não pode alterar
  matemática, contagem de territórios/mares/cartas, regras ou condições de vitória.
- **Não reproduzir arte protegida** do jogo original (ver diretriz acima); gerar arte
  própria, usando o material oficial apenas como referência de regra.
- Custo é real (não é free-tier): preferir o modelo `flash` para rascunho e só subir
  para `pro` no asset final aprovado.

**Script:** [`scripts/gen-art.mjs`](scripts/gen-art.mjs) (Node puro, sem deps — usa
`fetch` e `--env-file` nativos). Manifesto de assets dentro do próprio script.
```bash
node --env-file=.env.local scripts/gen-art.mjs            # gera o que falta
node --env-file=.env.local scripts/gen-art.mjs --force    # regera tudo
node --env-file=.env.local scripts/gen-art.mjs emblem:china   # só 1 asset
node --env-file=.env.local scripts/gen-art.mjs --pro      # modelo pro (final)
```
Pós-processo (recorte quadrado + PNG real) com `sips` nativo do macOS:
`sips -c 768 768 in.png --out tmp && sips -z 512 512 -s format png tmp --out out.png`.

**Componente de consumo:** [`ui/FactionEmblem.tsx`](client/src/ui/FactionEmblem.tsx)
renderiza `/art/emblems/<id>.png` com **fallback gracioso** para o disco colorido se o
arquivo faltar — nunca quebra a UI. Cor/identidade vêm sempre de `SUPERPOWERS`.

**Status:** chave configurada e validada. 1ª tanda concluída — 6 brasões de facção
em `client/public/art/emblems/`, integrados na Home (grid de escolha + header) e na
SetupScreen. Próximas tandas candidatas: ilustrações de carta e marcadores de unidade.

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

---

## Deployment

**LIVE:** https://supremacia.srv1031356.hstgr.cloud (VPS Hostinger com Traefik + Docker + HTTPS automático)

**Infraestrutura:**
- VPS Hostinger: 72.60.155.198
- Docker Compose com Traefik (reverse proxy)
- Container nginx:alpine para servir SPA React
- Config nginx em `/etc/nginx-supremacia.conf` (fallback `/index.html` para React Router)

**Como publicar após commit:**
```bash
./deploy.sh
```

O script faz:
1. `pnpm run build` (local)
2. Sincroniza `dist/public/` → VPS via rsync
3. Reinicia o container Docker
4. Pronto em ~10s

**Não usar Netlify** — tem limite de créditos de build. Use a VPS local.

**Para acessar a VPS direto** (não recomendado — use `deploy.sh`):
```bash
ssh root@72.60.155.198
/root/deploy-supremacia.sh  # ou qualquer comando
```

**SSH sem senha** já configurado via chave ed25519 (`~/.ssh/id_ed25519`).

**Domínio DNS:**
- Gerenciado via Hostinger
- Aponta para Traefik (ip público da VPS)
- HTTPS via Let's Encrypt (automático)
