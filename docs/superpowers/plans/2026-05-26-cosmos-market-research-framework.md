# Cosmos — Market Research Framework

> **Objetivo:** Validar cada diferencial do Cosmos com pesquisa de mercado.
> Para cada tópico: hipótese, perguntas de pesquisa, concorrentes a benchmarkar,
> sinais de validação / invalidação.

---

## Como usar este documento

1. Pegar um tópico por vez
2. Responder as **Perguntas de Pesquisa** com dados reais (G2, Gartner, entrevistas, papers)
3. Preencher a coluna **Encontrado** com o que cada concorrente faz
4. Registrar o **Veredito**: diferencial real / parity / gap nosso

---

## Mapa de Tópicos

| # | Tópico | Hipótese Central |
|---|---|---|
| T01 | SAFe como framework-base | SAFe é o framework dominante em enterprise — vale construir em cima |
| T02 | AI INVEST Scoring em Epic | Nenhum produto mainstream automatiza scoring de portfólio |
| T03 | RAG contextual na PI Planning | Copilot com memória de contexto do PI é diferencial não explorado |
| T04 | Flow Metrics 6 dimensões | Produto dedicado a Flow Metrics SAFe tem mercado não-atendido |
| T05 | Anomaly Detection proativo | Alerta antes do sprint explodir — nenhum tool faz isso com LLM |
| T06 | Synergy Detection de times | Recomendação de composição de time baseada em dados — inexistente no mercado |
| T07 | FinOps integrado ao portfolio | Custo cloud alocado por Epic/ART/Tema — gap real |
| T08 | Confidence Vote digitalizada | Cerimônia SAFe Fist-to-Five com round tracking — nicho não-atendido |
| T09 | Governance de Epic (LPM) | Fluxo de aprovação de Epics com DecisionLog — LPM digital |
| T10 | Large Solution Level | Camada acima do ART — quem precisa de LST? |
| T11 | Colaboração real-time (Yjs CRDT) | Edição colaborativa de Epic docs durante PI Planning |
| T12 | Integração bidirecional Linear/GitHub | Sync de issues sem perder contexto SAFe |
| T13 | Multi-tenant com roles SAFe | RTE/SM/PO como roles nativos — não customizável em tools genéricos |

---

## T01 — SAFe como Framework-Base ✅ PESQUISADO

**Hipótese:** SAFe é o framework de escala dominante em enterprise agile.
Construir um produto SAFe-native captura um segmento mal-atendido pelos tools genéricos.

### Veredito

> **"SAFe-native" é parity. O diferencial real é COMO: AI + Flow + FinOps + UX moderna.**

### Dados Encontrados

**Adoção:**
- 17th State of Agile Report (2023): SAFe = 26% dos enterprises, Scrum@Scale = 19%, LeSS/Spotify < 4%
- 22% não seguem nenhum framework mandatado; 12% criaram o próprio → hibridismo crescente
- Scaled Agile Inc: 20.000+ organizations, 1–2M profissionais treinados globalmente
- "% Fortune 500 que usa SAFe" não existe como dado auditável publicamente

**Ferramentas no mercado:**
- 62% dos times usam Jira Software (genérico); 37% usam EAPT nenhum ou solução caseira
- ~40% usam Jira Align como EAPT enterprise
- EAPTs SAFe-native: Jira Align, Rally (Broadcom), Digital.ai (VersionOne), Targetprocess/Planview
- Targetprocess whitepaper confirma: Jira nativo **não tem** lean budgeting, portfolio epics, value streams, ARTs → overlay é a solução atual

**Concorrentes benchmarkados:**

| Produto | Cobertura SAFe | Força | Fraqueza → Oportunidade Cosmos |
|---|---|---|---|
| Jira Align (Atlassian) | Full SAFe (Essential → Full) | Integração com Jira, suporte Atlassian enterprise | Complexo, caro (≥$27k/ano, escala para milhões), UX "corporate", pouco AI avançado, sem Flow 6D acionável, sem FinOps profundo |
| Rally (Broadcom) | Portfolio + Programa | Maturidade, ecossistema Broadcom | Percebido como legacy, UX antiga, sem AI/Flow/FinOps modernos |
| Digital.ai (VersionOne) | Enterprise Agile + SAFe | Histórico longo, DevOps/VSM | Pesado, similar ao Rally em peso e complexidade |
| Targetprocess / Planview | SAFe overlay sobre Jira/ADO, lean budgeting, PI Planning | Narrativa de "conectar LBM+planning com Jira" | Dependente de Jira/ADO, setup complexo, PPM clássico, sem AI-first |
| Planview AgilePlace | Portfolio/PPM, Kanban, Flow | Bom para PMOs tradicionais | Menos opinionated-SAFe, sem AI-first, sem FinOps integrado |

