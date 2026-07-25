# Story 047 — Webhook Receiver `/api/webhooks/fireflies`

**Epic:** epic-009
**Status:** pending
**WSJF Score:** 13.0
**Points:** 5
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** ART
**SRD:** FR-902

## User Story
Como sistema, quero receber webhooks de transcrição do Fireflies com segurança, para enfileirar o processamento sem perder nem reprocessar eventos.

## Acceptance Criteria

### AC-001: Assinatura inválida → 403
Given um POST em `/api/webhooks/fireflies`,
When o HMAC-SHA256 do body não bate com `x-hub-signature`,
Then responde 403 e registra audit log (fire-and-forget).

### AC-002: Enqueue idempotente
Given assinatura válida e `meetingId` novo,
When processado,
Then seta idempotency key `fireflies:<meetingId>` (TTL 48h) e enfileira Inngest `integration/fireflies.webhook` com `{ tenantId, integrationId, meetingId, clientReferenceId }`.

### AC-003: Duplicata → 200 sem reprocessar
Given `meetingId` já processado em <48h,
When o webhook chega novamente,
Then responde 200 e não enfileira.

### AC-004: Integração pausada → DLQ
Given `MeetingIntegration.status=PAUSED`,
When o webhook chega,
Then o payload bruto vai para `webhookDlq` e não é enfileirado.

### AC-005: Rate limit
Given mais de N requests/min do mesmo IP,
When excede,
Then responde 429.

## Technical Notes
- Seguir Artigo 7 (webhook pattern): sig → rate limit → idempotency → audit → Inngest → DLQ.
- Modelo: `apps/app/app/api/webhooks/linear/route.ts`.
- `webhookSecret` do `MeetingIntegration` (resolver tenant pelo payload/secret).

## Test Plan
- **Risco:** Crítico. Sig verify test (válido/inválido), idempotency test, DLQ test, rate limit test, negative cases.
- Coverage obrigatório no path de segurança.
