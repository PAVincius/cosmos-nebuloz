# Tasks: Meridian V1 · Diagnose

**Input**: `specs/001-meridian-diagnose/` — [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Testes são obrigatórios**: a constituição (Princípio III) exige TDD. Em cada fase, a task de teste precede a de implementação e deve falhar antes de existir código.

**Convenção de caminhos**: raiz do worktree. `apps/app`, `packages/database`, `packages/rbac`, `packages/design-system`, `packages/storage`.

---

## Phase 1 · Setup

- [ ] T001 Adicionar `MERIDIAN` ao enum `ProductModule` em `packages/database/prisma/schema/modules.prisma`
- [ ] T002 Criar `packages/database/prisma/schema/meridian.prisma` com os 11 enums de [data-model.md](./data-model.md) (`MeridianAxis`, `MeridianAssessmentStatus`, `MeridianRespondentStatus`, `MeridianQuestionType`, `MeridianScoreStatus`, `MeridianSeverity`, `MeridianEffort`, `MeridianGapState`, `MeridianConfidence`, `MeridianRole`, `MeridianPromotionTarget`)
- [ ] T003 Adicionar os 14 modelos Meridian a `packages/database/prisma/schema/meridian.prisma`, com `tenantId`, índices e regras de `onDelete` conforme [data-model.md](./data-model.md)
- [ ] T004 Adicionar as relações inversas do Meridian ao modelo `Tenant` em `packages/database/prisma/schema/tenant.prisma` (sem incluir as duas tabelas globais de benchmark)
- [ ] T005 Rodar `pnpm migrate` e confirmar que o cliente Prisma gera sem erro
- [ ] T006 [P] Adicionar os ícones `crosshair`, `diff` e `outbound` a `packages/design-system/cosmos/icons.tsx`, usando os paths do handoff
- [ ] T007 [P] Generalizar `ensureBucket(bucket = AI_PLAYGROUND_BUCKET)` e exportar `MERIDIAN_EVIDENCE_BUCKET = "meridian-evidence"` em `packages/storage/src/index.ts`

---

## Phase 2 · Foundational (bloqueia todas as histórias)

- [ ] T008 [P] Criar `packages/rbac/src/meridian-matrix.ts` com `MeridianPermission`, `MERIDIAN_MATRIX`, `MERIDIAN_ROLE_LABEL`, `hasMeridianPermission` e `denialReason`, conforme a tabela de R-02
- [ ] T009 [P] Criar `packages/rbac/src/meridian-resolve.ts` com `getMeridianRole` e `invalidateMeridianRoleCache`, espelhando `charter-resolve.ts`
- [ ] T010 Re-exportar os símbolos do Meridian em `packages/rbac/src/index.ts`
- [ ] T011 Teste: `packages/rbac/src/__tests__/meridian-matrix.test.ts` — cada permissão concedida exatamente aos papéis da tabela; `VIEWER` sem `override.write`; papel ausente nega tudo
- [ ] T012 Criar `apps/app/lib/meridian/axes.ts` com os cinco eixos, rótulo, ícone, descrição e a ordem canônica `AXIS_IDS`
- [ ] T013 Criar `apps/app/lib/meridian/guards.ts` com `MeridianContext`, `requireModule`, `requireMeridianContext`, `requireMeridianPermission`, `MeridianRuleError` e `StateConflictError`, na ordem documentada em R-02
- [ ] T014 Teste: `apps/app/__tests__/lib/meridian-guards.test.ts` — sem sessão → `UNAUTHORIZED`; módulo não contratado → `FORBIDDEN` com mensagem de contratação; sem `MeridianMembership` → `FORBIDDEN` com mensagem de papel; papel sem permissão → `FORBIDDEN`
- [ ] T015 Criar `apps/app/app/(meridian)/actions/_shared.ts` com `Db`, `AuditDiff`, `MeridianEntity` e `logMeridianAudit(db, …)` recebendo `db` para participar da transação
- [ ] T016 Gerar `apps/app/components/meridian/meridian.css` a partir de `apps/app/components/charter/charter.css`, reescopando `.charter-root` → `.meridian-root` e `@keyframes charter-*` → `meridian-*`, e adicionar `@keyframes meridian-merPulse`
- [ ] T017 Criar `apps/app/components/meridian/base.tsx` reexportando as primitivas de `components/charter/base` usadas pelo Meridian, com o comentário que justifica o acoplamento (R-09)
- [ ] T018 [P] Criar `apps/app/components/meridian/seams.tsx` com `CONFIDENCE`, `ConfPill`, `InheritedFrom` e `AwaitingUpstream`, portados de `nebuloz-seams.jsx`
- [ ] T019 [P] Criar `apps/app/components/meridian/charts.tsx` com `ScoreRing`, `Radar` e `BenchBand`, portados do handoff
- [ ] T020 Criar `apps/app/components/meridian/shell.tsx` (`"use client"`) com `MeridianShell`, topbar, sidebar (`MER_NAV`), `TITLES`, host de modal, pilha de toasts e `ComingSoon`
- [ ] T021 Criar `apps/app/app/(meridian)/actions/shell.ts` com `getShellData()` devolvendo organização, usuário, módulos e badges (`queue`, `gapsOpen`)
- [ ] T022 Criar `apps/app/app/(meridian)/layout.tsx` com o guard, o tratamento de `AuthError` (`UNAUTHORIZED` → `/sign-in`, `FORBIDDEN` → `/meridian-indisponivel`) e a casca
- [ ] T023 Criar `apps/app/app/meridian-indisponivel/page.tsx` explicando os dois motivos de bloqueio distintos
- [ ] T024 Criar `apps/app/components/meridian/screens/registry.tsx` com o mapa `SCREENS` vazio, e `apps/app/app/(meridian)/meridian/[[...seg]]/page.tsx` com `generateMetadata` e fallback `ComingSoon`

**Checkpoint**: `/meridian` carrega a casca com nav e tema, e toda tela cai em `ComingSoon`.

---

## Phase 3 · US1 · Consultor conduz a carteira (P1)

**Meta**: carteira navegável com indicadores, filtro e detalhe com cinco abas.
**Teste independente**: dois assessments em estados diferentes; conferir indicadores, filtro e as cinco abas.

- [ ] T025 [US1] Teste: `apps/app/__tests__/actions/meridian/assessments.test.ts` — `listAssessments` filtra por `tenantId` da sessão e nunca por input; filtro de status; `createAssessment` sem permissão → `FORBIDDEN`; `createAssessment` grava `lockedAt` no template
- [ ] T026 [US1] Implementar `apps/app/app/(meridian)/actions/assessments.ts` com `listAssessments`, `getAssessment` e `createAssessment`, conforme [contracts/actions.md](./contracts/actions.md)
- [ ] T027 [US1] Implementar `apps/app/lib/meridian/composite.ts` com `compositeOf`, `scoreTone` e `confTone` — funções puras, sem I/O
- [ ] T028 [P] [US1] Criar `apps/app/components/meridian/screens/assessments.tsx` com os quatro KPIs, `FilterChips` de status, tabela com barras por eixo e estado vazio com saída
- [ ] T029 [US1] Criar `apps/app/components/meridian/screens/assessment-detail.tsx` (Server Component: carrega dados) e `assessment-detail-client.tsx` (abas), com `PageHeader` mostrando código, template, setor, faixa, prazo e consultor
- [ ] T030 [US1] Registrar `assessments` e `assessment` em `registry.tsx` e as entradas correspondentes em `TITLES`
- [ ] T031 [US1] Teste: `apps/app/__tests__/screens/meridian-assessments.test.tsx` — renderiza carteira, aplica filtro sem resultado e mostra a ação de limpar

**Checkpoint**: US1 entregue e demonstrável.

---

## Phase 4 · US2 · Coleta multi-respondente (P1)

**Meta**: atribuir respondentes por eixo, responder por link seguro, anexar evidência, fechar coleta.
**Teste independente**: atribuir três eixos, responder um por link, conferir bloqueio de fechamento nos dois eixos sem dono.

- [ ] T032 [US2] Teste: `apps/app/__tests__/lib/meridian-respondent-token.test.ts` — token de 32 bytes; só o hash é persistido; token inválido, expirado e revogado são indistinguíveis na resposta
- [ ] T033 [US2] Implementar `apps/app/lib/meridian/respondent-token.ts` com `issueToken`, `hashToken` e `resolveToken`
- [ ] T034 [US2] Teste: `apps/app/__tests__/actions/meridian/collection.test.ts` — `closeCollection` recusa com `StateConflictError` listando eixos sem dono; aceita pendências devolvendo a contagem; `revokeRespondent` invalida o token
- [ ] T035 [US2] Implementar `apps/app/app/(meridian)/actions/collection.ts` com `assignRespondent`, `revokeRespondent`, `sendReminder` e `closeCollection`
- [ ] T036 [US2] Implementar `apps/app/app/(meridian)/actions/respondent.ts` com `resolveRespondentToken`, `getBattery`, `saveDraft`, `submitBattery` e `attachEvidence` — sem sessão, tenant vindo do token
- [ ] T037 [US2] Teste: `apps/app/__tests__/actions/meridian/respondent.test.ts` — respondente do eixo Data recebe só perguntas de Data; token de outro assessment não alcança o primeiro; `submitBattery` com pendência devolve `missing > 0` e não conclui
- [ ] T038 [P] [US2] Criar `apps/app/components/meridian/screens/tab-coleta.tsx` com respondentes agrupados por eixo, marcação de eixo sem dono, progresso e ação de fechar coleta
- [ ] T039 [P] [US2] Criar `apps/app/components/meridian/screens/respondent.tsx` com a bateria (likert, sim/não, escala), anexo de evidência, salvar rascunho e enviar
- [ ] T040 [US2] Criar `apps/app/app/(meridian)/responder/[token]/page.tsx` fora do layout com guard, resolvendo o token no servidor
- [ ] T041 [US2] Registrar `respondent` no `registry.tsx` para a pré-visualização do consultor ("Ver como respondente")

**Checkpoint**: coleta funcional ponta a ponta.

---

## Phase 5 · US3 · Scoring determinístico e revisão (P1)

**Meta**: score e confidence por eixo, contestação automática, divergência lado a lado, override append-only, fila global.
**Teste independente**: rodar scoring sobre respostas divergentes, aplicar override e conferir histórico com o computado preservado.

- [ ] T042 [US3] Teste: `apps/app/__tests__/lib/meridian-scoring.test.ts` — determinismo (duas execuções idênticas); normalização por tipo, incluindo `inverted`; confidence como produto de cobertura × amostra × concordância; `spread = 0` com um respondente; eixo acima de `contestedSpread` nasce contestado
- [ ] T043 [US3] Implementar `apps/app/lib/meridian/scoring.ts` — puro, sem `Date.now`, sem `Math.random`, iterando pela ordem canônica de perguntas
- [ ] T044 [US3] Teste: `apps/app/__tests__/actions/meridian/scoring.test.ts` — `runScoring` é idempotente e não duplica gaps; deriva gap de eixo abaixo de `gapThreshold`; `listReviewQueue` traz contestados de toda a carteira do tenant
- [ ] T045 [US3] Implementar `apps/app/app/(meridian)/actions/scoring.ts` com `runScoring`, `listReviewQueue` e `getDivergence`
- [ ] T046 [US3] Teste: `apps/app/__tests__/actions/meridian/overrides.test.ts` — rationale < 20 recusado; `toScore === computed` recusado; dois overrides no mesmo eixo preservam os dois e o computado; `final` reflete o mais recente
- [ ] T047 [US3] Implementar `apps/app/app/(meridian)/actions/overrides.ts` com `registerOverride` e `listOverrides`, gravando auditoria na mesma transação
- [ ] T048 [P] [US3] Criar `apps/app/components/meridian/screens/tab-scoring.tsx` com cards de eixo (anel, confidence, spread), fila de revisão, alertas de confidence baixa, histórico de overrides e painel de determinismo
- [ ] T049 [P] [US3] Criar `apps/app/components/meridian/modals.tsx` com `OverrideModal` (slider, rationale, validação) e `DivergencePanel`
- [ ] T050 [P] [US3] Criar `apps/app/components/meridian/screens/queue.tsx` — fila de revisão global
- [ ] T051 [US3] Registrar `queue` no `registry.tsx` e em `TITLES`

**Checkpoint**: MVP completo — US1 + US2 + US3 entregam um diagnóstico defensável.

---

## Phase 6 · US4 · Gap register e plano (P2)

**Meta**: registro canônico, DAG sem ciclo, plano topológico, promoção sem transferência de posse.
**Teste independente**: criar dependência, tentar ciclo (recusado), gerar plano e verificar a invariante topológica.

- [ ] T052 [US4] Teste: `apps/app/__tests__/lib/meridian-graph.test.ts` — ciclo direto e indireto recusados com os códigos do ciclo na mensagem; auto-dependência recusada; grafo desconexo aceito
- [ ] T053 [US4] Implementar `apps/app/lib/meridian/graph.ts` com `detectCycle` (DFS tri-estado) e `topologicalOrder` (Kahn, desempate por `costOfDelay` desc e depois `code`)
- [ ] T054 [US4] Teste: `apps/app/__tests__/lib/meridian-plan.test.ts` — nenhum item em trimestre anterior ao de um pré-requisito, sobre grafos gerados; `seq` estritamente crescente ao longo das dependências
- [ ] T055 [US4] Implementar `apps/app/lib/meridian/plan.ts` com `buildPlan` e a bucketização em quatro trimestres
- [ ] T056 [US4] Teste: `apps/app/__tests__/actions/meridian/gaps.test.ts` — `linkGapDependency` recusa ciclo; `deleteGap` recusa gap com promoção ativa; `promoteGap` mantém o gap no Meridian e carrega `originGapId`; `revokePromotion` devolve o estado anterior
- [ ] T057 [US4] Implementar `apps/app/app/(meridian)/actions/gaps.ts` com `listGapRegister`, `getGap`, `upsertGap`, `deleteGap`, `linkGapDependency`, `unlinkGapDependency`, `promoteGap` e `revokePromotion`
- [ ] T058 [US4] Implementar `apps/app/app/(meridian)/actions/plan.ts` com `generatePlan` e `exportPlan` no formato de [contracts/plan-export.md](./contracts/plan-export.md)
- [ ] T059 [P] [US4] Criar `apps/app/components/meridian/screens/tab-gaps.tsx` com o grafo em colunas por profundidade, arestas em SVG, foco na vizinhança e tabela por custo de atraso
- [ ] T060 [P] [US4] Criar `apps/app/components/meridian/screens/tab-plano.tsx` com as quatro colunas de trimestre e o painel de contrato de export
- [ ] T061 [P] [US4] Criar `apps/app/components/meridian/screens/gap-register.tsx` com KPIs, três grupos de filtro, tabela responsiva e a regra de fronteira
- [ ] T062 [US4] Adicionar `GapDetail` a `apps/app/components/meridian/modals.tsx`, com confiança do achado, destino e ações de promoção
- [ ] T063 [US4] Registrar `registry` (gap register) no `registry.tsx` e em `TITLES`
- [ ] T064 [US4] Teste: `apps/app/__tests__/actions/meridian/plan-export.test.ts` — export bate campo a campo com o contrato; gap sem plano não aparece; `promoted_to` omitido quando revogado

---

## Phase 7 · US5 · Relatório, benchmark e diff (P2)

**Meta**: shape, comparação com coorte, narrativa e diff de reavaliação.
**Teste independente**: relatório de setor com coorte acima do mínimo e de setor abaixo do mínimo.

- [ ] T065 [US5] Teste: `apps/app/__tests__/lib/meridian-benchmark.test.ts` — percentis por interpolação linear; `readCohort` devolve `withheld` abaixo de 5 e **não** inclui percentis no retorno; coorte que cruza o mínimo passa a devolver percentis
- [ ] T066 [US5] Implementar `apps/app/lib/meridian/benchmark.ts` com `cohortKeyOf`, `percentiles` e `readCohort`
- [ ] T067 [US5] Implementar `apps/app/app/(meridian)/actions/report.ts` com `getReport`, `getReassessmentDiff` e `requestEvidenceUrl` (auditando antes de emitir a URL)
- [ ] T068 [US5] Teste: `apps/app/__tests__/actions/meridian/report.test.ts` — assessment sem run anterior recusa o diff; `requestEvidenceUrl` grava a trilha antes de emitir; sem permissão `evidence.read` → `FORBIDDEN`
- [ ] T069 [P] [US5] Criar `apps/app/components/meridian/screens/tab-relatorio.tsx` com radar, barras por eixo, bandas de coorte ou declaração de retenção, narrativa dos três maiores e trilha de auditoria
- [ ] T070 [P] [US5] Adicionar `ReassessDiffModal` a `apps/app/components/meridian/modals.tsx`

---

## Phase 8 · US6 · Benchmark pool (P3)

**Meta**: coortes anônimas com opt-in e limiar de leitura.
**Teste independente**: duas orgs com opt-in e uma sem; coorte permanece retida abaixo do mínimo.

- [ ] T071 [US6] Teste: `apps/app/__tests__/actions/meridian/benchmark.test.ts` — assessment sem opt-in não contribui; retirar o opt-in remove a contribuição e recalcula; nenhuma coluna do retorno identifica organização
- [ ] T072 [US6] Implementar `apps/app/app/(meridian)/actions/benchmark.ts` com `listCohorts`, `readCohort` e `contributeToBenchmark`, chamado por `runScoring`
- [ ] T073 [P] [US6] Criar `apps/app/components/meridian/screens/benchmark.tsx` com os três KPIs, tabela de coortes com marcação de retenção e as regras do pool
- [ ] T074 [US6] Registrar `benchmark` no `registry.tsx` e em `TITLES`

---

## Phase 9 · US7 · Escala de confiança (P3)

**Meta**: vocabulário único da suíte, visível e contado.

- [ ] T075 [P] [US7] Criar `apps/app/components/meridian/screens/confidence-scale.tsx` com os três níveis, distribuição sobre o registro de gaps, consumidores e a regra do vocabulário único
- [ ] T076 [US7] Registrar `confidence` no `registry.tsx` e em `TITLES`

---

## Phase 10 · Polish & Cross-Cutting

- [ ] T077 Criar `apps/app/scripts/seed-meridian.ts` reproduzindo os dados do handoff: template `v3.2`, quatro assessments nos quatro estados, divergência real no eixo Data, gaps com DAG e coortes acima e abaixo do limiar
- [ ] T078 Criar `apps/app/e2e/meridian-diagnose.spec.ts` cobrindo os dez cenários de [quickstart.md](./quickstart.md)
- [ ] T079 [P] Registrar o módulo Meridian nas superfícies existentes que listam produtos: `apps/backoffice/app/actions/services.ts` e `proposta-escopo.ts` já citam `MERIDIAN` — confirmar que passam a resolver contra o enum do Prisma sem erro de valor inválido
- [ ] T080 [P] Rodar `pnpm check`, `pnpm --filter @repo/app typecheck` e `pnpm --filter @repo/app test -- meridian`, corrigindo o que aparecer
- [ ] T081 Confirmar cobertura ≥ 80% no escopo `lib/meridian` e `app/(meridian)/actions`
- [ ] T082 Criar `.claude/completions/2026-08-28-meridian-diagnose.md` com o resumo da entrega

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
