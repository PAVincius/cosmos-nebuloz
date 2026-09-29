---

description: "Task list for Tipo de conta e lançamento por coorte (Fase 1 do modelo de contas)"
---

# Tasks: Tipo de conta e lançamento por coorte (Fase 1 do modelo de contas)

**Input**: Design documents from `/specs/010-tipo-de-conta-e-lancamento/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: incluídos — Constitution III (Test-First) é NON-NEGOTIABLE.

**Organization**: tasks agrupadas por user story (spec.md). US2 (Tenant.type
como campo único) tem sua parte mínima na Foundational — sem ela, nenhuma
outra story tem o que ler — e o resto da migração (os ~15 call sites que
não bloqueiam as outras stories) na sua própria fase.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

Nenhuma tarefa — infraestrutura já existe (Vitest, Playwright,
`@repo/database`, `@repo/auth`, `@repo/provisioning`). Sem dependência nova.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `Tenant.type` precisa existir, estar populado e disponível via
`TenantContext` antes de qualquer user story poder ler ou escrever nele.

- [ ] T001 Adicionar enum `TenantType` (`CLIENTE`, `INTERNA`, `TESTE`,
  `DEMO`, `SISTEMA`) e campo `Tenant.type` (default `CLIENTE`) em
  `packages/database/prisma/schema/tenant.prisma` (linhas 36,42 —
  substitui `isSystem`/`isInternalTenant`, ver data-model.md)
- [ ] T002 Migration de dado: mapear tenants existentes conforme ADR-0018
  (`isSystem=true`→`SISTEMA`; `isInternalTenant=true`→`INTERNA`; slugs
  `nebula`/`dev-teste`/`nebuloz-novo-cliente`→`TESTE`; `medcore`→`DEMO`;
  demais→`CLIENTE`) em `packages/database/prisma/migrations/`
- [ ] T003 Adicionar `tenantType: TenantType` a `TenantContext` e resolvê-lo
  dentro de `requireTenantSession` (uma consulta a mais, não uma por
  chamador) em `packages/auth/server.ts` (linhas 155-160, 195-259)
- [ ] T004 Migrar `isTenantInterno()` para ler `Tenant.type === "INTERNA"`
  em `apps/app/app/(authenticated)/_lib/resolve-post-login-destination.ts`
  (linhas 12-22)

**Checkpoint**: `Tenant.type` existe, populado, e `ctx.tenantType`
disponível em toda sessão — US1, US3 e US4 podem começar.

---

## Phase 3: User Story 1 - Catálogo interno respeita o lançamento (Priority: P1) 🎯 MVP

**Goal**: card do catálogo só é clicável se contratado e lançado (para
`INTERNA`, contra a lista de acesso antecipado); motivo real de contrato
continua aparecendo quando não é o caso de "não lançado".

**Independent Test**: ver
[quickstart.md#us1](./quickstart.md#us1--catálogo-interno-respeita-o-lançamento).

### Tests for User Story 1

- [ ] T005 [P] [US1] Teste: `listarProdutos()` retorna `NAO_LANCADO` quando
  o módulo está `ACTIVE`/`TRIAL` mas fora da lista aplicável ao
  `tenantType`, e `DISPONIVEL` quando está na lista — estender
  `apps/app/__tests__/produto/` (arquivo de teste de `listarProdutos`, se
  existir, ou novo)
- [ ] T006 [P] [US1] Teste: no catálogo, `NAO_LANCADO` mostra "Em breve"
  sem motivo; `SUSPENSO`/`CANCELADO`/`EXPIRADO`/`SEM_CONTRATO` continuam
  mostrando o motivo real, mesmo para `catalogoPosLogin=true` (Edge Case,
  Acceptance Scenario 3) — em teste da página
  `apps/app/app/(authenticated)/produto/page.tsx` (novo ou estendido)

### Implementation for User Story 1

- [ ] T007 [US1] Criar `LANCAMENTO_ANTECIPADO`/`LANCAMENTO_GERAL`
  (`ProductModule[]`) em `apps/app/app/actions/produtos/lancamento.ts`
  (novo, mesmo padrão de `onboarding-modules.ts`) — todo módulo em
  `LANCAMENTO_GERAL` também implicitamente em `LANCAMENTO_ANTECIPADO`
- [ ] T008 [US1] Adicionar `NAO_LANCADO` a `EstadoDoProduto` e computar em
  `listarProdutos()` (`abre && !lançado_para(tenantType) → NAO_LANCADO`,
  antes do fallback `DISPONIVEL`) em
  `apps/app/app/actions/produtos/index.ts` (linhas 32-41, 149-193; depende
  de T003, T007)
- [ ] T009 [US1] Trocar `emBreve = catalogoPosLogin && produto.estado !== "DISPONIVEL"`
  por checagem em `produto.estado === "NAO_LANCADO"` em
  `apps/app/app/(authenticated)/produto/page.tsx` (linha 75; depende de
  T008)

**Checkpoint**: US1 completa e testável — resolve o incidente original da
spec 008.

---

## Phase 4: User Story 2 - Tipo de conta é um campo único (Priority: P1)

**Goal**: nenhum ponto de código fora de teste/migration/gerado ainda lê
`isSystem`/`isInternalTenant` — todos os ~15 call sites restantes (fora dos
4 já tocados na Foundational) migram para `Tenant.type`.

**Independent Test**: ver
[quickstart.md#us2](./quickstart.md#us2--tipo-de-conta-é-um-campo-único).

### Tests for User Story 2

- [ ] T010 [P] [US2] Teste de arquitetura: busca por `isSystem`/
  `isInternalTenant` fora de teste/`generated`/`migrations` retorna 0
  ocorrências — novo, seguindo o padrão de
  `apps/app/__tests__/scaffold/adr-0013-boundary.test.ts` (grep-based),
  em `apps/app/__tests__/architecture/tenant-type-boundary.test.ts`
- [ ] T011 [P] [US2] Teste: para cada tenant seedado, `type` bate com o
  mapeamento ADR-0018 (verifica T002) — estender
  `apps/app/scripts/verify-seed.ts` ou teste equivalente

### Implementation for User Story 2 (migração mecânica, um call site por task)

- [ ] T012 [P] [US2] `apps/app/app/(authenticated)/page.tsx` — migrar
  referência a `isInternalTenant` (linha 4)
- [ ] T013 [P] [US2] `apps/app/scripts/seed-catalogo-e2e.ts` — gravar
  `type: "INTERNA"` em vez de `isInternalTenant: true` (linhas 51-52,55)
- [ ] T014 [P] [US2] `apps/app/scripts/verify-charter.ts` — `isSystem: false`
  → `type: { not: "SISTEMA" }` (linha 66)
- [ ] T015 [P] [US2] `apps/app/scripts/verify-seed.ts` — idem (linha 923)
- [ ] T016 [P] [US2] `apps/app/e2e/setup/auth.setup.ts` — atualizar
  persona/fixture (linha 65)
- [ ] T017 [P] [US2] `apps/app/e2e/catalogo-pos-login.spec.ts` — idem
  (linha 30)
- [ ] T018 [P] [US2] `apps/backoffice/app/actions/provisioning.ts` —
  `tenant.isSystem` → `tenant.type === "SISTEMA"` (linhas 22,24)
- [ ] T019 [P] [US2] `apps/backoffice/app/actions/clientes-busca.ts` —
  idem (linha 38)
- [ ] T020 [P] [US2] `apps/backoffice/app/actions/scaffold.ts` — idem (3
  ocorrências, linhas 65,133,153)
- [ ] T021 [P] [US2] `apps/backoffice/app/actions/clients.ts` — idem +
  ternário (linhas 194,211)
- [ ] T022 [P] [US2] `apps/backoffice/app/actions/tenant-members.ts` —
  idem (linha 50)
- [ ] T023 [P] [US2] `apps/backoffice/app/actions/engagements.ts` — idem
  (linha 134)
- [ ] T024 [P] [US2] `apps/backoffice/app/actions/scaffold-supervision.ts`
  — idem (linhas 105,218)
- [ ] T025 [P] [US2] `apps/backoffice/app/actions/accounts.ts` — idem
  (linha 178; **não** a ação nova de US3, que é função separada no mesmo
  arquivo)
- [ ] T026 [P] [US2] `apps/backoffice/app/actions/audit.ts` — idem (linha
  90)
- [ ] T027 [P] [US2] `apps/backoffice/app/actions/benchmark.ts` — idem
  (linha 78)
- [ ] T028 [P] [US2] `apps/backoffice/lib/client-queries.ts` — idem (2
  ocorrências, linhas 12,34)

**Checkpoint**: T010 (teste de arquitetura) passa — zero leitura dos
booleanos antigos em código de produção.

---

## Phase 5: User Story 3 - Back-office troca o tipo de uma conta (Priority: P2)

**Goal**: staff troca `Tenant.type` de uma conta existente, com auditoria.

**Independent Test**: ver
[quickstart.md#us3](./quickstart.md#us3--back-office-troca-o-tipo-de-uma-conta).

### Tests for User Story 3

- [ ] T029 [P] [US3] Teste: `alterarTipoDeConta` atualiza `Tenant.type` e
  chama `logPlatformAudit` com `diff: [["type", antes, depois]]` — novo,
  seguindo o padrão de mock de
  `apps/backoffice/__tests__/actions/tenant-members.test.ts` (ou
  equivalente, se o caminho for outro)
- [ ] T030 [P] [US3] Teste: chamada sem papel de staff/escrita retorna
  `FORBIDDEN`, sem `database.tenant.update` nem `logPlatformAudit`

### Implementation for User Story 3

- [ ] T031 [US3] Implementar `alterarTipoDeConta` em
  `apps/backoffice/app/actions/accounts.ts`, conforme
  [contracts/alterar-tipo-de-conta.md](./contracts/alterar-tipo-de-conta.md)
  — `requirePlatformStaff`/`assertCanWrite` → `database.tenant.update` →
  `logPlatformAudit` (depende de T001, T029, T030)

**Checkpoint**: US3 testável isoladamente.

---

## Phase 6: User Story 4 - Conta não interna não acessa produto não lançado, nem por URL (Priority: P2)

**Goal**: `requireModule` bloqueia acesso direto por URL para `CLIENTE`/
`TESTE`/`DEMO` quando o módulo está fora da lista geral; `INTERNA`
continua isenta desse bloqueio (só o card, US1).

**Independent Test**: ver
[quickstart.md#us4](./quickstart.md#us4--conta-não-interna-não-acessa-produto-não-lançado-nem-por-url).

### Tests for User Story 4

- [ ] T032 [P] [US4] Teste: `requireModule("MERIDIAN", ctx)` lança
  `FORBIDDEN` quando `ctx.tenantType !== "INTERNA"` e `MERIDIAN` não está
  em `LANCAMENTO_GERAL` — estender
  `apps/app/__tests__/meridian/guards.test.ts`
- [ ] T033 [P] [US4] Mesmo teste para Charter — novo
  `apps/app/__tests__/charter/guards.test.ts` (não existe hoje um teste
  dedicado ao `requireModule` de Charter)
- [ ] T034 [P] [US4] Mesmo teste para Scaffold — estender
  `apps/app/__tests__/scaffold/guard.test.ts`
- [ ] T035 [P] [US4] Mesmo teste para Signal — estender
  `apps/app/__tests__/signal/integration/guards.test.ts`
- [ ] T036 [US4] Teste: para `ctx.tenantType === "INTERNA"`, `requireModule`
  **não** bloqueia por lançamento (só por contrato, comportamento
  inalterado) — mesmos 4 arquivos de teste acima
- [ ] T037 [US4] Investigar e testar o equivalente em Cosmos (research.md
  §5 — `apps/app/app/(cosmos)/layout.tsx` não chama `hasModule` hoje;
  confirmar onde o bloqueio de FR-011 se aplica antes de escrever o teste)

### Implementation for User Story 4

- [ ] T038 [P] [US4] Adicionar a checagem de lançamento (com mensagem de
  erro distinta de "não contratado") em `requireModule`, conforme
  [contracts/guard-lancamento.md](./contracts/guard-lancamento.md), em
  `apps/app/lib/meridian/guards.ts` (linhas 65-75; depende de T003, T007,
  T032, T036)
- [ ] T039 [P] [US4] Mesma checagem em `apps/app/lib/charter/guards.ts`
  (linhas 59-69; depende de T033, T036)
- [ ] T040 [P] [US4] Mesma checagem em `apps/app/lib/scaffold/guards.ts`
  (linhas 36-46; depende de T034, T036)
- [ ] T041 [P] [US4] Mesma checagem em `apps/app/lib/signal/guards.ts`
  (linhas 44-54; depende de T035, T036)
- [ ] T042 [US4] Implementar o equivalente em Cosmos, no ponto que T037
  identificar (depende de T037)

**Checkpoint**: todas as 4 user stories completas e testáveis
independentemente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T043 [P] Validar manualmente os 4 cenários de
  [quickstart.md](./quickstart.md) de ponta a ponta, nos dois apps
- [ ] T044 Rodar `pnpm typecheck`, `pnpm check` (Biome) e `test:coverage`
  (≥80%) em `apps/app` e `apps/backoffice` antes do PR
- [ ] T045 Criar
  `.claude/completions/YYYY-MM-DD-tipo-de-conta-e-lancamento.md` ao
  concluir (dono: Alicerce)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: bloqueia todas as 4 user stories — nenhuma
  lê `Tenant.type`/`ctx.tenantType` sem ela
- **US1 (Phase 3)**: depende só da Foundational
- **US2 (Phase 4)**: depende só da Foundational — os 17 call sites
  restantes não dependem de US1/US3/US4 nem entre si (todos `[P]`)
- **US3 (Phase 5)**: depende só da Foundational (T001)
- **US4 (Phase 6)**: depende da Foundational (T003, `ctx.tenantType`) e de
  US1 (T007, as listas de lançamento) — não depende de US2 nem US3
- **Polish (Phase 7)**: depende de todas as stories desejadas completas

### Parallel Opportunities

- T012-T028 (US2, migração mecânica): todos `[P]`, arquivos diferentes,
  sem dependência entre si — maior lote de paralelismo do plano
- T038-T041 (US4, 4 guards): `[P]` entre si, mas cada um depende do
  respectivo teste (T032-T036) e de T007 (listas)
- US1, US2 e US3 podem rodar totalmente em paralelo entre si (times
  diferentes) depois da Foundational; US4 só depois de US1 fechar T007

---

## Parallel Example: User Story 2

```bash
# Todos após a Foundational, nenhuma dependência entre si:
Task: "Migrar apps/backoffice/app/actions/provisioning.ts"
Task: "Migrar apps/backoffice/app/actions/clientes-busca.ts"
Task: "Migrar apps/backoffice/app/actions/scaffold.ts"
Task: "Migrar apps/backoffice/app/actions/clients.ts"
Task: "Migrar apps/backoffice/app/actions/tenant-members.ts"
# ... (T012-T028 inteiras em paralelo)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 2: Foundational (T001-T004)
2. Completar Phase 3: US1 (T005-T009)
3. **Parar e validar**: catálogo interno já respeita o lançamento —
   resolve a spec 008 mesmo antes de US2/US3/US4 fecharem
