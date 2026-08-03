# Grafo de completude do Cosmos

<!-- GERADO por scripts/cosmos-graph.mts — não edite à mão.
     Edite docs/cosmos/nodes/<id>.json e rode `pnpm cosmos:graph build`. -->

Estado do programa que leva as telas do Cosmos de THIN a REAL: o que cada uma
faz, qual regra do SAFe 6.0 cumpre, que actions e tabelas usa, o que falta.

**Este grafo não se funde com os outros dois do repo.** `graphify-out/` é grafo
de código (10 mil nós de símbolos e imports, regenerado por tooling) e
`.code-review-graph/` é o grafo de review por diff. Este aqui é estado de
programa: quem faz o quê, contra qual regra, e o que já pode ser reusado.

## Como usar, sendo agente

Leia esta tabela para saber o que já existe antes de escrever qualquer coisa.
Depois leia os `nodes/<id>.json` que você possui (`Owns:` no seu brief) e os
que você declara em `depende_de`. Não leia `grafo.json` — ele é para o `check`.

Escreva **apenas** nos nós que você possui. Aresta é declarada pelo consumidor,
nunca pelo produtor.

## Nós

| id | rota | balde | profund. | estado | trilha | actions | models |
|---|---|---|---|---|---|---|---|
| `anomalies` | /cosmos/anomalies | — | — | pendente | — | 0 | 0 |
| `budgets` | /cosmos/budgets | — | — | pendente | — | 0 | 0 |
| `capacity` | /cosmos/capacity | — | — | pendente | — | 0 | 0 |
| `copilot` | /cosmos/copilot | — | — | pendente | — | 0 | 0 |
| `dashboard` | /cosmos/dashboard | — | — | pendente | — | 0 | 0 |
| `decisions` | /cosmos/decisions | B | THIN | em-revisao | 1-portfolio | 3 | 5 |
| `dependencies` | /cosmos/dependencies | — | — | pendente | — | 0 | 0 |
| `epic` | /cosmos/epic | — | — | pendente | — | 0 | 0 |
| `executive` | /cosmos/executive | — | — | pendente | — | 0 | 0 |
| `feature` | /cosmos/feature | — | — | pendente | — | 0 | 0 |
| `flow` | /cosmos/flow | — | — | pendente | — | 0 | 0 |
| `gate` | /cosmos/gate | — | — | pendente | — | 0 | 0 |
| `governance` | /cosmos/governance | — | — | pendente | — | 0 | 0 |
| `horizon` | /cosmos/horizon | — | — | pendente | — | 0 | 0 |
| `integrations` | /cosmos/integrations | — | — | pendente | — | 0 | 0 |
| `kanban` | /cosmos/kanban | — | — | pendente | — | 0 | 0 |
| `measure` | /cosmos/measure | — | — | pendente | — | 0 | 0 |
| `okr` | /cosmos/okr | — | — | pendente | — | 0 | 0 |
| `okrs` | /cosmos/okrs | — | — | pendente | — | 0 | 0 |
| `pillar` | /cosmos/pillar | — | — | pendente | — | 0 | 0 |
| `piplanning` | /cosmos/piplanning | — | — | pendente | — | 0 | 0 |
| `program` | /cosmos/program | — | — | pendente | — | 0 | 0 |
| `risks` | /cosmos/risks | B | THIN | pendente | 2-execucao | 3 | 2 |
| `roadmap` | /cosmos/roadmap | — | — | pendente | — | 0 | 0 |
| `settings` | /cosmos/settings | — | — | pendente | — | 0 | 0 |
| `solution` | /cosmos/solution | — | — | pendente | — | 0 | 0 |
| `strategy` | /cosmos/strategy | — | — | pendente | — | 0 | 0 |
| `tags` | /cosmos/tags | — | — | pendente | — | 0 | 0 |
| `team` | /cosmos/team | — | — | pendente | — | 0 | 0 |
| `teams` | /cosmos/teams | — | — | pendente | — | 0 | 0 |
| `theme` | /cosmos/theme | — | — | pendente | — | 0 | 0 |
| `themes` | /cosmos/themes | B | THIN | em-revisao | 1-portfolio | 5 | 5 |
| `value` | /cosmos/value | B | THIN | em-revisao | 1-portfolio | 3 | 3 |
| `velocity` | /cosmos/velocity | — | — | pendente | — | 0 | 0 |
| `vs` | /cosmos/vs | — | — | pendente | — | 0 | 0 |
| `webhooks` | /cosmos/webhooks | — | — | pendente | — | 0 | 0 |
| `workflows` | /cosmos/workflows | — | — | pendente | — | 0 | 0 |
| `wsjf` | /cosmos/wsjf | — | — | pendente | — | 0 | 0 |

## Fichas SAFe

| id | prática | nível | o que faz | fonte |
|---|---|---|---|---|
| `decisions` | Decision Log & Audit Trail — registro imutável das decisões de investimento do portfólio (Lean Portfolio Management) | Portfolio | Guarda, em ordem e com justificativa, toda decisão de portfólio — aprovada, rejeitada, adiada ou alterada — e entrega esse histórico a um auditor externo em um export que ele pode levar embora, sem que ninguém consiga editar ou apagar uma entrada pela aplicação. | docs/srd-epic-006.md:126<br>docs/srd-epic-008.md:178<br>docs/PRD-v1.0.md:5103<br>docs/stories/epic-006/story-054-tela-decision-log.md<br>docs/stories/epic-006/story-016.md<br>SAFe 6.0 — Lean Portfolio Management (Portfolio Governance) ⚠ fonte externa |
| `risks` | ROAM — Resolved, Owned, Accepted, Mitigated | Essential | Registra os riscos levantados no PI Planning e obriga cada um a receber um desfecho ROAM antes do time se comprometer com o PI. | docs/srd-epic-006.md<br>docs/pi-planning/PI_PLANNING_WORKSPACE.md<br>SAFe 6.0 — Risk Management no PI Planning (ROAM) ⚠ fonte externa |
| `themes` | Strategic Themes — conexão entre a estratégia da empresa e o investimento do portfólio | Portfolio | Mostra para onde o investimento do portfólio está indo por tema, compara o planejado (alocação-alvo) com o real (custo atribuído), avisa quando um único tema concentra o portfólio, e deixa a Portfolio Manager rebalancear ou aposentar um tema sem apagar o histórico. | docs/srd-epic-006.md:170<br>docs/PRD-v1.0.md:3029<br>docs/stories/epic-006/story-053-tela-temas-estrategicos.md<br>docs/stories/epic-006/story-025.md<br>SAFe 6.0 — Strategic Themes (Lean Portfolio Management) ⚠ fonte externa |
| `value` | Benefit Realization / Epic Hypothesis — validar a hipótese de valor do épico com dado real depois da entrega (Lean Portfolio Management) | Portfolio | Liga cada épico entregue ao indicador de negócio que ele prometeu mover, compara o planejado com o realizado, e obriga quem encerra a hipótese — confirmando ou declarando abaixo da meta — a registrar por quê. É o antídoto do épico zumbi: entregue, em execução para sempre, sem ninguém dizer se a aposta se pagou. | docs/PRD-v1.0.md:822<br>docs/PRD-v1.0.md:836<br>docs/stories/epic-006/story-055-tela-value-realization.md<br>docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md<br>SAFe 6.0 — Epic Hypothesis Statement e Lean Business Case (benefit realization) ⚠ fonte externa |
