# Story 048 — Inngest Worker: Fetch GraphQL Transcript + Summary

**Epic:** epic-009
**Status:** pending
**WSJF Score:** 11.0
**Points:** 5
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** ART
**SRD:** FR-903

## User Story
Como sistema, quero buscar o transcript e summary do Fireflies via GraphQL após o webhook, para persistir os dados da cerimônia normalizados.

## Acceptance Criteria

### AC-001: Fetch + persist
Given um evento `integration/fireflies.webhook`,
When o worker roda,
Then consulta GraphQL `transcript { title summary { overview action_items keywords outline } sentences }` autenticado com a API key do tenant (vault), e persiste `MeetingTranscript` com `tenantId`, `meetingId`, `rawSummary`.

### AC-002: Retry + DLQ
Given a query GraphQL falha (timeout/5xx),
When o worker tenta,
Then aplica retry com backoff (Inngest); esgotado, envia para DLQ com o erro.

### AC-003: Idempotente
Given `MeetingTranscript` já existe para `(tenantId, meetingId)`,
When o worker roda de novo,
Then atualiza sem duplicar.

## Technical Notes
- Cliente GraphQL Fireflies (`https://api.fireflies.ai/graphql`), Bearer API key do vault.
- Worker Inngest no padrão existente dos webhooks Linear/GitHub.
- Normalizar para shape interno antes de persistir `rawSummary`.

## Test Plan
- **Risco:** Alto. Mock GraphQL (sucesso/erro), retry path, idempotency test.
- Coverage ≥80%.
