# Implementation Plan: Tipo de conta e lançamento por coorte (Fase 1 do modelo de contas)

**Branch**: `010-tipo-de-conta-e-lancamento` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-tipo-de-conta-e-lancamento/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

`Tenant.type` (enum `CLIENTE`/`INTERNA`/`TESTE`/`DEMO`/`SISTEMA`, ADR-0018)
substitui `isSystem` e `isInternalTenant` em todos os ~19 pontos de leitura
hoje espalhados por `apps/app` e `apps/backoffice`; o back-office ganha uma
ação para trocar o tipo de uma conta, auditada via `logPlatformAudit`
(`@repo/provisioning`, mesmo padrão de `tenant-members.ts:147-158`); o
catálogo pós-login (`/produto`) passa a checar duas listas de lançamento
mantidas em código (acesso antecipado para `INTERNA`, geral para as demais)
antes de deixar um card clicável — resolvendo a spec 008. FR-011 foi
resolvido via `/speckit-clarify` em 2026-09-27 (CEO, `proposta.md` commit
`ef39a747`): para `CLIENTE`/`TESTE`/`DEMO`, produto fora da lista geral
bloqueia também o acesso direto por URL, via a mesma checagem que hoje
nega por falta de contrato (`requireModule`, 4 cópias em
`apps/app/lib/{meridian,charter,scaffold,signal}/guards.ts`); `INTERNA`
continua isenta desse bloqueio (FR-010, inalterado). Este plano cobre as 4
user stories por completo.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 15 App Router (React 19),
Prisma (PostgreSQL)

**Primary Dependencies**: `@repo/database` (Prisma, RLS), `@repo/provisioning`
(`logPlatformAudit`, porta única cross-tenant via `platformDb`), `@repo/rbac`
(`listModules`/`hasModule`, inalterado), `@repo/auth`

**Storage**: PostgreSQL via Prisma — migration de schema (`Tenant.type`) e de
dado (mapeamento ADR-0018), responsabilidade do Alicerce

**Testing**: Vitest (unit/integration, `apps/app/__tests__/` e
`apps/backoffice/__tests__/`), Playwright (E2E, `apps/app/e2e/` e
`apps/backoffice/e2e/` se existir)

**Target Platform**: Web — dois apps do monorepo (`apps/app`,
`apps/backoffice`)

**Project Type**: Web application — monorepo pnpm/Turborepo

**Performance Goals**: N/A — troca de tipo e leitura de lançamento são
operações de baixo volume (SC-004: reflete na próxima carga de página, sem
exigir deploy)

**Constraints**: nenhum novo mecanismo de acesso cross-tenant (ADR-0013
continua valendo — leitura de `Tenant.type` de outra conta, quando
necessária no back-office, passa por `platformDb`, nunca por `apps/app`);
listas de lançamento MUST permanecer manuais, sem ligação ao gate de
maturidade (FR-006); bloqueio de URL direta (FR-011) reusa a checagem já
existente de `requireModule`, sem duplicar a lógica de contrato (FR-009)

**Scale/Scope**: ~19 pontos de leitura de `isSystem`/`isInternalTenant`
migrados (12 em `apps/backoffice/app/actions/*`, 2 em
`apps/backoffice/lib/*`, 1 em `apps/app/app/(authenticated)/_lib/*`, 3 em
scripts/E2E de `apps/app`), 1 enum novo, `TenantContext` ganha 1 campo, 4
cópias de `requireModule` ganham a checagem de FR-011 (+ Cosmos, a
confirmar), 1 ação nova de back-office, 2 listas de código novas, 1 ponto
de checagem novo no catálogo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Multi-Tenant Safety (NON-NEGOTIABLE)** — PASS. Nenhuma query nova
  cross-tenant: as listagens de `apps/backoffice` que hoje filtram
  `isSystem: false` (12 arquivos, ver research.md) continuam filtrando por
  `tenantId`/`slug` da própria query, só trocam o campo do filtro. A ação de
  trocar `Tenant.type` grava `tenantId` explícito, nunca de input não
  validado — reusa `assertCanWrite`/`requirePlatformStaff`
  (`apps/backoffice/lib/guard.ts`).
- **II. Result<T>, não throw** — PASS. A ação nova de troca de tipo segue o
  padrão de `safeAction`/`Result<T>` já usado em
  `apps/backoffice/app/actions/tenant-members.ts` (mesmo arquivo de
  referência para a chamada de `logPlatformAudit`).
