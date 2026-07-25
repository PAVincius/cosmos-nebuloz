# Microcopy Glossary — Cosmos Nebuloz

Canonical PT-BR terminology for all SAFe concepts in the UI. Consistency across tooltips, labels, badges, notifications, and empty states.

---

## Regra geral

| Inglês (SAFe 6.0) | Cosmos PT-BR | Evitar |
|---|---|---|
| Program Increment | PI | Sprint do PI, Incremento |
| Epic | Épico | Epic (em inglês) |
| Feature | Feature | Funcionalidade |
| Story / User Story | Story | Estória, História |
| Sprint | Sprint | Iteração |
| Backlog | Backlog | Fila, Lista |
| Kanban | Kanban | Quadro Kanban |
| Portfolio | Portfólio | Portfolio (sem acento) |
| Release Train Engineer | RTE | Líder do trem |
| Release Train | Trem de lançamento (completo) / ART (sigla) | |
| Lean Portfolio Management | LPM | Gestão de Portfólio |
| Product Owner | PO | |
| Scrum Master | SM | |
| DevOps | DevOps | Dev Ops, Dev/Ops |

---

## Scores e métricas

| Conceito | Label | Tooltip / legenda |
|---|---|---|
| WSJF | WSJF | Weighted Shortest Job First — prioriza pelo menor job |
| INVEST Score | INVEST | Independent · Negotiable · Valuable · Estimable · Small · Testable |
| Business Value | BV | Valor de negócio |
| Time Criticality | TC | Urgência temporal |
| Risk Reduction | RR | Redução de risco |
| Job Size | JS | Tamanho do job |
| Composite Score | Score INVEST | Média ponderada de todas as dimensões |

---

## Estados de governance

| Status | Label | Cor semântica |
|---|---|---|
| `BLOCKED` | ⚠ BLOCKED | `--red-c` |
| `ON_TRACK` | No prazo | `--green-c` |
| `AT_RISK` | Em risco | `--amber-c` |
| `DONE` | Concluído | `--green-soft` |
| `CANCELLED` | Cancelado | `--muted-foreground` |

---

## Ações de IA

| Contexto | Label | Ícone / símbolo |
|---|---|---|
| Análise INVEST | "Analisar com IA" | ✦ (cosmos-ai) |
| Reanalizar | "Reanalisar" | ✦ |
| Análise em progresso | "Analisando…" | spinner |
| Resultado de IA | "✦ Cosmos AI" | cor: `--cosmos-ai-fg` |
| Alta confiança | "Alta confiança" | `text-green-*` |
| Confiança média | "Confiança média" | `text-amber-*` |
| Baixa confiança | "Baixa confiança" | `text-red-*` |

---

## Empty states

| Contexto | Mensagem principal | CTA |
|---|---|---|
| Coluna kanban vazia | — | `+ Épico` |
| Nenhum INVEST calculado | "Nenhum score INVEST calculado ainda." | "Analisar com IA" |
| Sem features vinculadas | "Nenhuma feature vinculada." | "Adicionar feature" |
| Sem OKRs vinculados | "Sem OKRs." | "Vincular OKR" |
| PI sem épicos | "Sem épicos neste PI." | "Criar épico" |

---

## Toasts e notificações

| Evento | Mensagem |
|---|---|
| Épico movido | "Épico movido para [coluna]" |
| Story criada | "Story criada com sucesso" |
| INVEST analisado | "Análise INVEST concluída" |
| Erro genérico | "Algo deu errado. Tente novamente." |
| Sem permissão | "Você não tem permissão para esta ação." |

---

## Personas e papéis

| Role | Label exibido | Sigla |
|---|---|---|
| `RTE` | Release Train Engineer | RTE |
| `LPM` | Lean Portfolio Manager | LPM |
| `PO` | Product Owner | PO |
| `SM` | Scrum Master | SM |
| `DEVOPS` | DevOps Engineer | DevOps |
| `MEMBER` | Membro | — |

---

_Atualizado: 2026-06-10_
