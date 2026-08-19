# Cosmos — Product Requirements Document

> **PRODUCT** Cosmos · **STAGE** Produto (cliente) · **STATUS** Draft for review
> **VERSION** 1.0 · **OWNER** Product, Nebuloz
> **COMPANION** [Cosmos SRD v1.0](./cosmos-srd.md)

A plataforma que o cliente usa. Portfólio, ART, time e analytics de SAFe sobre
um único banco de fatos — sem planilha paralela e sem exportação manual.

---

## 1. Problema

Uma organização que roda SAFe produz decisão em quatro altitudes: portfólio
decide onde investir, ART decide o que entra no PI, time decide o que entra no
sprint, e a liderança pergunta se o que foi decidido aconteceu. Cada altitude
hoje mora numa ferramenta diferente — épico no Jira ou Linear, orçamento na
planilha, PI Planning no Miro, métrica de fluxo num dashboard que alguém
alimenta à mão.

O custo não é a licença de cinco ferramentas. É que **as quatro altitudes não
se reconciliam**: o épico priorizado por WSJF no portfólio não é o mesmo
registro da feature no board do time, então a pergunta "o tema estratégico que
recebeu 40% do budget entregou o quê" não tem resposta derivável — tem resposta
montada, por alguém, num slide, uma vez por trimestre.

> **POR QUE ISSO TRAVA O SAFe**
> SAFe é um framework de alinhamento. Alinhamento que só existe no PI Planning
> e some no dia seguinte é cerimônia, não sistema. O valor do Cosmos não está em
> ter tela de kanban — está em kanban, WSJF, lean budget e flow metric lerem a
> **mesma linha do mesmo banco**.

### Evidência

- Épico, feature, story e task já existem no mesmo schema (`166 modelos`,
  27 arquivos Prisma), mas 12 das 38 telas do handoff ainda não existem.
- A auditoria interna de 2026-07-23 classificou 23 de 26 telas então existentes
  como **THIN** — UI sobre modelo que já existe, sem o drill-down que fecha o ciclo.
- `dashboard.tsx` renderizava KPI fabricado ao lado de KPI real; `wsjf.ts` fixava
  `prev = rank`, deixando a coluna "Δ IA" estruturalmente morta.
- Métrica de fluxo (CFD, throughput, aging WIP, DORA) depende de
  `StateTransitionHistory`, que passou a ser gravado depois das telas que o leem.

---

## 2. Usuários

| PAPEL | TRABALHO A FAZER | SUCESSO É |
|---|---|---|
| Portfolio Manager | Decidir onde investir e provar retorno | Tema estratégico com budget e valor realizado na mesma tela |
| Epic Owner | Levar épico do funil ao gate | Estado do épico derivado de fato, não de status escrito à mão |
| RTE | Rodar PI Planning e destravar dependência | Board de programa que sobrevive ao fim do evento |
| Product Owner | Manter backlog de feature priorizado | WSJF com BV/TC/RR/CoD visíveis e recalculáveis |
| Scrum Master | Ver impedimento, capacidade e fluxo do time | Métrica derivada de transição, não de preenchimento |
| Time | Trabalhar no board sem alimentar relatório | Um lugar onde mover o card é a única entrada de dado |
| Liderança | Saber se o PI vai entregar | Previsibilidade derivada, com "sem sinal" explícito |
| Compliance (Charter) | Governar uso de IA e fornecedor | Política, caso e evidência versionados |
| Admin do tenant | Papéis, SSO, integrações e trilha | Configuração sem chamado |

---

## 3. Objetivos e não-objetivos

### Objetivos

| OBJETIVO | MEDIDA |
|---|---|
| Uma fonte de verdade das quatro altitudes | Share de telas que leem do banco, sem constante no código |
| Fechar o laço estratégia → entrega → valor | Tema estratégico com budget alocado **e** valor realizado |
| Métrica derivada, nunca digitada | Share de métrica calculada a partir de transição de estado |
| Drill-down completo | Toda linha de lista abre o detalhe correspondente |
| Trazer o dado que já existe fora | Épico e issue importados de Linear e GitHub, com sync incremental |
| Isolar tenant por construção | Zero leitura cruzada entre tenants em qualquer caminho |

### Não-objetivos

- **Não é issue tracker.** Linear, Jira e GitHub continuam existindo; o Cosmos
  sincroniza e agrega, não substitui o dia a dia da engenharia.
