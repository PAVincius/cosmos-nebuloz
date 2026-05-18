# LEAN_BUDGET – Modelo de Lean Budget no COSMOS

## 1. Propósito

Este documento define como o COSMOS implementa **Lean Budgets** e **Lean Budget Guardrails** para:

- financiar **Value Streams / ARTs** em vez de projetos isolados;
- integrar custos reais (SaaS, folha, serviços, notas fiscais) ao portfólio;
- manter alinhamento com SAFe 6.0 e Lean Portfolio Management.

---

## 2. Conceitos básicos (SAFe 6.0)

- **Lean Budgets**: modelo de financiamento que concede orçamentos fixos a value streams para acelerar a tomada de decisão e reduzir a burocracia, mantendo governança por guardrails.
- **Lean Budget Guardrails**: políticas e limites que orientam:
  - alocação de investimento por value stream e horizonte de tempo;
  - aprovação de épicos significativos;
  - gastos com iniciativas e capacidades;
  - revisão contínua do desempenho do portfólio.

No COSMOS, o Lean Budget conecta:

> Portfolio → Value Streams / ARTs → Épicos / Projetos → PIs → Custos reais (integrações, folha, notas).

---

## 3. Entidades principais

### 3.1. Portfolio

Representa um portfólio SAFe.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Identificador |
| `nome` | string | Nome do portfólio |
| `moeda` | string | ex.: BRL, USD |
| `budget_total_aprovado` | decimal | Total do período |
| `periodo_budget` | enum | `anual`, `semestral` |

Relacionamentos: 1:N `ValueStream`, 1:N `BudgetGuardrail`

### 3.2. ValueStream / ART

Unidade principal de funding.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Identificador |
| `portfolio_id` | uuid | FK Portfolio |
| `nome` | string | Nome da VS/ART |
| `tipo` | enum | `value_stream`, `art` |
| `budget_anual` | decimal | Budget aprovado |
| `budget_disponivel` | decimal | Budget restante (calculado) |
| `horizonte_budget` | enum | `ano`, `quarter`, `pi` |

Relacionamentos: 1:N `Epic`/`Solution`, 1:N `CostAllocation`

### 3.3. BudgetGuardrail

Define limites e políticas de gasto.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Identificador |
| `portfolio_id` | uuid | FK Portfolio |
| `nome` | string | Nome descritivo |
| `tipo` | enum | `horizonte_investimento`, `alocacao_capacidade`, `aprovacao_epicos`, `revisao_continua` |
| `limite_percentual` | decimal | Ex.: 15.0 = máx. 15% do budget |
| `ativo` | boolean | Guardrail habilitado |

Guardrails são avaliados a cada criação ou alteração de `CostAllocation`.

---

## 4. Integrações pagas e contratos

### 4.1. IntegrationProvider

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Identificador |
| `nome` | string | Nome do provedor |
| `tipo` | enum | `finance`, `hr`, `invoicing`, `other` |
| `api_config` | jsonb | client_id, secret, scopes, endpoint |
| `billing_model` | enum | `subscription`, `per_user`, `usage_based` |
| `ativo` | boolean | Provider ativo |

### 4.2. SubscriptionContract

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Identificador |
| `integration_provider_id` | uuid | FK Provider |
| `descricao` | string | Descrição do contrato |
| `valor_mensal` | decimal | Valor recorrente |
| `moeda` | string | Moeda do contrato |
| `data_inicio` | date | Início da vigência |
| `data_fim` | date? | Fim (opcional) |
| `billing_cycle` | enum | `monthly`, `yearly`, `custom` |
| `allocation_strategy` | enum | `fixed_split`, `headcount_based`, `usage_based`, `manual` |
| `metadata` | jsonb | Detalhes adicionais do contrato |

---

## 5. Faturas, notas e despesas

### 5.1. Invoice / Expense

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Identificador |
| `subscription_id` | uuid? | FK Contrato (opcional) |
| `integration_provider_id` | uuid | FK Provider |
| `numero_nota` | string | Nº da NF/fatura |
| `data_emissao` | date | Data de emissão |
| `valor` | decimal | Valor total |
| `moeda` | string | Moeda |
| `categoria` | enum | `saas`, `payroll`, `infra`, `consulting`, `other` |
| `metadata_fiscal` | jsonb | CFOP, impostos, etc. |
| `status_pagamento` | enum | `pendente`, `pago`, `cancelado` |