**SAFe 6.0 — impacto no Cosmos:**
- Reforça Flow Metrics, WIP, Kanban → **valida T04**
- Adiciona OKRs, LPM mais forte → **valida T09**
- Inclui AI/Cloud/Big Data no próprio framework → **legitima features de AI**
- Cosmos precisa seguir terminologia 6.0 (competency assessments, OKRs estruturados) para não parecer "SAFe 5.x only"

**Dores reportadas:**
- Barreiras de adoção SAFe: resistência cultural (47%), falta de liderança (41%), inconsistência entre times (30%)
- Dores com Jira Align: curva alta, admins dedicados, integração frágil com Jira, rigidez de workflow, custo proibitivo em escala

### Implicações Estratégicas

1. **Não vender "somos SAFe-native"** — isso é parity. Vender os outcomes: Flow visível, custo alocado, AI que age.
2. **ICP primário:** empresas 200–2000 devs que querem SAFe mas acham Jira Align complexo/caro demais.
3. **ICP secundário:** enterprises em Rally/Digital.ai querendo modernizar (new wave).
4. **Abraçar híbrido:** 34% de empresas que usam SAFe adaptado são mercado, não ruído — Cosmos não pode ser SAFe "by the book only".
5. **SAFe 6.0 como roadmap guia:** as adições de flow, OKR e AI do 6.0 são backlog validado pelo mercado.

---

## T02 — AI INVEST Scoring em Epic

**Hipótese:** Product managers perdem tempo significativo avaliando qualidade de
Epics manualmente. AI scoring automático (cached, invalidado por mudança de
conteúdo) é diferencial não-existente no mercado.

### O que o Cosmos faz

```
Epic.title + descriptionMd
  → sha256(title + desc) = investHash (cache key)
  → Claude avalia I, N, V, E, S, T (0–100 cada)
  → investScore = composite 0–100
  → investBreakdown = { I: {score, rationale}, N: {...}, ... }
```

### Perguntas de Pesquisa

- Algum produto de portfólio tem AI scoring de work items? (pesquisar G2 "AI portfolio", "AI epic scoring")
- LPMs usam INVEST na prática? Ou é só teoria de treinamento SAFe?
- Quanto tempo um LPM gasta por semana avaliando qualidade de Epics?
- O que sinaliza um Epic de baixa qualidade para um LPM? (entrevista)
- AI writing assistants (Linear Copilot, Jira AI) fazem scoring ou só sugestão de texto?
- WSJF é mais usado que INVEST no dia-a-dia?

### Concorrentes a Benchmarkar

| Produto | Tem AI scoring? | O que faz |
|---|---|---|
| Jira Align | ? | — |
| ProductBoard | ? | — |
| Aha! | ? | — |
| Linear | ? | — |
| GitHub Copilot Issues | ? | — |

### Sinais de Validação

- [ ] LPMs entrevistados relatam dor em avaliar qualidade de Epics
- [ ] Nenhum concorrente tem scoring automático de portfólio

### Sinais de Invalidação

- [ ] LPMs não usam INVEST — usam critério próprio
- [ ] Concorrente já lançou algo similar nos últimos 6 meses

---

## T03 — RAG Contextual na PI Planning

**Hipótese:** Durante PI Planning, o contexto está espalhado em docs, riscos,
features, objetivos anteriores. Um Copilot com memória vetorial desse contexto
resolve o problema de "onde estava aquela decisão".

### O que o Cosmos faz

```
sourceType: risk | pi_objective | feature | epic | okr | document
Embedding: 1536-dim (OpenAI/Anthropic)
Similarity: cosine (pgvector), threshold 0.75
Scope: por tenant (isolamento garantido)
Upload: documentos externos (PRDs, specs) também indexados
```

### Perguntas de Pesquisa

