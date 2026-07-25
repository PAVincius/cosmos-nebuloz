# Cosmos/Nebuloz — Metodologia de Engenharia (SDD Playbook)

> Como executamos cada fase rumo ao MRR. Spec-Driven Development sobre spec-kit + agentes superpowers.
> Backbone de regras: `docs/CONSTITUTION.md`. Roadmap: `docs/superpowers/plans/2026-06-09-INDEX-mrr-roadmap.md`.
>
> **Última atualização:** 2026-06-09

---

## 1. Tooling

| Camada | Ferramenta | Papel |
|--------|-----------|-------|
| **Artifact pipeline** | spec-kit (`.specify/`) | constitution → spec → plan → tasks → implement |
| **Execução** | agentes superpowers | planner, tdd-guide, code-reviewer, security-reviewer, architect |
| **Gate de teste** | conceito BMAD-TEA | estratégia risk-based (ver Constituição) |

BMAD-METHOD full **não** instalado — personas duplicam os agentes já no repo.

### Mapeamento spec-kit ↔ artefatos
```
/speckit-constitution → docs/CONSTITUTION.md
/speckit-specify      → docs/srd-epic-NNN.md       (FR-XXX + Gherkin)
/speckit-plan         → plano técnico da feature
/speckit-tasks        → docs/stories/epic-NNN/story-NNN-*.md (WSJF + AC + Test Plan)
/speckit-implement    → TDD via tdd-guide
```
PRD permanece hand-authored (`docs/PRD-*.md`) como entrada da fase.

---

## 2. Pipeline SDD (fluxo padrão por feature)

```
PRD da fase (JTBD + personas + use cases)
   │  superpowers:brainstorming (se ambíguo)
   ▼
/speckit-specify  → SRD (FR-XXX, Gherkin, Must/Should/Could)
   │  architect agent (boundaries, ADRs)
   ▼
/speckit-plan     → plano técnico (schema, actions, rotas, integrações, segurança)
   │  planner agent
   ▼
/speckit-tasks    → stories (WSJF, AC, Test Plan) — test-first ordering
   │  superpowers:writing-plans
   ▼
/speckit-implement → TDD (tdd-guide): RED → GREEN → REFACTOR
   │
   ▼
Quality Gate: code-reviewer ∥ security-reviewer (paralelo)
   │  superpowers:requesting-code-review
   ▼
CI: biome → test:coverage → security → build
   │
   ▼
Completion doc (.claude/completions/) + merge
```

---

## 3. Best-practice por tipo de tarefa

| Tipo | Workflow de agentes | Gate extra |
|------|--------------------|-----------|
| **Feature nova** | brainstorming → specify → plan → tasks → tdd-guide → code-reviewer → security-reviewer | Coverage ≥80%, SAFe mapping |
| **Integration/webhook** | specify → plan (reusar webhook pattern, Artigo 7) → tdd-guide → **security-reviewer obrigatório** | sig verify + DLQ + idempotency tests |
| **Bugfix** | systematic-debugging → repro test (RED) → fix → code-reviewer | teste que reproduz o bug |
| **Refactor** | architect → tests verdes antes/depois → refactor-cleaner → code-reviewer | zero mudança de comportamento |
| **Schema/migration** | architect → plan → database-reviewer → migration test | RLS / tenant isolation verificado |

---

## 4. Fases (visão)

Detalhe e tracking: `docs/superpowers/plans/2026-06-09-INDEX-mrr-roadmap.md`.

| Fase | Objetivo | Estado | Métrica de saída |
|------|----------|--------|------------------|
| **0 — Meeting Integration** | Transcrição → decisions/risks/actions (Fireflies→Fathom→Otter, sem bot) | Blocker do trial | RTE conclui cerimônia → insights no Cosmos |
| **1 — TOTVS Trial Readiness** | MVP polido para trial enterprise | Specs existentes (epics 006-008) | TOTVS roda 1 PI Planning real sem fallback |
| **2 — Scale BR/LATAM** | Converter leads, reduzir fricção | PRD a detalhar | 3 contas enterprise; copilot on-prem |
| **3 — MRR Engine** | Motor de receita | PRD a detalhar | 5-10 contas; pricing por tier |

> Fases 1-3: specs detalhadas just-in-time (evita envelhecimento). Cada fase roda o pipeline §2 completo.

---

## 5. Definition of Done (por story)

- [ ] ACs (Gherkin) cobertos por testes
- [ ] Coverage ≥80% (Crítico/Alto: + negative cases)
- [ ] biome check + build verdes
- [ ] code-reviewer sem CRITICAL/HIGH aberto
- [ ] security-reviewer (se auth/PII/webhook/billing)
- [ ] tenant isolation verificado
- [ ] completion doc criado
