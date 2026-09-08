# Feature Specification: Signal — medição de adoção e valor de IA

**Branch**: `claude/signal-html-implementation-636f46` | **Data**: 2026-09-02
**Fonte de design**: Claude Design · projeto `691f7fe5` · `signal.html` (+ `signal-*.jsx`, `charter-base.jsx`, `charter-modal.jsx`, `cosmos-icons.jsx`, `cosmos-kit.jsx`)
**Fonte de requisito**: `uploads/signal-prd-detailed.md` (PRD), `uploads/signal-brd.md`, `uploads/signal-mrd.md`
**Módulo**: `ProductModule.SIGNAL` (já existe em `packages/database/prisma/schema/modules.prisma`)

---

## 1. Resumo

Signal é o quarto produto da plataforma Nebuloz (ao lado de Cosmos, Charter e Meridian). Mede **adoção e valor de iniciativas de IA** de um tenant: registra a iniciativa, congela um baseline assinado, conecta fontes de dado, calcula ROI com fórmula versionada e visível, atribui um **score de confiança**, e emite um **veredito** que é a linguagem de decisão do CFO.

A regra-mãe do produto, herdada literalmente do design: **adoção e resultado moram juntos; ROI nunca aparece sem fórmula e sem confiança.**

## 2. Problema

Empresas investem em IA sem forma confiável de medir adoção, valor operacional e ROI de modo consistente. O reporte vive espalhado em planilhas, BI e updates ad hoc. Quem decide precisa de uma fonte de verdade que ligue atividade de iniciativa a resultado de negócio — e que sobreviva a contestação em comitê.

## 3. Personas (do design `signal-shell.jsx`)

| Persona | Papel | Lente |
|---|---|---|
| CFO | Otávio Lins · CFO | Onde o dinheiro rende e onde não rende |
| CTO | Bruno Sato · CTO | Adoção real e saúde das fontes antes de acreditar no ROI |
| Program owner | Marina Duarte · AI program owner | Baseline, fórmula e mapeamento defensáveis |
| PMO | Íris Campos · PMO/transformação | Compara iniciativas entre áreas, prepara o comitê |
| Gestora | Paula Rocha · Gerente de Operações | Iniciativas da própria área, não o portfólio |

O switcher de persona do protótipo é **lente de visualização**, não autorização. A autorização real é `SignalRole` (§7.3).

## 4. Escopo

### 4.1 Em escopo (V1)

Registro de iniciativas · baseline versionado e assinado · conexões de dado com saúde · mapeamento evento→métrica · métricas de adoção e resultado · ROI com componentes/custos/premissas versionados · score de confiança · veredito · dashboards executivo e de detalhe · alertas · evidências rastreáveis · trilha de auditoria · relatórios congeláveis e exportáveis · paleta ⌘K · preferências (tema, contraste, movimento, idioma).

### 4.2 Fora de escopo

Substituir compras/billing · treino ou benchmark de modelo · enforcement de política de uso · substituir BI genérico · workflow de GRC/jurídico · motor de recomendação e benchmarking cross-tenant (V2) · ingestão automática real das fontes (V1 entrega o *contrato* de conexão + entrada manual/semi-manual; conectores reais entram por iteração, conforme TR-1).

## 5. Telas (10 · IA do design)

Seções do sidebar: **Valor** · **Prova** · **Dado** · **Sistema**.

| id | Tela | Seção | Conteúdo essencial |
|---|---|---|---|
| `overview` | Visão geral | Valor | KPIs de portfólio, matriz adoção × valor, ranking, alertas, narrativa |
| `initiatives` | Iniciativas | Valor | Lista/filtro por BU, categoria, status, veredito |
| `alerts` | Alertas | Valor | Fila de alertas `low` / `weak` / `stale` com regra, o quê e próximo passo |
| `initiative` | Iniciativa (detalhe) | Valor | Hipótese, baseline, adoção, resultado, ROI, confiança, evidências, histórico |
| `evidence` | Evidências | Prova | Observações com fonte, mapeamento, janela, linhas, transformação |
| `audit` | Trilha de auditoria | Prova | Append-only: quem, quando, de → para, nota |
| `reports` | Relatórios | Prova | Snapshots congeláveis; bloqueio quando há fonte sem lastro |
| `connections` | Conexões | Dado | Fonte, saúde, último sync, o que alimenta, erro e impacto |
| `mapping` | Mapeamento de métricas | Dado | Evento → métrica, transformação, unidade, versão, estado |
| `settings` | Configurações | Sistema | Preferências, limiares, papéis |