- Produtos de PI Planning têm AI assistants? Com contexto real da PI ou genérico?
- Qual % do tempo de PI Planning é gasto buscando decisões/contexto anteriores?
- Quais ferramentas de knowledge management times SAFe usam junto com o tool de planning?
- Confluence + Jira juntos resolvem o problema? Por quê as pessoas ainda buscam contexto manual?
- Há produtos que fazem RAG sobre histórico de sprints/PI? (pesquisar)
- Qual o limite de contexto que é útil? PI atual? Últimos 3 PIs?

### Concorrentes a Benchmarkar

| Produto | Tem RAG/AI sobre histórico PI? | O que faz |
|---|---|---|
| Jira Align + Atlassian AI | ? | — |
| Notion AI sobre docs linked ao board | ? | — |
| Linear AI | ? | — |
| Planview + AI | ? | — |

### Sinais de Validação

- [ ] RTEs relatam perda de contexto entre PIs
- [ ] Nenhum tool tem RAG sobre artefatos de PI (risks, objectives, features)

### Sinais de Invalidação

- [ ] Times usam Confluence bem e não sentem dor
- [ ] RAG genérico (ChatGPT + docs) já resolve

---

## T04 — Flow Metrics (6 Dimensões SAFe)

**Hipótese:** Flow Metrics são o KPI oficial do SAFe para medir health de entrega.
Poucos produtos calculam as 6 dimensões corretamente e de forma acionável.

**Contexto T01 → T04:** SAFe 6.0 tornou Flow Metrics o mecanismo central de medição em todos os níveis. Pressão crescente sobre EAPTs para suportar as 6D — mas a maioria ainda não faz de forma integrada ao backlog. Esse é o gap a confirmar.

### As 6 Métricas

```
1. Flow Distribution  — % por tipo (story/defect/feature/enabler)
2. Flow Velocity      — itens entregues/período
3. Flow Time          — lead time médio e mediano
4. Flow Load          — WIP médio e corrente
5. Flow Efficiency    — touch time / elapsed time
6. Flow Predictability — delivered / planned
```

### Perguntas de Pesquisa

**Cobertura de mercado:**
- Jira Align: quais das 6 estão nativas? Qual o esforço de configuração?
- Planview AgilePlace: tem Flow Distribution e Flow Efficiency ou só velocity/lead time?
- Engineering analytics (LinearB, Swarmia, Haystack, Pluralsight Flow): calculam Flow SAFe ou DORA/custom?
- Existe algum produto que une backlog SAFe + Flow 6D + alertas proativos numa plataforma?

**Adoção real:**
- RTEs/Agile Coaches usam Flow Metrics ativamente ou só recitam em treinamento?
- Qual das 6 é mais usada? (hipótese: só velocity e flow time são medidas de fato)
- Flow Efficiency (touch time / elapsed time): calculada explicitamente ou estimada?
- Bottleneck de setup: capturar status transitions ou construir o dashboard?

**Definições e padronização:**
- Há variância na definição de "Flow Time" entre ferramentas? (lead time vs cycle time vs throughput time)
- SAFe 6.0 publicou definições oficiais revisadas das 6 métricas?
- Existe demanda por Flow Metrics em contextos não-SAFe (Kanban puro, Shape Up)?

**Acionabilidade vs só dashboard:**
- Quando RTE vê Flow Load alto — o que o tool sugere? Algum tool faz isso ativamente?
- Flow Metrics hoje são retrospectivas (sprint fechado) ou near-realtime nos EAPTs?

### Concorrentes a Benchmarkar

| Produto | Dist. | Vel. | Time | Load | Eff. | Pred. | Acionável? | Integrado ao backlog SAFe? |
|---|---|---|---|---|---|---|---|---|
| Jira Align | ? | ? | ? | ? | ? | ? | ? | ? |
| Planview AgilePlace | ? | ? | ? | ? | ? | ? | ? | ? |
| Targetprocess | ? | ? | ? | ? | ? | ? | ? | ? |
| LinearB | ? | ? | ? | ? | ? | ? | ? | — |
| Swarmia | ? | ? | ? | ? | ? | ? | ? | — |
| Haystack | ? | ? | ? | ? | ? | ? | ? | — |
| Pluralsight Flow | ? | ? | ? | ? | ? | ? | ? | — |

### Hipóteses de Resultado (calibrar com dados)

