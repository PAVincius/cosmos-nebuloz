# Flow Intelligence Automation — Design Spec

## Goal

Fechar o gap entre infraestrutura já construída (staleness R1-R5, anomaly detection, capacity/synergy) e entrega real de valor: dados sempre frescos sem ação manual, anomalias detectadas automaticamente, e todos os painéis do Flow Intelligence visíveis no dashboard.

## Architecture

Três subsistemas independentes com ponto de integração no evento de fechamento de sprint:

```
Sprint Close Event
       │
       ├─→ FlowMetricSnapshot (created)
       │         │
       │         └─→ AnomalyDetectionRun (triggered)
       │
Vercel Cron (hourly)
       │
       ├─→ /api/cron/staleness-check   → StalenessService (session-free)
       └─→ /api/cron/anomaly-detection → analyzeFlowAnomalies (service layer)

Dashboard
       │
       ├─→ Flow Metrics tab (existing)
       ├─→ Anomaly tab (AnomalySummaryPanel, existing but only snapshotId passed)
       ├─→ Capacity tab (TeamCapacityTab — NEW wire-up)
       └─→ Synergy tab (SynergyTab — NEW wire-up)
```

**Tech stack:** Next.js 15 App Router, Vercel Cron, Prisma, `@repo/database`

---

## Subsistema A — Cron Layer (session-free staleness + anomaly)

### Problema atual

`/api/cron/staleness-check` só escreve `lastStalenessCheck = now()`. O re-scoring real de staleness (R1-R5) está em `checkSnapshotStaleness`, que chama `requireTenantSession` — impossível rodar em cron sem sessão de usuário.

### Solução

**A1 — Extrair lógica pura para `StalenessService`**

Novo arquivo: `apps/app/app/actions/flow-intelligence/staleness-service.ts`

Função: `scoreSnapshotStaleness(snapshotId: string, tenantId: string): Promise<void>`

- Recebe `tenantId` direto (sem session)
- Chama `computeStaleness` com dados do banco
- Atualiza `FlowMetricSnapshot.staleness`, `stalenessReasons`, `lastStalenessCheck`
- Grava `StalenessAuditLog` quando muda estado
- Não precisa de sessão — usa `tenantId` do cron payload

**A2 — Refatorar `/api/cron/staleness-check`**

- Remove código que só tocava timestamp
- Para cada snapshot com `lastStalenessCheck` < 20h:
  - Chama `scoreSnapshotStaleness(snapshot.id, snapshot.tenantId)`
- Limit: 100 snapshots por execução (evitar timeout)

**A3 — Novo `/api/cron/anomaly-detection`**

Novo arquivo: `apps/app/app/api/cron/anomaly-detection/route.ts`

- Busca snapshots FRESH/AGING sem `AnomalyDetectionRun` nas últimas 24h
- Para cada um: cria `AnomalyDetectionRun` + chama `runAllRules` diretamente (sem session)
- Auto-cria `ImprovementAction` para anomalias CRITICAL
- Limit: 50 snapshots por execução

**A4 — Configurar Vercel Cron em `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/staleness-check",   "schedule": "0 * * * *" },
    { "path": "/api/cron/anomaly-detection",  "schedule": "30 * * * *" }
  ]
}
```

Staleness a cada hora (XX:00), anomaly detection meia hora depois (XX:30) — garante que snapshots já foram re-scored antes da detecção.

**Auth:** ambos os endpoints validam `Authorization: Bearer $CRON_SECRET`.

---

## Subsistema B — Sprint Close Event

### Problema atual

`FlowMetricSnapshot` só é criado por `re-evaluate-snapshot.ts` (ação manual). Não existe trigger automático no fechamento de sprint, então anomaly detection nunca tem dados iniciais frescos.

### Solução

**B1 — Server action `closeSprintAndSnapshot`**

Novo arquivo: `apps/app/app/actions/sprints/close-sprint.ts`

```
closeSprintAndSnapshot(sprintId: string):
  1. Verifica sprint pertence ao tenant + está IN_PROGRESS
  2. Marca sprint como CLOSED + closedAt = now()
  3. Computa métricas do sprint (velocity, flowTime, efficiency, predictability, load, distribution)
     usando dados já existentes em Task/TaskAssignee
  4. Cria FlowMetricSnapshot com scope="team", period="sprint", periodRef=sprintId
  5. Dispara AnomalyDetectionRun com trigger="snapshot_created"
  6. Retorna { ok: true, snapshotId, runId }
```

**B2 — Botão "Fechar Sprint" no Program Board**

`apps/app/app/(authenticated)/arts/[artId]/program-board/page.tsx` — adiciona botão para RTEs/SMs fecharem sprint ativa. Confirmação modal antes de executar.

O botão só aparece se:
- Usuário tem role RTE ou SM
- Sprint está IN_PROGRESS
- Data de fim ≤ today + 1 dia

**B3 — Cálculo de métricas no closeSprintAndSnapshot**

Reutiliza a mesma lógica já em `getFlowMetrics` (flow-metrics/index.ts), mas para o sprint específico que está sendo fechado. Extrai a lógica de cálculo para uma função pura `computeSprintMetrics(sprintId, tenantId)` que pode ser chamada tanto pelo close action quanto pelo getFlowMetrics existente.