- **Não é ferramenta de whiteboard.** PI Planning tem grade de confiança e board
  de programa; não tem canvas livre.
- **Não é ERP nem contabilidade.** FinOps lê billing de nuvem e aloca custo por
  ART e tema; não fecha o mês.
- **Não é o painel interno.** Provisionar tenant, contratar módulo e auditar
  vários clientes é do [Back-office](./backoffice-prd.md).
- **Não afirma o que não sabe.** Onde falta sinal, a tela diz "sem sinal" — nunca
  colapsa em número.

---

## 4. As áreas

O produto tem 63 telas atrás de uma rota única (`/cosmos/[[...seg]]`), agrupadas
em nove seções de navegação. A divisão segue as altitudes do SAFe, não a
conveniência do menu.

**Board Snapshot e Visão Geral** — Onde a liderança entra. Estado do PI,
previsibilidade, épicos em progresso.

**Portfolio** — Kanban de épicos, WSJF, temas estratégicos, value realization,
strategy map, OKRs, lean budgets, tag rules, anomalias, roadmap, governance
board e decision log. É a altitude onde dinheiro vira aposta.

**ART Board** — ARTs, program board, PI Planning, dependências, riscos e capacity
planning. É a altitude onde aposta vira compromisso de PI.

**Times e Board do Time** — Sprint, story, task, defeito, impedimento. É a
altitude onde compromisso vira trabalho.

**Analytics** — Flow metrics, velocity e Measure & Grow. É onde se pergunta se a
altitude de cima descreveu a de baixo corretamente.

**Workflows** — Estados por time, transição e BPMN. O que define quando uma
transição conta como fluxo.

**Large Solution** — Solution trains, capabilities, solution epics, LACE,
fornecedores e dependências entre ARTs.

**Integrações** — Linear, GitHub, Fireflies e Fathom; webhooks de saída e chaves
de API.

**Settings** — Workspace, membros, papéis customizados, SSO, segurança,
notificações, billing, SAFe e auditoria.

**Charter** (módulo à parte, 12 telas) — Política de uso de IA, registro de
casos, fornecedores, risco, conformidade e trilha. Contratado por tenant,
independente do Cosmos.

> **RESTRIÇÃO DURA**
> Nenhuma tela inventa número. Métrica que depende de dado ainda não coletado
> mostra "sem sinal" — não zero, não média, não estimativa. Um dashboard que
> exibe 87% de previsibilidade sobre base vazia não é otimista: é falso, e custa
> mais caro que a tela em branco, porque a decisão tomada em cima dele parece
> fundamentada.

### O que uma tela de decisão carrega

| | |
|---|---|
| **Origem do número** — derivado de transição ou de linha, nunca de constante | **Drill-down** — a linha abre o registro que a produziu |
| **Escopo de tenant no `where`** — não no filtro da UI | **Estado vazio honesto** — "sem sinal" é categoria, não erro |

---

## 5. Requisitos

Prioridade: **P0** necessário para o produto se sustentar · **P1** dentro de dois
trimestres · **P2** desejável.

| ID | REQUISITO | PRI |
|---|---|---|
| C-01 | Quatro altitudes (portfólio, ART, time, analytics) sobre o mesmo schema | P0 |
| C-02 | Isolamento de tenant em toda leitura e escrita | P0 |
| C-03 | Papéis SAFe e papéis customizados verificados no servidor | P0 |
| C-04 | Kanban de épicos com gate de governança e decision log | P0 |
| C-05 | WSJF com BV/TC/RR/CoD editáveis e ranking recalculado a partir dos fatores | P0 |
| C-06 | PI Planning com objetivos, confidence vote e board de programa persistidos | P0 |
| C-07 | Board do time com story, task, defeito e impedimento | P0 |
| C-08 | Toda métrica de fluxo derivada de `StateTransitionHistory` | P0 |
| C-09 | Nenhum KPI alimentado por constante no código | P0 |
| C-10 | Drill-down de toda lista para o detalhe correspondente | P0 |
| C-11 | Lean budgets ligados a tema estratégico e a custo real | P0 |
| C-12 | Trilha de auditoria em toda escrita sensível | P0 |
| C-13 | Import e sync incremental de Linear e GitHub, com DLQ | P1 |
| C-14 | Settings completo (workspace, membros, papéis, SSO, segurança, billing, SAFe, auditoria) | P1 |
| C-15 | Value realization: tema com alocação planejada **e** realizada | P1 |
| C-16 | Roadmap multi-PI com dependências visíveis | P1 |
| C-17 | Detecção de anomalia de fluxo e de custo | P1 |
| C-18 | SAFe Copilot com contexto do tenant e sessão persistida | P1 |
| C-19 | Meeting intelligence (Fireflies, Fathom) virando insight ligado a registro | P1 |
| C-20 | Relatórios agendados e layout de dashboard por usuário | P2 |
| C-21 | Measure & Grow com assessment de competência e ação de melhoria | P2 |
| C-22 | Paginação e agregação no banco em toda lista que cresce com o tenant | P2 |