1. Jira Align cobre velocity + talvez flow time, mas não as 6 integradas ao backlog
2. Engineering analytics (LinearB, Swarmia) cobrem DORA + lead time, não Flow SAFe oficial
3. Nenhuma ferramenta: Flow 6D + anomaly detection + narrativa linguagem natural na mesma plataforma
4. Flow Efficiency e Flow Distribution são as mais órfãs — sem suporte nativo em nenhum EAPT

### Sinais de Validação

- [ ] Nenhum EAPT tem as 6 dimensões integradas ao backlog SAFe em uma plataforma
- [ ] RTEs/Agile Coaches relatam Excel ou Power BI para calcular Flow Metrics
- [ ] Flow Efficiency e Flow Distribution raramente medidas em ferramentas disponíveis

### Sinais de Invalidação

- [ ] Jira Align lançou Flow Metrics 6D completo nos últimos 12 meses
- [ ] Times SAFe raramente usam Flow Metrics além de velocity (adoção < 20%)

---

## T05 — Anomaly Detection Proativo

**Hipótese:** Teams descobrem problemas de flow (velocity cliff, WIP overload) só
quando é tarde. Detection automática + narrativa LLM + push para Copilot muda o
ciclo de feedback de reativo para proativo.

### O que o Cosmos faz

```
Regras heurísticas:
  VelocityCliff          — queda > X% sprint-over-sprint
  WIPOverload            — WIP > threshold do time
  PredictabilityCollapse — delivered/planned < baseline
  CycleTimeDegradation   — lead time trend crescente
  EfficiencyNosedive     — flowEfficiency trend descendente
  WorkTypeImbalance      — distribuição fora do normal
  StaleCompetencyAssessment
  ImprovementActionOverdue

Trigger: FlowMetricSnapshot criado → AnomalyDetectionRun
Output: Anomaly[] com severity, delta, metadata → narrativa LLM → surface no Copilot
```

### Perguntas de Pesquisa

- Ferramentas de engineering analytics (LinearB, Swarmia) têm anomaly detection?
- Products de ITSM (Jira Service, ServiceNow) têm alert automático em métricas?
- Qual é o gap entre "dashboard" e "alerta proativo" em adoção?
- RTEs/SMs agem em cima de alertas ou preferem self-serve?
- Existe produto que combina: detecção + narrativa em linguagem natural + ação sugerida?
- False positive rate em anomaly detection é um bloqueador de adoção?

### Concorrentes a Benchmarkar

| Produto | Tem anomaly detection? | Tem narrativa LLM? |
|---|---|---|
| LinearB | ? | ? |
| Swarmia | ? | ? |
| Haystack | ? | ? |
| Jira Align | ? | ? |
| Pluralsight Flow | ? | ? |

### Sinais de Validação

- [ ] Engenheiros de dados relatam que SMs não abrem dashboards regularmente
- [ ] Nenhum tool tem narrative + anomaly (só raw metrics)

### Sinais de Invalidação

- [ ] LinearB/Swarmia já têm alertas proativos robustos
- [ ] SMs não confiam em AI para identificar problemas de time

---

## T06 — Synergy Detection de Times

**Hipótese:** A composição de times impacta entrega, mas é decidida empiricamente.
Dados de colaboração (quem trabalha bem com quem, em qual tipo de task) podem
guiar composição de times de forma baseada em evidência.

### O que o Cosmos faz

```
TaskAssignee.role: primary | reviewer | pair
TaskAssignee.taskType: backend | frontend | ml | infra | qa | data | design

PairSynergy:  userId1 + userId2 + taskType → score
GroupSynergy: memberHash + taskType → score

Feed: recomendações de composição de time no PI Planning
```

### Perguntas de Pesquisa

- Existe produto que recomenda composição de time baseado em dados históricos?
- Organizational Network Analysis (ONA) — quais ferramentas fazem isso?
- RTEs/SMs decisores de composição de time — qual é o processo atual?
- Dados de colaboração são sensíveis demais para alimentar AI? (privacidade)
- GitHub social graph, Linear assignee patterns — alguém monetizou isso?
- Pesquisar: "team composition recommendation software" no G2, ProductHunt

### Concorrentes a Benchmarkar

| Produto | Synergy / ONA? | Baseado em dados de entrega? |
|---|---|---|
| Microsoft Viva Insights | ? | — |
| Workday Peakon | ? | — |
| Humanyze | ? | — |
| LinearB "Teams" | ? | — |

### Sinais de Validação

- [ ] Zero produto de agile management faz synergy detection de entrega
- [ ] RTEs relatam dificuldade em decidir composição de time

