# Completion — Meeting Intelligence Foundation (epic-009)

**Date:** 2026-06-09
**Branch:** feat/kanban-portfolio-ai

## Scope entregue

### Metodologia SDD (commit 8b8b7dd6)
- `docs/CONSTITUTION.md` + `.specify/memory/constitution.md` (10 princípios, v1.0.0)
- `docs/METHODOLOGY.md` — pipeline PRD→SRD→Story→TDD→gate
- spec-kit real instalado via `uvx` (não-destrutivo): `.specify/` + 10 skills `.claude/skills/speckit-*`
- INDEX-mrr-roadmap (4 fases ↔ epics/stories)
- Phase 0 specs: PRD, SRD epic-009 (FR-901..906), 7 stories
- Phase 1-3 PRD skeletons

### story-046 — Schema (commit 2cb20721)
- `MeetingIntegration`, `MeetingTranscript`, `MeetingInsight` + migration 028
- RLS force + `tenant_isolation` policy; unique `(tenantId, meetingId)` idempotency
- Test schema (raw pg.Pool, skip sem DATABASE_URL)

### story-047 — Webhook receiver (commit e79bb4cd)
- `POST /api/webhooks/fireflies/[integrationId]` (URL per-integration resolve tenant+secret)
- `verifyFirefliesSignature` (HMAC-SHA256, x-hub-signature)
- Pattern Artigo 7: rate limit → sig → PAUSED→DLQ → idempotency → Inngest
- Sig test: 4 pass

## Decisões-chave
- **spec-kit > BMAD full**: BMAD duplicava agentes superpowers. Só conceito TEA (test risk-based).
- **URL per-integration** para Fireflies: payload não carrega tenantId; `[integrationId]` no path resolve tenant + webhookSecret.
- **String não enum** no schema: casa convenção do model `Integration` existente.
- **piPlanId loose** (sem FK): segue padrão de external refs do repo (P04).

## Verificação
- prisma format + generate ✓; biome ✓; typecheck novos arquivos limpo ✓
- Sig test 4/4; schema test válido (skip sem DB)

## Próximo (pending)
- story-048: Inngest worker fetch GraphQL transcript+summary
- story-049: AI mapper insights → Task/Risk/DecisionLog
- story-050: Connect UI (Settings → Fireflies)
- story-051: Insight review UI + timeline
- story-052: Fathom adapter (interface MeetingProvider)

## Notas
- Worker (048) consome `integration/fireflies.webhook` — precisa registrar inngest function + GraphQL client Fireflies (`api.fireflies.ai/graphql`, Bearer API key do vault).
- Otter adiado (API limitada, DNS developers.otter.ai falhou).
