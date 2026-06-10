# Cosmos/Nebuloz — Constituição de Engenharia

> Princípios invioláveis. **Todo** spec, plano, story e PR herda estas regras.
> Espelhado em `.specify/memory/constitution.md` (spec-kit). Atualizar os dois juntos.
>
> **Última atualização:** 2026-06-09

---

## Artigo 1 — Multi-Tenant Safety (CRÍTICO)

Toda query filtra por `tenantId`. Obter via `requireTenantSession(await headers())`.
**Nunca** query cross-tenant. **Nunca** confiar em `tenantId` vindo do body — sempre da sessão.

```ts
const { tenantId } = await requireTenantSession(await headers());
const epics = await db.epic.findMany({ where: { tenantId } });
```

## Artigo 2 — Result<T>, não throw

Server actions retornam `Result<T>` (`{ ok: true, data }` | `{ ok: false, error }`).
Operações não-bloqueantes (audit, notificações): fire-and-forget — não derrubam o fluxo principal.

## Artigo 3 — Zod de `_base.ts`

Reusar primitivos: `nnStr`, `optStr`, `cuid`, `isoDate`. **Nunca** duplicar.
Validar em todo boundary (body de webhook, input de action, payload externo).

## Artigo 4 — TDD obrigatório

RED → GREEN → REFACTOR. Teste primeiro, sempre. Test-first ordering imposto no template de tasks.
Bugfix começa por um teste que reproduz o bug.

## Artigo 5 — Quality Gates CI (blocking)

`biome check` → `test:coverage` (≥80%) → security audit (falha em high/critical) → `build`.
`typecheck` informativo (não-blocking no CI, mas rodar local antes de PR).

## Artigo 6 — pnpm only

pnpm v10.24.0. **Nunca** npm/yarn. `pnpm dev | test | build | migrate | check | fix | typecheck`.

## Artigo 7 — Webhook Receiver Pattern

Ordem obrigatória para todo endpoint `/api/webhooks/*`:
1. Verificar assinatura (HMAC-SHA256, timing-safe compare) → 403 se inválida
2. Rate limit por IP (Upstash sliding window)
3. Idempotency (Redis SETNX, TTL 48h) → 200 imediato se duplicado
4. Audit log (fire-and-forget)
5. Enqueue Inngest (`integration/<provider>.webhook`)
6. DLQ fallback se integration pausada/inativa

Referência: `apps/app/app/api/webhooks/linear/route.ts`, `.../github/route.ts`.

## Artigo 8 — SAFe Alignment

Toda feature mapeia a:
- **1 competência SAFe** (TEAM_TECHNICAL_AGILITY, AGILE_PRODUCT_DELIVERY, LEAN_PORTFOLIO_MANAGEMENT, ORGANIZATIONAL_AGILITY, ENTERPRISE_SOLUTION_DELIVERY, LEAN_AGILE_LEADERSHIP, CONTINUOUS_LEARNING_CULTURE)
- **1 nível** (Portfolio / Solution / ART / Team)

## Artigo 9 — Idioma

PT-BR primário na prosa (specs, stories, comentários de domínio). Termos técnicos em inglês.

## Artigo 10 — Completion Doc

Ao concluir uma task: `.claude/completions/YYYY-MM-DD-<task>.md` com decisões e learnings.

---

## Gate de Teste Risk-Based (inspirado em BMAD-TEA)

Profundidade de teste proporcional ao risco:
- **Crítico** (auth, billing, tenant isolation, webhook sig) → unit + integration + e2e + negative cases
- **Alto** (mutations de domínio SAFe) → unit + integration, coverage ≥80%
- **Médio** (UI, read paths) → unit + component
- **Baixo** (estático, copy) → smoke
