---
description: "Task list — Scaffold, framework de adoção em trilhas guiadas"
---

# Tasks: Scaffold — framework de adoção em trilhas guiadas

**Input**: `specs/002-scaffold-adoption/` — [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: **obrigatórios**. A constituição §III torna TDD non-negotiable — a task
de teste precede a de implementação em toda fatia. O gate engine (US2) é
**Crítico** no BMAD-TEA: unit + integration + e2e + negative.

**Organization**: uma fase por fatia do plano (US1..US8), em ordem de dependência.

**R1 confirmada (2026-09-02)**: Scaffold é produto. As oito fatias valem.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável — arquivo diferente, sem dependência pendente
- **[Story]**: US1..US8, mapeando a fatia do plano

## Path Conventions

Monorepo pnpm + Turborepo. Caminhos reais:

- Schema: `packages/database/prisma/schema/`
- App do cliente: `apps/app/app/(scaffold)/`, `apps/app/components/scaffold/`, `apps/app/lib/scaffold/`
- Back-office: `apps/backoffice/app/scaffold-supervision/`
- Testes: `apps/app/__tests__/scaffold/`, `apps/app/e2e/`

---

## ⚠️ Regras que valem para toda task

1. **Guard triplo em cada action**: `requireTenantSession(await headers())` →
   módulo `SCAFFOLD` contratado → papel `ScaffoldRole`. Layout protege
   navegação, não protege RPC.
2. **`Result<T>`, nunca throw** para erro de domínio (constituição §II).
3. **`tenantId` sempre da sessão**, nunca do payload (constituição §I).
4. **Zod em todo boundary**, reusando `apps/app/app/actions/_base.ts`
   (`nnStr`, `optStr`, `cuid`, `isoDate`) — nunca duplicar primitivo.
5. **`logAudit` fire-and-forget** em toda transição, sign-off e override (SN-03).
6. **Teste antes**: escrever → ver falhar (RED) → implementar (GREEN) → refatorar.
7. **Completion doc** por fatia em `.claude/completions/YYYY-MM-DD-scaffold-<fatia>.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: schema, migration e gate de contratação. Nada aqui depende de tela.

- [x] T001 Criar `packages/database/prisma/schema/scaffold.prisma` com o cabeçalho de contexto e os 11 enums de [data-model.md](data-model.md) §Enums (`ScaffoldPhase`, `ScaffoldPhaseState`, `ScaffoldStepState`, `ScaffoldGateOutcome`, `ScaffoldTrackStatus`, `ScaffoldRole`, `ScaffoldArchetype`, `ScaffoldBusinessCaseState`, `ScaffoldMetricDirection`, `ScaffoldMetricConfidence`, `ScaffoldBenefitKind`, `ScaffoldOverlayOp`)
- [x] T002 Adicionar `SCAFFOLD` ao `enum ProductModule` em `packages/database/prisma/schema/modules.prisma`, com comentário `///` registrando que `ProductModule` governa **acesso** e `PrecoDeModulo` governa **preço recorrente** — entrar num sem entrar no outro é coerente (research §R2)
- [x] T003 Rodar `pnpm migrate` (prisma format + generate + db push) e confirmar que o client tipado expõe os enums novos
- [x] T004 [P] Criar `apps/app/app/scaffold-indisponivel/page.tsx` espelhando `apps/app/app/meridian-indisponivel/`, com as duas mensagens distintas: módulo não contratado (comercial) e papel ausente (peça a um consultor)
- [x] T005 [P] Criar `apps/app/components/scaffold/scaffold.css` portando os tokens de `scaffold.html`: paleta Nebuloz (`--canvas:#07080c`, sky/baby/butter), `[data-theme="light"]` e `[data-theme="dark"]`, classes `.kpi`, `.lift`, `.navitem`, `.btn`, `.scroll`, `.mono`, `.display`, `.skeleton`, e o bloco `@media (pointer:coarse)` de alvo de toque 44px (WCAG 2.5.8 / SN-10)
- [x] T006 [P] Criar `apps/app/__tests__/scaffold/.gitkeep` e registrar o path no config do Vitest de `apps/app`, se houver allowlist de diretórios

**Checkpoint**: schema no banco, módulo gateável, tokens de tema prontos.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: acesso, guard e modelo de membership. **Nenhuma US começa antes disto.**

**⚠️ CRITICAL**: bloqueia todas as fatias.

- [x] T007 Adicionar `model ScaffoldMembership` (`id`, `tenantId`, `userId`, `role: ScaffoldRole`, `@@unique([tenantId, userId])`, `@@index([tenantId])`) em `packages/database/prisma/schema/scaffold.prisma`, espelhando `MeridianMembership`
- [x] T008 Escrever `apps/app/__tests__/scaffold/guard.test.ts` (RED): sessão ausente → `UNAUTHORIZED`; módulo `SCAFFOLD` não contratado → `FORBIDDEN`; papel `ScaffoldRole` ausente → `FORBIDDEN`; os três portões repetidos fora do layout
- [x] T009 Implementar `apps/app/app/(scaffold)/actions/_shared.ts` com o guard triplo reutilizável (`requireScaffoldAccess(role?)`), espelhando `apps/app/app/(meridian)/actions/_shared.ts` — faz T008 passar
- [x] T010 Implementar `apps/app/app/(scaffold)/actions/shell.ts` com `getShellData()` → `{ user, organization, modules, badges, role }`, badges vazios por ora (preenchidos em US6)
- [x] T011 Implementar `apps/app/app/(scaffold)/layout.tsx` com o guard: `AuthError.UNAUTHORIZED` → `/sign-in`, `FORBIDDEN` → `/scaffold-indisponivel`; importar `scaffold.css`
- [x] T012 [P] Criar `apps/app/lib/scaffold/errors.ts` com os erros nomeados de [contracts/server-actions.md](contracts/server-actions.md): `GAP_ALREADY_PROMOTED`, `OVERLAY_HAS_UNRESOLVED_CONFLICT`, `TEMPLATE_HAS_NO_PUBLISHED_VERSION`, `STEPS_INCOMPLETE`, `CRITERIA_UNMET`, `BASELINE_NOT_SIGNED`, `CHARTER_POLICY_NOT_ACKED`, `RATIONALE_REQUIRED`, `UNMET_CRITERIA_REQUIRED`, `VERSION_IMMUTABLE`, `NOT_SIGNED`
- [x] T013 [P] Criar `apps/app/lib/scaffold/schemas.ts` com os primitivos Zod do domínio, **importando** `nnStr`/`optStr`/`cuid`/`isoDate` de `apps/app/app/actions/_base.ts` (constituição §IV — nunca duplicar)
- [x] T014 [P] Escrever `apps/app/__tests__/scaffold/tenant-isolation.test.ts` (RED, cresce a cada fatia): tenant A não lê trilha, passo, artefato nem caso de negócio do tenant B por nenhuma action — SC-005
- [x] T015 [P] Escrever `apps/app/__tests__/scaffold/adr-0013-boundary.test.ts`: falha se qualquer arquivo sob `apps/app/` importar `platformDb` ou `@repo/provisioning` — reforço local da ADR-0013 (research §R4)
- [x] T016 Criar `apps/app/components/scaffold/screens/registry.ts` com `SCREENS: Record<string, ComponentType<{param?: string}>>` vazio e `TITLES` portado de `SC_TITLES` (`portfolio`, `supervision`, `templates`, `track`, `baselines`, `baseline`)

**Checkpoint**: guard verde, fronteira ADR-0013 testada, registry pronto para receber telas.

---

## Phase 3: User Story 1 — Ligação Meridian → trilha (Priority: P0) 🎯 MVP

**Goal**: uma lacuna promovida no Meridian aterrissa como trilha real, com as
quatro fases instanciadas e `MeridianGapPromotion.targetEntityId` preenchido.
Fecha **S-01**.

**Independent Test**: promover uma `MeridianGap` com `targetProduct = SCAFFOLD`
e verificar no banco: existe `ScaffoldTrack` com `sourceGapId`, quatro
`ScaffoldPhaseInstance` (`ASSESS` em `OPEN`, demais `IDLE`), passos copiados da
versão de template pinada, e `targetEntityId = track.id`.

**Por que é o MVP**: é a única fatia sobre a qual as duas leituras de escopo
(produto e ligação) concordam — ver research §R1.

### Tests for User Story 1 ⚠️

> Escrever primeiro, ver falhar.

- [x] T017 [P] [US1] Escrever `apps/app/__tests__/scaffold/track-seed.test.ts`: `createTrackFromGap` cria trilha + 4 fases + passos copiados, numa transação; rollback deixa o banco limpo
- [x] T018 [P] [US1] Adicionar a `track-seed.test.ts` os casos negativos: `GAP_ALREADY_PROMOTED` (lacuna já com `targetEntityId`), `TEMPLATE_HAS_NO_PUBLISHED_VERSION`, `OVERLAY_HAS_UNRESOLVED_CONFLICT`
- [x] T019 [P] [US1] Escrever `apps/app/__tests__/scaffold/step-copy.test.ts`: `statement` e `expectedArtefact` do `ScaffoldStepInstance` são **cópia** do `ScaffoldStepTemplate`, não join — provado alterando o template depois e relendo a trilha (base de ST-03)

### Implementation for User Story 1

- [x] T020 [P] [US1] Adicionar `model ScaffoldTrack` em `packages/database/prisma/schema/scaffold.prisma` conforme [data-model.md](data-model.md) §ScaffoldTrack, incluindo `@@unique([tenantId, code])`, `@@index([tenantId, status])` e `@@index([tenantId, lastGateAt])`, com o comentário `///` explicando por que `sourceGapId` é `String?` e não FK
- [x] T021 [P] [US1] Adicionar `model ScaffoldPhaseInstance` com `@@unique([trackId, phase])`, `observationEndsAt`, `reopenedAt`, `reopenCount`
- [x] T022 [P] [US1] Adicionar `model ScaffoldStepInstance` com `statement`, `expectedArtefact`, `required @default(true)`, `seq`, e o comentário `///` de por que o texto é copiado
- [x] T023 [US1] Adicionar os modelos mínimos de template que o seed exige — `ScaffoldTemplate`, `ScaffoldTemplateVersion`, `ScaffoldStepTemplate`, `ScaffoldGateCriterion` — sem overlay ainda (overlay é US5); `ScaffoldTemplateVersion` **sem** `updatedAt` (ST-01)
- [x] T024 [US1] Rodar `pnpm migrate` e confirmar as tabelas
- [x] T025 [P] [US1] Criar `packages/database/prisma/seed/scaffold-templates.ts` com os três arquétipos do protótipo — `triage v3`+`v4`, `docreview v2`, `reporting v3` — cada um com as quatro fases, passos e critérios de `scaffold-data.jsx`/`PHASE`; registrar o script `seed:scaffold` no `package.json` de `@repo/database`
- [x] T026 [US1] Implementar `apps/app/app/(scaffold)/actions/tracks.ts` com `createTrackFromGap({ gapId, promotionId, templateId, overlayId?, processName, ownerId, archetype? })` — transação única: cria trilha, 4 fases, copia passos da versão pinada, grava `MeridianGapPromotion.targetEntityId = trackId`
- [x] T027 [US1] Adicionar `createTrack` (sem lacuna de origem) e `getTrack({ trackId })` retornando `TrackDetail` ao mesmo arquivo
- [x] T028 [US1] Adicionar `cancelTrack({ trackId, rationale })` — `status = CANCELLED`, nunca delete; recusa se houver caso de negócio `SIGNED` sem decisão explícita (o guard efetivo entra em US4; por ora, comentário `TODO(US4)` no ponto exato)
- [x] T029 [US1] Ligar a promoção do lado do Meridian: em `apps/app/app/(meridian)/actions/gaps.ts`, a promoção com `targetProduct = SCAFFOLD` passa a chamar `createTrackFromGap` e recusa revogação com trilha ativa, com mensagem que diz o porquê (mesmo princípio do `Restrict` do `Engagement`)
- [x] T030 [US1] Estender `apps/app/__tests__/scaffold/tenant-isolation.test.ts` para cobrir `getTrack` e `cancelTrack` cross-tenant

**Checkpoint**: US1 entregável sozinha. A ligação que `docs/produto/scaffold-prd.md` pede existe.

---

## Phase 4: User Story 2 — Gate engine (Priority: P0)

**Goal**: fase só fecha com critérios atendidos ou override atribuído. Fecha
**S-02, S-03, SG-01, SG-02, SG-03, SG-07**.

**Independent Test**: rodar `gates-negative.test.ts` — toda linha do contrato de
bloqueio falha pelo erro nomeado correto, e `gates-architecture.test.ts` passa.

**Depende de**: US1 (precisa de trilha com fases e passos).

> **Esta fatia é o produto.** O SRD nomeia o bloqueio de gate como *o* produto e
> classifica caminho que feche fase sem registro como defeito de correção de
> severidade máxima — não atalho de UX.

### Tests for User Story 2 ⚠️

- [x] T031 [P] [US2] Escrever `apps/app/__tests__/scaffold/gate-machine.test.ts`: transições puras de [data-model.md](data-model.md) §Máquina de estados, **sem banco** — `IDLE→OPEN→GATE_READY→CLOSED`, `GATE_READY→BLOCKED→CLOSED` via override, `CLOSED→REOPENED→OPEN`, e que nenhuma transição pula fase
- [x] T032 [P] [US2] Escrever `apps/app/__tests__/scaffold/gates-negative.test.ts` — **a suíte que prova o produto**: uma asserção por linha da tabela de [contracts/server-actions.md](contracts/server-actions.md) §Contrato de bloqueio — `STEPS_INCOMPLETE` (SG-01), `CRITERIA_UNMET` (SG-02), `RATIONALE_REQUIRED` com string vazia **e** só espaços (SG-03), `UNMET_CRITERIA_REQUIRED` com lista vazia (SG-03)
- [x] T033 [P] [US2] Escrever `apps/app/__tests__/scaffold/gates-architecture.test.ts`: varre o source de `apps/app/` e falha se `ScaffoldPhaseState.CLOSED` (ou a string `"CLOSED"` em atribuição de `state`) aparecer fora de `closePhase()` em `apps/app/app/(scaffold)/actions/gates.ts`
- [x] T034 [P] [US2] Escrever `apps/app/__tests__/scaffold/gates-append-only.test.ts` (SG-07): nenhuma action expõe `update` ou `delete` de `ScaffoldGateResult` / `ScaffoldGateOverride`; reabrir cria registro novo e deixa o anterior intacto
- [x] T035 [P] [US2] Escrever `apps/app/__tests__/scaffold/gates-integration.test.ts`: ciclo `ASSESS` completo contra o banco — passos → `GATE_READY` → `closePhase` → `GateResult` com `criteriaSnapshot` congelado

### Implementation for User Story 2

- [x] T036 [P] [US2] Adicionar `model ScaffoldGateResult` (`phaseInstanceId @unique`, `outcome`, `approverId`, `decidedAt`, `criteriaSnapshot Json`, **sem `updatedAt`**) em `scaffold.prisma`, com o comentário `///` de por que o snapshot congela
- [x] T037 [P] [US2] Adicionar `model ScaffoldGateOverride` (`gateResultId @unique`, `actorId`, `unmetCriteria String[]`, `rationale @db.Text`, `createdAt`) em `scaffold.prisma`
- [x] T038 [US2] Rodar `pnpm migrate`
- [x] T039 [US2] Implementar `apps/app/lib/scaffold/gate-machine.ts` — funções puras `canEnterGateReady(steps)`, `evaluateCriteria(criteria, facts)`, `nextState(current, event)`, sem import de Prisma — faz T031 passar
- [x] T040 [US2] Implementar `evaluateGate({ phaseInstanceId })` em `apps/app/app/(scaffold)/actions/gates.ts` → `{ criteria, canClose, blockers }`
- [x] T041 [US2] Implementar `closePhase({ phaseInstanceId, approverId, criteriaSnapshot })` — **única** função autorizada a escrever `state = CLOSED`; recusa com `STEPS_INCOMPLETE` (SG-01) e `CRITERIA_UNMET` (SG-02); grava `GateResult` com snapshot congelado e `lastGateAt` na trilha
- [x] T042 [US2] Implementar `overridePhase({ phaseInstanceId, unmetCriteria, rationale })` — valida `rationale.trim()` não-vazia (`RATIONALE_REQUIRED`) e lista não-vazia (`UNMET_CRITERIA_REQUIRED`); grava `GateResult(outcome: OVERRIDDEN)` + `GateOverride`, e delega o fechamento a `closePhase` (SG-03)
- [x] T043 [US2] Implementar `reopenPhase({ phaseInstanceId, rationale })` — `reopenCount++`, novo ciclo; **não** toca em `GateResult` anterior (SG-07)
- [x] T044 [US2] Adicionar os pontos de extensão de `closePhase` que as fatias seguintes preenchem, como guards explícitos que hoje passam: `assertBaselineSigned()` (US4/SG-04) e `assertCharterPolicyAcked()` (US7/SG-05), cada um com `TODO(US4)`/`TODO(US7)` nomeando a task
- [x] T045 [US2] Adicionar `logAudit` fire-and-forget em `closePhase`, `overridePhase` e `reopenPhase` (SN-03) — falha de audit não derruba a transição (constituição §II)
- [x] T046 [US2] Adicionar Zod em toda entrada de `gates.ts`, reusando `apps/app/lib/scaffold/schemas.ts`
- [x] T047 [US2] Estender `tenant-isolation.test.ts` para `evaluateGate`, `closePhase`, `overridePhase`, `reopenPhase`
- [x] T048 [US2] Escrever `.claude/completions/YYYY-MM-DD-scaffold-gate-engine.md` registrando a invariante e o teste de arquitetura que a sustenta

**Checkpoint**: o invariante do produto existe e é testado. US1+US2 = fatia mínima defensável.

---

## Phase 5: User Story 3 — Shell, portfólio e detalhe de trilha (Priority: P0/P1)

**Goal**: as duas primeiras telas de cliente. Fecha **S-04, S-07**.

**Independent Test**: `http://localhost:3012/scaffold` lista as trilhas com fase,
dono, bloqueio e dias de estagnação; clicar abre o detalhe com as quatro fases,
passos e o painel de gate.

**Depende de**: US2 (o detalhe renderiza `evaluateGate`).

### Tests for User Story 3 ⚠️

- [x] T049 [P] [US3] Escrever `apps/app/__tests__/scaffold/screens-registry.test.ts`: toda chave de `TITLES` tem entrada em `SCREENS` ou cai em `ComingSoon`; nenhuma tela é importada pelo shell `"use client"`
- [x] T050 [P] [US3] Escrever `apps/app/__tests__/scaffold/metadata.test.ts`: `generateMetadata` devolve `"<title> | <parent> · Scaffold"` para cada id — sem isso toda aba lê `localhost:3012` e o axe acusa em todas as telas
- [x] T051 [P] [US3] Escrever `apps/app/__tests__/scaffold/portfolio-query.test.ts`: `listTracks` filtra por `status`/`phase`/`archetype`/`ownerId` e deriva `stalledDays` de `lastGateAt`

### Implementation for User Story 3

- [x] T052 [US3] Implementar `apps/app/app/(scaffold)/scaffold/[[...seg]]/page.tsx` — rota única, `seg[0]` = tela, `seg[1]` = id de detalhe, mais `generateMetadata` (portar o comentário do Meridian explicando por que ela existe)
- [x] T053 [US3] Implementar `apps/app/components/scaffold/shell.tsx` `"use client"` — topbar com `ScBrand` + breadcrumb + toggle de tema, sidebar com as três seções de `SC_NAV` (Adoção / Supervisão / Método) e o card de estagnação; recebe `screenIds: string[]`, **nunca** importa o registry
- [x] T054 [US3] Portar o toggle de tema para `data-theme` no elemento raiz, persistindo em `localStorage` sob `scaffold.theme`, com fallback `dark`
- [x] T055 [US3] **Não portar** o `ScPersonaSwitcher`: o papel vem da sessão (`ScaffoldRole`), conforme ADR-0004 e research §R11 — deixar comentário no shell registrando a decisão para quem comparar com o protótipo
- [x] T056 [US3] Implementar `listTracks({ status?, phase?, archetype?, ownerId? })` em `apps/app/app/(scaffold)/actions/tracks.ts` → `TrackSummary[]` com `stalledDays` derivado
- [x] T057 [P] [US3] Implementar `apps/app/components/scaffold/screens/portfolio.tsx` (Server Component) — grid de trilhas com fase, estado, dono, consultora, template pinado e chip de estagnação; portar de `scaffold-screens-1.jsx`
- [x] T058 [P] [US3] Implementar `apps/app/components/scaffold/screens/track-detail.tsx` — quatro fases com passos, artefatos e painel de critérios de gate; portar de `scaffold-screens-1.jsx`/`scaffold-screens-2.jsx`
- [x] T059 [US3] Registrar `portfolio` e `track` em `apps/app/components/scaffold/screens/registry.ts`
- [x] T060 [P] [US3] Implementar `setStepState({ stepInstanceId, state })` em `apps/app/app/(scaffold)/actions/steps.ts` (S-04)
- [x] T061 [P] [US3] Implementar `attachArtefact` e `readArtefact` em `steps.ts` usando `@repo/storage` (Vercel Blob): `attachArtefact` devolve `uploadUrl` + `artefactId`; `readArtefact` grava `AccessLog` **antes** de emitir URL assinada de curta duração (SN-02, research §R5)
- [x] T062 [US3] Adicionar `model ScaffoldArtefact` (`stepInstanceId`, `objectKey`, `kind`, `filename`, `sizeBytes`, `uploadedById`, `uploadedAt`) em `scaffold.prisma` e migrar
- [x] T063 [US3] Escrever `apps/app/__tests__/scaffold/artefact-access.test.ts`: `readArtefact` grava `AccessLog` antes da URL; URL do Blob nunca aparece em HTML renderizado (SN-02)
- [x] T064 [US3] Rodar axe nas duas telas e corrigir violações WCAG 2.2 AA (SN-10) — alvo de toque 44px já vem do CSS de T005

**Checkpoint**: produto navegável. Portfólio + detalhe de trilha funcionando sobre o gate engine.

---

## Phase 6: User Story 4 — Caso de negócio (Priority: P0)

**Goal**: baseline como artefato assinado, imutável e versionado. Fecha
**S-06, SG-04**, e liga a trava da Fase 1.

**Independent Test**: criar caso de negócio em `DRAFT`, submeter, contestar,
voltar a `DRAFT`, assinar; verificar que a `ASSESS` só fecha depois da
assinatura e que editar métrica de versão assinada cria versão nova.

**Depende de**: US2 (o guard `assertBaselineSigned` de T044), US3 (telas).

### Tests for User Story 4 ⚠️

- [x] T065 [P] [US4] Escrever `apps/app/__tests__/scaffold/business-case-state.test.ts`: `DRAFT→AWAITING→SIGNED`; `AWAITING→CONTESTED→DRAFT`; assinar nova versão marca a anterior `SUPERSEDED`
- [x] T066 [P] [US4] Escrever `apps/app/__tests__/scaffold/business-case-immutability.test.ts`: `saveDraft` em versão não-`DRAFT` recusa com `VERSION_IMMUTABLE`; editar caso assinado cria versão nova e deixa a assinada intacta e legível
- [x] T067 [P] [US4] Adicionar a `gates-negative.test.ts` os casos de SG-04: fechar `ASSESS` com caso em `DRAFT`, `AWAITING` e `CONTESTED` → `BASELINE_NOT_SIGNED`
- [x] T068 [P] [US4] Escrever `apps/app/__tests__/scaffold/business-case-hash.test.ts`: `contentHash` é estável para o mesmo payload, muda com qualquer métrica, e é nulo enquanto não assinado

### Implementation for User Story 4

- [x] T069 [P] [US4] Adicionar `model ScaffoldBusinessCase` em `scaffold.prisma` conforme [data-model.md](data-model.md), com o comentário `///` de por que `currentVersionId` e `signedVersionId` são colunas separadas (é o que faz o painel dizer `v2 vigente · v3 em edição`)
- [x] T070 [P] [US4] Adicionar `model ScaffoldBusinessCaseVersion` (`label`, `state`, `note`, `authoredById`, `authoredAt`, `signedById?`, `signedAt?`, `contentHash?`, `@@unique([businessCaseId, label])`)
- [x] T071 [P] [US4] Adicionar `model ScaffoldBusinessCaseMetric` pendurado na **versão**, com `baseValue`/`targetValue` `Decimal`, `direction`, `confidence`, `sourceLabel`, `sampleLabel`
- [x] T072 [P] [US4] Adicionar `model ScaffoldBusinessCaseContest` (`byId`, `roleLabel`, `at`, `objection @db.Text`, `asks @db.Text`, `resolvedAt?`)
- [x] T073 [US4] Rodar `pnpm migrate`
- [x] T074 [US4] Implementar `apps/app/lib/scaffold/business-case-hash.ts` — hash determinístico do payload assinado (o `ref` do protótipo, ex. `a7f3c2e9`)
- [x] T075 [US4] Implementar `getBusinessCase` e `saveDraft` em `apps/app/app/(scaffold)/actions/business-case.ts`; `saveDraft` recusa versão não-`DRAFT` com `VERSION_IMMUTABLE`
- [x] T076 [US4] Implementar `submitForSignature` (congela em `AWAITING`) e `contestBusinessCase({ objection, asks })` (→ `CONTESTED`, `ASSESS` segue bloqueada)
- [x] T077 [US4] Implementar `signBusinessCase` — calcula `contentHash`, marca a anterior `SUPERSEDED`, e é a **única** que escreve `signedVersionId`
- [x] T078 [US4] Implementar `newVersionFromSigned({ note })` — clona métricas da assinada para uma versão `DRAFT` nova
- [x] T079 [US4] Preencher `assertBaselineSigned()` em `gates.ts` (T044): fase `ASSESS` só fecha com `signedVersionId` presente — faz T067 passar (SG-04)
- [x] T080 [P] [US4] Implementar `apps/app/components/scaffold/screens/baselines.tsx` — lista de casos de negócio com estado, sponsor e versão; portar de `scaffold-screens-baseline.jsx`
- [x] T081 [P] [US4] Implementar `apps/app/components/scaffold/screens/baseline-detail.tsx` — `MetricRow` (editável em `DRAFT`, travada depois, com delta derivado e `ConfPill`), `SignalContractCard` e `VersionTrail`; portar de `scaffold-baseline.jsx`, registrar `baselines` e `baseline` no registry
- [x] T082 [US4] Fechar o `TODO(US4)` de `cancelTrack` (T028): cancelar trilha com caso `SIGNED` exige decisão explícita sobre a leitura do Signal

**Checkpoint**: a Fase 1 tem trava real. O artefato que o Signal vai ler existe e é imutável.

---

## Phase 7: User Story 5 — Biblioteca de templates (Priority: P0)

**Goal**: versões imutáveis, overlays como lista de operações, conflito
explícito. Fecha **S-05, S-12, ST-01..ST-04**.

**Independent Test**: criar trilha na `v3`, publicar `v4` que muda passos e
critérios, reler a trilha — conjunto de passos byte-idêntico; e o overlay da
Vanta sobre a `v3` levanta conflito contra a `v4`.

**Depende de**: US1 (modelos base de template), US3 (shell para a tela).

### Tests for User Story 5 ⚠️

- [x] T083 [P] [US5] Escrever `apps/app/__tests__/scaffold/template-immutability.test.ts` (ST-01): nenhuma action atualiza `ScaffoldTemplateVersion`; publicar cria linha nova; o modelo não tem `updatedAt`
- [x] T084 [P] [US5] Escrever `apps/app/__tests__/scaffold/template-publish-isolation.test.ts` (ST-03, SC-003): trilha na `v3`, publica `v4`, conjunto de passos da trilha idêntico — nenhum `UPDATE` em `ScaffoldStepInstance` sai de `templates.ts`
- [x] T085 [P] [US5] Escrever `apps/app/__tests__/scaffold/overlay-merge.test.ts` (ST-02) usando o caso literal do protótipo: overlay da Vanta sobre `triage v3` afrouxa o critério de rollback que a `v4` endureceu → gera `ScaffoldOverlayConflict` pendente, e nada é sobrescrito
- [x] T086 [P] [US5] Adicionar a `overlay-merge.test.ts`: overlay com conflito pendente bloqueia `createTrackFromGap` com `OVERLAY_HAS_UNRESOLVED_CONFLICT`
- [x] T087 [P] [US5] Escrever `apps/app/__tests__/scaffold/template-provenance.test.ts` (ST-04): toda trilha reporta versão + overlay em duas colunas, sem reconstrução

### Implementation for User Story 5

- [x] T088 [P] [US5] Adicionar `model ScaffoldTemplateOverlay` (`tenantId`, `templateId`, `baseVersionId`, `name`, `ops Json`) em `scaffold.prisma`
- [x] T089 [P] [US5] Adicionar `model ScaffoldOverlayConflict` (`overlayId`, `againstVersionId`, `targetKey`, `field`, `note`, `resolvedAt?`, `resolvedById?`)
- [x] T090 [US5] Rodar `pnpm migrate`
- [x] T091 [US5] Implementar `apps/app/lib/scaffold/overlay-merge.ts` — `ops` como `[{ op: ADD|REMOVE|REPLACE, target: "stepKey"|"criterionKey", key, patch }]`; `applyOverlay(baseVersion, ops)` e `detectConflicts(overlay, newVersion)` retornando conflitos quando o alvo mudou desde a base (research §R9). **Nunca** copiar a árvore — cópia é fork, e ST-01/SRD §5 proíbem
- [x] T092 [US5] Implementar `listTemplates` e `getTemplate` em `apps/app/app/(scaffold)/actions/templates.ts`; contagem de trilhas por versão é query agregada, **não** coluna
- [x] T093 [US5] Implementar `publishVersion({ templateId, label, note, steps, criteria })` → `{ versionId, conflicts[] }` — reaplica todo overlay ativo contra a base nova e devolve os conflitos gerados
- [x] T094 [US5] Implementar `saveOverlay({ templateId, baseVersionId, name, ops })` e `resolveConflict({ conflictId, resolution })`
- [x] T095 [US5] Bloquear `createTrackFromGap` quando o overlay escolhido tem conflito pendente — faz T086 passar
- [x] T096 [US5] Implementar `apps/app/components/scaffold/screens/templates.tsx` — cards por arquétipo com versão vigente, trilha de versões (autor, nota, trilhas em uso) e overlays com badge de conflito; portar de `scaffold-screens-3.jsx`; registrar `templates` no registry
- [x] T097 [US5] Estender `tenant-isolation.test.ts`: overlay de tenant A invisível ao tenant B; template base é global

**Checkpoint**: o método é versionado sem quebrar trilha em curso.

---

## Phase 8: User Story 6 — Supervisão e estagnação (Priority: P1)

**Goal**: fila cross-cliente da consultora e detecção de estagnação. Fecha
**S-08, S-09, SG-08, SN-06, SN-07**.

**Independent Test**: `http://localhost:3013/scaffold-supervision` lista gates de
múltiplos tenants **sem** nenhum artefato ou texto de critério; recuar
`lastGateAt` e disparar o cron marca a trilha `STALLED` e notifica.

**Depende de**: US2 (estados de gate), US3 (badges no shell).

> **Fronteira.** Esta é a única superfície cross-tenant do produto, e por isso
> vive em `apps/backoffice` — `apps/app` não pode importar `platformDb`
> (ADR-0013, research §R4). O teste T015 já falha se alguém tentar.

### Tests for User Story 6 ⚠️

- [x] T098 [P] [US6] Escrever `apps/backoffice/__tests__/scaffold-supervision.test.ts` (SN-06): `listGateQueue` devolve **exatamente** `{ trackCode, orgName, phase, ageLabel, criteriaMet, criteriaTotal, kind }` — teste falha se qualquer campo extra vazar, e falha se artefato ou prosa de critério aparecer
- [x] T099 [P] [US6] Adicionar ao mesmo arquivo: `enterTenantContext` grava `AccessLog` **antes** de conceder, e não existe link direto da fila ao artefato
- [x] T100 [P] [US6] Escrever `apps/app/__tests__/scaffold/stall-detection.test.ts`: trilha com `lastGateAt` além do limiar vira `STALLED`; dentro do limiar não; notificação é fire-and-forget e sua falha não derruba a varredura
- [x] T101 [P] [US6] Escrever `apps/app/__tests__/scaffold/override-rate.test.ts` (SG-08): taxa de override por organização é computada corretamente e exposta no portfólio

### Implementation for User Story 6

- [x] T102 [US6] Criar `apps/backoffice/app/scaffold-supervision/actions.ts` com `listGateQueue({ kind? })` usando `platformDb` de `@repo/provisioning`, filtrando `isSystem = false`, projetando **apenas** o `QueueEntry` fechado de T098
- [x] T103 [US6] Implementar `enterTenantContext({ trackId, rationale })` em `apps/backoffice/app/scaffold-supervision/actions.ts` — grava `AccessLog` (modelo já existe em `platform-ops.prisma`) e só então devolve o destino no app do cliente
- [x] T104 [US6] Implementar `apps/backoffice/app/scaffold-supervision/page.tsx` — três agrupamentos (`sign-off`, `blocked`, `observing`) com trilha, org, fase, idade e `n de m` critérios; portar o layout de `SUPERVISION` em `scaffold-data.jsx`
- [x] T105 [P] [US6] Adicionar `stallThresholdDays` configurável por tenant (default 14, o `STALL_THRESHOLD` do protótipo) — coluna em `ScaffoldMembership`? não: tabela `ScaffoldSettings` (`tenantId @unique`, `stallThresholdDays @default(14)`) em `scaffold.prisma`, e migrar
- [x] T106 [US6] Implementar `apps/app/lib/inngest/scaffold-stall.ts` — função agendada espelhando `apps/app/lib/inngest/solution-staleness.ts`; varre `@@index([tenantId, lastGateAt])`, marca `STALLED`, notifica dono e sponsor via `@repo/notifications`, fire-and-forget
- [x] T107 [US6] Registrar a função no cliente Inngest em `apps/app/lib/inngest/client.ts` e na rota `/api/inngest`
- [x] T108 [US6] Preencher `badges` em `apps/app/app/(scaffold)/actions/shell.ts` (T010): contagem de trilhas estagnadas e de casos de negócio em `AWAITING`/`CONTESTED` — os dois números da sidebar do protótipo
- [x] T109 [US6] Adicionar taxa de override por organização a `listTracks`/portfólio (SG-08)
- [x] T110 [US6] Ocultar a entrada "Fila de gates" da sidebar de `apps/app` — a fila não vive lá; deixar comentário apontando para `apps/backoffice/app/scaffold-supervision` e para research §R4
- [x] T111 [US6] Rodar `apps/app/__tests__/scaffold/adr-0013-boundary.test.ts` (T015) e confirmar verde depois da fatia

**Checkpoint**: a consultora supervisiona sem enxergar dado de cliente. Estagnação é detectada sozinha.

---

## Phase 9: User Story 7 — Charter, observação e export (Priority: P1)

**Goal**: política do Charter na Fase 3, janela de 30 dias na Fase 4, e o
contrato de saída para o Signal. Fecha **S-11, SG-05, SG-06** e o contrato de
**S-06**.

**Independent Test**: fechar `SCALE` sem ack do Charter falha com o tenant tendo
Charter; passa sem Charter contratado. Fechar `EMBED` leva a `OBSERVING`, e 30
dias sem reabertura levam a `EMBEDDED`.

**Depende de**: US4 (caso de negócio), US5 (critérios do template).

### Tests for User Story 7 ⚠️

- [x] T112 [P] [US7] Adicionar a `gates-negative.test.ts` os casos de SG-05: `SCALE` com `TenantModule(CHARTER)` ativo e sem ack → `CHARTER_POLICY_NOT_ACKED`; **sem** Charter contratado → passa (degradação graciosa, SRD §8)
- [x] T113 [P] [US7] Escrever `apps/app/__tests__/scaffold/observation-window.test.ts` (SG-06): fechar `EMBED` → `OBSERVING` com `observationEndsAt = now + 30d`; avançar o relógio sem reabrir → `status = EMBEDDED`; reabrir dentro da janela → `REOPENED` e a trilha **não** vira `EMBEDDED`
- [x] T114 [P] [US7] Escrever `apps/app/__tests__/scaffold/signal-export.test.ts` (SC-004): fixture do `BC-104` valida contra o schema Zod dos shapes v2 e v1 de [contracts/signal-baseline-export.md](contracts/signal-baseline-export.md) e importa **sem transformação**; versão não assinada → `NOT_SIGNED`

### Implementation for User Story 7

- [x] T115 [US7] Adicionar `charterPolicyId` e `charterPolicyAckAt` a `ScaffoldPhaseInstance` em `scaffold.prisma` e migrar
- [x] T116 [US7] Implementar `acknowledgeCharterPolicy({ phaseInstanceId, policyId })` em `apps/app/app/(scaffold)/actions/gates.ts`, lendo a política aplicável do schema do Charter
- [x] T117 [US7] Preencher `assertCharterPolicyAcked()` em `gates.ts` (T044) — bloqueia **só** quando `TenantModule(CHARTER)` está ativo; faz T112 passar
- [x] T118 [US7] Surfacar a política aplicável dentro dos passos da Fase 3 em `track-detail.tsx` (S-11), com estado vazio explícito quando o Charter não está contratado
- [x] T119 [US7] Implementar a transição `EMBED → OBSERVING` em `closePhase` — grava `observationEndsAt = now + 30d`; `closePhase` **não** marca `EMBEDDED` (SG-06)
- [x] T120 [US7] Implementar `apps/app/lib/inngest/scaffold-observation.ts` — varre `observationEndsAt` vencido sem reabertura e marca `track.status = EMBEDDED`, `embeddedAt`; registrar no cliente Inngest
- [x] T121 [US7] Implementar `apps/app/app/(scaffold)/actions/export.ts` com `exportBusinessCase({ businessCaseId, shape?: "v2" | "v1" })` → `Result<SignalBaselineV2 | SignalBaselineV1>`; recusa com `NOT_SIGNED` para versão em `DRAFT`/`AWAITING`/`CONTESTED`
- [x] T122 [US7] Implementar o derivador v1 — `volume→volume_per_period`, `cycle→cycle_time_minutes`, `error→error_rate` dividido por 100; métrica ausente vira `null` e o v1 **não** falha por isso
- [x] T123 [US7] Renderizar o estado degradado do `SignalContractCard` quando não há assinatura: *"o Signal mostra esta iniciativa como aguardando promessa — não como zero"* (research §R10); `signalInitiativeRef` e contagem de leituras ficam nulos enquanto o Signal não existir
- [ ] T124 [US7] Escrever `apps/app/e2e/scaffold-track-lifecycle.spec.ts` (SC-001): promover lacuna → 4 fases → passos → assinar caso de negócio → fechar `ASSESS` → `PILOT` com override atribuído → `SCALE` com ack do Charter → fechar `EMBED` → `OBSERVING` → avançar 30 dias → `EMBEDDED`

**Checkpoint**: o ciclo completo roda ponta a ponta, sem engenharia no meio.

---

## Phase 10: User Story 8 — Handover pack (Priority: P1)

**Goal**: export auto-contido no fechamento da Fase 4. Fecha **S-10, SN-09**.

**Independent Test**: baixar o pack de uma trilha `EMBEDDED`, abrir num ambiente
sem conta Nebuloz, e ler runbook, donos, modos de falha e caminho de escalação.

**Depende de**: US7 (fechamento da `EMBED`).

### Tests for User Story 8 ⚠️

- [x] T125 [P] [US8] Escrever `apps/app/__tests__/scaffold/handover-pack.test.ts` (SN-09): o ZIP abre e é legível sem nenhuma chamada a serviço Nebuloz; nenhuma URL assinada expirável dentro dele; todo artefato referenciado está embutido, não linkado
- [x] T126 [P] [US8] Adicionar: gerar pack de trilha que não está em `EMBED` fechada recusa com erro nomeado

### Implementation for User Story 8

- [x] T127 [US8] Implementar `apps/app/lib/scaffold/handover-pack.ts` — monta o arquivo com `index.html` estático, runbook, donos, histórico de gates e overrides, caso de negócio assinado com `contentHash`, e os artefatos embutidos
- [x] T128 [US8] Implementar `exportHandoverPack({ trackId })` em `apps/app/app/(scaffold)/actions/export.ts`, via `@repo/storage`, devolvendo URL assinada de curta duração e gravando `AccessLog`
- [x] T129 [US8] Adicionar o botão de export ao painel da fase `EMBED` em `track-detail.tsx`, habilitado só com a fase fechada
- [x] T130 [US8] Rodar `logAudit` no export (SN-03) — o pack sai do perímetro, e isso precisa ficar registrado
- [x] T131 [US8] Verificar SN-08 explicitamente: nenhum dado do pack alimenta treino de modelo; registrar a verificação no completion doc
- [x] T132 [US8] Estender `tenant-isolation.test.ts` para `exportHandoverPack` e `exportBusinessCase`

**Checkpoint**: o cliente sai andando sozinho. É o critério de sucesso do produto.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T133 [P] Rodar axe em todas as seis telas e fechar violações WCAG 2.2 AA (SN-10)
- [x] T134 [P] Escrever ADR `docs/adr/0014-scaffold-supervisao-no-backoffice.md` registrando a decisão de research §R4 — por que a fila cross-tenant não vive em `apps/app`
- [x] T135 [P] Escrever ADR `docs/adr/0015-caso-de-negocio-versionado-vence-baseline-plano.md` registrando research §R3
- [x] T136 [P] Atualizar `docs/produto/scaffold-prd.md` com uma nota de cabeçalho apontando para `specs/002-scaffold-adoption/` e registrando que R1 resolveu o conflito de escopo em favor do produto
- [x] T137 [P] Registrar SN-04 (residência de dado) como fora do V1 em `docs/adr/` ou na seção de pendências do PRD — research §R6
- [x] T138 Rodar `pnpm check` e `pnpm --filter app typecheck` e zerar
- [x] T139 Confirmar cobertura ≥ 80% em `pnpm test` (gate bloqueante de CI)
- [x] T140 Rodar `pnpm build` e confirmar verde
- [x] T141 Executar o checklist de aceite de [quickstart.md](quickstart.md) §Checklist, item a item
- [x] T142 Escrever `.claude/completions/YYYY-MM-DD-scaffold-<fatia>.md` para cada fatia entregue

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependência
- **Foundational (Phase 2)**: depende do Setup — **bloqueia todas as fatias**
- **US1 (Phase 3)**: depende da Foundational
- **US2 (Phase 4)**: depende de US1
- **US3 (Phase 5)**: depende de US2
- **US4 (Phase 6)**: depende de US2 (guard T044) e US3 (telas)
- **US5 (Phase 7)**: depende de US1 (modelos de template) e US3 (shell)
- **US6 (Phase 8)**: depende de US2 e US3
- **US7 (Phase 9)**: depende de US4 e US5
- **US8 (Phase 10)**: depende de US7
- **Polish (Phase 11)**: depende das fatias desejadas

### Honestidade sobre independência

O template pede fatias independentes. **Estas não são todas.** O produto é uma
máquina de estado, e telas sobre uma máquina inexistente não são incremento —
são mock. A cadeia real é `US1 → US2 → US3`, e a partir daí abre:

```
Setup → Foundational → US1 → US2 → US3 ─┬─→ US4 ─┐
                                        ├─→ US5 ─┴─→ US7 → US8
                                        └─→ US6
```

Cada fatia continua **testável sozinha** ao ser entregue, que é o que importa
para o checkpoint. O que ela não é: iniciável fora de ordem.

### Within Each User Story

- Testes escritos e **falhando** antes da implementação (constituição §III)
- Modelos → migration → lib pura → actions → telas
- `logAudit` e Zod entram junto com a action, não depois

### Parallel Opportunities

- **Phase 1**: T004, T005, T006 em paralelo depois de T003
- **Phase 2**: T012, T013, T014, T015 em paralelo
- **US1**: T017–T019 (testes) juntos; T020–T022 (modelos) juntos
- **US2**: T031–T035 (testes) juntos; T036–T037 (modelos) juntos
- **US4**: T065–T068 juntos; T069–T072 juntos; T080–T081 juntos
- **US5**: T083–T087 juntos; T088–T089 juntos
- **US6**: T098–T101 juntos
- **US7**: T112–T114 juntos
- **Phase 11**: T133–T137 juntos
- **US4, US5 e US6 podem ser tocadas por pessoas diferentes** depois de US3

---

## Parallel Example: User Story 2 (gate engine)

```bash
# Testes primeiro, todos juntos — devem falhar:
Task: "gate-machine.test.ts — transições puras sem banco"
Task: "gates-negative.test.ts — uma asserção por linha do contrato de bloqueio"
Task: "gates-architecture.test.ts — CLOSED só em closePhase"
Task: "gates-append-only.test.ts — SG-07"
Task: "gates-integration.test.ts — ciclo ASSESS contra o banco"

# Depois, os dois modelos juntos:
Task: "model ScaffoldGateResult em scaffold.prisma"
Task: "model ScaffoldGateOverride em scaffold.prisma"
```

---

## Implementation Strategy

### MVP (US1 apenas)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1
4. **PARAR E VALIDAR**: lacuna promovida vira trilha com `targetEntityId` preenchido
5. Entregável isolado — é exatamente o V1 que `docs/produto/scaffold-prd.md` pede

### Fatia mínima defensável (US1 + US2)

O MVP mais o invariante. Entrega a ligação **e** o mecanismo que faz o produto
valer, sem nenhuma tela nova. Se o orçamento apertar, é aqui que se para.

### Entrega incremental

1. Setup + Foundational → base pronta
2. US1 → validar → demo (MVP)
3. US2 → validar → o gate bloqueia de verdade
4. US3 → validar → produto navegável
5. US4 / US5 / US6 → em paralelo, se houver gente
6. US7 → ciclo completo ponta a ponta
7. US8 → o cliente sai andando sozinho

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- Verificar que o teste falha antes de implementar — RED antes de GREEN
- Commit por task ou grupo lógico
- **Nunca** escrever `state = CLOSED` fora de `closePhase()`; T033 falha se acontecer
- **Nunca** duplicar primitivo Zod — importar de `apps/app/app/actions/_base.ts`
- **Nunca** importar `platformDb` em `apps/app` — T015 falha se acontecer
- As telas ainda não lidas do design (`scaffold-screens-1/2/3.jsx`,
  `scaffold-screens-baseline.jsx`) são a referência de render: puxar do projeto
  Claude Design `691f7fe5-e623-458e-aa9f-92b8c46dbbd9` **na fatia que precisa
  delas** (T057, T058, T080, T081, T096), não antes