Relacionamentos: 1:N `CostAllocation`

---

## 6. Alocação de Custos (CostAllocation)

### 6.1. CostAllocation

Divide o valor de uma invoice entre value streams, ARTs, épicos, projetos e PIs.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Identificador |
| `invoice_id` | uuid | FK Invoice |
| `value_stream_id` | uuid | Obrigatório |
| `art_id` | uuid? | Opcional |
| `epic_id` | uuid? | Opcional |
| `project_id` | uuid? | Opcional |
| `pi_id` | uuid? | Opcional |
| `percentual` | decimal | 0–100 |
| `valor_alocado` | decimal | Valor calculado |
| `categoria` | enum | Herdada ou sobrescrita |
| `criado_por` | uuid | FK usuário |
| `criado_em` | timestamp | Data de criação |

**Regras:**
- Soma de `percentual` por `invoice_id` ≤ 100%.
- Uma invoice pode ter múltiplas `CostAllocation` para divisão entre value streams.

---

## 7. Fluxos de uso

### 7.1. Onboarding de integrações e contratos

1. Admin cadastra `IntegrationProvider` (ERP financeiro, sistema de RH, emissor de notas).
2. Cria `SubscriptionContract` com valor, ciclo de cobrança e `allocation_strategy`.
3. COSMOS executa jobs de sincronização (diário/horário) para importar invoices/despesas.

### 7.2. Importação e classificação de invoices

1. Job chama API do `IntegrationProvider` e traz faturas / despesas.
2. Backend converte para `Invoice`, preenchendo categoria e metadata.
3. Regras automáticas por contrato geram `CostAllocation` padrão:
   - `fixed_split`: percentuais fixos por value stream.
   - `headcount_based`: headcount por VS/ART (via integração de RH) divide custo proporcionalmente.
   - `usage_based`: métricas de uso distribuem o custo.

### 7.3. Ajuste manual de alocação

Usuários com permissão podem:
- revisar `CostAllocation` sugeridas;
- ajustar percentuais/valores;
- vincular a `epic_id`/`project_id`/`pi_id`.

---

## 8. Aplicação de Lean Budget Guardrails

A cada criação/alteração de `CostAllocation`:

1. Recalcula gasto acumulado no período (ano/quarter/PI) por `value_stream_id`/`art_id` e categoria.
2. Compara com `budget_anual`/`budget_periodo` e `BudgetGuardrail.limite_percentual`.
3. Se violar:
   - registra evento de violação;
   - dispara notificação para LPM/finance;
   - opcionalmente bloqueia ou solicita aprovação explícita.

**Exemplos de checagens:**
- "VS-001 excedeu 10% de budget em novas iniciativas no horizonte atual."
- "Despesas SaaS do VS-001 ultrapassaram o guardrail de 15% do budget anual."

---

## 9. Relatórios e visualizações

### 9.1. Portfólio / Value Stream

- Budget planejado vs real por VS/ART (anual, trimestral, PI).
- Gasto por categoria (SaaS, folha, consultoria, infra).
- Gasto por provider.

### 9.2. Tema Estratégico / Épico / Projeto

- Soma das `CostAllocation` vinculadas.
- Relação custo × resultados (OKRs, métricas de negócio).

### 9.3. PI / ART

- Custo do PI por value stream, ART e épico.
- Cruzamento com throughput e objetivos de PI.

---

## 10. Políticas e boas práticas

- **Fundear value streams, não projetos**: `value_stream_id` sempre obrigatório; vínculos a épicos/projetos são detalhes adicionais.
- **Revisar em cadência de portfólio**: relatórios Lean Budget revisados junto com OKRs/épicos por quarter/PI.
- **Automatizar ao máximo**: regras por provider/contrato minimizam alocação manual, com governança por guardrails.

---

## 11. Frontend – Arquitetura de Componentes

### 11.1. Hierarquia de páginas

```
/portfolio/[id]/lean-budget
  ├── LeanBudgetDashboard          ← Server Component (dados iniciais via RSC)
  │   ├── BudgetSummaryHeader      ← totais do portfólio, período selector
  │   ├── ValueStreamBudgetGrid    ← grid de cards por VS/ART
  │   │   └── ValueStreamBudgetCard (× N)
  │   ├── BudgetVsRealChart        ← lazy-loaded (recharts / victory)
  │   └── GuardrailViolationFeed   ← lista de violações recentes
  │
  └── /invoices
      ├── InvoiceFilters           ← filtros client-side (categoria, período, provider)
      ├── InvoiceTable             ← virtualizada (@tanstack/react-virtual)
      └── InvoiceDetailDrawer      ← drawer com CostAllocationForm

/portfolio/[id]/lean-budget/settings
  ├── GuardrailConfigPanel
  ├── IntegrationProviderList
  └── SubscriptionContractForm
```

