# Story 052 — Fathom Adapter (Provider-Agnostic)

**Epic:** epic-009
**Status:** pending
**WSJF Score:** 6.0
**Points:** 5
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** ART
**SRD:** FR-901..904 (provider-agnostic)

## User Story
Como produto, quero suportar Fathom além de Fireflies, para ampliar a cobertura de clientes sem reescrever o pipeline.

## Acceptance Criteria

### AC-001: Interface MeetingProvider
Given o pipeline de meeting,
When implementado,
Then existe interface `MeetingProvider { verifySignature, fetchTranscript, normalizeSummary }` com Fireflies como impl base.

### AC-002: Fathom impl
Given a interface,
When o adapter Fathom é adicionado,
Then `/api/webhooks/fathom` reusa o mesmo receiver pattern e o worker normaliza o summary Fathom para o shape interno comum.

### AC-003: Connect UI Fathom
Given Settings → Integrations,
When o RTE escolhe Fathom,
Then conecta via API key/OAuth e cria `MeetingIntegration { type=FATHOM }`.

### AC-004: Roteamento por provider
Given múltiplas integrações no tenant,
When webhooks chegam,
Then cada um é roteado ao adapter correto sem colisão de idempotency.

## Technical Notes
- Refatorar story-047/048 para a interface antes de adicionar Fathom (evita branching por provider).
- Otter fica fora (API limitada) — interface deixa o slot pronto.

## Test Plan
- **Risco:** Médio. Testar Fireflies e Fathom contra a mesma interface (contract test).
- Verificar normalização produz shape idêntico para ambos.
