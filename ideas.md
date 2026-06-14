# Brainstorm de Design — Supremacia Digital Interna

## Três Abordagens Estilísticas

### 1. "War Room" — Sala de Comando Militar
Estética de centro de comando militar dos anos 80, com monitores CRT verdes, grades de radar, tipografia monospace e efeitos de fósforo. Evoca tensão da Guerra Fria e decisões de alto risco.
**Probabilidade:** 0.04

### 2. "Atlas Tático" — Cartografia Geopolítica Moderna
Inspirado em mapas geopolíticos de think-tanks e dashboards de inteligência contemporâneos. Cores sóbrias, tipografia condensada, linhas finas e dados densos apresentados com clareza cirúrgica. Visual de briefing presidencial.
**Probabilidade:** 0.06

### 3. "Neon Doctrine" — Retrofuturismo Estratégico
Mistura de estética synthwave com infográficos militares. Fundo escuro com acentos neon, tipografia bold geométrica, e elementos de HUD (heads-up display). Sensação de jogo de estratégia cyberpunk.
**Probabilidade:** 0.03

---

## Abordagem Escolhida: "Atlas Tático" — Cartografia Geopolítica Moderna

### Design Movement
Inspirado no **Swiss International Style** aplicado a cartografia militar moderna — precisão tipográfica, hierarquia clara, uso funcional de cor, e densidade informacional sem ruído visual.

### Core Principles
1. **Clareza sob pressão** — Toda informação crítica visível em 1 segundo; nenhum elemento decorativo que não sirva ao gameplay.
2. **Densidade controlada** — Muitos dados em pouco espaço, mas com hierarquia impecável de peso visual.
3. **Cor como dado** — Cada cor comunica pertencimento (superpotência), estado (em guerra, neutro, destruído) ou recurso (cereal, petróleo, minério).
4. **Toque preciso** — Áreas de toque generosas (mínimo 44px), feedback tátil imediato, zero ambiguidade sobre o que foi selecionado.

### Color Philosophy
Fundo escuro (slate-900/950) para reduzir fadiga em sessões longas e maximizar contraste do mapa. Cada superpotência recebe uma cor saturada distinta que funciona tanto em preenchimento de território quanto em texto/ícone:
- **Confederação Sul-Americana**: Esmeralda (#10b981)
- **Federação Africana**: Âmbar (#f59e0b)
- **Liga Europeia**: Safira (#3b82f6)
- **República da China**: Carmesim (#ef4444)
- **Estados Unidos**: Prata/Branco (#e2e8f0)
- **União Soviética**: Rubi (#dc2626 com tom mais frio)

Recursos: Cereal = dourado-trigo, Petróleo = preto-azulado, Minério = cinza-metálico.
Neutros: slate-600 com borda pontilhada.

### Layout Paradigm
**Mapa-central com painéis periféricos recolhíveis.** O mapa SVG ocupa 100% da viewport como elemento principal. Informações contextuais aparecem em bottom-sheets (mobile) ou painéis laterais (desktop) que deslizam sobre o mapa sem removê-lo da vista. A barra de fase do turno fica fixa no topo como uma timeline horizontal compacta.

### Signature Elements
1. **Linhas de grade cartográficas** — Grid sutil no fundo do mapa com coordenadas, evocando cartas náuticas reais.
2. **Indicadores de pulso** — Territórios em conflito ou sob ameaça nuclear pulsam suavemente com um halo da cor do atacante.
3. **Tipografia de briefing** — Números grandes e bold para dados críticos (saldo, tropas), labels em caps condensadas.

### Interaction Philosophy
Interações são **diretas e confirmáveis**. Toque em território = seleção imediata com highlight. Ações irreversíveis (ataque, bomba) exigem confirmação explícita com countdown visual. Transições entre fases do turno são marcadas por um flash sutil na barra de timeline. Arrastar para mover unidades (futuro), tap-tap para selecionar origem-destino.

### Animation
- Transições de fase: slide horizontal da barra de turno (200ms, ease-out).
- Seleção de território: scale(1.02) + borda luminosa (150ms).
- Dados de combate: rotação 3D simulada com números finais (400ms).
- Explosão nuclear: flash branco → fade para ícone de cogumelo (600ms).
- Bottom sheet: spring animation com vaul (300ms).
- Nenhuma animação bloqueia input por mais de 500ms.

### Typography System
- **Display/Headers**: "Barlow Condensed" (700, 600) — geométrica, condensada, militar.
- **Body/Data**: "IBM Plex Sans" (400, 500) — legível em tamanhos pequenos, técnica.
- **Mono/Numbers**: "JetBrains Mono" — para valores monetários e contagens.
- Hierarquia: H1 (fase do turno) > H2 (painel ativo) > H3 (sub-seção) > Body > Caption.

### Brand Essence
**Supremacia Digital** é um simulador de geopolítica nuclear para estrategistas mobile que querem profundidade de jogo de tabuleiro com a fluidez de um app moderno — sóbrio, denso e viciante.
Personalidade: **Preciso. Tenso. Imersivo.**

### Brand Voice
Headlines e CTAs soam como briefings militares concisos, nunca como marketing genérico.
- "Fase de Ataque — Selecione o alvo."
- "Suprimentos insuficientes. Construção cancelada."
Proibido: "Bem-vindo!", "Comece agora!", "Divirta-se!"

### Wordmark & Logo
Símbolo: Um hexágono estilizado com seis segmentos (representando as 6 superpotências) formando um globo abstrato. Linhas finas, geométrico, sem texto. Funciona em 24px e em 64px.

### Signature Brand Color
**Slate-900 (#0f172a)** como cor de fundo dominante — o "canvas" sobre o qual todo o jogo se desenrola. É a cor que define a marca: escura, séria, profissional.
