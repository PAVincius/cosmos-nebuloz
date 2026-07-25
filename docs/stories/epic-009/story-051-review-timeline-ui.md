# Story 051 — Insight Review UI + Timeline de Cerimônias

**Epic:** epic-009
**Status:** pending
**WSJF Score:** 8.0
**Points:** 8
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** ART
**SRD:** FR-905, FR-906

## User Story
Como RTE, quero revisar os insights extraídos antes de virarem entidades e ver a timeline de cerimônias por PI, para controlar o ruído da AI e ter rastreabilidade.

## Acceptance Criteria

### AC-001: Review — aprovar
Given insights `PENDING`,
When o RTE aprova um,
Then a entidade de domínio (Task/Risk/DecisionLog) é criada com `tenantId` + link ao PI, e o insight marca `status=APPLIED` (`appliedEntityId` setado).

### AC-002: Review — descartar
Given um insight,
When o RTE descarta,
Then `status=DISMISSED`; nenhuma entidade criada.

### AC-003: Review — editar
Given um insight,
When o RTE edita o texto/destino e aprova,
Then a entidade reflete a edição.

### AC-004: Timeline
Given meetings transcritas num PI,
When o RTE abre a timeline,
Then vê cada cerimônia (data, título, contagem de insights por status) e clicar abre a review.

## Technical Notes
- Reusar componentes de drawer/list existentes (kanban/portfolio).
- Actions: `applyInsight`, `dismissInsight` → `Result<T>`.
- Criação de entidade reusa actions de domínio (`tasks/`, `risks/`, `governance/`).

## Test Plan
- **Risco:** Médio. Action tests (apply/dismiss/edit cria entidade certa com tenantId), component test da timeline.
- Verificar idempotência de apply (não cria duplicado).