---

## Subsistema C — Dashboard Tabs Wire-up

### Problema atual

`TeamCapacityTab`, `SynergyMatrix`, `SynergyTab` existem como componentes mas não são importados em `FlowMetricsDashboard`. Usuário não tem como ver capacity ou synergy.

### Solução

**C1 — Buscar dados de capacity e synergy em `flow/page.tsx`**

Adicionar ao Promise.all existente:

```typescript
import { getTeamCapacity } from "@/app/actions/flow-intelligence/capacity";
import { getSynergyMatrix } from "@/app/actions/flow-intelligence/synergy";

// No Promise.all do selectedScope:
const [metrics, assessments, actions, stalenessInfo, capacityData, synergyData] =
  selectedScope?.type === "team"
    ? await Promise.all([
        getFlowMetrics(...),
        getAssessments(...),
        getImprovementActions(...),
        checkSnapshotStaleness(...),
        getTeamCapacity(selectedScope.id),
        getSynergyMatrix(selectedScope.id),
      ])
    : [null, [], [], null, null, null];
```

**C2 — Adicionar tabs no `FlowMetricsDashboard`**

Tabs existentes: "flow" | "measure". Adicionar: "capacity" | "synergy".

Tab "Capacity" — renderiza `<TeamCapacityTab />` com dados de capacidade
Tab "Synergy" — renderiza `<SynergyTab />` + `<SynergyMatrix />`

Tabs de capacity/synergy só aparecem quando `selectedScope.type === "team"` (dados por time).

**C3 — Sem novas dependências** — todos os componentes já existem.

---

## Data flow completo (estado final)

```
RTE fecha sprint
  → closeSprintAndSnapshot(sprintId)
      → Sprint.status = CLOSED
      → computeSprintMetrics() → FlowMetricSnapshot (FRESH)
      → AnomalyDetectionRun (trigger=snapshot_created)
          → runAllRules() → Anomaly[] (CRITICAL auto-cria ImprovementAction)

Vercel Cron 0 * * * *
  → /api/cron/staleness-check
      → scoreSnapshotStaleness() para snapshots não checados há >20h
          → computeStaleness(R1-R5) → atualiza staleness + StalenessAuditLog

Vercel Cron 30 * * * *
  → /api/cron/anomaly-detection
      → runAllRules() para snapshots sem run nas últimas 24h
          → Anomaly[] → auto-cria ImprovementAction para CRITICAL

Usuário abre /analytics/flow
  → getFlowMetrics() retorna snapshot com staleness já calculado
  → FlowMetricsDashboard mostra:
      - Tab Flow: KPIs + C Híbrido + StalenessBadge
      - Tab Anomaly: AnomalySummaryPanel
      - Tab Capacity: TeamCapacityTab (só para team scope)
      - Tab Synergy: SynergyTab + SynergyMatrix (só para team scope)
      - Tab Measure: Competency assessments (existente)
```

---

## Error handling

- Crons: erros por snapshot individual são logados mas não param o batch. Retornam `{ succeeded, failed }`.
- `closeSprintAndSnapshot`: transação atômica — se snapshot creation falha, sprint não é fechada.
- Tabs capacity/synergy: se `getTeamCapacity` ou `getSynergyMatrix` retornar erro, renderiza empty state com mensagem.

---

## Testing

- `closeSprintAndSnapshot`: teste de integração verificando sprint CLOSED + snapshot FRESH criado
- `scoreSnapshotStaleness`: teste unitário puro (sem session) — input/output de staleness state
- `anomaly-detection` cron route: teste com mock de banco — verifica que só processa snapshots sem run recente
- Dashboard tabs: verificar que props são passadas e componentes renderizam sem erro

---

## Arquivos criados/modificados

| Ação | Arquivo |
|------|---------|
| CREATE | `apps/app/app/actions/flow-intelligence/staleness-service.ts` |
| CREATE | `apps/app/app/actions/sprints/close-sprint.ts` |
| CREATE | `apps/app/app/api/cron/anomaly-detection/route.ts` |
| MODIFY | `apps/app/app/api/cron/staleness-check/route.ts` |
| MODIFY | `apps/app/app/vercel.json` |
| MODIFY | `apps/app/app/(authenticated)/analytics/flow/page.tsx` |
| MODIFY | `apps/app/app/(authenticated)/analytics/flow/components/flow-metrics-dashboard.tsx` |
| MODIFY | `apps/app/app/(authenticated)/arts/[artId]/program-board/page.tsx` |
| CREATE | `apps/app/__tests__/actions/flow-intelligence/staleness-service.test.ts` |
| CREATE | `apps/app/__tests__/actions/sprints/close-sprint.test.ts` |
| CREATE | `apps/app/__tests__/api/cron-anomaly-detection.test.ts` |

---

## Fora de escopo

- OAuth para Linear (M7 seguinte)
- Group synergy (GroupSynergy model existe, cálculo é futuro)
- PersonSkillProfile computation (S5 — schema existe, lógica não)
- Notificações push de anomalias (Slack/email)
