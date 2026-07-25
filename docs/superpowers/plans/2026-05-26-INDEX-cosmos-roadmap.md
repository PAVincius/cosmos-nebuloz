# Cosmos — Roadmap Plans Index (2026-05-26)

> Planos gerados a partir do `2026-05-26-cosmos-market-research-framework.md`
> Base: pesquisa de mercado em `docs/superpowers/specs/Cosmos: Framework de Pesquisa de Mercado.md`

---

## Fase 1 — Fundação de Adoção (3 meses)

| Plano | Tópico | Diferencial validado | Arquivo |
|---|---|---|---|
| 1 | T02 — AI INVEST Scoring | Único quality-gate AI no mercado | `2026-05-26-t02-ai-invest-scoring.md` |
| 2 | T12 — Sync Linear/GitHub SAFe-aware | Único sync SAFe-aware bidirecional | `2026-05-26-t12-linear-github-safe-sync.md` |
| 3 | T03 — RAG na PI Planning | RAG cirúrgico vs busca textual ampla | `2026-05-26-t03-rag-pi-planning.md` |
| 4 | T09 — Governance Kanban + DecisionLog | Compliance SOX/FDA com audit imutável | `2026-05-26-t09-governance-decisionlog.md` |

## Fase 2 — Inteligência (3–6 meses)

| Plano | Tópico | Diferencial validado | Arquivo |
|---|---|---|---|
| 5 | T05 — Anomaly Detection LLM | Narrativa contextual SAFe vs alertas brutos | `2026-05-26-t05-anomaly-detection-llm.md` |
| 6 | T04 — Flow Metrics 6D na UI | Zero-setup vs pipeline BI externo | `2026-05-26-t04-flow-metrics-ui.md` |
| 7 | T07 — FinOps integrado UI completa | Diff forte mid-market, sem Apptio | `2026-05-26-t07-finops-ui.md` |

## Fase 3 — Diferenciação UX (6–12 meses)

| Plano | Tópico | Diferencial validado | Arquivo |
|---|---|---|---|
| 8 | T13 — Copilot modes por role | UX adaptativa por papel SAFe nativo | `2026-05-26-t13-copilot-roles.md` |
| 9 | T11 — Yjs CRDT em Epic editing | Parity usabilidade — sem last-write-wins | `2026-05-26-t11-yjs-crdt-epic.md` |
| 10 | T08 — Confidence Vote + correlação | Bias scoring histórico — piplanning.io não tem | `2026-05-26-t08-confidence-vote-correlation.md` |
| 11 | T10 — Large Solution Level (opcional) | Parity sob demanda — flag desativado por padrão | `2026-05-26-t10-large-solution-level.md` |

## Reescopos críticos

| Plano | Tópico | Motivo | Arquivo |
|---|---|---|---|
| - | T06 — Capability Planning (ex-Synergy) | GDPR/LGPD bloqueia synergy individual | `2026-05-26-t06-capability-planning-rename.md` |

---

## Dependências entre Planos

```
T02 INVEST Scoring ──┐
                     ├──> T09 DecisionLog usa investScore como dado de suporte na transição
T03 RAG Indexer ─────┴──> T05 Anomaly LLM compartilha embedding-provider abstraction

T12 Linear sync ──────> independente, pode iniciar em paralelo

T06 Capability rename ─> independente, mas deve preceder qualquer comunicação externa

T07 FinOps UI ─────────> depende de BillingEntry populado (T07 usa dados de billing existentes)

T04 Flow UI ───────────> depende de getFlowMetrics() (já implementado — UI-only)

T08 Confidence Corr ───> depende de PI com VoteSessions encerradas (dados precisam existir)

T10 LST ───────────────> independente, feature flag off por padrão
```

## Sequência recomendada de execução

**Sprint 1 (paralela):** T02 + T12 + T06 (rename rápido, libera comunicação)
**Sprint 2:** T03 (depende de embedding-provider que T02 não tem, mas T05 vai usar)
**Sprint 3:** T09 (depende de T02 para incluir investScore no decision log)
**Sprint 4:** T05 (depende de embedding-provider do T03 + decision context)
**Sprint 5 (paralela):** T04 + T07 (UI-only, sem dependências novas)
**Sprint 6 (paralela):** T13 + T11 (UX — independentes entre si)
**Sprint 7:** T08 (precisa de PIs encerrados para ter dados de correlação)
**Sprint 8:** T10 (opcional — ativar se houver demanda de clientes com 3+ ARTs)

---

## Como executar cada plano

Cada plano segue o formato writing-plans com:
- Tasks bite-sized (2-5 min cada)
- TDD: failing test → implementation → passing test → commit
- Files exatos a criar/modificar
- Código completo em cada step (não placeholders)

Para executar:

```bash
# Subagent-driven (recomendado)
/spawn subagent-driven-development docs/superpowers/plans/2026-05-26-t02-ai-invest-scoring.md

# Ou inline
/execute-plan docs/superpowers/plans/2026-05-26-t02-ai-invest-scoring.md
```