4. Seguir com US2, US3, US4 em paralelo (não dependem entre si, exceto US4→US1)

### Incremental Delivery

1. Foundational → US1 → validar → demo (resolve o incidente original)
2. US2 em paralelo (migração mecânica, sem risco de comportamento) →
   validar com T010 (teste de arquitetura)
3. US3 em paralelo (ação nova, isolada) → validar
4. US4 depois de US1 fechar (precisa das listas) → validar, prestando
   atenção especial ao Cosmos (T037/T042, único caso não mapeado)

### Parallel Team Strategy

Foundational primeiro (bloqueia tudo). Depois: uma pessoa em US1 (curto,
é o MVP), um par em US2 (17 tasks mecânicas, alto paralelismo interno),
uma pessoa em US3 (isolado). US4 espera US1 fechar T007, então entra por
último ou reusa quem terminou US1.

---

## Notes

- [P] = arquivos diferentes, sem dependência entre si
- T010 é o gate de "migração completa" — só passa quando as 17 tasks de
  US2 (T012-T028) estiverem todas feitas, mesmo sendo tasks `[P]`
  independentes entre si
- T037/T042 (Cosmos) é o único ponto do plano sem localização exata
  confirmada — não adivinhar o arquivo antes de olhar o guard real de
  Cosmos na implementação
- Rodar `quickstart.md` inteiro antes de considerar a Fase 1 pronta
