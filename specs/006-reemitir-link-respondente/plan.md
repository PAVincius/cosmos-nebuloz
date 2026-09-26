# Implementation Plan: Reemitir link do respondente (Meridian)

**Branch**: `006-reemitir-link-respondente` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-reemitir-link-respondente/spec.md`

## Summary

Duas novas server actions na coleta do Meridian: `reissueRespondentLink` (por respondente, gira `tokenHash` no mesmo padrão de `revokeRespondent`, sem mudar `status`) e `reissuePendingLinks` (em lote, para todo `INVITED`/`PENDING`/`OVERDUE` do assessment). Ambas bloqueiam quando o `assessment.deadline` já passou, e fixam `tokenExpiresAt = min(now + 14d, assessment.deadline)` no momento da emissão. UI: botão "Reemitir link" ao lado de "Lembrar"/"Revogar" por respondente, e uma ação de lote que abre um modal de lista (nome · eixo · link) com copiar tudo e baixar `.txt`/`.csv`.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 15 (App Router)

**Primary Dependencies**: Prisma + PostgreSQL (`packages/database`); `@repo/rbac` (via `requireMeridianPermissionContext`); nenhuma dependência nova — reaproveita `hashToken`/`issueToken` (`lib/meridian/respondent-token`) e `logMeridianAudit` (`actions/_shared.ts`) já existentes.

**Storage**: PostgreSQL via Prisma — sem mudança de schema (campos `tokenHash`, `tokenExpiresAt`, `status` já existem em `MeridianRespondent`; auditoria usa a tabela append-only já existente, só um novo valor de `action`).

**Testing**: Vitest (`apps/app/__tests__/meridian/`) + Playwright E2E (`apps/app/e2e/`), mesmo padrão de `collection.test.ts`/`meridian-collection-as112.spec.ts`.

**Target Platform**: Web, Vercel (Next.js), `app.nebuloz.ai`.

**Project Type**: Monorepo — mudanças isoladas em `apps/app/app/(meridian)/actions/collection.ts` e `apps/app/components/meridian/screens/tab-coleta.tsx`.

**Performance Goals**: Sem meta nova — a ação em lote roda numa transação única por assessment, na mesma ordem de grandeza da atribuição em lote existente (dezenas de respondentes, não milhares).

**Constraints**: Multi-tenant safety (constituição I) — toda operação passa por `requireMeridianPermissionContext("assessment.manage")` e `withTenantDb(ctx.tenantId, …)`, como as actions vizinhas. Não mexe em `packages/auth` (superfície da spec 004, corre em paralelo sem overlap de arquivo).

**Scale/Scope**: Pequena — uma action nova, uma extensão de action existente (revoke-like), dois botões, um modal de lista. Sem novo serviço, sem nova tabela.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Multi-Tenant Safety (NON-NEGOTIABLE)** — PASS. Ambas as actions abrem com `requireMeridianPermissionContext("assessment.manage")` e operam dentro de `withTenantDb(ctx.tenantId, …)`, buscando o respondente/assessment por `id` **e** `tenantId`, igual a `revokeRespondent`/`assignRespondent`.
- **II. Result\<T\>, não throw** — PASS. `reissueRespondentLink`/`reissuePendingLinks` retornam `Result<T>` via `safeAction`, erros de domínio (`DONE`/`REVOKED`/prazo vencido) como `MeridianRuleError`/`StateConflictError`, mesmo padrão de `revokeRespondent`/`closeCollection`.
- **III. Test-First (NON-NEGOTIABLE)** — PASS (a garantir na execução): teste antes de implementação pra cada FR, cobertura ≥80% nos arquivos tocados.
- **IV. Validação em Boundaries** — PASS. Input de cada action (`respondentId`/`assessmentId`) validado com Zod (`cuid` de `_base.ts`), mesmo padrão de `RevokeSchema`/`CloseSchema`.
- **V. Webhook Receiver Pattern** — N/A. Sem endpoint de webhook.

Nenhuma violação — sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-reemitir-link-respondente/
├── intent.md             # Aprovado
├── spec.md               # Aprovado
├── plan.md               # Este arquivo
├── research.md           # Phase 0
├── data-model.md         # Phase 1
├── quickstart.md         # Phase 1
├── contracts/
│   └── actions.md
└── tasks.md              # /speckit-tasks (a seguir)
```

### Source Code (repository root)

```text
apps/app/
├── app/(meridian)/actions/
│   └── collection.ts                 # + reissueRespondentLink, + reissuePendingLinks
├── components/meridian/screens/
│   └── tab-coleta.tsx                # + botão "Reemitir link" (linha do respondente, perto de Lembrar/Revogar)
│                                      # + ação/modal "Reemitir e copiar todos os pendentes"
├── __tests__/meridian/
│   └── collection.test.ts            # + casos de reemissão (individual e lote)
└── e2e/
    └── meridian-collection-as112.spec.ts  # + cenário de reemissão, ou novo spec dedicado
```

**Structure Decision**: Tudo dentro da superfície já existente da coleta do Meridian (`actions/collection.ts` + `tab-coleta.tsx`) — sem arquivo novo de action, seguindo o padrão já estabelecido de `assignRespondent`/`revokeRespondent`/`sendReminder`/`closeCollection` no mesmo módulo. Sem overlap com a spec 004 (que mexe em `packages/auth`).