### Sinais de Invalidação

- [ ] Privacidade de dados de colaboração é bloqueador legal
- [ ] Times não mudam composição frequente o suficiente para valer

---

## T07 — FinOps Integrado ao Portfolio

**Hipótese:** Times de engenharia têm custo cloud mas LPMs não veem esse custo
no contexto do portfolio (por Epic, por ART, por Tema). Alocar custo cloud
diretamente no fluxo SAFe é um gap real.

**Contexto T01 → T07:** SAFe 6.0 reforça Lean Portfolio Management com ênfase maior em métricas de valor e custo. A própria Scaled Agile Inc. menciona custo como dimensão de portfólio — mas nenhum EAPT atual integra cloud cost diretamente ao Kanban de Portfólio. Apptio (IBM) é o competidor mais próximo, mas vende como produto separado de TBM/FinOps, não integrado ao fluxo SAFe.

### O que o Cosmos faz

```
Integration.source: billing_aws | billing_gcp | billing_azure
BillingEntry: FOCUS v1.1 compliant (effectiveCost, Decimal 18,6)
BillingEntryAllocation: % de custo alocado para themeId/epicId/artId
LeanBudget.spentSource: BILLING_AGGREGATE (puxa de BillingEntry)
CostSnapshot: agregação periódica

AWS: Cost Explorer API + Pricing API
GCP: Cloud Billing API
Azure: Cost Management API
```

### Perguntas de Pesquisa

**Mercado e incumbentes:**
- FinOps Foundation FOCUS standard: quantos produtos adotaram? Qual o timing?
- Apptio (IBM) + Targetprocess: qual o depth da integração? Portfolio SAFe com custo em uma tela?
- Planview + Cloudability (adquirida 2019): integração real ou produtos paralelos?
- Jira Align: tem qualquer integração de custo cloud? Tags, alocações, LeanBudget?
- CloudHealth (VMware), Spot.io, Harness CCM: integram com EAPTs SAFe?

**Compradores e dor:**
- Quem sente mais essa dor: LPM, CFO, Engineering Director, ou FinOps team?
- Como LPMs visualizam custo cloud hoje? (hipótese: relatório separado do FinOps team, sem contexto de Epic/ART)
- "Technology Business Management" (TBM via Apptio) vs "SAFe Lean Budgeting" — sobreposição ou mercados distintos?
- Qual segmento sente isso mais agudamente? (hipótese: fintech/healthtech com compliance de custo regulatório)
- O pain point é "ver o custo" ou "alocar o custo por iniciativa"? Diferença crítica.

**Modelo de alocação:**
- Como alocação de custo cloud por projeto/produto é feita hoje? Tags AWS? Manual? FinOps tool?
- FOCUS v1.1 é usado na prática por compradores enterprise ou é só padrão técnico ainda?
- Existe apetite para alocação porcentual (x% do EC2 vai para Epic Y)? Ou só tag-based?

### Concorrentes a Benchmarkar

| Produto | Portfolio SAFe? | Cloud cost? | Custo por Epic/ART? | Integrado ou paralelo? |
|---|---|---|---|---|
| Apptio Cloudability (IBM) | Não (TBM) | Sim | Não (layer financeiro, não SAFe) | Paralelo |
| Planview Cloudability | Parcial (PPM) | Sim | ? | ? |
| Jira Align | Sim (SAFe completo) | Não | Não | — |
| Targetprocess | Sim (SAFe overlay) | Não | Não | — |
| Harness CCM | Não | Sim | Não | — |
| CloudHealth (VMware) | Não | Sim | Não | — |

### Hipóteses de Resultado (calibrar com dados)

1. Nenhum EAPT SAFe tem custo cloud como feature nativa — é sempre produto separado
2. Apptio/Planview-Cloudability cobrem FinOps mas sem contexto de Epic/ART/PI
3. A dor real é "alocar custo por iniciativa", não só "ver custo total" — gap de granularidade
4. ICP: empresas com cloud spend > $500k/mês, usando SAFe, que já têm um FinOps team sem visão de portfólio

### Sinais de Validação

- [ ] Nenhum EAPT SAFe tem alocação de custo cloud por Epic/ART nativamente
- [ ] LPMs recebem relatório de custo separado (email, BI) — sem contexto de roadmap
- [ ] FinOps teams e portfólio teams não falam a mesma linguagem (custo vs valor)

