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
| `capacity` | /cosmos/capacity | A | THIN | em-revisao | 2-execucao | 5 | 5 |
| `copilot` | /cosmos/copilot | — | — | pendente | — | 0 | 0 |
| `dashboard` | /cosmos/dashboard | — | — | pendente | — | 0 | 0 |
| `decisions` | /cosmos/decisions | B | THIN | em-revisao | 1-portfolio | 3 | 5 |
| `dependencies` | /cosmos/dependencies | A | THIN | em-revisao | 2-execucao | 3 | 3 |
| `epic` | /cosmos/epic | — | — | pendente | — | 0 | 0 |
| `executive` | /cosmos/executive | — | — | pendente | — | 0 | 0 |
| `feature` | /cosmos/feature | — | — | pendente | — | 0 | 0 |
| `flow` | /cosmos/flow | B | THIN | em-revisao | 3-metricas-plataforma | 4 | 7 |
| `gate` | /cosmos/gate | — | — | pendente | — | 0 | 0 |
| `governance` | /cosmos/governance | — | — | pendente | — | 0 | 0 |
| `horizon` | /cosmos/horizon | — | — | pendente | — | 0 | 0 |
| `integrations` | /cosmos/integrations | — | — | pendente | — | 0 | 0 |
| `kanban` | /cosmos/kanban | — | — | pendente | — | 0 | 0 |
| `measure` | /cosmos/measure | B | THIN | em-revisao | 3-metricas-plataforma | 4 | 3 |
| `okr` | /cosmos/okr | — | — | pendente | — | 0 | 0 |
| `okrs` | /cosmos/okrs | — | — | pendente | — | 0 | 0 |
| `pillar` | /cosmos/pillar | — | — | pendente | — | 0 | 0 |
| `piplanning` | /cosmos/piplanning | B | THIN | em-revisao | 2-execucao | 5 | 8 |
| `program` | /cosmos/program | B | THIN | em-revisao | 2-execucao | 3 | 7 |
| `risks` | /cosmos/risks | B | THIN | em-revisao | 2-execucao | 3 | 2 |
| `roadmap` | /cosmos/roadmap | — | — | pendente | — | 0 | 0 |
| `settings` | /cosmos/settings | — | — | pendente | — | 0 | 0 |
| `solution` | /cosmos/solution | — | — | pendente | — | 0 | 0 |
| `strategy` | /cosmos/strategy | — | — | pendente | — | 0 | 0 |
| `tags` | /cosmos/tags | — | — | pendente | — | 0 | 0 |
| `team` | /cosmos/team | — | — | pendente | — | 0 | 0 |
| `teams` | /cosmos/teams | A | THIN | em-revisao | 2-execucao | 4 | 7 |
| `theme` | /cosmos/theme | — | — | pendente | — | 0 | 0 |
| `themes` | /cosmos/themes | B | THIN | em-revisao | 1-portfolio | 5 | 5 |
| `value` | /cosmos/value | B | THIN | em-revisao | 1-portfolio | 3 | 3 |
| `velocity` | /cosmos/velocity | A | THIN | em-revisao | 3-metricas-plataforma | 2 | 3 |
| `vs` | /cosmos/vs | — | — | pendente | — | 0 | 0 |
| `webhooks` | /cosmos/webhooks | A | THIN | em-revisao | 3-metricas-plataforma | 4 | 2 |
| `workflows` | /cosmos/workflows | — | — | pendente | — | 0 | 0 |
| `wsjf` | /cosmos/wsjf | — | — | pendente | — | 0 | 0 |

## Fichas SAFe

