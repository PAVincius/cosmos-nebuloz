# Cosmos/Nebuloz Constitution

> Fonte de verdade humana: `docs/CONSTITUTION.md` — manter sincronizado.
> Carregada por `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`.

## Core Principles

### I. Multi-Tenant Safety (NON-NEGOTIABLE)
Toda query filtra por `tenantId` obtido via `requireTenantSession(await headers())`. Nunca query cross-tenant. Nunca confiar em `tenantId` vindo do body — sempre da sessão. RLS força isolamento no banco.

### II. Result<T>, não throw
Server actions retornam `Result<T>` (`{ ok, data } | { ok, error }`). Operações não-bloqueantes (audit, notificações) são fire-and-forget e não derrubam o fluxo principal.

### III. Test-First (NON-NEGOTIABLE)
TDD obrigatório: teste escrito → falha (RED) → implementação mínima (GREEN) → refactor. Test-first ordering: a task de teste precede a de implementação. Bugfix começa por teste que reproduz o bug. Coverage ≥80%.

### IV. Validação em Boundaries
Zod em todo boundary (webhook body, input de action, payload externo). Reusar primitivos de `_base.ts` (`nnStr`, `optStr`, `cuid`, `isoDate`) — nunca duplicar.

### V. Webhook Receiver Pattern
Endpoints `/api/webhooks/*` seguem ordem fixa: sig HMAC-SHA256 (timing-safe, 403 se inválida) → rate limit (Upstash) → idempotency (Redis SETNX 48h) → audit (fire-and-forget) → Inngest enqueue → DLQ fallback.

## Additional Constraints (Stack & Compliance)

- **pnpm only** v10.24.0 — nunca npm/yarn.
- **SAFe alignment**: toda feature mapeia 1 competência SAFe + 1 nível (Portfolio/Solution/ART/Team).
- **Idioma**: PT-BR na prosa; inglês nos termos técnicos.
- **Gate de teste risk-based** (BMAD-TEA): Crítico (auth/billing/tenant/webhook) → unit+integration+e2e+negative; Alto → unit+integration ≥80%; Médio → unit+component; Baixo → smoke.

## Quality Gates (CI — Development Workflow)

Blocking: `biome check` → `test:coverage` (≥80%) → security audit (high/critical) → `build`. `typecheck` informativo no CI, rodar local antes do PR. Completion doc por task em `.claude/completions/YYYY-MM-DD-<task>.md`.

## Governance

Esta constituição supera convenções ad-hoc. Todo spec/plan/task/PR verifica conformidade. Complexidade deve ser justificada (ver Complexity Tracking no plan-template). Amendments: editar `docs/CONSTITUTION.md` + este arquivo juntos.

**Version**: 1.0.0 | **Ratified**: 2026-06-09 | **Last Amended**: 2026-06-09
