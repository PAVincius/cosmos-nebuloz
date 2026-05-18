# PRD – Feature: Lean Budget & Guardrails

## 1. Visão Geral

### 1.1. Resumo

A feature **"Lean Budget & Guardrails"** permite que o COSMOS:

- modele orçamento em nível de **value streams / ARTs** (não apenas projeto);
- conecte custos reais de integrações pagas (financeiro, RH, notas fiscais) ao portfólio SAFe;
- aplique **Lean Budget Guardrails** para avisar e controlar estouros de budget.

### 1.2. Contexto SAFe

SAFe 6.0 recomenda **Lean Budgets** com funding por value stream/ART e guardrails para governança leve e efetiva. Lean Portfolio Management exige:
- visibilidade clara de investimento por value stream;
- alinhamento entre gastos e resultados (épicos, temas, OKRs);
- envolvimento de financeiro via métricas e relatórios contínuos.

---

## 2. Problema / Oportunidade

### 2.1. Problema

- Custos de ferramentas/SaaS/folha ficam em ERPs/planilhas desconectados do contexto SAFe.
- Não há visão direta de **"quanto custa este value stream / épico / PI"** dentro da ferramenta de gestão.
- Lean Budget fica teórico: funding por VS, mas sem link automático com faturas e integrações reais.

### 2.2. Oportunidade

Integrar financeiro/RH/notas ao COSMOS permite:
- visibilidade real de custo por value stream/épico/PI;
- guardrails de budget automatizados;
- relatórios de ROI e custo por fluxo de valor (não só por projeto).

---

## 3. Objetivos e Métricas de Sucesso

### 3.1. Objetivos

- Tornar o COSMOS a "fonte de verdade" de gastos Lean Budget por value stream/ART.
- Permitir que LPM e financeiro vejam **budget vs real** e violações de guardrails em tempo quase real.
- Facilitar prestação de contas de custos de integrações/assinaturas por projeto/épico/PI.

### 3.2. Métricas

- % de despesas/invoices entrando automaticamente com alocação completa (VS/ART + categoria).
- Nº de violações de guardrail detectadas e tratadas por período.
- Tempo médio para responder "quanto custou este épico/PI?" usando COSMOS.

---

## 4. Escopo

### 4.1. IN (versão inicial)

- Modelo de dados: `Portfolio`, `ValueStream/ART`, `BudgetGuardrail`, `IntegrationProvider`, `SubscriptionContract`, `Invoice`, `CostAllocation`.
- Jobs de integração com ao menos um tipo de sistema financeiro/RH/faturamento.
- Regras de alocação: `fixed_split`, `headcount_based`, `manual`.
- Cálculo de budget vs real por value stream e guardrails básicos (limites percentuais).
- Relatórios básicos: gasto por VS/ART vs budget; gasto por categoria/provider; custo por épico/projeto/PI.

### 4.2. OUT (futuro)

- Estratégia `usage_based` com métricas de uso de ferramentas.
- Integrações específicas (Omie, Conta Azul, QuickBooks, Gusto, Deel).
- Dashboards com forecast de budget e cenários "what-if".

---

## 5. Personas e Casos de Uso

### 5.1. Personas

| Persona | Necessidade principal |
|---|---|
| **Lean Portfolio Manager (LPM)** | Acompanhar budget vs real por VS e negociar ajustes |
| **Finance / Controlling** | Mapear custos de ferramentas e folha para centros de custo/VS |
| **Enterprise Architect / PMO** | Ver custo real de épicos/projetos e PIs |
| **RTE / ART Leadership** | Usar dados de custo + fluxo para priorizar e negociar funding |

### 5.2. Casos de Uso

1. Cadastrar VS/ART com budget anual e guardrails de gasto.
2. Cadastrar integrações pagas com contratos e estratégias de alocação.
3. Importar invoices automaticamente, classificá-las e alocá-las por VS.
4. Visualizar relatórios de budget vs real por VS/ART, com alertas de violações.
5. Ver quanto custou um épico/PI específico (soma das alocações vinculadas).