---

## 6. Critérios de sucesso

- Um tema estratégico mostra quanto recebeu, quanto foi gasto e o que entregou —
  sem ninguém montar planilha.
- Um épico priorizado no portfólio é o mesmo registro que aparece no board do
  time, sem exportação.
- Nenhum número na tela vem de constante no código, verificado por teste.
- Toda lista abre o detalhe; nenhum clique é decorativo.
- Métrica de fluxo de um tenant com dez mil transições responde tão rápido quanto
  a de um com cem — porque agrega no banco.
- Um tenant não lê dado de outro por nenhum caminho de API.
- Onde falta dado, a tela diz que falta.

---

## 7. Riscos

| RISCO | MITIGAÇÃO |
|---|---|
| Tela bonita sobre dado inexistente | "Sem sinal" como categoria de primeira classe; teste que proíbe constante de KPI |
| Profundidade que não fecha — lista sem detalhe | Drill-down como requisito de aceite, não de backlog |
| Métrica de fluxo sem histórico de transição | `StateTransitionHistory` gravado antes de a tela que o lê existir |
| Import de Linear/GitHub duplicando registro | Chave externa por provedor e sync incremental com cursor |
| Sync que falha em silêncio | DLQ de webhook com reprocesso visível |
| 63 telas com um só shell — regressão cruzada | E2E por área e teste de schema por domínio |
| Custo de leitura crescendo com o tenant | Agregação no banco e paginação; nunca reduzir em memória amostra parcial |
| Copilot afirmando o que não checou | Contexto restrito ao tenant e resposta ancorada em registro citável |

---

## 8. Dependências

| DEPENDE DE | NATUREZA |
|---|---|
| Back-office | Provisiona o tenant e contrata o módulo COSMOS |
| `@repo/auth` | Sessão multi-tenant, papéis, SSO e segundo fator |
| `@repo/rbac` | Papéis customizados e atribuição por ART |
| `@repo/safe-engine` | WSJF e máquina de confidence vote |
| `@repo/database` | Prisma, 166 modelos, 87 migrations |
| `@repo/audit` | Trilha append-only |
| `@repo/collaboration` | Presença e edição concorrente (Liveblocks) |
| `@repo/ai` | SAFe Copilot |
| Linear · GitHub | Origem de épico, issue, PR e deploy |
| Fireflies · Fathom | Origem de transcrição e insight de reunião |
| Charter | Módulo irmão, contratado à parte |

---

## 9. Questões em aberto

- **Profundidade antes de largura.** Restam ~89 dev-days entre o estado atual e a
  paridade com o handoff. Fechar as telas THIN primeiro ou entregar as 12 que
  faltam? A resposta muda a ordem de dois trimestres.
- **Fonte de verdade do épico.** Quando o Linear e o Cosmos discordam do estado
  de um épico, quem ganha? Hoje o último sync ganha, e isso não é uma decisão —
  é uma consequência.
- **Granularidade do lean budget.** Budget por tema, por value stream ou por
  horizonte de investimento? Os três modelos existem; a UI assume um.
- **Escopo do Copilot.** Ele lê o tenant inteiro ou só a área da tela? Ler tudo é
  mais útil e é também a maior superfície de vazamento entre papéis.
- **Retenção de transição.** `StateTransitionHistory` cresce com atividade, não
  com número de usuários. Em que volume vale particionar?
- **Charter dentro ou fora.** Charter tem shell próprio e 18 modelos próprios.
  Vale unificar a navegação ou manter dois produtos que dividem o tenant?

---

*Draft para revisão interna. Documento companheiro: Cosmos SRD v1.0.*
