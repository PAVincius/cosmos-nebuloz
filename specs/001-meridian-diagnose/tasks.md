# Tasks: Meridian V1 · Diagnose

**Input**: `specs/001-meridian-diagnose/` — [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Testes são obrigatórios**: a constituição (Princípio III) exige TDD. Em cada fase, a task de teste precede a de implementação e deve falhar antes de existir código.

**Convenção de caminhos**: raiz do worktree. `apps/app`, `packages/database`, `packages/rbac`, `packages/design-system`, `packages/storage`.

---

## Phase 1 · Setup

- [x] T001 Adicionar `MERIDIAN` ao enum `ProductModule` em `packages/database/prisma/schema/modules.prisma` — `packages/database/prisma/schema/modules.prisma:19`
- [x] T002 Criar `packages/database/prisma/schema/meridian.prisma` com os 11 enums — `packages/database/prisma/schema/meridian.prisma`
- [x] T003 Adicionar os 14 modelos Meridian a `packages/database/prisma/schema/meridian.prisma` — `packages/database/prisma/schema/meridian.prisma`
- [x] T004 Adicionar as relações inversas do Meridian ao modelo `Tenant` — `packages/database/prisma/schema/tenant.prisma:205-218,314`
- [ ] T005 Rodar `pnpm migrate` e confirmar que o cliente Prisma gera sem erro — não verificável estaticamente, precisa rodar
- [x] T006 [P] Adicionar os ícones `crosshair`, `diff` e `outbound` a `packages/design-system/cosmos/icons.tsx` — `packages/design-system/cosmos/icons.tsx:222-224` (nota: `diff`→`GitCompareArrows`, `outbound`→`ExternalLink`)
- [x] T007 [P] Generalizar `ensureBucket` e exportar `MERIDIAN_EVIDENCE_BUCKET = "meridian-evidence"` — `packages/storage/src/index.ts:15,21`

---

## Phase 2 · Foundational (bloqueia todas as histórias)

- [x] T008 [P] Criar `packages/rbac/src/meridian-matrix.ts` — `packages/rbac/src/meridian-matrix.ts`
- [x] T009 [P] Criar `packages/rbac/src/meridian-resolve.ts` — `packages/rbac/src/meridian-resolve.ts`
- [x] T010 Re-exportar os símbolos do Meridian em `packages/rbac/src/index.ts`
- [x] T011 Teste: `packages/rbac/src/__tests__/meridian-matrix.test.ts`
- [x] T012 Criar `apps/app/lib/meridian/axes.ts`
- [x] T013 Criar `apps/app/lib/meridian/guards.ts`
- [x] T014 Teste: guards test existe em `apps/app/__tests__/meridian/guards.test.ts` (caminho difere do spec'd `__tests__/lib/meridian-guards.test.ts`)
- [x] T015 Criar `apps/app/app/(meridian)/actions/_shared.ts`
- [x] T016 Gerar `apps/app/components/meridian/meridian.css`
- [x] T017 Criar `apps/app/components/meridian/base.tsx`
- [x] T018 [P] Criar `apps/app/components/meridian/seams.tsx`
- [x] T019 [P] Criar `apps/app/components/meridian/charts.tsx`
- [x] T020 Criar `apps/app/components/meridian/shell.tsx` — `apps/app/components/meridian/shell.tsx`
- [x] T021 Criar `apps/app/app/(meridian)/actions/shell.ts` com `getShellData()`
- [x] T022 Criar `apps/app/app/(meridian)/layout.tsx` — `apps/app/app/(meridian)/layout.tsx`
- [x] T023 Criar `apps/app/app/meridian-indisponivel/page.tsx` — `apps/app/app/meridian-indisponivel/page.tsx`
- [x] T024 Criar `apps/app/components/meridian/screens/registry.tsx` e `apps/app/app/(meridian)/meridian/[[...seg]]/page.tsx`

**Checkpoint**: `/meridian` carrega a casca com nav e tema, e toda tela cai em `ComingSoon`.

---

## Phase 3 · US1 · Consultor conduz a carteira (P1)

**Meta**: carteira navegável com indicadores, filtro e detalhe com cinco abas.
**Teste independente**: dois assessments em estados diferentes; conferir indicadores, filtro e as cinco abas.

- [ ] T025 [US1] Teste: `apps/app/__tests__/actions/meridian/assessments.test.ts` — **falta, arquivo não existe**
- [x] T026 [US1] Implementar `apps/app/app/(meridian)/actions/assessments.ts` com `listAssessments`, `getAssessment` e `createAssessment` — `apps/app/app/(meridian)/actions/assessments.ts`
- [x] T027 [US1] Implementar `apps/app/lib/meridian/composite.ts`
- [x] T028 [P] [US1] Criar `apps/app/components/meridian/screens/assessments.tsx`
- [x] T029 [US1] Criar `apps/app/components/meridian/screens/assessment-detail.tsx` e `assessment-detail-client.tsx`
- [x] T030 [US1] Registrar `assessments` e `assessment` em `registry.tsx`
- [x] T031 [US1] Teste de tela existe como `apps/app/__tests__/meridian.test.tsx` (não no caminho spec'd `__tests__/screens/meridian-assessments.test.tsx`; cobertura de filtro/empty-state não confirmada)

**Checkpoint**: US1 entregue e demonstrável.

---

## Phase 4 · US2 · Coleta multi-respondente (P1)

**Meta**: atribuir respondentes por eixo, responder por link seguro, anexar evidência, fechar coleta.
**Teste independente**: atribuir três eixos, responder um por link, conferir bloqueio de fechamento nos dois eixos sem dono.

- [x] T032 [US2] Teste: `apps/app/__tests__/lib/meridian-respondent-token.test.ts`
- [x] T033 [US2] Implementar `apps/app/lib/meridian/respondent-token.ts`
- [ ] T034 [US2] Teste: `apps/app/__tests__/actions/meridian/collection.test.ts` — **falta, arquivo não existe**
- [x] T035 [US2] Implementar `apps/app/app/(meridian)/actions/collection.ts` com `assignRespondent`, `revokeRespondent`, `sendReminder` e `closeCollection` — `apps/app/app/(meridian)/actions/collection.ts` (⚠️ `assignRespondent`:40 e `revokeRespondent`:111 sem chamador de UI — ver P0)
- [x] T036 [US2] Implementar `apps/app/app/(meridian)/actions/respondent.ts`
- [ ] T037 [US2] Teste: `apps/app/__tests__/actions/meridian/respondent.test.ts` — **falta, arquivo não existe**
- [x] T038 [P] [US2] Criar `apps/app/components/meridian/screens/tab-coleta.tsx`
- [x] T039 [P] [US2] Criar `apps/app/components/meridian/screens/respondent-form.tsx` (nome difere do spec'd `respondent.tsx`)
- [x] T040 [US2] Rota implementada em `apps/app/app/meridian-responder/[token]/page.tsx` (fora do route group `(meridian)`, caminho difere do spec'd `app/(meridian)/responder/[token]/page.tsx` — decisão deliberada, não bug)
- [x] T041 [US2] Registrado como `respondent-preview.tsx` em `registry.tsx`

**Checkpoint**: coleta funcional ponta a ponta.

---

## Phase 5 · US3 · Scoring determinístico e revisão (P1)

**Meta**: score e confidence por eixo, contestação automática, divergência lado a lado, override append-only, fila global.
**Teste independente**: rodar scoring sobre respostas divergentes, aplicar override e conferir histórico com o computado preservado.

- [x] T042 [US3] Teste: `apps/app/__tests__/lib/meridian-scoring.test.ts`
- [x] T043 [US3] Implementar `apps/app/lib/meridian/scoring.ts`
- [ ] T044 [US3] Teste: `apps/app/__tests__/actions/meridian/scoring.test.ts` — **falta, arquivo não existe**
- [x] T045 [US3] Implementar `apps/app/app/(meridian)/actions/scoring.ts` (⚠️ `runScoring` público sem chamador de UI — só `runScoringInTx` interno é usado, via `closeCollection`)
- [ ] T046 [US3] Teste: `apps/app/__tests__/actions/meridian/overrides.test.ts` — **falta, arquivo não existe**
- [x] T047 [US3] Implementar `apps/app/app/(meridian)/actions/overrides.ts` (⚠️ `listOverrides`:131 sem chamador de UI)
- [x] T048 [P] [US3] Criar `apps/app/components/meridian/screens/tab-scoring.tsx`
- [x] T049 [P] [US3] Criar `apps/app/components/meridian/modals.tsx`
- [x] T050 [P] [US3] Criar `apps/app/components/meridian/screens/queue.tsx`
- [x] T051 [US3] Registrar `queue` no `registry.tsx`

**Checkpoint**: MVP completo — US1 + US2 + US3 entregam um diagnóstico defensável.

---

## Phase 6 · US4 · Gap register e plano (P2)

**Meta**: registro canônico, DAG sem ciclo, plano topológico, promoção sem transferência de posse.
**Teste independente**: criar dependência, tentar ciclo (recusado), gerar plano e verificar a invariante topológica.

- [x] T052 [US4] Teste: `apps/app/__tests__/lib/meridian-graph.test.ts`
- [x] T053 [US4] Implementar `apps/app/lib/meridian/graph.ts`
- [x] T054 [US4] Teste: `apps/app/__tests__/lib/meridian-plan.test.ts`
- [x] T055 [US4] Implementar `apps/app/lib/meridian/plan.ts`
- [ ] T056 [US4] Teste: `apps/app/__tests__/actions/meridian/gaps.test.ts` — **falta, arquivo não existe**
- [x] T057 [US4] Implementar `apps/app/app/(meridian)/actions/gaps.ts` (⚠️ `upsertGap`:152, `deleteGap`:244, `linkGapDependency`:288, `unlinkGapDependency`:356, `revokePromotion`:470 sem chamador de UI)
- [x] T058 [US4] Implementar `apps/app/app/(meridian)/actions/plan.ts`
- [x] T059 [P] [US4] Criar `apps/app/components/meridian/screens/tab-gaps.tsx`
- [x] T060 [P] [US4] Criar `apps/app/components/meridian/screens/tab-plano.tsx`
- [x] T061 [P] [US4] Criar `apps/app/components/meridian/screens/gap-register.tsx`
- [x] T062 [US4] Adicionar `GapDetail` a `apps/app/components/meridian/modals.tsx`
- [x] T063 [US4] Registrar `registry` (gap register) no `registry.tsx`
- [ ] T064 [US4] Teste: `apps/app/__tests__/actions/meridian/plan-export.test.ts` — **falta, arquivo não existe**

---

## Phase 7 · US5 · Relatório, benchmark e diff (P2)

**Meta**: shape, comparação com coorte, narrativa e diff de reavaliação.
**Teste independente**: relatório de setor com coorte acima do mínimo e de setor abaixo do mínimo.

- [x] T065 [US5] Teste: `apps/app/__tests__/lib/meridian-benchmark.test.ts`
- [x] T066 [US5] Implementar `apps/app/lib/meridian/benchmark.ts`
- [x] T067 [US5] Implementar `apps/app/app/(meridian)/actions/report.ts` (⚠️ `requestEvidenceUrl`:264 sem chamador de UI)
- [ ] T068 [US5] Teste: `apps/app/__tests__/actions/meridian/report.test.ts` — **falta, arquivo não existe**
- [x] T069 [P] [US5] Criar `apps/app/components/meridian/screens/tab-relatorio.tsx`
- [x] T070 [P] [US5] Adicionar `ReassessDiffModal` a `apps/app/components/meridian/modals.tsx`

---

## Phase 8 · US6 · Benchmark pool (P3)

**Meta**: coortes anônimas com opt-in e limiar de leitura.
**Teste independente**: duas orgs com opt-in e uma sem; coorte permanece retida abaixo do mínimo.

- [ ] T071 [US6] Teste: `apps/app/__tests__/actions/meridian/benchmark.test.ts` — **falta, arquivo não existe**
- [x] T072 [US6] Implementar `apps/app/app/(meridian)/actions/benchmark.ts` (⚠️ `withdrawContribution`:98 e `readCohortAction`:151 sem chamador de UI)
- [x] T073 [P] [US6] Criar `apps/app/components/meridian/screens/benchmark.tsx`
- [x] T074 [US6] Registrar `benchmark` no `registry.tsx`

---

## Phase 9 · US7 · Escala de confiança (P3)

**Meta**: vocabulário único da suíte, visível e contado.

- [x] T075 [P] [US7] Criar `apps/app/components/meridian/screens/confidence-scale.tsx`
- [x] T076 [US7] Registrar `confidence` no `registry.tsx`

---

## Phase 10 · Polish & Cross-Cutting

- [x] T077 Criar `apps/app/scripts/seed-meridian.ts` — `apps/app/scripts/seed-meridian.ts` (⚠️ 101 linhas não commitadas do Crivo em cima do script, ver `.claude/completions/` mais recente — decisão pendente: vira fixture de teste ou sai)
- [x] T078 Criar `apps/app/e2e/meridian-diagnose.spec.ts` — existe (mais `meridian-dogfood.spec.ts` não commitado)
- [x] T079 [P] Registrar o módulo Meridian nas superfícies existentes — `services.ts`/`proposta-escopo.ts` validam contra o enum do Prisma genericamente
- [ ] T080 [P] Rodar `pnpm check`, `pnpm --filter @repo/app typecheck` e `pnpm --filter @repo/app test -- meridian` — não verificável estaticamente, precisa rodar
- [ ] T081 Confirmar cobertura ≥ 80% no escopo `lib/meridian` e `app/(meridian)/actions` — não verificável estaticamente; 9 arquivos de teste de action estão faltando (ver T025/T034/T037/T044/T046/T056/T064/T068/T071), cobertura provavelmente abaixo do alvo
- [x] T082 Criar `.claude/completions/2026-08-28-meridian-diagnose.md`

---

## Dependências

```
Phase 1 (Setup) ──► Phase 2 (Foundational) ──┬─► Phase 3 (US1) ──► Phase 4 (US2) ──► Phase 5 (US3) ──┬─► Phase 6 (US4) ──► Phase 7 (US5)
                                             │                                                       │
                                             └───────────────────────────────────────────────────────┴─► Phase 8 (US6) ──► Phase 9 (US7)
                                                                                                                             │
                                                                                                                             ▼
                                                                                                                    Phase 10 (Polish)
```

- US2 depende de US1 (o detalhe do assessment é onde a aba de coleta vive).
- US3 depende de US2 (sem resposta não há score).
- US4 depende de US3 (gaps nascem do scoring).
- US5 depende de US3 e US4 (o relatório mostra scores e narrativa de gaps).
- US6 é independente de US4 e US5 — só precisa de US3.
- US7 depende de US4 apenas para a contagem por nível; a tela em si é autônoma.

## Paralelismo

- **Phase 1**: T006 e T007 em paralelo com T001–T005.
- **Phase 2**: T008/T009 em paralelo; T018/T019 em paralelo depois de T012.
- **Phase 3**: T028 em paralelo com T026/T027.
- **Phase 4**: T038 e T039 em paralelo depois de T035/T036.
- **Phase 5**: T048, T049 e T050 em paralelo depois das actions.
- **Phase 6**: T059, T060 e T061 em paralelo depois de T057/T058.
- **Phase 7**: T069 e T070 em paralelo depois de T067.

## Estratégia de entrega

**MVP = Phases 1, 2, 3, 4 e 5** (US1 + US2 + US3): a consultora conduz um assessment do convite ao score revisado, com override auditável. É o produto mínimo que já sobrevive à pergunta do patrocinador.

**Incremento 2 = Phases 6 e 7** (US4 + US5): gap register, plano e relatório — o que o cliente leva embora.

**Incremento 3 = Phases 8 e 9** (US6 + US7): benchmark e vocabulário — diferencial de suíte, não bloqueia nenhum fluxo.
