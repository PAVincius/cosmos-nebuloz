# Feature Specification: Signal V1 · Measure

**Feature Branch**: a criar

**Created**: 2026-09-02

**Status**: Draft — para reação, não para execução

**Input**: Decisão de 2026-09-02 de que o Signal é produto. O que ele promete
está publicado na home (`web.readiness.ladder.stages[2]` e
`products.items[2]`): *"Conecta às ferramentas que você já usa e transforma
adoção em linha de base medida — horas recuperadas, taxa de erro, tempo de
ciclo."* Quatro saídas nomeadas: telemetria de adoção por time, registro de
horas recuperadas, variação de tempo de ciclo, relatório pronto para o
conselho. Cadência contínua. Comprador: financeiro e liderança de operações.

> **O que esta spec é.** Um esqueleto no padrão de `001-meridian-diagnose`,
> escrito para transformar "nada" em "algo para discordar". As user stories
> derivam das quatro saídas que o site já vende. O que está marcado **[aberto]**
> é decisão de produto que ninguém tomou; o que está marcado **[reusa]** aponta
> para código do Cosmos que já faz parte do trabalho.

---

## Por que o Signal não parte do zero

O Cosmos já mede boa parte do que o Signal promete:

| Promessa do site | O que já existe | Onde |
|---|---|---|
| Tempo de ciclo | `FlowMetricSnapshot.flowTimeAvgHours` / `flowTimeMedianHours`, por time/ART/value stream, por sprint/PI/trimestre | `flow-metrics.prisma` |
| Taxa de adoção | Nada direto. `CompetencyAssessment` e `PersonSkillProfile` medem competência, não uso | `flow-metrics.prisma` |
| Horas recuperadas | Nada. É a métrica nova de verdade | — |
| Custo por resultado | `BillingEntry`, `CostSnapshot`, `BillingEntryAllocation` medem custo de nuvem por épico/ART | `finops.prisma` |
| Anomalia / drift | `AnomalyDetectionRun`, `Anomaly`, narrativa por LLM | `flow-intelligence.prisma`, `anomaly-narrative.ts` |
| Escala de confiança | `measured \| estimated \| declared`, **já concebida como compartilhada com o Signal** | spec do Meridian, `MeridianConfidence` |

Duas das quatro saídas têm base pronta; uma tem base parcial; **uma — horas
recuperadas — é inteiramente nova e é a que o CFO mais quer**. A spec precisa
ser honesta sobre isso: o Signal V1 é 60% repackaging e 40% produto novo, e o
40% é o mais difícil de medir com credibilidade.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Linha de base antes do trabalho (Priority: P1)

Antes de uma trilha do Scaffold começar, alguém registra a linha de base: para
cada processo que vai ser tocado, quanto tempo leva hoje, quantas pessoas
tocam, com que frequência. Sem isso, nada do que vier depois é medição — é
opinião com gráfico.

**Why this priority**: É o que separa o Signal de um dashboard. Toda métrica do
produto é *delta contra a linha de base*; sem ela, o produto não tem o que
mostrar. E é a única parte que não pode ser feita depois — a linha de base
capturada após o trabalho começar já está contaminada.

**Independent Test**: Registrar linha de base para um processo, iniciar uma
trilha, tentar registrar linha de base de novo para o mesmo processo e ver o
sistema recusar com o motivo.

**Acceptance Scenarios**:

1. **Given** um processo sem linha de base, **When** alguém a registra, **Then**
   ela fica congelada com data, autor e confiança (`measured`, `estimated` ou
   `declared`) — e a confiança aparece em toda métrica derivada dela.
2. **Given** uma trilha do Scaffold em `PILOT` ou posterior para aquele
   processo, **When** alguém tenta registrar linha de base, **Then** o sistema
   recusa: linha de base depois do trabalho começar não é linha de base.
3. **Given** uma linha de base `declared` (ninguém mediu, alguém disse),
   **When** o relatório é gerado, **Then** toda métrica derivada carrega o
   selo `declared`, e o relatório diz em uma frase o que isso significa.

**[aberto]** Quem registra a linha de base — o cliente, a consultora, ou os
dois com assinatura? Meridian usa respondente por link; Scaffold usa gate com
aprovação. Signal precisa escolher.

**[reusa]** A escala de confiança do Meridian, sem alteração.

---

### User Story 2 — Adoção por time, sem vigilância (Priority: P1)

Depois que a trilha entrega, o Signal mostra, por time, se a coisa está sendo
usada: quantas pessoas usaram na semana, com que frequência, em que processo.
**Agregado por time, nunca por pessoa.**

**Why this priority**: É a primeira das quatro saídas do site, e é a que
responde "o piloto virou prática?" — a pergunta que o próprio site levanta na
seção da lacuna. Sem adoção medida, horas recuperadas é extrapolação.

**Independent Test**: Alimentar eventos de uso de três pessoas do mesmo time,
abrir a tela, ver a contagem agregada e **não** ver nome nenhum.

**Acceptance Scenarios**:

1. **Given** eventos de uso chegando de uma integração, **When** o painel
   agrega, **Then** mostra por time: usuários ativos, frequência, processos
   tocados — e nenhum dado individual sai da camada de agregação.
2. **Given** um time com menos de N pessoas **[aberto: N]**, **When** o painel
   agrega, **Then** suprime a linha, pelo mesmo motivo que o benchmark do
   Meridian suprime coorte abaixo de cinco: com poucos, agregado identifica.
3. **Given** uma pessoa que pede eliminação de dados (LGPD), **When** o pedido
   é processado, **Then** os eventos dela saem e os agregados históricos
   **não são recalculados** — o agregado já não a identificava, e recalcular
   revelaria por diferença.