## 6. Requisitos funcionais

Mapeados 1:1 do PRD (`FR-n`), com o comportamento observado no protótipo.

### 6.1 Iniciativas
- **FR-1** Criar iniciativa com nome, dono, hipótese de negócio, data de início, categoria (`productivity` | `quality` | `risk` | `revenue`), BU e valor esperado.
- **FR-2** Editar metadados, métricas esperadas e status (autorizado).
- **FR-3** Ciclo de vida `draft → active → paused → closed | cancelled`. Encerramento exige **motivo** registrado (`closure` no design: quem, quando, por quê).

### 6.2 Baseline
- **FR-4** Capturar baseline **antes** da adoção.
- **FR-5** Dimensões mínimas: tempo, custo, volume (throughput), qualidade e base de usuários — cada uma com **fonte declarada**.
- **FR-6** Baseline é **versionado** (`v1`, `v2`, …) e **assinado** (quem assinou, quando, janela de medição). Versão anterior nunca é sobrescrita.

### 6.3 Conexões e mapeamento
- **FR-7** Conectar fontes: rastreador de tarefas, atendimento, data warehouse, planilha, comunicação, diretório.
- **FR-8** Mapear evento de origem → métrica de negócio, com transformação e unidade explícitas.
- **FR-9** Saúde da conexão: `healthy` | `stale` | `down`, com último sync, frequência, **erro acionável** e **impacto declarado** (quais métricas de quais iniciativas congelaram).
- Estado do mapeamento é derivado da saúde da fonte + revisão humana: `active` | `review` | `broken` | `stale`.

### 6.4 Medição
- **FR-10** Adoção: % sobre base licenciada, usuários ativos, frequência, **profundidade** de uso (texto qualitativo) e série temporal.
- **FR-11** Resultado: métrica primária (era → agora → Δ%) + métrica secundária + série temporal.
- **FR-12** ROI a partir de componentes de retorno e de custo, cada um com quantidade, unitário, total e **fonte**; premissas explícitas com nota. Fórmula **versionada**.
- **FR-13** Score de confiança 0–100 por fatores ponderados; cada fator carrega peso, obtido e nota do desconto. Faixas: ≥80 Alta · ≥65 Média · >0 Baixa · 0 Sem dado.
- **FR-14** Tendência de adoção, resultado e ROI ao longo do tempo.

### 6.5 Veredito (regra de decisão)
Cruzamento de dois limiares configuráveis por tenant — `ADOPTION_BAR` (padrão 60%) e `VALUE_BAR` (padrão 1,5×):

| adoção | valor | veredito | ação sugerida |
|---|---|---|---|
| ≥ bar | ≥ bar | **Provado** | Escalar orçamento |
| ≥ bar | < bar | **Uso sem valor** | Investigar método |
| < bar | ≥ bar | **Promessa parada** | Destravar adoção |
| < bar | < bar | **Candidata a parada** | Levar ao comitê |

### 6.6 Dashboards e relatório
- **FR-15** Visão geral com portfólio (retorno/investido), iniciativas ativas, valor em risco, alertas.
- **FR-16** Detalhe da iniciativa com métricas, evidências e histórico.
- **FR-17** Agrupamento por BU, programa, região ou categoria.
- **FR-18** Exportar sumário executivo e relatório por iniciativa a partir de **snapshot estruturado** (TR-4) — nunca raspagem de tela.

### 6.7 Evidência e auditoria
- **FR-19** Toda observação de métrica guarda: iniciativa, métrica, valor, janela, conexão, mapeamento, nº de linhas, transformação, quando e por quem; e pode carregar `flag` de ressalva.
- **FR-20** Auditoria append-only de mudanças em iniciativa, baseline, fórmula, atribuição, alerta e encerramento — com `de → para` e nota.