| id | prática | nível | o que faz | fonte |
|---|---|---|---|---|
| `capacity` | Capacity utilization heatmap — carga contra capacidade por time e sprint do PI | Essential | Mostra, célula a célula do PI ativo, quanto o time planejou e quanto entregou, com a faixa de utilização em cor e em palavras, e o painel de ajustes que explica a variação (férias, treinamento, onboarding). | docs/stories/epic-007/story-057-tela-capacity-planning.md<br>docs/stories/epic-007/story-032.md<br>docs/srd-epic-007.md:120<br>SAFe 6.0 — Iteration Planning / PI Planning (team load vs. capacity) ⚠ fonte externa |
| `decisions` | Decision Log & Audit Trail — registro imutável das decisões de investimento do portfólio (Lean Portfolio Management) | Portfolio | Guarda, em ordem e com justificativa, toda decisão de portfólio — aprovada, rejeitada, adiada ou alterada — e entrega esse histórico a um auditor externo em um export que ele pode levar embora, sem que ninguém consiga editar ou apagar uma entrada pela aplicação. | docs/srd-epic-006.md:126<br>docs/srd-epic-008.md:178<br>docs/PRD-v1.0.md:5103<br>docs/stories/epic-006/story-054-tela-decision-log.md<br>docs/stories/epic-006/story-016.md<br>SAFe 6.0 — Lean Portfolio Management (Portfolio Governance) ⚠ fonte externa |
| `dependencies` | Dependency management do Program Board — bloqueios entre times mapeados, acíclicos e levados até a resolução | Essential | Lista os bloqueios entre features de times diferentes com o time de origem e destino, recusa o registro de uma dependência que fecharia um ciclo (dizendo qual), e deixa o RTE avançar o bloqueio de identificado para em resolução e resolvido. | docs/stories/epic-006/story-058-tela-dependencias.md<br>docs/stories/epic-006/story-020.md<br>docs/stories/epic-008/story-042.md<br>SAFe 6.0 — PI Planning / Program Board (cross-team dependency management) ⚠ fonte externa |
| `flow` | Measure and Grow — Flow Metrics (6D) e DORA no Continuous Delivery Pipeline | Essential | Mostra o retrato mais recente das métricas de fluxo, quais itens estão envelhecendo em progresso além do SLA, e as métricas DORA que a fonte de dados do tenant realmente sustenta — dizendo, para cada métrica sem fonte, qual fonte falta. | docs/srd-epic-007.md:119<br>docs/srd-epic-007.md:212<br>docs/stories/epic-007/story-022.md<br>docs/stories/epic-007/story-025.md<br>SAFe 6.0 — Flow Metrics e Continuous Delivery Pipeline ⚠ fonte externa |
| `measure` | Measure and Grow — avaliação das 7 competências centrais e o backlog de melhoria que sai dela | Essential | Deixa o RTE ou o Scrum Master registrar a nota de cada competência-chave SAFe por time, ver a evolução contra o ciclo anterior do mesmo time, e abrir as ações de melhoria que a avaliação motivou, com a taxa de conclusão sobre um denominador visível. | docs/srd-epic-007.md:149<br>docs/stories/epic-007/story-032.md<br>SAFe 6.0 — Measure and Grow (Core Competency Assessments) ⚠ fonte externa |
| `piplanning` | Confidence Vote (fist-of-five) no PI Planning | Essential | Mostra o PI ativo — objetivos com business value, riscos ROAM e o placar de confiança — e deixa o ART votar de 1 a 5 na confiança do plano e o RTE revelar o resultado, que é o insumo do gate de commitment do PI. | docs/stories/epic-006/story-060-tela-pi-planning-confidence-vote.md<br>docs/stories/epic-006/story-018.md:30<br>docs/stories/epic-006/story-018.md:38<br>docs/stories/epic-006/story-018.md:82<br>docs/srd-epic-006.md:160<br>SAFe 6.0 — Confidence Vote no PI Planning (fist-of-five, nível de ART) ⚠ fonte externa |
| `program` | Program Board — features do PI distribuídas em células time × sprint, com carga contra capacidade e congelamento após o commitment | Essential | Desenha o quadro do PI ativo: cada time é uma linha, cada sprint do time uma coluna, e cada célula mostra as features alocadas, os pontos comprometidos contra a capacidade daquela sprint e o aviso de sobrecarga. O RTE aloca uma feature pendente numa célula enquanto o PI está aberto; depois do commitment o quadro vira somente leitura. | docs/stories/epic-006/story-020.md<br>docs/stories/epic-008/story-031.md:88<br>docs/srd-epic-008.md:53<br>SAFe 6.0 — PI Planning / Program Board ⚠ fonte externa |
| `risks` | ROAM — Resolved, Owned, Accepted, Mitigated | Essential | Registra os riscos levantados no PI Planning, mostra onde cada um cai na matriz probabilidade × impacto e — o que faltava — deixa o RTE dar a cada risco um desfecho ROAM, com o compromisso que aquele desfecho exige, antes de o ART se comprometer com o PI. | docs/stories/epic-006/story-059-tela-riscos-roam.md<br>docs/stories/epic-006/story-019.md:30<br>docs/stories/epic-006/story-019.md:47<br>docs/PRD-v1.0.md:632<br>docs/srd-epic-006.md:213<br>SAFe 6.0 — Risk Management no PI Planning (ROAM) ⚠ fonte externa |
| `teams` | Agile Team — um time pertence a um, e somente um, ART (Team and Technical Agility) | Essential | Mostra os squads do portfólio com membros, WIP, velocity, capacidade e predictability, e — o que faltava — expõe os times que estão fora de qualquer ART e deixa o RTE vinculá-los antes de abrir o PI Planning. | docs/stories/epic-006/story-056-tela-times.md<br>docs/stories/epic-006/story-017.md:183<br>docs/stories/epic-006/story-017.md:41<br>docs/stories/epic-006/story-017.md:34<br>SAFe 6.0 — Agile Release Train (Agile Teams are part of one, and only one, ART) ⚠ fonte externa |
| `themes` | Strategic Themes — conexão entre a estratégia da empresa e o investimento do portfólio | Portfolio | Mostra para onde o investimento do portfólio está indo por tema, compara o planejado (alocação-alvo) com o real (custo atribuído), avisa quando um único tema concentra o portfólio, e deixa a Portfolio Manager rebalancear ou aposentar um tema sem apagar o histórico. | docs/srd-epic-006.md:170<br>docs/PRD-v1.0.md:3029<br>docs/stories/epic-006/story-053-tela-temas-estrategicos.md<br>docs/stories/epic-006/story-025.md<br>SAFe 6.0 — Strategic Themes (Lean Portfolio Management) ⚠ fonte externa |
| `value` | Benefit Realization / Epic Hypothesis — validar a hipótese de valor do épico com dado real depois da entrega (Lean Portfolio Management) | Portfolio | Liga cada épico entregue ao indicador de negócio que ele prometeu mover, compara o planejado com o realizado, e obriga quem encerra a hipótese — confirmando ou declarando abaixo da meta — a registrar por quê. É o antídoto do épico zumbi: entregue, em execução para sempre, sem ninguém dizer se a aposta se pagou. | docs/PRD-v1.0.md:822<br>docs/PRD-v1.0.md:836<br>docs/stories/epic-006/story-055-tela-value-realization.md<br>docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md<br>SAFe 6.0 — Epic Hypothesis Statement e Lean Business Case (benefit realization) ⚠ fonte externa |
| `velocity` | PI Predictability Measure — aceito sobre comprometido, com benchmark de 80% | Essential | Mostra, por sprint fechada, quanto foi comprometido no planejamento, quanto foi concluído e quanto o PO efetivamente aceitou na Sprint Review, calcula predictability como aceito/comprometido e avisa quando a média fica abaixo do benchmark SAFe de 80%, por sprint e por time. | docs/srd-epic-007.md:129<br>docs/stories/epic-007/story-032.md<br>SAFe 6.0 — PI Predictability Measure (Measure and Grow) ⚠ fonte externa |
| `webhooks` | Continuous Delivery Pipeline — integração de saída confiável e observável (Release on Demand) | Portfolio | Mostra os endpoints de saída do tenant com a saúde real derivada do histórico de entrega, deixa o Org Admin pausar um endpoint que está quebrando sem apagá-lo, e disparar um evento sintético para provar a configuração antes de confiar nela em produção. | docs/srd-epic-007.md:222<br>docs/stories/epic-007/story-035.md<br>docs/stories/epic-008/story-037.md<br>SAFe 6.0 — Continuous Delivery Pipeline (Release on Demand) ⚠ fonte externa |
