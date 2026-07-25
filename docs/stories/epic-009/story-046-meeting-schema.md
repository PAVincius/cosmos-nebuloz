# Story 046 — Schema: MeetingIntegration, MeetingTranscript & MeetingInsight

**Epic:** epic-009
**Status:** pending
**WSJF Score:** 14.0
**Points:** 5
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** ART
**SRD:** FR-901, FR-903, FR-904

## User Story
Como engenheiro da plataforma, quero o schema Prisma de Meeting Intelligence, para persistir integrações, transcrições e insights com tenant isolation.

## Acceptance Criteria

### AC-001: MeetingIntegration
Given o domínio de meeting,
When a migration roda,
Then existe `MeetingIntegration { id, tenantId, type (FIREFLIES|FATHOM|OTTER), status (ACTIVE|PAUSED), credentialRef, webhookSecret, createdAt }` com índice em `tenantId`.

### AC-002: MeetingTranscript
Given uma transcrição recebida,
When persistida,
Then `MeetingTranscript { id, tenantId, integrationId (FK), meetingId, title, rawSummary (Json), piPlanId?, createdAt }` com unique `(tenantId, meetingId)`.

### AC-003: MeetingInsight
Given insights extraídos,
When persistidos,
Then `MeetingInsight { id, tenantId, transcriptId (FK), type (ACTION|RISK|DECISION), text, proposedTarget, status (PENDING|APPLIED|DISMISSED), appliedEntityId?, createdAt }`.

### AC-004: Tenant isolation
Given qualquer entidade nova,
When consultada,
Then RLS/tenant filter aplicado; zero acesso cross-tenant.

## Technical Notes
- Schema em `packages/database/prisma/schema/` (seguir bounded contexts existentes).
- `credentialRef` aponta para credential vault (não armazenar key em plaintext).
- `rawSummary` Json até normalização madura; considerar colunas tipadas depois.

## Test Plan
- **Risco:** Alto. Migration test + tenant isolation test.
- Verificar unique `(tenantId, meetingId)` previne duplicata (FR-903 idempotency).
- `pnpm migrate` gera sem erro; RLS force test.