---

## 6. Fluxos (alto nível)

### 6.1. Configuração inicial

1. Admin configura Portfolios e VS/ARTs com `budget_anual` e `periodo_budget`.
2. LPM define `BudgetGuardrail` por portfolio.
3. Admin cadastra `IntegrationProvider` e `SubscriptionContract` com `allocation_strategy`.

### 6.2. Importação e alocação automática

1. Job periódico chama API do `IntegrationProvider` e importa invoices.
2. Backend cria registros `Invoice`.
3. Regras do contrato/provider aplicam `CostAllocation` automática.

### 6.3. Validação e guardrails

1. Ao gravar `CostAllocation`, serviço de budget recalcula gasto acumulado do VS e percentuais por categoria.
2. Se guardrail violado: registra evento, notifica LPM/finance, opcionalmente marca alocação como "pendente de aprovação".

### 6.4. Relatórios

1. LPM/finance acessa tela de Lean Budget do portfolio: gráfico budget vs real, tabela por categoria/provider, lista de violações.
2. Em épico/PI, aba "Custos" lista invoices alocadas, valor total e breakdown por categoria.

---

## 7. Requisitos Funcionais

| RF | Descrição |
|---|---|
| **RF-01** | CRUD de `Portfolio` e `ValueStream/ART` com campos de budget/horizonte |
| **RF-02** | `BudgetGuardrail` com tipos e limites; serviço de validação acionado a cada atualização |
| **RF-03** | CRUD de `IntegrationProvider` e `SubscriptionContract`; jobs configuráveis para buscar invoices |
| **RF-04** | Importação de invoices e criação de `CostAllocation` conforme `allocation_strategy`; endpoint de ajuste manual |
| **RF-05** | Serviço de cálculo budget vs real por `portfolio_id`/período com breakdown por VS/ART e categoria |
| **RF-06** | Geração de evento de violação de guardrail; API para consumo por UI, notificações e webhooks |

---

## 8. Requisitos Não Funcionais

- **Escalabilidade**: modelado para muitas invoices e alocações por mês sem queda de performance (virtualização obrigatória na UI para listas > 200 itens).
- **Confiabilidade**: logs e trilha de auditoria completos para compliance/finanças.
- **Segurança**: segregação de dados financeiros sensíveis, RBAC para acessar custos.
- **Performance de UI**: First Contentful Paint < 1.5s para dashboard de budget (dados críticos via Server Components, gráficos lazy-loaded).
- **Acessibilidade**: WCAG 2.1 AA para tabelas financeiras e formulários de alocação.

---

## 9. Dependências

- Modelo de Portfólio/Value Stream/ART/Épico/PI já existente no COSMOS.
- Módulo de autenticação/autorização (roles de LPM/Finance/Admin).
- Infra de jobs/worker para integrações (fila/cron).

---

## 10. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Complexidade alta de integração com sistemas financeiros reais | Começar com integração genérica (CSV/API simples) e poucas estratégias de alocação |
| Desalinhamento entre contabilidade oficial e visão Lean Budget | Posicionar COSMOS como camada de **gestão de portfólio**, não contabilidade; alinhar com finance team desde o início |
| Lentidão de UI com grandes volumes de invoices | Virtualização com `@tanstack/react-virtual`; paginação cursor-based na API |

---

## 11. Critérios de Aceitação

1. É possível cadastrar budgets por value stream e guardrails por portfolio.
2. É possível cadastrar pelo menos um `IntegrationProvider` e importar invoices.
3. Invoices importadas geram `CostAllocation` automática conforme estratégia do contrato.
4. Relatórios mostram budget vs real por VS em período selecionado.
5. Violações de guardrails são detectadas, registradas e exibidas no dashboard.

---

## 12. Especificações de Frontend

### 12.1. Telas e componentes

