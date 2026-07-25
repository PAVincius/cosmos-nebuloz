# Epic 009 — Meeting Intelligence Complete

**Data:** 2026-06-09
**Branch:** feat/kanban-portfolio-ai
**Commits:** 046 schema → 047 webhook → 048 worker → 049 AI mapper → 050 connect UI → 051 review UI → 052 provider adapter

---

## Entregues

| Story | Commit | Destaques |
|-------|--------|-----------|
| 046 | MeetingIntegration + MeetingTranscript + MeetingInsight schema + migration 028 + RLS |
| 047 | `/api/webhooks/fireflies/[integrationId]`: sig HMAC→ratelimit→idempotency(Redis SETNX 48h)→Inngest→DLQ |
| 048 | `fireflies-transcript` Inngest fn: decrypt apiKey→GraphQL fetch→upsert transcript→enqueue mapper |
| 049 | `fireflies-insights` Inngest fn: LLM classify ACTION/RISK/DECISION + fallback parseActionItemsFallback |
| 050 | `/settings/integrations/meeting`: connect Fireflies (API key, test conn, webhookSecret one-time) |
| 051 | `applyInsight`/`dismissInsight`/`listMeetingTimeline`; `/meetings` timeline; `/meetings/[id]/review` client |
| 052 | `MeetingProvider` type + registry; `FirefliesAdapter`/`FathomAdapter`; `/api/webhooks/fathom/[id]`; `fathom-transcript` fn; `connectFathom` |

---

## Decisões-chave

- **Tenant resolution**: URL per-integration `/api/webhooks/{provider}/[integrationId]` — tenant resolvido por DB lookup, nunca confia no body.
- **ACTION insights → Risk**: `Task.storyId` obrigatório na DB; ACTION vira Risk com category="organizational" (SAFe ROAM válido).
- **DECISION → DecisionLogEntry**: tipo="meeting-insight", targetType="PI" se piPlanId disponível.
- **Fathom API**: REST `GET /v1/calls/{id}`, sig header `X-Fathom-Webhook-Signature: sha256=<hmac>`.
- **Idempotência dual**: Redis SETNX 48h (webhook) + `@@unique([tenantId, meetingId])` (DB upsert).
- **Otter**: fora do scope — API limitada. Interface `getProvider("otter")` retorna null (slot pronto).

---

## Cobertura de testes

- 4 sig tests (Fireflies webhook verify)
- 4 transcript worker normalize tests
- 6 insight classify tests (LLM fallback)
- 3 connector URL tests
- 7 insight review action tests (apply/dismiss/idempotency)
- 12 provider contract tests (Fireflies+Fathom shape, HMAC, registry)

---

## Next (Phase 1 — TOTVS Trial Readiness)

- PI Planning flow completo (stories 021-026)
- LGPD + tenant isolation audit
- Onboarding RTE multi-ART (story-044)
