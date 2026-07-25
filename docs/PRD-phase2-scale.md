# PRD — Phase 2: Scale BR/LATAM

> Esqueleto. Detalhe just-in-time quando a fase iniciar (após Phase 1 / trial TOTVS).
> Roadmap: `docs/superpowers/plans/2026-06-09-INDEX-mrr-roadmap.md`.
>
> **Status:** skeleton · **Janela:** ~3-6 meses pós-trial

---

## 1. Objetivo

Converter os 2 leads restantes + pipeline BR/LATAM; reduzir fricção de adoção enterprise. Provar o diferenciador de **data sovereignty** (copilot on-prem).

## 2. Métrica de Sucesso

- 3 contas enterprise ativas.
- AI Copilot deployável on-prem (infra do cliente).

## 3. Escopo (epics/stories)

| Tema | Origem | Notas |
|------|--------|-------|
| Multi-org support | story-044 | múltiplos orgs por tenant/conta |
| SOC2 prep | `docs/compliance/soc2/` | controles + evidências |
| AI Copilot on-prem | **novo** | deploy do copilot na infra do cliente — diferenciador |
| Jira / Azure DevOps sync | **novo** | além de Linear/GitHub (✅) |
| Executive dashboard + export | story-045 | relatórios para C-level |

## 4. Capítulos a detalhar (na ativação)

- **On-prem deployment**: arquitetura, isolamento de dados, modelo de update, SLA.
- **Jira/ADO connectors**: mapeamento SAFe (reusar pattern LinearSync), bidirecional, DLQ.
- **Multi-org**: isolamento, billing por org, RBAC cross-org.

## 5. Gates

- architect (boundaries de deploy on-prem).
- database-reviewer (multi-org isolation).
- security-reviewer (data sovereignty, SOC2).

## 6. Riscos (preliminar)

- Complexidade de on-prem (versionamento, suporte).
- Jira/ADO API rate limits + mapeamento SAFe imperfeito.

> FRs detalhados via `/speckit-specify` na ativação da fase.
