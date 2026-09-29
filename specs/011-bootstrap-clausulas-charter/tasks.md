---
description: "Task list for feature implementation"
---

# Tasks: Bootstrap do Charter cria biblioteca de cláusulas

**Input**: Design documents from `/specs/011-bootstrap-clausulas-charter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Constitution do repo (Princípio III, NON-NEGOTIABLE) exige TDD — tests não são opcionais nesta feature. Toda task de implementação é precedida por uma task de teste que deve falhar antes dela.

**Organization**: Tasks agrupadas por user story do `spec.md` (US1 = P1, US2 = P2, US3 = P3), para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de task incompleta)
- **[Story]**: a user story do `spec.md` a que a task pertence

## Path Conventions

Pacote de biblioteca no monorepo — sem `src/`/`tests/` na raiz. Caminhos reais, do `plan.md`:

- `packages/provisioning/src/charter.ts` (edita)
- `packages/provisioning/src/charter-clauses.ts` (novo)
- `packages/provisioning/src/index.ts` (edita — exporta o catálogo novo)
- `packages/provisioning/src/__tests__/charter.test.ts` (edita)
- `packages/provisioning/src/__tests__/charter-clauses.test.ts` (novo)
- `apps/app/scripts/seed-charter.ts` (edita)

---

## Phase 1: Setup

**Purpose**: Confirmar terreno antes de tocar o código compartilhado — pacote e testes já existem, não há inicialização de projeto.

- [x] T001 Confirmar que nenhum outro arquivo importa o array local `CLAUSES` de `apps/app/scripts/seed-charter.ts` (`grep -rn "CLAUSES" apps/app apps/backoffice`) — só o próprio arquivo pode usá-lo hoje; se algo mais depender dele, ajustar o escopo das tasks de US3 antes de prosseguir.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Catálogo único de cláusulas — pré-requisito de US1, US2 e US3. Nenhuma user story começa antes desta fase.

**⚠️ CRITICAL**: Bloqueia todas as user stories.

- [x] T002 [P] Escrever teste (RED) do formato do catálogo em `packages/provisioning/src/__tests__/charter-clauses.test.ts`: `CHARTER_CLAUSES` tem 8 entradas, códigos únicos no formato `CL-0N`, e os 8 códigos esperados (CL-01–CL-08) estão presentes com a criticidade documentada em `data-model.md`.
- [x] T003 Implementar `packages/provisioning/src/charter-clauses.ts` exportando `CHARTER_CLAUSES: { code: string; name: string; critical: boolean }[]` com as 8 cláusulas (código/nome/criticidade extraídos de `apps/app/scripts/seed-charter.ts:212-233`, sem alterar conteúdo) — GREEN para T002.
- [x] T004 [P] Adicionar `charterClause: { createMany(args: unknown): Promise<{ count: number }> }` ao tipo `CharterDb` em `packages/provisioning/src/charter.ts` (mesmo padrão de `charterPolicySection.createMany` já existente no tipo).
- [x] T005 Exportar `CHARTER_CLAUSES` em `packages/provisioning/src/index.ts`, no mesmo bloco de export de `./charter-clauses` (padrão dos exports existentes de `POLICY_SECTIONS` e `CLAUSE_LABEL`).

**Checkpoint**: catálogo único existe e é importável tanto por `packages/provisioning` quanto por `apps/app`.

---

## Phase 3: User Story 1 - Tenant novo decide caso sem SQL nem seed (Priority: P1) 🎯 MVP

**Goal**: bootstrap de um tenant sem Charter cria as 8 cláusulas junto com a política.

**Independent Test**: provisionar tenant novo, chamar `bootstrapCharter` com tenant sem política prévia, e confirmar que `charterClause.createMany` foi chamado com as 8 cláusulas do catálogo para esse tenant.

### Tests for User Story 1 ⚠️

> Escrever e confirmar que falham (RED) antes de implementar.

- [x] T006 [P] [US1] Em `packages/provisioning/src/__tests__/charter.test.ts`: teste "cria as 8 cláusulas quando o tenant ainda não tem Charter" — mockar `charterClause.createMany`, chamar `bootstrapCharter` com política inexistente (`policyExists: false`), e afirmar que `createMany` foi chamado uma vez com `data` de 8 itens (todos com o `tenantId` correto e os 8 códigos do catálogo) e `skipDuplicates: true`.
- [x] T007 [P] [US1] No mesmo arquivo: estender o teste existente "falha com TENANT_NOT_FOUND antes de consultar usuário ou escrever" com a asserção `expect(db.charterClause.createMany).not.toHaveBeenCalled()`.
- [x] T008 [P] [US1] No mesmo arquivo: estender o teste existente "falha com USER_NOT_FOUND" com a mesma asserção `expect(db.charterClause.createMany).not.toHaveBeenCalled()`.

### Implementation for User Story 1

- [x] T009 [US1] Em `packages/provisioning/src/charter.ts`: no branch onde a política é criada pela primeira vez (dentro do bloco que hoje só roda quando `!existing`), chamar `db.charterClause.createMany({ data: CHARTER_CLAUSES.map((c) => ({ tenantId: input.tenantId, ...c })), skipDuplicates: true })`, importando `CHARTER_CLAUSES` de `./charter-clauses`. Depende de T003, T004, T006-T008.
- [x] T010 [US1] No mesmo arquivo, logo após a criação: chamar `logPlatformAudit` com `action: "charter.clauses_bootstrapped"`, `entityType: "CharterClause"`, e `target` incluindo a contagem de cláusulas (mesmo padrão do log `charter.bootstrapped` já existente para a política). Depende de T009.

**Checkpoint**: um tenant provisionado do zero já sai do bootstrap com as 8 cláusulas — `npx vitest run packages/provisioning/src/__tests__/charter.test.ts` verde para os testes de US1.

---

## Phase 4: User Story 2 - Re-provisionar não duplica nem apaga edição do Legal (Priority: P2)

**Goal**: rodar o bootstrap de novo no mesmo tenant não cria cláusula duplicada nem altera uma cláusula que já existe (inclusive editada por Legal) — mesmo quando a política já existe (branch hoje early-return).

**Independent Test**: rodar `bootstrapCharter` duas vezes para o mesmo tenant (segunda vez com política já existente) e confirmar que `charterClause.createMany` é chamado com `skipDuplicates: true` também nesse branch, e que nenhum método de atualização (`update`/`upsert`) é chamado em `charterClause`.

### Tests for User Story 2 ⚠️

> Escrever e confirmar que falham (RED) antes de implementar — T011 falha porque hoje o branch de política existente retorna antes de qualquer chamada a `charterClause`.

- [x] T011 [P] [US2] Em `packages/provisioning/src/__tests__/charter.test.ts`: teste "cria as cláusulas faltantes mesmo quando a política já existe" — mockar `policyExists: true`, chamar `bootstrapCharter`, e afirmar que `charterClause.createMany` foi chamado com os 8 itens e `skipDuplicates: true` (o mesmo comportamento de T006, agora no branch de skip da política).
- [x] T012 [P] [US2] No mesmo arquivo: teste "nunca atualiza uma cláusula existente" — adicionar `update`/`upsert` mockados (`vi.fn()`) ao `charterClause` do `makeDb`, rodar `bootstrapCharter` (com e sem política existente) e afirmar que nenhum dos dois foi chamado — só `createMany`.

### Implementation for User Story 2

- [x] T013 [US2] Em `packages/provisioning/src/charter.ts`: extrair a chamada de criação das cláusulas (de T009) para uma função interna do módulo, chamada tanto no branch de política nova quanto no branch onde a política já existe (antes do `return` de `bootstrap_skipped`), para não duplicar o literal do `createMany`. Depende de T009, T011, T012.

**Checkpoint**: re-provisionar o mesmo tenant é seguro — `npx vitest run packages/provisioning/src/__tests__/charter.test.ts` verde para todos os testes de US1 e US2.

---

## Phase 5: User Story 3 - Seed e bootstrap não divergem (Priority: P3)

**Goal**: `apps/app/scripts/seed-charter.ts` usa o catálogo `CHARTER_CLAUSES` de `@repo/provisioning` em vez de manter seu próprio array `CLAUSES`.

**Independent Test**: remover o array local `CLAUSES` de `seed-charter.ts`, rodar o seed contra um banco de desenvolvimento e confirmar que as 8 cláusulas criadas são idênticas (código, nome, criticidade) às de antes.

### Tests for User Story 3 ⚠️

- [x] T014 [P] [US3] Em `packages/provisioning/src/__tests__/charter-clauses.test.ts` (do T002): adicionar caso "os códigos batem com os usados historicamente pelo seed de demonstração" comparando `CHARTER_CLAUSES.map(c => c.code)` com a lista fixa `["CL-01", ..., "CL-08"]` — trava qualquer remoção ou renomeação acidental de código ao migrar o seed. (Feito junto com T002, mesmo commit — mesma tabela de dados.)

### Implementation for User Story 3

- [x] T015 [US3] Em `apps/app/scripts/seed-charter.ts`: remover o array local `CLAUSES` (linhas 212-233) e importar `CHARTER_CLAUSES` de `@repo/provisioning`, ajustando o laço de criação (`tx.charterClause.create`) para iterar sobre o import. Depende de T003, T005, T014.

**Checkpoint**: única fonte de verdade — `npx vitest run packages/provisioning/src/__tests__/charter-clauses.test.ts` verde, e uma leitura do `seed-charter.ts` não mostra mais nome/criticidade de cláusula hardcoded.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T016 Rodar `npx biome check --write` nos arquivos tocados (`packages/provisioning/src/charter.ts`, `packages/provisioning/src/charter-clauses.ts`, `packages/provisioning/src/index.ts`, `packages/provisioning/src/__tests__/charter.test.ts`, `packages/provisioning/src/__tests__/charter-clauses.test.ts`, `apps/app/scripts/seed-charter.ts`).
- [x] T017 Rodar a suíte completa de `packages/provisioning` (`npx vitest run packages/provisioning/src/__tests__`) e confirmar cobertura ≥80% nos arquivos tocados (Constitution, Quality Gates). 138/138 verde; cobertura de `charter.ts`+`charter-clauses.ts` 100% (statements/branch/funcs/lines).
- [ ] T018 Executar a verificação manual do `quickstart.md` (passos 1–7) em ambiente local e depois encerrar o `pnpm dev` (porta 3012). **Não executado nesta rodada**: feature não muda nenhuma tela nem fluxo de UI (só `packages/provisioning` e um script de seed), e T020 já cobre por teste automatizado o mesmo resultado (SC-002) que os passos 2-4 do quickstart validariam manualmente. Requer ambiente local com Postgres + fluxo de contratação do back-office — deixado para quem revisar (Alicerce/dev) rodar se quiser confirmar visualmente.
- [x] T019 [P] Criar `.claude/completions/YYYY-MM-DD-bootstrap-clausulas-charter.md` registrando o que foi entregue, conforme convenção do `CLAUDE.md` do repo.
- [x] T020 [polish] Teste de integração (não estava no `tasks.md` original — pedido explícito de Morgana, ponto 5): `packages/provisioning/src/__tests__/charter-clauses-integration.test.ts` prova que os códigos que `bootstrapCharter` cria, associados a um fornecedor, fazem `deriveVendorMaxClass` sair de `PUBLIC` para `RESTRICTED` — e que sem eles (estado de hoje sem esta feature) o mesmo fornecedor trava em `PUBLIC`. Fecha SC-002 da spec e o PRD do Charter, linha 164.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — bloqueia todas as user stories.
- **US1 (Phase 3)**: depende do Foundational. Sem dependência de US2/US3.
- **US2 (Phase 4)**: depende do Foundational **e** da implementação de US1 (T009) — extrai/reusa o código que T009 introduz. Não é independente de US1 no código, mas é independentemente testável (seus testes exercitam um cenário que os testes de US1 não cobrem).
- **US3 (Phase 5)**: depende do Foundational (catálogo, T003/T005). Não depende do código de US1/US2 — pode rodar em paralelo com Phase 3/4 por um dev diferente.
- **Polish (Phase 6)**: depende de todas as user stories desejadas estarem completas.

### Parallel Opportunities

- T002 e T004 (Foundational) — arquivos diferentes.
- T006, T007, T008 (testes de US1) — mesmo arquivo, mas blocos de teste independentes; marcados [P] por não dependerem uns dos outros para escrever (rodam sequencialmente na prática por serem no mesmo arquivo, mas podem ser escritos em paralelo por pessoas diferentes).
- T011 e T012 (testes de US2) — mesma observação.
- Phase 5 (US3) inteira pode rodar em paralelo com Phase 3/4, já que só depende do Foundational.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1).
2. Parar e validar: tenant novo sai do bootstrap com as 8 cláusulas (fecha o risco do PRD:178).
3. Esse já é o ponto que fecha FR-9 do PRD para tenant novo — dá para entregar aqui se houver pressão de prazo, deixando US2/US3 para depois.

### Incremental Delivery

1. Setup + Foundational → catálogo único pronto.
2. US1 → tenant novo funciona (MVP, fecha o risco do PRD).
3. US2 → re-provisionamento seguro (fecha o edge case de bootstrap parcial/re-execução).
4. US3 → seed e bootstrap param de divergir (limpeza de dívida, sem mudança de comportamento observável).
5. Polish.