### Sinais de Invalidação

- [ ] Apptio + Targetprocess resolve esse problema completamente em integração real
- [ ] ICP não tem cloud spend relevante (infra on-prem ou via contrato Broadcom/Oracle)
- [ ] LPMs não se importam com custo cloud — esse é problema do Engineering Director

---

## T08 — Confidence Vote Digitalizada

**Hipótese:** SAFe formaliza Fist-to-Five voting ao final do PI Planning.
Atualmente feito com papel, post-it ou Mentimeter improvisado. Produto nativo
com round tracking, xState machine e histórico é nicho não-atendido.

### O que o Cosmos faz

```
PISession → ConfidenceVoteSession (múltiplas rounds)
  roundNumber: Int
  xStateStatus: NOT_STARTED → OPEN → CLOSED
  votes: Json number[]  (gap: sem userId por voto — ver P10)
```

### Perguntas de Pesquisa

- Times SAFe usam ferramenta para Confidence Vote hoje? Qual?
- Mentimeter, Miro, Slido — quão usados em PI Planning ceremonies?
- Existe integração de Confidence Vote em Jira Align ou Rally?
- Quantas rodadas de Confidence Vote são típicas? (dados de campo)
- RTEs consideram o vote uma cerimônia crítica ou formalidade?
- Há valor em histórico de confidence votes por PI? (benchmarks de maturidade)

### Concorrentes a Benchmarkar

| Produto | Tem Confidence Vote nativo? | Round tracking? |
|---|---|---|
| Jira Align | ? | ? |
| Rally | ? | ? |
| SAFe Community tools | ? | ? |
| Miro SAFe template | — | — |

### Sinais de Validação

- [ ] Zero produto de PI Planning tem Confidence Vote nativo integrado
- [ ] RTEs relatam improvisação (Mentimeter, raise of hands) na cerimônia

### Sinais de Invalidação

- [ ] Times não fazem Confidence Vote formalmente na prática
- [ ] Ferramenta externa (Mentimeter) resolve suficientemente

---

## T09 — Governance de Epic (LPM Digital)

**Hipótese:** O processo de aprovação de Epics em organizações SAFe é feito em
reuniões e emails. Digitalizar o FUNNEL → ANALYZING → PORTFOLIO_BACKLOG →
IMPLEMENTING com workflow customizável + DecisionLog é diferencial de LPM.

### O que o Cosmos faz

```
GovernedEpic (wrapper de Epic)
  governanceStatus: FUNNEL → ANALYZING → PORTFOLIO_BACKLOG → IMPLEMENTING → DONE → CANCELLED

ApprovalWorkflow (template configurável)
  → ApprovalRequest (instância por GovernedEpic)
    → ApprovalStepInstance[] (passos individuais)

DecisionLogEntry: epic_decision | budget_decision | theme_decision
  tipo, justificativa, dadosSuporte (JSON), decisorId, dataDecisao
```

### Perguntas de Pesquisa

- Jira Align tem fluxo de governança de Epics? Como funciona?
- Aha! ou ProductBoard têm approval workflows para roadmap items?
- Como LPMs fazem Portfolio Kanban hoje? Em qual ferramenta?
- Qual é o bottleneck mais doloroso no processo de aprovação de Epics?
- DecisionLog é usado/valorizado? Compliance exige isso?
- Há regulatórios (SOX, FDA 21 CFR Part 11) que exigem audit trail de decisão de portfólio?

### Concorrentes a Benchmarkar

| Produto | Portfolio Kanban + Governance? | DecisionLog? |
|---|---|---|
| Jira Align | ? | ? |
| Aha! | ? | ? |
| ProductBoard | ? | ? |
| Planview PPM | ? | ? |
| ServiceNow SPM | ? | ? |

### Sinais de Validação

- [ ] LPMs usam Confluence/email para approval — sem tracking estruturado
- [ ] Regulated industries (fintech, healthtech) precisam de audit trail

### Sinais de Invalidação

- [ ] ServiceNow SPM ou Planview já tem governance workflow completo

---

## T10 — Large Solution Level (LST)

**Hipótese:** Organizações com múltiplos ARTs coordenando entrega de um produto
maior precisam do nível LST (Solution Train). Poucos tools implementam isso.

### O que o Cosmos faz

```
SolutionTrain
  → Capability[] (feature acima de Feature, decompõe em Features por ART)
  → SolutionEpic[] (Epic de nível LST, com WSJF)
```

