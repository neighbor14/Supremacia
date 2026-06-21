# Checklist — Auditoria de cartas, conquista e movimento

Cobertura dos casos críticos das Partes 2–8 da auditoria. Itens marcados
**[auto]** têm teste automatizado em `client/src/game/__tests__/conquest.test.ts`
(`pnpm test`). Itens **[manual]** devem ser verificados no app (mobile).

## Territórios e mapa
- [x] **[auto]** Todo território conquistável tem id único (40 territórios).
- [x] **[auto]** `central_america` existe como território terrestre.
- [x] **[auto]** `caribbean` existe como zona marítima separada (sem confusão terra/mar).
- [x] **[auto]** `central_africa`, `south_africa`, `north_africa`, `chile` existem.
- [x] **[auto]** Toda companhia referencia território existente e recurso válido.
- [ ] **[manual]** Clicar em qualquer território abre o painel consistente
  (controlador, tipo, exércitos, companhia, "pode construir?").
- [ ] **[manual]** África do Sul / "Sursidental" mostra painel e status de companhia.

## Conquista
- [x] **[auto]** Conquistar `central_america` por movimento muda `owner` para o jogador.
- [x] **[auto]** Conquistar território neutro funciona igual para África e Américas.
- [x] **[auto]** Conquistar território neutro NÃO concede companhia automaticamente.
- [x] **[auto]** Capturar território com companhia transfere a carta ao conquistador.
- [ ] **[manual]** A cor do território muda imediatamente para a do conquistador
  (a cor deriva de `territory.owner`).
- [ ] **[manual]** Toast/feedback de conquista aparece ao tomar território neutro.
- [ ] **[manual]** Build só liberado em território terrestre próprio e não nuclearizado.

## Cartas / companhias
- [x] **[auto]** Produção = soma das companhias possuídas (não dos territórios).
- [x] **[auto]** Território controlado sem companhia não produz.
- [x] **[auto]** Prospecção (genérica) revela a carta do topo do baralho.
- [x] **[auto]** Prospecção por tipo retorna uma companhia do recurso escolhido.
- [x] **[auto]** Nenhuma carta duplicada entre baralho e mão de jogador.
- [ ] **[manual]** "Minhas Cartas" mostra `N companhias` e `M territórios` separados.
- [ ] **[manual]** Painel do território distingue "companhia ativa" de "sem companhia".

## Movimento
- [x] **[auto]** `getMoveBlockReason` retorna `no_grain` com 0 cereal, `null` quando há cereal.
- [x] **[auto]** Movimento com 0 cereal é bloqueado (owner inalterado) e registrado no log.
- [x] **[auto]** Território inimigo não pode ser ocupado por movimento simples (`enemy_held`).
- [ ] **[manual]** Painel de Movimento mostra o custo em cereal e o saldo antes do clique.
- [ ] **[manual]** Tentar mover sem cereal mostra toast claro (não bloqueia em silêncio).
- [ ] **[manual]** Mensagens legíveis no mobile.

## Consistência geral
- [x] **[auto]** Mapa/owner/produção derivam de fonte única (validado pelos testes acima).
- [ ] **[manual]** Mapa × painel × log × build concordam após cada conquista.
- [ ] **[manual]** Nenhuma ação bloqueada sem motivo visível.

## Como rodar
```bash
pnpm check   # TypeScript
pnpm test    # vitest (suite acima)
pnpm build   # build de produção
```