### 6.8 Alertas
- **FR-21** `low` — adoção < 40% após 8 semanas.
- **FR-22** `weak` — adoção ≥ 60% e ROI < 1,0×.
- **FR-23** `stale` — fonte sem sync há > 48 h.
Cada alerta traz **o quê**, **próximo passo** e **dono**.

## 7. Requisitos não-funcionais e de plataforma

### 7.1 Multi-tenant (NÃO NEGOCIÁVEL)
Toda leitura e escrita filtra por `tenantId` de `requireTenantSession(await headers())`. Nunca do body. RLS no banco.

### 7.2 Módulo
Acesso exige `TenantModule` com `module = SIGNAL` e status ativo. Ausência → `/signal-indisponivel`.

### 7.3 Papéis (`SignalRole`)
Ortogonal a `MemberRole`, `CharterRole` e `MeridianRole`:

| Papel | Pode |
|---|---|
| `VIEWER` | Ler tudo do tenant; exportar relatório já congelado |
| `OWNER` | Tudo de VIEWER + criar/editar as **próprias** iniciativas, capturar baseline |
| `ANALYST` | Tudo de OWNER (em qualquer iniciativa) + mapear métricas, versionar fórmula, recalcular |
| `ADMIN` | Tudo + conexões, limiares do tenant, congelar relatório, encerrar iniciativa |

### 7.4 Acessibilidade
Piso do DS, já presente no `signal.html`: skip link (WCAG 2.4.1), alvo de toque 44px em ponteiro grosso (2.5.8), `:focus-visible`, modo alto contraste (`data-contrast="high"`), movimento reduzido explícito (`data-motion="reduced"`) **e** `prefers-reduced-motion`.

### 7.5 Idioma
UI em PT-BR com dicionário (`SG_DICT`), preparada para en-US. Termos técnicos em inglês.

## 8. Modelo de dados (entidades)

`SignalInitiative` · `SignalBaseline` (versionado) · `SignalBaselineDimension` · `SignalConnection` · `SignalMetricMapping` (versionado) · `SignalMetricObservation` (= evidência) · `SignalRoiFormula` (versionada, com componentes/custos/premissas) · `SignalAdoptionSnapshot` · `SignalOutcomeSnapshot` · `SignalConfidenceFactor` · `SignalAlert` · `SignalReportSnapshot` · `SignalMember` · `SignalSettings` · `SignalSequence`. Auditoria reusa `AuditLog` com `entityType = "signal.<entidade>"`.

Detalhe em [data-model.md](./data-model.md).

## 9. Critérios de aceite

1. Um tenant com `SIGNAL` contratado acessa `/signal` e vê a visão geral; um sem o módulo cai em `/signal-indisponivel`.
2. Criar iniciativa → capturar baseline v1 assinado → conectar fonte → mapear evento → registrar observação → o detalhe mostra adoção, resultado, ROI, confiança e veredito **coerentes entre si**.
3. Nenhuma tela exibe múltiplo de ROI sem exibir, no mesmo contexto, a versão da fórmula e o score de confiança.
4. Derrubar uma conexão faz o mapeamento virar `broken`, a evidência afetada ganhar `flag` de congelamento, o alerta `stale` aparecer e a confiança cair pelo fator correspondente.
5. Congelar relatório produz snapshot imutável: mudar a fonte depois não altera o número do relatório.
6. Toda alteração de baseline, fórmula, atribuição e status aparece na trilha com `de → para` e autor.
7. Nenhuma query cruza tenant; toda server action repete o guard (sessão → módulo → papel → permissão).
8. `biome check`, `test:coverage ≥ 80%`, `build` verdes.

## 10. Questões em aberto

| # | Questão | Encaminhamento |
|---|---|---|
| Q1 | Quais integrações são obrigatórias no primeiro segmento? | V1 entrega o contrato de conexão + entrada manual; conectores por iteração |
| Q2 | Quanto de automação é aceitável no baseline? | V1: captura manual com fonte declarada por dimensão |
| Q3 | Qual modelo de confiança casa com a narrativa? | Adotado o do protótipo: 4 fatores ponderados (30/25/20/25), configurável por tenant |
| Q4 | Fórmula de ROI padrão por tipo de iniciativa? | V1: templates por categoria, editáveis e versionados |
