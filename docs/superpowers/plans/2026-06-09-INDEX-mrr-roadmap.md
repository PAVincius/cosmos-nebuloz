# INDEX — MRR Roadmap (4 Fases)

> Index executável: liga cada fase às epics/stories. Tracking vivo do caminho para MRR.
> Metodologia: `docs/METHODOLOGY.md`. Estratégia: memory `project-cosmos-strategy`.
>
> **Criado:** 2026-06-09

---

## Norte

MVP validado (3 RTEs ❤️, TOTVS + 2 leads). **Phase 0 é o único blocker para o primeiro trial pago.**
Objetivo: milhões USD em MRR via enterprises BR/LATAM rodando SAFe com 3+ ARTs.

---

## Phase 0 — Meeting Integration  🔴 BLOCKER

**Epic novo:** `epic-009-meeting-intelligence`
**Objetivo:** transcrição de Meet/Teams → decisions/risks/actions no Cosmos. Webhook das ferramentas (Fireflies 1º, Fathom 2º, Otter 3º). Sem bot próprio.
**Métrica:** RTE conclui 1 cerimônia → insights aparecem automaticamente. TOTVS inicia trial.

| Artefato | Local |
|----------|-------|
| PRD | `docs/meeting/PRD.md` |
| SRD | `docs/srd-epic-009.md` (FR-901..906) |
| Stories | `docs/stories/epic-009/story-046..052` |

| Story | Título | WSJF | Pts | Status |
|-------|--------|------|-----|--------|
| 046 | Schema MeetingIntegration/Transcript/Insight | 14 | 5 | ✅ done |
| 047 | Webhook receiver `/api/webhooks/fireflies` | 13 | 5 | ✅ done |
| 048 | Inngest worker: fetch GraphQL transcript+summary | 11 | 5 | ✅ done |
| 049 | AI mapper: insights → Task/Risk/DecisionLog | 12 | 8 | ✅ done |
| 050 | Connect UI (Settings → Integrations → Fireflies) | 9 | 5 | pending |
| 051 | Insight review UI + timeline de cerimônias | 8 | 8 | pending |
| 052 | Fathom adapter (provider-agnostic) | 6 | 5 | pending |

---

## Phase 1 — TOTVS Trial Readiness  (~4-8 semanas)

**Objetivo:** MVP polido para trial enterprise. **Métrica:** TOTVS roda 1 PI Planning real sem fallback para Jira.
**Gate:** security-reviewer + LGPD checklist obrigatórios.

| Área | Stories existentes |
|------|--------------------|
| PI Planning flow completo | epic-007 stories 021-026 |
| Confidence Vote + ROAM | ✅ implementado |
| Onboarding RTE (3 ARTs) | epic-008 story-044 |
| LGPD + tenant isolation | epic-008 story-034 |
| RBAC enforcement | epic-008 story-038 |

PRD: caps. 6 (PI Planning) + 12 (Security/Compliance) de `docs/PRD-v1.0.md`.

---

## Phase 2 — Scale BR/LATAM  (~3-6 meses)

**Objetivo:** converter 2 leads restantes + pipeline. **Métrica:** 3 contas enterprise ativas; copilot on-prem deployável.
**Gate:** architect (deploy on-prem), database-reviewer (multi-org isolation).
**PRD:** `docs/PRD-phase2-scale.md`.

- Multi-org (story-044) · SOC2 prep (`docs/compliance/soc2/`)
- AI Copilot on-prem (diferenciador data sovereignty)
- Jira/ADO sync (além de Linear/GitHub ✅)
- Executive dashboard + export (story-045)

---

## Phase 3 — MRR Engine  (~6-12 meses)

**Objetivo:** motor de receita escalável. **Métrica:** 5-10 contas enterprise BR; MRR por tier.
**Gate:** security-reviewer (billing/PII), e2e-runner (self-serve crítico).
**PRD:** `docs/PRD-phase3-monetization.md`.

- Pricing tiers: Starter (1 ART) / Growth (3+ ARTs) / Enterprise (on-prem + SLA)
- Self-serve onboarding · Billing/subscription
- API marketplace para integrações custom

---

## Open Risks

- **Otter API limitada** — confirmar antes de prometer; Fireflies + Fathom cobrem o trial.
- **AI mapping noise** — FR-905 (human review) mitiga.
- **spec-kit init** — rodar não-destrutivo; não clobber `.claude/commands`.
