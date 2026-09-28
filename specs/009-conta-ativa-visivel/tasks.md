---

description: "Task list for Conta ativa sempre visível (Fase 0 do modelo de contas)"
---

# Tasks: Conta ativa sempre visível (Fase 0 do modelo de contas)

**Input**: Design documents from `/specs/009-conta-ativa-visivel/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: incluídos — Constitution III (Test-First) é NON-NEGOTIABLE neste
repo; cada task de teste precede a de implementação que ela cobre.

**Organization**: tasks agrupadas por user story (spec.md), para permitir
implementação e teste independentes de cada uma.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência entre si)
- **[Story]**: US1/US2/US3/US4, conforme spec.md
- Caminhos de arquivo são reais, extraídos do código atual (ver research.md
  para arquivo:linha de cada achado)

---

## Phase 1: Setup

Nenhuma tarefa de setup — infraestrutura já existe (pnpm, Vitest, Playwright,
`@repo/design-system`, `@repo/auth`, `@repo/database`); sem dependência nova
a instalar, sem schema/migration (Assumptions do spec.md).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestrutura compartilhada pelas duas user stories de UI
(US1, US2). US3 e US4 são puramente de backend/sessão e não dependem desta
fase — podem começar em paralelo assim que a Foundational de UI existir ou
mesmo antes, já que não a usam.

- [x] T001 [P] Criar esqueleto do módulo compartilhado com o tipo
  `ActiveAccountData` (`{ activeTenantId, tenants: {id, name, role}[] }`,
  ver [contracts/shell-data-contract.md](./contracts/shell-data-contract.md))
  em `packages/design-system/components/account-switcher/types.ts`

**Checkpoint**: módulo compartilhado pronto para US1 (badge) e US2 (dialog)
importarem dele.

---

## Phase 3: User Story 1 - Saber sempre qual conta está ativa (Priority: P1) 🎯 MVP

**Goal**: nome da conta ativa aparece como texto sempre visível (nunca só
tooltip) no topo dos 5 produtos, via um único componente reusado.

**Independent Test**: abrir cada um dos 5 produtos e confirmar que o nome da
conta ativa aparece como texto na tela, sem hover — ver
[quickstart.md#us1](./quickstart.md#us1--nome-da-conta-sempre-visível).

**Achado de research.md**: o bug de "só tooltip" existe hoje só em Meridian
e Signal (`title={organization}`); Scaffold e Charter já mostram texto mas
com implementação própria; Cosmos já tem um bloco visual sem função de
seletor. Os 5 precisam convergir para o componente novo.

### Tests for User Story 1

- [x] T002 [P] [US1] Teste unitário: `ActiveAccountBadge` renderiza o nome da
  conta como nó de texto visível (não só no atributo `title`) em
  `apps/app/__tests__/design-system/active-account-badge.test.tsx` (novo)
- [x] T003 [P] [US1] Teste E2E: para cada um dos 5 produtos, o nome da conta
  aparece sem interação de mouse, em
  `apps/app/e2e/active-account-badge.spec.ts` (novo)

### Implementation for User Story 1

- [x] T004 [US1] Implementar `ActiveAccountBadge` (recebe `{ name: string }`,
  renderiza texto visível, sem tooltip-only) em
  `packages/design-system/components/account-switcher/active-account-badge.tsx`
  (depende de T001; deve falhar T002 antes de existir)
- [x] T005 [P] [US1] Trocar o `<span title={organization}>{user.role} · {user.name}</span>`
  por `<ActiveAccountBadge name={organization} />` em
  `apps/app/components/meridian/shell.tsx` (linhas 513-523 hoje)
- [x] T006 [P] [US1] Mesma troca em `apps/app/components/signal/shell.tsx`
  (bloco `title={organization}`, ~linha 618-632)
- [x] T007 [P] [US1] Trocar o `<span>{organization}</span>` próprio por
  `<ActiveAccountBadge name={organization} />` em
  `apps/app/components/scaffold/shell.tsx` (linhas 264-267 hoje)
- [x] T008 [P] [US1] Mesma troca no `<Link>{organization}</Link>` de
  `apps/app/components/charter/shell.tsx` (linhas 625-637 hoje)
- [x] T009 [P] [US1] Trocar o bloco `identity.tenantInitials` /
  `identity.tenantName` (botão sem `onClick`) por
  `<ActiveAccountBadge name={identity.tenantName} />` em
  `apps/app/components/cosmos/shell.tsx` (linhas 312-368 hoje, preservando o
  estilo de sidebar já existente)

**Checkpoint**: US1 completa e testável — nome da conta visível e idêntico
nos 5 produtos, sem seletor funcional ainda (isso é US2).

---

## Phase 4: User Story 2 - Trocar de conta com confirmação e feedback (Priority: P1)

**Goal**: seletor de conta com confirmação explícita antes de trocar, feedback
visível depois, reusando `/api/auth/switch-tenant` (já correto — valida
membership, escopa por sessão, limpa `better-auth.session_data`) e
`resolvePostLoginDestination` para o destino.

**Independent Test**: acionar o seletor, iniciar troca, confirmar que existe
passo de confirmação explícito, confirmar que a tela muda mostrando a conta
nova — ver [quickstart.md#us2](./quickstart.md#us2--trocar-de-conta-com-confirmação-p1).

### Tests for User Story 2

- [x] T010 [P] [US2] Teste unitário: `SwitchAccountDialog` só dispara a troca
  após confirmação explícita; cancelar não chama a troca em
  `apps/app/__tests__/design-system/switch-account-dialog.test.tsx` (novo)
- [x] T011 [P] [US2] Teste de integração: `getShellData()`/`ShellIdentity` de
  cada um dos 5 produtos devolve `tenants[]` + `activeTenantId` no formato de
  [contracts/shell-data-contract.md](./contracts/shell-data-contract.md) em
  `apps/app/__tests__/produto/shell-data.test.ts` (novo)
- [x] T012 [US2] Teste de integração (FR-009/SC-004): depois de um 200 de
  `POST /api/auth/switch-tenant`, uma chamada imediata a
  `requireTenantSession` já enxerga a conta nova, sem esperar a janela de
  cache de 60s — em
  `apps/app/__tests__/actions/auth/switch-tenant-cache.test.ts` (novo)
- [~] T013 [US2] Teste E2E: escolher outra conta → diálogo de confirmação →
  cancelar mantém a conta; confirmar leva ao destino certo com feedback
  visível da conta nova — estender `apps/app/e2e/workspace-switcher.spec.ts`
  (PARCIAL: edge case `tenants.length <= 1` coberto — nenhum seed atual
  dá 2+ `TenantMember` à mesma pessoa para exercitar o fluxo de troca de
  verdade; falta seed antes de fechar)

### Implementation for User Story 2

- [x] T014 [US2] Implementar `SwitchAccountDialog` (passo de confirmação
  explícito, chama `POST /api/auth/switch-tenant` — ver
  [contracts/switch-tenant-api.md](./contracts/switch-tenant-api.md), sem
  endpoint novo) em
  `packages/design-system/components/account-switcher/switch-account-dialog.tsx`
  (depende de T010)
- [x] T015 [US2] Compor `AccountSwitcher` (badge + seletor; esconde o
  seletor quando `tenants.length <= 1`, edge case do spec) em
  `packages/design-system/components/account-switcher/index.tsx` (depende de
  T004, T014)
- [x] T016 [US2] Server action fina que envolve
  `resolvePostLoginDestination()` (`apps/app/app/(authenticated)/_lib/resolve-post-login-destination.ts`)
  para uso pelo cliente depois de confirmar a troca, em
  `apps/app/app/actions/auth/resolve-active-account-destination.ts` (novo)
- [x] T017 [P] [US2] Estender `getShellData()` para incluir `tenants[]` +
  `activeTenantId` (mesma leitura de `TenantMember` de
  `apps/app/app/api/tenants/route.ts:12-30`) em
  `apps/app/app/(meridian)/actions/shell.ts`
- [x] T018 [P] [US2] Mesma extensão em
  `apps/app/app/(signal)/actions/shell.ts`
- [x] T019 [P] [US2] Mesma extensão em
  `apps/app/app/(scaffold)/actions/shell.ts`
- [x] T020 [P] [US2] Mesma extensão em
  `apps/app/app/(charter)/actions/shell.ts`
- [x] T021 [P] [US2] Mesma extensão em `ShellIdentity` e sua resolução
  (`apps/app/components/cosmos/shell.tsx:266-273` e o `layout.tsx` que a
  monta) em `apps/app/app/(cosmos)/layout.tsx`
- [x] T022 [P] [US2] Trocar `ActiveAccountBadge` por `AccountSwitcher`
  (passa `tenants` + `activeTenantId`, usa T016 + `router.push`/`refresh` no
  confirmar) em `apps/app/components/meridian/shell.tsx` (depende de T015,
  T017)
- [x] T023 [P] [US2] Mesma troca em `apps/app/components/signal/shell.tsx`
  (depende de T015, T018)
- [x] T024 [P] [US2] Mesma troca em `apps/app/components/scaffold/shell.tsx`
  (depende de T015, T019)
- [x] T025 [P] [US2] Mesma troca em `apps/app/components/charter/shell.tsx`
  (depende de T015, T020)
- [x] T026 [P] [US2] Mesma troca em `apps/app/components/cosmos/shell.tsx`
  (depende de T015, T021)

**Checkpoint**: US1 + US2 completas e testáveis juntas — MVP da Fase 0
pronto no lado de UI.

---

## Phase 5: User Story 3 - Fallback determinístico quando não há conta ativa (Priority: P2)

**Goal**: quando a sessão não tem `activeTenantId`, a conta escolhida é
sempre a mesma (membership mais antiga por `createdAt`), não ordem
arbitrária de banco.

**Independent Test**: zerar `activeTenantId` da sessão e repetir o acesso
várias vezes — a conta escolhida deve ser sempre a mesma. Ver
[quickstart.md#us3](./quickstart.md#us3--fallback-determinístico-p2).

**Achado de research.md**: `packages/auth/server.ts:209-212` hoje faz
`tenantMember.findFirst({ where: { userId } })` sem `orderBy` — ordem não
determinística. `TenantMember.createdAt` já existe
(`packages/database/prisma/schema/tenant.prisma:423`), sem migration
necessária.

### Tests for User Story 3

- [x] T027 [P] [US3] Teste unitário: `requireTenantSession` sem
  `activeTenantId` sempre escolhe o `TenantMember` de `createdAt` mais
  antigo, de forma repetível; com uma única membership, escolhe ela sem
  ambiguidade — em
  `apps/app/__tests__/auth/require-tenant-session-fallback.test.ts` (novo;
  seguir o padrão de mock de `apps/app/__tests__/actions/auth/switch-org.test.ts`)

### Implementation for User Story 3

- [x] T028 [US3] Adicionar `orderBy: { createdAt: "asc" }` à query
  `tenantMember.findFirst` em `packages/auth/server.ts:209-212` (depende de
  T027 falhando antes)

**Checkpoint**: US3 testável isoladamente, sem depender de US1/US2.

---

## Phase 6: User Story 4 - Convite e onboarding não trocam a conta de outras sessões (Priority: P2)

**Goal**: aceitar convite e completar onboarding trocam `activeTenantId` só
da sessão que executou a ação, não de todas via `session.updateMany`.

**Independent Test**: duas sessões da mesma pessoa; sessão B aceita convite
ou completa onboarding; sessão A mantém a conta que já tinha. Ver
[quickstart.md#us4](./quickstart.md#us4--conviteonboarding-não-vaza-entre-sessões-p2).

**Achado de research.md**: os dois pontos já têm `session.session.id`
disponível (a sessão já foi lida) — a troca é trocar `updateMany({ where:
{ userId } })` por `update({ where: { id: session.session.id } })`, mesmo
padrão já correto de `switch-tenant/route.ts:42-45` e `switch-org.ts:39-42`.

### Tests for User Story 4

- [x] T029 [P] [US4] Teste: aceitar convite na sessão B não altera
  `activeTenantId` de outra sessão (A) da mesma pessoa — em
  `apps/app/__tests__/actions/invite/complete.test.ts` (novo; não existe
  teste hoje para esta página)
- [x] T030 [P] [US4] Atualizar
  `apps/app/__tests__/actions/create-onboarding-workspace.test.ts`: o teste
  "sets activeTenantId on all user sessions after creation" (linhas 135-142)
  afirma hoje o comportamento que este FR proíbe — trocar a asserção para
  `session.update({ where: { id: <session.id> }, data: { activeTenantId } })`,
  adicionar `session: { id: "session-1" }` ao mock `defaultSession` (linha
  50-52) e trocar o mock `sessionUpdateMany` por `sessionUpdate`

### Implementation for User Story 4

- [x] T031 [US4] Trocar `database.session.updateMany({ where: { userId: session.user.id } })`
  por `database.session.update({ where: { id: session.session.id } })` em
  `apps/app/app/(unauthenticated)/invite/[token]/complete/page.tsx:53-56`
  (depende de T029)
- [x] T032 [US4] Mesma troca em `apps/app/app/actions/onboarding.ts:57-60`
  (depende de T030)

**Checkpoint**: todas as 4 user stories completas e testáveis
independentemente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T033 [P] Validar manualmente os 4 cenários de
  [quickstart.md](./quickstart.md) de ponta a ponta
- [ ] T034 Rodar `pnpm typecheck`, `pnpm check` (Biome) e `test:coverage`
  (≥80%, Constitution Quality Gates) antes do PR
- [ ] T035 Criar `.claude/completions/YYYY-MM-DD-conta-ativa-visivel.md` ao
  concluir a implementação (dono: Alicerce, conforme convenção do
  `CLAUDE.md` raiz)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: nenhuma — sem tarefas
- **Foundational (Phase 2)**: bloqueia US1 e US2 (ambas importam do módulo
  criado em T001); **não bloqueia** US3 nem US4, que são independentes de UI
- **US1 (Phase 3)**: depende só da Foundational
- **US2 (Phase 4)**: depende da Foundational e de US1 (reusa
  `ActiveAccountBadge` dentro de `AccountSwitcher`, T015)
- **US3 (Phase 5)**: sem dependência de Foundational, US1 ou US2 — pode
  rodar em paralelo com qualquer uma
- **US4 (Phase 6)**: sem dependência de Foundational, US1, US2 ou US3 — pode
  rodar em paralelo com qualquer uma
- **Polish (Phase 7)**: depende de todas as stories desejadas estarem
  completas

### Parallel Opportunities

- T017-T021 (extensão de `getShellData` nos 5 produtos) — arquivos
  diferentes, paralelizável
- T022-T026 (troca do componente nos 5 shells) — arquivos diferentes,
  paralelizável, mas cada um depende do par T017-T021 do mesmo produto
- US3 inteira e US4 inteira podem rodar em paralelo com US1+US2 (times
  diferentes, sem arquivo em comum)

---

## Parallel Example: User Story 2

```bash
# Depois de T014/T015/T016 prontos, os 5 produtos em paralelo:
Task: "Estender getShellData() em apps/app/app/(meridian)/actions/shell.ts"
Task: "Estender getShellData() em apps/app/app/(signal)/actions/shell.ts"
Task: "Estender getShellData() em apps/app/app/(scaffold)/actions/shell.ts"
Task: "Estender getShellData() em apps/app/app/(charter)/actions/shell.ts"
Task: "Estender ShellIdentity em apps/app/app/(cosmos)/layout.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 2: Foundational (T001)
2. Completar Phase 3: US1 (T002-T009)
3. **Parar e validar**: o incidente do dogfood (nome só em tooltip) já não
   se repete nos 5 produtos, mesmo sem seletor funcional
4. Seguir para US2 (o par que fecha a promessa de P1)

### Incremental Delivery

1. Foundational → US1 → validar → (opcional) demo/merge
2. US2 → validar → MVP completo de P1 (US1+US2)
3. US3 e US4 podem entrar a qualquer momento em paralelo — são
   independentes da UI
4. Cada story soma valor sem quebrar a anterior

### Parallel Team Strategy

Com mais de uma pessoa: Foundational primeiro (bloqueia US1/US2); depois
US1→US2 em sequência (mesma pessoa ou par, por causa da dependência de
`AccountSwitcher` sobre `ActiveAccountBadge`) enquanto outra pessoa toca
US3 e uma terceira toca US4 — as três frentes não compartilham arquivo.

---

## Notes

- [P] = arquivos diferentes, sem dependência entre si
- [Story] mapeia a task à user story do spec.md para rastreabilidade
- Teste antes de implementação em cada FR (Constitution III)
- T030 é a task mais sensível: um teste hoje afirma o comportamento que o
  FR-011 proíbe — não é só código de produção que muda, é a asserção do
  teste existente
- Rodar `quickstart.md` inteiro antes de considerar a Fase 0 pronta
