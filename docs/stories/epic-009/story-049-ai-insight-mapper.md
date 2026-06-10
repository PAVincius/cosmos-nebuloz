# Story 049 — AI Mapper: Insights → Task / Risk / DecisionLog

**Epic:** epic-009
**Status:** pending
**WSJF Score:** 12.0
**Points:** 8
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** ART
**SRD:** FR-904

## User Story
Como RTE, quero que a AI classifique o summary da cerimônia em ações, riscos e decisões vinculados ao PI ativo, para não digitar manualmente.

## Acceptance Criteria

### AC-001: Action items → MeetingInsight ACTION
Given um summary com `action_items`,
When o mapper processa,
Then cada item vira `MeetingInsight` tipo `ACTION` com `sourceType=MEETING`, `tenantId`, `piPlanId` resolvido, `status=PENDING`.

### AC-002: Riscos → MeetingInsight RISK
Given o summary menciona risco,
When o mapper classifica,
Then cria `MeetingInsight` tipo `RISK` candidato a Risk/ROAM.

### AC-003: Decisões → MeetingInsight DECISION
Given o summary contém decisão,
When o mapper classifica,
Then cria `MeetingInsight` tipo `DECISION` candidato a DecisionLog.

### AC-004: PI não resolvível → unlinked
Given nenhum PI ativo resolvível (sem `clientReferenceId`, fora da janela de timestamp),
When o mapper roda,
Then insights ficam `piPlanId=null` e sinalizados para vínculo manual.

### AC-005: Tenant correto
Given o tenant da integração,
When entidades/insights são criados,
Then todos carregam o `tenantId` correto (zero cross-tenant).

## Technical Notes
- Reusar copilot tools / LLM (`actions/safe-copilot/tools/`).
- Resolver PI: `clientReferenceId` primeiro; fallback janela de timestamp da cerimônia × PISession agendada.
- Prompt deve retornar JSON estruturado (validar com Zod).

## Test Plan
- **Risco:** Alto (AI + tenant). Mock LLM com summaries-fixture; testar classificação por tipo, resolução de PI, fallback unlinked, tenant isolation.
- Negative: summary vazio, JSON malformado do LLM.