#### Dashboard de Lean Budget (`/portfolio/[id]/lean-budget`)

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `LeanBudgetDashboard` | Server Component | Layout principal; carrega dados de budget e violações via RSC |
| `BudgetSummaryHeader` | Client Component | Totais do portfólio, seletor de período, indicador de guardrails |
| `ValueStreamBudgetGrid` | Server Component | Grid de cards por VS/ART |
| `ValueStreamBudgetCard` | Client Component | Budget vs real de uma VS; badge de status de guardrail |
| `BudgetVsRealChart` | Client Component (lazy) | Gráfico de barras/área; carregado sob demanda |
| `GuardrailViolationFeed` | Client Component | Lista em tempo quase real de violações; `aria-live="polite"` |

#### Tabela de Invoices (`/portfolio/[id]/lean-budget/invoices`)

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `InvoiceFilters` | Client Component | Filtros: categoria, período, provider, status de pagamento |
| `InvoiceTable` | Client Component | Lista virtualizada com `@tanstack/react-virtual` (obrigatório para > 200 linhas) |
| `InvoiceRow` | Client Component (memo) | Linha da tabela; memoizado para evitar re-renders no scroll |
| `InvoiceDetailDrawer` | Client Component | Drawer lateral com detalhes e `CostAllocationForm` |

#### Configurações (`/portfolio/[id]/lean-budget/settings`)

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `GuardrailConfigPanel` | Client Component | CRUD de guardrails com validação Zod |
| `IntegrationProviderList` | Client Component | Lista de providers com status de conexão |
| `SubscriptionContractForm` | Client Component | Formulário de contrato com seletor de `allocation_strategy` |

### 12.2. Padrões de estado

```
Budget Dashboard
├── Server state (React Query)
│   ├── budget summary (staleTime: 60s)
│   ├── guardrail violations (staleTime: 30s)
│   └── invoice list (cursor-based pagination)
│
└── UI state (local useState / useReducer)
    ├── período selecionado (filtro)
    ├── VS/ART selecionada (drill-down)
    └── rascunho de CostAllocation (reducer local antes de salvar)
```

### 12.3. Fluxo de edição de alocação

```
InvoiceTable
  → clique na linha
  → InvoiceDetailDrawer abre
  → CostAllocationForm carregado (allocationReducer inicializado com dados existentes)
  → usuário ajusta percentuais / vincula épico
  → validação Zod (soma ≤ 100%, uuid válido)
  → submit → mutation React Query → invalidate ['allocations', invoiceId]
  → drawer fecha → InvoiceTable atualiza
```

### 12.4. GuardrailStatusBadge

Feedback visual em 3 estados baseado em `gasto / limite`:

```
<= 80%  →  badge verde   "Dentro do limite"
80–100% →  badge âmbar   "Atenção: X% do guardrail"
> 100%  →  badge vermelho + ícone  "Guardrail violado"
```

`role="status"` + `aria-label` descritivo para leitores de tela.

### 12.5. Tratamento de erros

- `ErrorBoundary` envolvendo `BudgetVsRealChart` e `InvoiceTable` isoladamente (falha de gráfico não derruba a página).
- Formulários exibem erros inline por campo (Zod + react-hook-form `formState.errors`).
- Toast de erro para falhas de importação de invoice ou violação bloqueante de guardrail.

### 12.6. Acessibilidade (WCAG 2.1 AA)

- `InvoiceTable` usa `<table>` semântico com `<th scope="col">` e `aria-sort` em colunas ordenáveis.
- `GuardrailViolationFeed` usa `aria-live="polite"` para anunciar novas violações sem interromper o usuário.
- `InvoiceDetailDrawer` gerencia foco: foca no primeiro campo ao abrir; restaura foco no elemento disparador ao fechar.
- Todos os campos de percentual têm `aria-label` explícito com nome da VS.
- Navegação por teclado completa em `GuardrailConfigPanel` (Tabs entre guardrails, Enter para editar, Esc para cancelar).