### Perguntas de Pesquisa

- Qual % das organizações SAFe usam Large Solution? (Scaled Agile Inc relatórios)
- Quem são os compradores de LST-level tools? CTO? Enterprise Architect?
- Jira Align tem LST como nível nativo?
- Qual é o número mínimo de ARTs que justifica LST?
- STE (Solution Train Engineer) — quão comum é esse papel?
- Risco: LST pode ser "feature para vender para enterprise" mas não usado na prática

### Concorrentes a Benchmarkar

| Produto | Tem LST nativo? | Capability model? |
|---|---|---|
| Jira Align | ? | ? |
| Rally | ? | ? |
| VersionOne | ? | ? |

### Sinais de Validação

- [ ] Jira Align não tem LST — apenas Portfolio e ART
- [ ] Grandes clientes (1000+ devs) precisam de coordenação inter-ART

### Sinais de Invalidação

- [ ] <10% das organizações SAFe usam LST de fato
- [ ] STE é papel raro que não influencia compra de tool

---

## T11 — Colaboração Real-Time em Epic (Yjs CRDT)

**Hipótese:** Epic description editing durante PI Planning precisa ser colaborativo
(múltiplos POs e LPMs editando simultaneamente). CRDT via Yjs resolve o conflito
de merge.

### O que o Cosmos faz

```
Epic.yjsDocumentState: String (estado CRDT persistido)
packages/collaboration: Liveblocks (auth, hooks, room, config)
TipTap editor + Liveblocks room por Epic
```

### Perguntas de Pesquisa

- Notion, Coda, Linear têm CRDT em work items durante planning events?
- Liveblocks vs Yjs direto vs PartyKit — comparativo de mercado?
- Quão crítica é colaboração simultânea em Epic vs async (comentários)?
- Custo de Liveblocks por room/mês em escala de 100+ usuários simultâneos?
- Times SAFe editam Epics simultaneamente ou sequencialmente?

### Concorrentes a Benchmarkar

| Produto | Real-time collab em work items? | Qual tech? |
|---|---|---|
| Linear | ? | ? |
| Notion (linked to projects) | Sim | Yjs interno |
| Jira (editores de issue) | parcial | ? |
| Coda | Sim | ? |

### Sinais de Validação

- [ ] PI Planning presencial tem múltiplas pessoas editando mesma Epic
- [ ] Conflict de "last write wins" é dor real em tools sem CRDT

### Sinais de Invalidação

- [ ] Times editam Epics de forma assíncrona — collab real-time não é dor

---

## T12 — Sync Bidirecional Linear / GitHub

**Hipótese:** Times de engenharia vivem no Linear (ou GitHub). LPMs vivem no
tool de portfólio. Sync bidirecional com mapeamento SAFe preserva contexto de
ambos os lados sem duplicação.

### O que o Cosmos faz

```
LinearSync: linear_syncs table
  linearType: team | project | issue | milestone | cycle
  cosmosType: Art | Epic | Feature | PIPlan | Sprint

Mapeamento:
  Linear team      ↔ ART
  Linear project   ↔ Epic / PIPlan
  Linear issue     ↔ Feature / Story
  Linear milestone ↔ PIPlan
  Linear cycle     ↔ Sprint

Feature/Story.externalId/Source/Url (campos de integração)
```

### Perguntas de Pesquisa

- Jira Align tem sync com Linear? Com GitHub Issues?
- Qual é o flow mais comum: Linear como source of truth + portfolio tool como viewer?
- Onde surgem conflitos de sync? Status mapping, ownership, campos customizados?
- Times que usam Linear rejeitam Jira/Rally completamente?
- Existe mercado de "Linear + SAFe" — times que querem ambos?
- Como o merge de dados de sync é tratado quando ambos os lados editam?

### Concorrentes a Benchmarkar

| Produto | Sync com Linear? | Bidirecional? | SAFe-aware? |
|---|---|---|---|
| Jira Align | ? | ? | ? |
| Unito (sync tool) | Sim | Sim | Não |
| Zapier (automação) | parcial | Não | Não |

### Sinais de Validação

- [ ] Times tech usam Linear e rejeitam Jira Align por UX
- [ ] Não existe sync Linear ↔ SAFe portfolio tool no mercado

### Sinais de Invalidação

