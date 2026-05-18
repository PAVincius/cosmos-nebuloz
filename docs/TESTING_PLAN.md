# Plano de testes — COSMOS Nebuloz

Meta do PRD: **≥ 80% de cobertura** com isolamento multi-tenant (zero vazamento entre tenants).

Estado inicial (maio 2026): Vitest recolhia ficheiros Playwright em `e2e/` → `pnpm test` falhava; sem `test:coverage`; ~14 ficheiros de teste; RLS/RBAC só no repo legado `cosmos/`.

---

## Visão em camadas

| Camada | Ferramenta | O quê valida |
|--------|------------|--------------|
| **L0 — Domínio puro** | Vitest (`packages/safe-engine`, `apps/app/lib`) | WSJF, máquinas XState, agregações sem I/O |
| **L1 — Contratos** | Vitest (`schemas`, `permissions`) | Zod nos boundaries; tabela RBAC |
| **L2 — Server actions** | Vitest + mocks (`vi.mock`) | Auth, `enforce`, Prisma, `revalidateTag` |
| **L3 — Integração DB** | Vitest + Postgres E2E (`docker-compose.e2e.yml`) | RLS por tenant, rotas críticas |
| **L4 — E2E UX** | Playwright + UX Swarm | Personas SAFe, kanban, auth, workspace |

---

## Fase 1 — Fundação (esta sessão) ✅ alvo

1. **Separar runners**
   - `vitest.config.mts`: `include: ["__tests__/**"]`, `exclude: ["e2e/**"]`
   - `test` = unit; `test:e2e` = Playwright (inalterado)

2. **Scripts de coverage**
   - `apps/app`: `test:coverage` com `@vitest/coverage-v8`
   - `packages/safe-engine`, `apps/api`: idem
   - Raiz: `test:coverage` via `turbo test:coverage`

3. **Extrair lógica testável**
   - `lib/portfolio-aggregate.ts`: `effectiveFeatureWsjf`, `aggregateEpicRow`
   - `get-portfolio.ts` importa da lib (sem mudar comportamento)

4. **Primeiros testes unitários (app)**
   - `__tests__/portfolio-cache.test.ts`
   - `__tests__/portfolio-aggregate.test.ts`
   - `__tests__/schemas.test.ts` (UpdateWSJF, UpdateEpicStatus, ConfidenceVote)
   - `__tests__/permissions.test.ts` (matriz WSJF, Epic, ADMIN, read default)

5. **Verificação**
   - `pnpm test` na raiz → verde
   - `pnpm test:coverage` → relatório baseline documentado

**Critério de done:** `turbo test` verde; zero specs E2E no Vitest; ≥ 30 casos unitários novos na app.

---

## Fase 2 — Server actions críticas (1–2 PRs)

Prioridade por risco de negócio:

| Módulo | Ficheiro | Testes | Estado |
|--------|----------|--------|--------|
| WSJF | `features/update-wsjf.ts` | mock `database`, session, score + `revalidateTag` | ✅ `__tests__/actions/update-wsjf.test.ts` |
| Kanban | `epics/update-status.ts` | status válido, tenant no `where` | ✅ `__tests__/actions/update-epic-status.test.ts` |
| Confidence vote | `arts/confidence-vote.ts` | `sendVoteEvent` transições + tenant | ✅ `__tests__/actions/send-vote-event.test.ts` |
| Portfolio | `epics/get-portfolio.ts` | mock cache + session | ✅ `__tests__/actions/get-portfolio.test.ts` |
| Auth tenant | `@repo/auth/server` | `switch-tenant`, sessão | Pendente (`packages/auth`) |

Padrão de mock:

```ts
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1", userId: "u1", role: "PO" }),
  requireRole: vi.fn(),
}));
vi.mock("@repo/database", () => ({ database: { feature: { findFirst: vi.fn(), updateMany: vi.fn() } } }));
```

**Critério:** coverage `app/actions/epics/*` e `features/update-wsjf.ts` ≥ 70%.

**Helpers:** `__tests__/helpers/action-mocks.ts` — contexto tenant, `MockAuthError`, factories para mocks hoisted.

---

## Fase 3 — RBAC parametrizado (paridade `cosmos/`) ✅