### 11.2. Estratégia de busca de dados

```typescript
// Server Component — dados de budget do portfólio (zero client JS)
export default async function LeanBudgetDashboard({ params }: { params: { id: string } }) {
  const [summary, guardrails] = await Promise.all([
    getBudgetSummary(params.id),
    getGuardrailViolations(params.id),
  ])
  return (
    <>
      <BudgetSummaryHeader summary={summary} />
      <GuardrailViolationFeed violations={guardrails} />
      <Suspense fallback={<ChartSkeleton />}>
        <BudgetVsRealChart portfolioId={params.id} />
      </Suspense>
    </>
  )
}
```

Para dados mutáveis em tempo real (alocações, violações novas), usar **React Query** no client:

```typescript
const { data: allocations } = useQuery({
  queryKey: ['allocations', invoiceId],
  queryFn: () => getCostAllocations(invoiceId),
  staleTime: 30_000,
})
```

### 11.3. State management – CostAllocation

```typescript
// Reducer local para edição de alocações antes de persistir
type AllocationAction =
  | { type: 'SET_SPLIT'; vsId: string; pct: number }
  | { type: 'LINK_EPIC'; vsId: string; epicId: string }
  | { type: 'RESET' }

function allocationReducer(state: AllocationDraft, action: AllocationAction): AllocationDraft {
  switch (action.type) {
    case 'SET_SPLIT':
      return { ...state, splits: state.splits.map(s =>
        s.vsId === action.vsId ? { ...s, percentual: action.pct } : s
      )}
    case 'LINK_EPIC':
      return { ...state, splits: state.splits.map(s =>
        s.vsId === action.vsId ? { ...s, epicId: action.epicId } : s
      )}
    case 'RESET':
      return initialAllocationDraft(state.invoice)
  }
}
```

### 11.4. InvoiceTable – Virtualização

Portfólios grandes geram centenas a milhares de invoices por mês. Virtualizar obrigatoriamente:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: invoices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(row => (
          <div
            key={row.index}
            style={{ position: 'absolute', top: row.start, height: row.size, width: '100%' }}
          >
            <InvoiceRow invoice={invoices[row.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 11.5. CostAllocationForm – Validação

```typescript
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const allocationSchema = z.object({
  splits: z.array(z.object({
    value_stream_id: z.string().uuid(),
    percentual: z.number().min(0).max(100),
    epic_id: z.string().uuid().optional(),
  })).refine(splits => splits.reduce((sum, s) => sum + s.percentual, 0) <= 100, {
    message: 'Soma dos percentuais não pode exceder 100%',
  }),
})

type AllocationFormValues = z.infer<typeof allocationSchema>
```

### 11.6. Guardrail – Feedback visual

- **Verde**: dentro do limite (`<= 80%` do guardrail).
- **Âmbar**: zona de atenção (`80–100%`).
- **Vermelho + ícone de bloqueio**: violação ativa (`> 100%`).

```typescript
function guardrailStatus(gasto: number, limite: number): 'ok' | 'warning' | 'violation' {
  const pct = gasto / limite
  if (pct > 1) return 'violation'
  if (pct > 0.8) return 'warning'
  return 'ok'
}
```

### 11.7. Performance – Code splitting

```typescript
// Gráficos são pesados — carregam só quando visíveis
const BudgetVsRealChart = lazy(() => import('./BudgetVsRealChart'))
const CategoryBreakdownChart = lazy(() => import('./CategoryBreakdownChart'))

// Painel de configuração de integrações — admin only
const IntegrationSettingsPanel = lazy(() => import('./IntegrationSettingsPanel'))
```

### 11.8. Acessibilidade – tabelas de budget

- Usar `<table>` semântico (não divs) para `InvoiceTable`.
- `aria-sort` em colunas ordenáveis.
- `aria-live="polite"` no `GuardrailViolationFeed` para anunciar novas violações.
- Navegação por teclado no `CostAllocationForm` (Tab entre inputs de percentual, Enter para confirmar VS).
- `role="status"` em indicadores de guardrail.