**[aberto]** De onde vêm os eventos de uso. O site diz "conecta às ferramentas
que você já usa". Quais? A primeira integração define o produto. Candidatas
pelo que o Cosmos já integra: Linear, GitHub, e o próprio Cosmos.

**[aberto]** A fronteira entre "adoção" e "vigilância" precisa estar escrita
antes da primeira linha de código, e precisa ser regra de produto, não só de
UI — porque é exatamente o que um comitê de trabalhadores vai perguntar. O
Charter da própria Nebuloz deveria ter este caso de uso cadastrado antes de o
produto existir.

---

### User Story 3 — Horas recuperadas, com a conta aberta (Priority: P2)

Para cada processo com linha de base e adoção medida, o Signal calcula horas
recuperadas: (tempo antes − tempo depois) × frequência × pessoas. **E mostra a
conta**, não só o resultado — cada fator com sua confiança.

**Why this priority**: É a métrica que o CFO quer e a que mais fácil vira
mentira. P2 porque depende das duas anteriores e porque a credibilidade dela
vem inteiramente de a conta estar aberta — um número sem os fatores é o
"retorno anedótico" que o site promete substituir.

**Independent Test**: Registrar linha de base `measured` de 40 min, tempo
depois `estimated` de 15 min, 20 execuções/semana, 3 pessoas; ver 25 horas na
semana, com a linha de base marcada `measured` e o resultado marcado
`estimated` (o mais fraco dos fatores manda).

**Acceptance Scenarios**:

1. **Given** todos os fatores presentes, **When** o cálculo roda, **Then** a
   tela mostra a fórmula preenchida, e a confiança do resultado é a **menor**
   entre os fatores — nunca a média.
2. **Given** um fator ausente, **When** o cálculo roda, **Then** não há número:
   há a lista do que falta. Zero não é resposta.
3. **Given** horas recuperadas e um custo-hora informado **[aberto: por quem]**,
   **When** o relatório é gerado, **Then** o valor em dinheiro aparece com a
   mesma confiança das horas e com o custo-hora declarado ao lado.

**[aberto]** "Tempo depois" é medido como? Amostragem, auto-relato, telemetria?
Cada um tem uma confiança diferente e a spec precisa nomear.

---

### User Story 4 — Relatório para o conselho (Priority: P2)

Um documento periódico, exportável, que junta as três anteriores em uma página:
o que foi medido, contra que linha de base, com que confiança, e o que ainda
não dá para afirmar.

**Why this priority**: É a saída que o comprador de fato consome — o CFO não
abre painel, abre PDF antes da reunião. P2 porque é composição das anteriores.

**Independent Test**: Gerar o relatório de um período com um processo
`measured` e outro `declared`; conferir que o documento distingue os dois e
tem uma seção "o que não afirmamos".

**Acceptance Scenarios**:

1. **Given** um período fechado, **When** o relatório é gerado, **Then** ele é
   congelado — regerar o mesmo período produz o mesmo documento, e o dado que
   mudou depois vai para o período seguinte.
2. **Given** métricas de confiança mista, **When** o relatório é gerado,
   **Then** a primeira página diz quantas são `measured`, quantas `estimated`,
   quantas `declared`, antes de qualquer número.
3. **Given** um processo sem linha de base, **When** o relatório é gerado,
   **Then** ele aparece na seção "não medido", não some.

**[reusa]** O export de conformidade do Charter (`compliance-export.ts`,
`compliance-pdf.tsx`) como padrão de documento congelado por período.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda métrica carrega a escala de confiança do Meridian
  (`measured | estimated | declared`), e a de um cálculo é a menor entre seus
  fatores.
- **FR-002**: Linha de base é imutável após a trilha correspondente sair de
  `ASSESS`.
- **FR-003**: Adoção é agregada por time; nenhuma leitura individual sai da
  camada de agregação, e times abaixo de N são suprimidos.
- **FR-004**: Cálculo com fator ausente não produz número.
- **FR-005**: Relatório de período fechado é imutável.
- **FR-006**: Eliminação de titular remove eventos individuais sem recalcular
  agregados históricos.

### Key Entities *(draft)*

- **Baseline** — processo, medida, confiança, autor, data, congelada.
- **UsageEvent** — evento de uso vindo de integração; individual; sujeito a
  eliminação; **nunca lido fora da agregação**.
- **AdoptionSnapshot** — agregado por time e período, derivado de UsageEvent,
  sobrevive à eliminação dos eventos.
- **RecoveryLedger** — horas recuperadas por processo e período, com os fatores
  e a confiança de cada um.
- **SignalReport** — documento por período, congelado.

**[reusa]** `FlowMetricSnapshot` para tempo de ciclo; `CostSnapshot` para custo;
`MeridianConfidence` (ou equivalente compartilhado) para a escala.

---

## O que esta spec deliberadamente não decide

- **Preço.** Decisão de 2026-09-02 adia junto com os demais.
- **A primeira integração.** Define o produto e não está escolhida.
- **A fronteira adoção/vigilância.** Precisa ser regra escrita, com o caso de
  uso cadastrado no Charter da Nebuloz antes da primeira linha de código.
- **Quem registra linha de base e quem informa custo-hora.**
- **O tamanho de N** para supressão de time pequeno.

Cinco decisões. Nenhuma é de engenharia, e as duas do meio são as que um
cliente regulado vai perguntar primeiro.

---

## Success Criteria *(draft)*

- **SC-001**: Um relatório de período pode ser lido por um CFO sem contexto e
  responde "quanto recuperamos, com que certeza, e o que não sabemos" na
  primeira página.
- **SC-002**: Nenhum caminho do produto expõe uso individual — verificável por
  teste, não por revisão.
- **SC-003**: A mesma linha de base e os mesmos eventos produzem o mesmo
  relatório, sempre.