Implementado em `apps/app/__tests__/rbac-matrix.test.ts`:

1. `it.each` sobre todas as entradas de `POLICIES` × 6 roles não-ADMIN
2. Casos globais: bypass ADMIN, `read` sem restrição, listas vazias = ADMIN-only, ações indefinidas negadas

**Critério:** 100% das entradas explícitas em `POLICIES` cobertas — **feito** (89 casos parametrizados + 4 suites fixas).

---

## Fase 4 — RLS / integração DB

Pré-requisitos: `docker compose -f docker-compose.e2e.yml up -d`, `DATABASE_URL` de teste.

1. Copiar padrão de `cosmos/tests/integration/rls/*.rls.test.ts` para `apps/app/__tests__/integration/rls/`.
2. Entidades mínimas: `portfolio` (epic/feature), `team`, `user`, `notification`.
3. Cada teste: user A tenant 1 não vê dados tenant 2.

Script raiz (futuro): `test:integration` com flag `RUN_INTEGRATION=1`.

**Critério:** suite RLS verde em CI com serviço Postgres.

---

## Fase 5 — CI e gate de qualidade

1. `.github/workflows/test.yml`:
   - job `unit`: `pnpm test` + `pnpm test:coverage`
   - job `e2e` (opcional em PR): Playwright com secrets `E2E_*`
2. Upload artefacto `coverage-summary.json`.
3. Threshold progressivo no Vitest:
   - M1: `lines: 40`
   - M2: `lines: 60`
   - M3: `lines: 80` (meta PRD)

4. PR template: checkbox “testes adicionados/atualizados”.

---

## Fase 6 — E2E e Swarm

Manter e expandir (sem misturar com Vitest):

| Spec | Persona / fluxo |
|------|-----------------|
| `lpm.spec.ts` | Portfolio kanban, WSJF |
| `rte.spec.ts` | PI Planning, ART |
| `po.spec.ts` | Stories, `switch-tenant` API |
| `sm.spec.ts` | Métricas equipa |
| `devops.spec.ts` | Integrações |

`pnpm swarm` antes de release; relatórios em `docs/ux-reports/`.

---

## Comandos (após Fase 1)

```bash
# Unit (monorepo)
pnpm test

# Coverage
pnpm test:coverage

# Só app
pnpm --filter app test
pnpm --filter app test:coverage

# E2E (app a correr em :3012 ou PLAYWRIGHT_BASE_URL)
pnpm --filter app test:e2e

# Swarm UX
pnpm --filter app swarm
```

---

## Métricas e roadmap de coverage

| Marco | Linhas (app actions + lib) | Prazo sugerido |
|-------|---------------------------|----------------|
| Baseline pós-Fase 1 | ~15–25% | Imediato |
| Fase 2 completa | ~45% | +1 sprint |
| Fase 3 RBAC | ~55% | +1 sprint |
| Fase 4 RLS | ~65% | +2 sprints |
| Meta PRD | **≥ 80%** | +2–3 sprints |

---

## O que NÃO fazer

- Não correr `e2e/**/*.spec.ts` no Vitest.
- Não usar `toBeDefined()` como único assert de páginas (preferir roles/labels).
- Não commitar `.env` com credenciais nos testes de integração.
- Não duplicar `calculateWSJF` — sempre `@repo/safe-engine`.

---

## Checklist de execução (sessão atual)

- [x] Plano documentado (`docs/TESTING_PLAN.md`)
- [x] Vitest exclui `e2e/`
- [x] Scripts `test:coverage`
- [x] `lib/portfolio-aggregate.ts` + testes
- [x] Testes schemas + permissions + cache
- [x] `pnpm test` verde na raiz (33 testes: app 24 + safe-engine 8 + api 1)
- [x] `pnpm --filter app test:coverage` (baseline ~19% linhas em `app/actions` — ver relatório HTML em `apps/app/coverage/`)

### Refactor suporte a testes

- `permissions-policy.ts` — RBAC puro (sem `@repo/auth/server`)
- `lib/portfolio-aggregate.ts` — agregação WSJF do kanban
- Vitest: alias `server-only` → mock vazio em testes
