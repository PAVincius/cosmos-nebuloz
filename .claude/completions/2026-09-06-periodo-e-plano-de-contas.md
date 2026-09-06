# 2026-09-06 — Período por intervalo e plano de contas editável

Spec: docs/superpowers/specs/2026-09-06-periodo-e-plano-de-contas-design.md
Plano: docs/superpowers/plans/2026-09-06-periodo-e-plano-de-contas.md

Entregue, por task:
1. `lib/empresa/periodo.ts` — intervalo `{ de, ate }` → competências (teto 12
   meses) e segundas-feiras (teto 26 semanas), presets por aba, rótulo,
   validação e padrões por tela.
2. Modelo `ContaDoPlano` (`empresa.prisma`, migration
   `20260907000000_conta_do_plano`) e as 27 contas como seed em
   `packages/provisioning/src/plano-de-contas-nebuloz.ts`, consumidas por
   `apps/app/scripts/seed-empresa-nebuloz.ts`.
3. `lib/empresa/plano-de-contas.ts` e `lib/empresa/financeiro.ts` sem a lista
   fixa — `calcularDre(contas, lançamentos)` deriva as linhas das contas
   ativas (uma por conta nos grupos 1 e 3, uma por centro de custo nos
   grupos 4–6).
4. `components/entrada-de-data.tsx` e `components/seletor-de-periodo.tsx` —
   seletor de intervalo portado do date-range-picker-for-shadcn sobre
   `Popover`/`Calendar` do `@repo/design-system`.
5. `app/actions/empresa/financeiro.ts` — CRUD do plano de contas; DRE/caixa
   por intervalo.
6. `app/actions/empresa/cac.ts` — CAC agregado por intervalo (parcelas
   somadas, nulo se faltar mês, edição só com um mês selecionado).
7. Telas `app/(staff)/empresa/financeiro/{page,dre,caixa,plano}.tsx` e
   `app/(staff)/empresa/cac/{page,painel}.tsx` usando o seletor e as actions
   por intervalo.
8. Verificação: suite completa do backoffice (442 testes) e tsc limpo em
   backoffice/app/database/provisioning; Biome limpo nos arquivos da branch;
   `prisma migrate status` em dia; `ContaDoPlano` = 27 linhas no banco local;
   `seed-contas-prod.sql` gerado (27 INSERTs); nota adicionada em
   `docs/financeiro/plano-de-contas.md`.

Decisões em execução:
- `IntervaloSchema` (zod) ficou em `periodo.ts`, não nas actions, para
  validar `{ de, ate }` num só lugar antes de calcular competências/semanas.
- `date-fns` e `react-day-picker` entraram como dependências do
  `apps/backoffice` (não existiam ali antes do seletor de intervalo).
- Nos testes, `Popover` foi mockado via um relay de contexto — o Radix
  `Popover` real não abre o conteúdo em jsdom sem portal, e mockar
  componente a componente perdia o estado aberto/fechado entre trigger e
  conteúdo.
- No `SeletorDePeriodo`: as setas do teclado no calendário foram travadas
  para nunca sair de um mês/ano válido; o mês inicial exibido usa
  `defaultMonth` calculado localmente (evita depender de estado que ainda
  não montou); o rascunho de datas só reseta quando o popover abre (não a
  cada render), senão perdia a edição em andamento.
- `proximaOrdem` (nova conta do plano) é derivada da lista de contas já
  carregada, não de uma query `MAX(ordem)` separada.
- Cada aba (Financeiro, CAC) tem seu próprio intervalo padrão e presets —
  `intervaloPadraoCompetencia`/`intervaloPadraoCaixa` e
  `PRESETS_COMPETENCIA`/`PRESETS_CAIXA` em `periodo.ts`.

Pendente:
- Rodar `seed-contas-prod.sql` (`/private/tmp/claude-501/-Users-azos-Documents-Github-web-backoffice-my-cosmos-nebuloz--claude-worktrees-mapa-pendencias-criticas-803c5f/528f958c-2471-4cdc-b0fa-bbd55bfc6323/scratchpad/seed-contas-prod.sql`)
  contra produção só com "vai" do usuário.
- Percurso no navegador (Task 8, passo 3 — `/empresa/financeiro` com os
  presets, criar/desativar conta do plano, `/empresa/cac` com um e dois
  meses) fica para o controller, que tem sessão de staff.