- **III. Test-First (NON-NEGOTIABLE)** — PASS, gate para `/speckit-tasks`:
  cada FR tem cenário Given/When/Then testável; migração de dado (FR-002)
  tem teste de verificação (SC-003) antes de considerar completa.
- **IV. Validação em Boundaries** — PASS. Input da ação de troca de tipo
  (`tenantId`, `type` novo) validado por schema Zod, reusando primitivos de
  `_base.ts`/`schemas.ts` já existentes — sem input externo novo além
  desse.
- **V. Webhook Receiver Pattern** — N/A, sem webhook nesta feature.

Nenhuma violação — sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/database/prisma/schema/
└── tenant.prisma                # linhas 36,42 — Tenant.type substitui isSystem/isInternalTenant (FR-001/002)

packages/auth/
└── server.ts                    # linhas 155-160,195-259 — TenantContext ganha tenantType, resolvido dentro de requireTenantSession (base de FR-011)

packages/provisioning/src/
└── (logPlatformAudit já existe — reusado, não alterado, FR-004)

apps/app/
├── lib/{meridian,charter,scaffold,signal}/guards.ts  # requireModule (4 cópias) ganha checagem de lançamento geral pra tipo != INTERNA (FR-011)
├── app/(cosmos)/layout.tsx                  # resolveIdentity() — ponto de bloqueio equivalente a confirmar na implementação (research.md §5, sem `hasModule` hoje)
├── app/(authenticated)/_lib/
│   └── resolve-post-login-destination.ts   # linhas 12-22 — isTenantInterno() lê Tenant.type
├── app/actions/produtos/index.ts            # ORDEM/CATALOGO inalterados; EstadoDoProduto ganha checagem de lançamento (FR-007/008)
├── app/(authenticated)/produto/page.tsx     # linhas 69-119 — emBreve passa a checar lançamento, não só estado !== DISPONIVEL
├── app/(authenticated)/page.tsx             # comentário/uso de isInternalTenant (linha 4) — migrar leitura
├── scripts/{seed-catalogo-e2e,seed-e2e,verify-charter,verify-seed}.ts  # seeds de teste que gravam/leem os booleanos — migrar pra type
└── e2e/{setup/auth.setup,catalogo-pos-login.spec}.ts                    # personas de teste referenciam isInternalTenant — migrar

apps/backoffice/
├── app/actions/
│   ├── provisioning.ts           # linha 22-24 — tenant.isSystem → tenant.type === "SISTEMA"
│   ├── clientes-busca.ts         # linha 38 — isSystem: false → type: { not: "SISTEMA" }
│   ├── scaffold.ts               # linhas 65,133,153 — idem
│   ├── clients.ts                # linhas 194,211 — idem
│   ├── tenant-members.ts         # linha 50 — idem; também a referência de padrão de auditoria (logPlatformAudit, linhas 147-158) para a nova ação de troca de type
│   ├── engagements.ts            # linha 134 — idem
│   ├── scaffold-supervision.ts   # linhas 105,218 — idem
│   ├── accounts.ts               # linha 178 — idem; **novo**: ação `alterarTipoDeConta` aqui (troca Tenant.type, FR-004)
│   ├── audit.ts                  # linha 90 — idem
│   └── benchmark.ts              # linha 78 — idem
└── lib/client-queries.ts         # linhas 12,34 — idem

apps/app/__tests__/
└── produto/                      # testes novos/estendidos de FR-007/008 (catálogo respeita lançamento)

apps/backoffice/__tests__/ (ou local equivalente)
└── accounts/                     # teste novo da ação alterarTipoDeConta + auditoria (FR-004, US3)
```

**Structure Decision**: `Tenant.type` fica no schema existente
(`tenant.prisma`), sem novo pacote. A ação de trocar tipo entra em
`apps/backoffice/app/actions/accounts.ts` (já é onde vive a leitura de
contas do back-office, linha 178) em vez de um arquivo novo, seguindo a
convenção de uma action por domínio já usada no app. As duas listas de
lançamento (acesso antecipado + geral) são constantes exportadas de um novo
arquivo `apps/app/app/actions/produtos/lancamento.ts`, ao lado do
`CATALOGO`/`ORDEM` que `listarProdutos()` já usa — mesmo padrão de
`onboarding-modules.ts` (`SELF_SERVICE_MODULES`) citado no intent.

## Complexity Tracking

Nenhuma violação da constituição — seção não aplicável.
