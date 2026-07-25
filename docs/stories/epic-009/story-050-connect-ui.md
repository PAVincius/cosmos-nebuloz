# Story 050 — Connect UI (Settings → Integrations → Fireflies)

**Epic:** epic-009
**Status:** pending
**WSJF Score:** 9.0
**Points:** 5
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** ART
**SRD:** FR-901

## User Story
Como RTE, quero conectar minha conta Fireflies em Settings, para ativar a captura de insights das cerimônias.

## Acceptance Criteria

### AC-001: Conectar
Given RTE em Settings → Integrations,
When insere API key Fireflies válida e salva,
Then `MeetingIntegration { type=FIREFLIES, status=ACTIVE, tenantId }` é criado, API key cifrada no vault, e a webhook URL do Cosmos é exibida para colar no dashboard Fireflies.

### AC-002: Key inválida
Given uma API key inválida,
When o RTE salva,
Then erro claro exibido; nenhum registro persistido.

### AC-003: Desconectar
Given uma integração ativa,
When o RTE desconecta,
Then `status=PAUSED`; webhooks subsequentes vão para DLQ (FR-902 AC-004).

## Technical Notes
- Server action `actions/integrations/connectors/fireflies` retorna `Result<T>`.
- Validar key fazendo um ping GraphQL leve antes de persistir.
- UI com shadcn/ui no padrão de Settings existente.

## Test Plan
- **Risco:** Médio. Action test (válido/inválido/desconectar), component test.
- Verificar key nunca aparece em plaintext na response/UI.