- [ ] Times que usam Linear não querem SAFe overhead
- [ ] Jira tem integração com Linear que cobre o caso

---

## T13 — Multi-Tenant com Roles SAFe Nativos

**Hipótese:** Ferramentas genéricas têm "admin/member/viewer". Cosmos tem
RTE/SM/PO/STE como roles first-class — isso impacta permissões, dashboards,
notificações e UX contextual.

### O que o Cosmos faz

```
MemberRole: ADMIN | STE | RTE | SM | PO | DEV | MEMBER

Copilot mode por role:
  mode: global | rte | lpm | pm | team | spc

Permissões implícitas por role:
  RTE: vê todos os ARTs, PI Sessions, Confidence Votes
  SM: vê o time, daily standup, retro, impedimentos
  PO: vê features, stories, WSJF
  LPM: vê portfolio kanban, lean budget, governance
```

### Perguntas de Pesquisa

- Jira Align tem roles SAFe nativos ou apenas permission sets customizáveis?
- Compradores de tool SAFe fazem distinção de role no processo de compra?
- RTEs e SMs usam tools diferentes ou o mesmo tool com views diferentes?
- Role-based UX (dashboard diferente por role) é feature valorizada ou pouco usada?
- Como onboarding de um novo RTE vs novo DEV difere em tools concorrentes?

### Concorrentes a Benchmarkar

| Produto | Roles SAFe nativos? | UX por role? |
|---|---|---|
| Jira Align | ? | ? |
| Rally | ? | ? |
| Targetprocess | ? | ? |

### Sinais de Validação

- [ ] RTEs relatam ver dados irrelevantes em tools genéricos
- [ ] Role-based dashboard é pedido frequente em reviews de Jira Align

### Sinais de Invalidação

- [ ] Times configuram views manualmente e não sentem falta de roles nativos

---

## Priorização para Pesquisa

Ordenado por: impacto potencial × grau de incerteza atual.

| Prioridade | Tópico | Por quê pesquisar primeiro |
|---|---|---|
| 🔴 1 | T01 — SAFe como base | Valida a fundação inteira do produto |
| 🔴 2 | T04 — Flow Metrics | Diferencial técnico mais tangível de demonstrar |
| 🔴 3 | T07 — FinOps integrado | Gap mais óbvio, comprador diferente (CFO/LPM) |
| 🟡 4 | T02 — AI INVEST Scoring | Diferencial AI mais próximo do produto |
| 🟡 5 | T09 — Governance LPM | Comprador enterprise, deal size maior |
| 🟡 6 | T05 — Anomaly Detection | Valida o loop de AI da plataforma |
| 🟡 7 | T12 — Sync Linear/GitHub | Valida go-to-market com times tech-forward |
| 🟢 8 | T03 — RAG na PI Planning | Forte diferencial mas mais difícil de pesquisar |
| 🟢 9 | T13 — Roles SAFe nativos | Validar se é comprador ou apenas usuário |
| 🟢 10 | T08 — Confidence Vote | Nicho pequeno mas sem concorrência |
| 🔵 11 | T06 — Synergy Detection | Feature única mas compra secundária |
| 🔵 12 | T11 — Collab CRDT | Infra, não diferencial de compra |
| 🔵 13 | T10 — Large Solution LST | Pesquisar tamanho real do segmento |

---

## Fontes de Pesquisa Recomendadas

### Dados de Mercado
- G2 (reviews, comparativos, categorias: "SAFe tools", "Agile portfolio", "Flow metrics")
- Gartner Magic Quadrant for Adaptive Project Management and Reporting (2024/2025)
- Forrester Wave: Enterprise Agile Planning Tools
- Scaled Agile Inc — State of SAFe report anual
- FinOps Foundation — FOCUS adoption report

### Entrevistas (ICP)
- RTE em empresa 200–2000 devs
- LPM (Lean Portfolio Manager) em financial services ou healthtech
- Agile Coach certificado SAFe (SPC)
- Engineering Manager com Linear como ferramenta principal

### Comunidades para pesquisa qualitativa
- SAFe Community Platform (community.scaledagile.com)
- Reddit: r/agile, r/scrum, r/programming
- Linkedin groups: SAFe practitioners, Agile Portfolio Management
- Slack: Rands Leadership, Software Lead Weekly

---

*Gerado em 2026-05-26. Usar junto com `2026-05-25-cosmos-product-prd.md`.*
