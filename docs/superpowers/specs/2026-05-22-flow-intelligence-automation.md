# Flow Intelligence Automation — Design Spec

## Goal

Fechar o gap entre infraestrutura já construída (staleness R1-R5, anomaly detection, capacity/synergy) e entrega real de valor: dados sempre frescos sem ação manual, anomalias detectadas automaticamente, e todos os painéis do Flow Intelligence visíveis no dashboard.

## Architecture

```
Sprint Close Event
       │
       ├─→ snapshotSprintFlowMetrics() → FlowMetricSnapshot (FRESH)
       │         │
       │         └─→ AnomalyDetectionRun (trigger=snapshot_created)
       │
Vercel Cron 0 * * * *
       └─→ /api/cron/staleness-check → scoreSnapshotStaleness() (session-free)

Vercel Cron 30 * * * *
       └─→ /api/cron/anomaly-detection → runAllRules() (session-free)

Dashboard (team scope)
       ├─→ Tab Flow: KPIs + C Híbrido + StalenessBadge (existente)
       ├─→ Tab Anomaly: AnomalySummaryPanel (existente, já wired)
       ├─→ Tab Capacity: TeamCapacityTab (componente existe, NÃO wired)
       └─→ Tab Synergy: SynergyTab + SynergyMatrix (componentes existem, NÃO wired)
```

**Tech stack:** Next.js 15 App Router, Vercel Cron, Prisma, `@repo/database`

---

## Subsistema A — Cron Layer (session-free)

### Problema

`/api/cron/staleness-check` só escreve `lastStalenessCheck = now()`. Re-scoring real (R1-R5) está em `checkSnapshotStaleness` que requer `requireTenantSession` — impossível em cron. Não existe cron de anomaly detection.

### A1 — `staleness-service.ts` (função pura, sem session)

Novo arquivo: `apps/app/app/actions/flow-intelligence/staleness-service.ts`

```typescript
// Não é "use server" — é utilitário puro chamado pelo cron (sem sessão)
export async function scoreSnapshotStaleness(
  snapshotId: string,
  tenantId: string
): Promise<void>
```

- Busca snapshot + dados necessários (sprint, team composition, assessments) usando `tenantId` diretamente
- Chama `computeStaleness(input)` de `staleness-rules.ts` (já é pura)
- Atualiza `FlowMetricSnapshot.{ staleness, stalenessReasons, lastStalenessCheck }`
- Grava `StalenessAuditLog` quando `oldState !== newState`

### A2 — Refatorar `/api/cron/staleness-check`

Substitui lógica de "só toca timestamp" por chamadas reais a `scoreSnapshotStaleness`:

```typescript
// Busca snapshots não checados há >20h, limit 100
// Para cada: await scoreSnapshotStaleness(s.id, s.tenantId)
// Retorna { checked, succeeded, failed }
```

### A3 — Novo `/api/cron/anomaly-detection`

Novo arquivo: `apps/app/app/api/cron/anomaly-detection/route.ts`

```typescript
// Busca snapshots sem AnomalyDetectionRun nas últimas 24h (staleness FRESH|AGING), limit 50
// Para cada snapshot:
//   1. Busca history (últimos 4 snapshots do mesmo scope)
//   2. Busca openActions + latestAssessment
//   3. Cria AnomalyDetectionRun(status=RUNNING, trigger="scheduled")
//   4. Chama runAllRules({ current, history, openActions, latestAssessment })
//   5. Persiste Anomaly[] e atualiza Run(status=COMPLETED, summary)
//   6. Para CRITICAL: cria ImprovementAction automático
// Retorna { processed, succeeded, failed }
```

Obs: não usa `analyzeFlowAnomalies` server action (que requer session) — chama `runAllRules` diretamente.

### A4 — `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "node scripts/skip-ci.js",
  "crons": [
    { "path": "/api/cron/staleness-check",  "schedule": "0 * * * *" },
    { "path": "/api/cron/anomaly-detection", "schedule": "30 * * * *" }
  ]
}
```

Auth: ambos validam `Authorization: Bearer $CRON_SECRET`.

---

## Subsistema B — Sprint Close Event

### Problema

`FlowMetricSnapshot` só é criado por `re-evaluate-snapshot.ts` (manual). Sem snapshot inicial, anomaly detection não tem dados.

### B1 — `snapshotSprintFlowMetrics` (nova função de escrita)

Novo arquivo: `apps/app/app/actions/flow-intelligence/snapshot-sprint.ts`

```typescript
// Não é "use server" — utilitário chamado por closeSprintAndSnapshot
export async function snapshotSprintFlowMetrics(
  sprintId: string,
  teamId: string,
  tenantId: string
): Promise<{ snapshotId: string }>
```

Computa as 6 métricas a partir das Stories do sprint fechado:
- `flowVelocityTotal` = stories com status DONE
- `flowTimeAvgHours` = média de `(completedAt - startedAt)` por story DONE
- `flowLoadCurrent` = stories IN_PROGRESS no `endDate` do sprint
- `flowEfficiency` = tempo ativo / tempo total (stories com startedAt + completedAt)
- `flowPredictability` = `SprintReview.velocity / Sprint.capacity` (se existir review)
- `flowDistribution` = contagem por tipo de story

Persiste como `FlowMetricSnapshot { scope="team", period="sprint", periodRef=sprintId, staleness="FRESH" }`.

NÃO é a mesma coisa que `computeSprintMetrics` em `capacity.ts` (que computa métricas por membro → `MemberSprintMetrics`). São funções distintas com propósitos distintos.

### B2 — Server action `closeSprintAndSnapshot`

Novo arquivo: `apps/app/app/actions/sprints/close-sprint.ts`

```
"use server"
closeSprintAndSnapshot(sprintId: string):
  1. requireTenantSession()
  2. Busca sprint — verifica tenantId + status === "ACTIVE" (schema: PLANNING/ACTIVE/COMPLETED)
  3. Transação atômica:
     a. sprint.status = "COMPLETED"
     b. await computeSprintMetrics(sprintId, teamId)  ← já existe em capacity.ts
     c. const { snapshotId } = await snapshotSprintFlowMetrics(sprintId, teamId, tenantId)
  4. (fora da transação) cria AnomalyDetectionRun com trigger="snapshot_created"
     + chama runAllRules e persiste anomalias
  5. Retorna { ok: true, snapshotId, runId }
```

### B3 — Botão "Fechar Sprint"

Localização: página do time — onde sprint ACTIVE aparece. Program board é ART-level (cross-team), não é o lugar certo.

Candidato: `apps/app/app/(authenticated)/arts/[artId]/program-board/components/program-board-client.tsx` tem lista de sprints por time — adicionar botão por sprint ACTIVE.

Condições de exibição:
- Role do usuário: RTE ou SM
- `sprint.status === "ACTIVE"`
- `sprint.endDate <= today + 1 dia`

Confirmação modal antes de executar. Após fechar, invalidar router (`router.refresh()`).

---

## Subsistema C — Dashboard Tabs Wire-up

### Problema

`TeamCapacityTab`, `SynergyMatrix`, `SynergyTab` existem mas não importados em `FlowMetricsDashboard`.

### C1 — `flow/page.tsx` — adicionar fetches de capacity e synergy

Funções reais (verificadas no código):
- `getTeamCapacityDashboard(teamId)` — em `capacity.ts`
- `getSynergyMatrix(teamId)` — em `synergy.ts`

Staleness já vem de `getFlowMetrics().staleness` — NÃO adicionar `checkSnapshotStaleness` ao page load.

```typescript
import { getTeamCapacityDashboard } from "@/app/actions/flow-intelligence/capacity";
import { getSynergyMatrix } from "@/app/actions/flow-intelligence/synergy";

const [metrics, assessments, actions, capacityData, synergyData] = selectedScope
  ? await Promise.all([
      getFlowMetrics(selectedScope.type, selectedScope.id),
      getAssessments(selectedScope.type, selectedScope.id),
      getImprovementActions(selectedScope.type, selectedScope.id),
      selectedScope.type === "team"
        ? getTeamCapacityDashboard(selectedScope.id)
        : Promise.resolve(null),
      selectedScope.type === "team"
        ? getSynergyMatrix(selectedScope.id)
        : Promise.resolve(null),
    ])
  : [null, [], [], null, null];
```

### C2 — Adicionar tabs no `FlowMetricsDashboard`

Tabs existentes: `"flow" | "measure"`. Adicionar: `"capacity" | "synergy"`.

```tsx
// Tab bar adiciona dois botões (só renderizados quando selectedScope.type === "team"):
{ key: "capacity", label: "Capacity" }
{ key: "synergy",  label: "Synergy" }

// Render por tab:
{activeTab === "capacity" && capacityData && (
  <TeamCapacityTab data={capacityData} />
)}
{activeTab === "synergy" && synergyData && (
  <>
    <SynergyTab data={synergyData} />
    <SynergyMatrix pairs={synergyData.data?.pairs ?? []} teamId={selectedScope.id} />
  </>
)}
```

Props de `capacityData` e `synergyData` adicionadas ao tipo `Props` do componente.

### C3 — Sem novas dependências

Todos os componentes já existem. Só wire-up de imports e props.

---

## Data flow completo (estado final)

```
SM fecha sprint (ACTIVE → COMPLETED)
  → closeSprintAndSnapshot(sprintId)
      → computeSprintMetrics()         → MemberSprintMetrics[]
      → snapshotSprintFlowMetrics()    → FlowMetricSnapshot (staleness=FRESH)
      → AnomalyDetectionRun           → Anomaly[] (CRITICAL → ImprovementAction auto)

Vercel Cron 0 * * * * (a cada hora)
  → /api/cron/staleness-check
      → scoreSnapshotStaleness() para snapshots não checados há >20h
          → computeStaleness(R1-R5) → FlowMetricSnapshot.staleness + StalenessAuditLog

Vercel Cron 30 * * * * (meia hora depois)
  → /api/cron/anomaly-detection
      → runAllRules() para snapshots sem run nas últimas 24h
          → Anomaly[] → ImprovementAction para CRITICAL

Usuário abre /analytics/flow (team scope)
  → getFlowMetrics() → snapshot com staleness já calculado pelo cron
  → getTeamCapacityDashboard() + getSynergyMatrix() em paralelo
  → FlowMetricsDashboard:
      Tab Flow     → KPIs + C Híbrido + StalenessBadge + sub-sections
      Tab Anomaly  → AnomalySummaryPanel (já wired)
      Tab Capacity → TeamCapacityTab
      Tab Synergy  → SynergyTab + SynergyMatrix
      Tab Measure  → Competency assessments (existente)
```

---

## Error handling

- Crons: erro por snapshot individual não para o batch — log + continua. Retorna `{ succeeded, failed }`.
- `closeSprintAndSnapshot`: transação atômica nos steps 3a-3c — se `snapshotSprintFlowMetrics` falha, sprint não é marcada COMPLETED.
- Capacity/synergy tabs: se fetch retorna `null` ou erro, renderiza empty state com mensagem.

---

## Testing

| Teste | Tipo | O que verifica |
|-------|------|----------------|
| `staleness-service.test.ts` | unitário puro | `scoreSnapshotStaleness` atualiza staleness sem session |
| `close-sprint.test.ts` | integração (mock db) | sprint → COMPLETED + snapshot FRESH criado na mesma transação |
| `cron-anomaly-detection.test.ts` | mock db | só processa snapshots sem run recente; CRITICAL cria ImprovementAction |
| `flow-dashboard-tabs.test.ts` | render | tabs Capacity/Synergy renderizam quando scope=team, ocultos quando scope=art |

---

## Arquivos

| Ação | Arquivo |
|------|---------|
| CREATE | `apps/app/app/actions/flow-intelligence/staleness-service.ts` |
| CREATE | `apps/app/app/actions/flow-intelligence/snapshot-sprint.ts` |
| CREATE | `apps/app/app/actions/sprints/close-sprint.ts` |
| CREATE | `apps/app/app/api/cron/anomaly-detection/route.ts` |
| MODIFY | `apps/app/app/api/cron/staleness-check/route.ts` |
| MODIFY | `apps/app/vercel.json` |
| MODIFY | `apps/app/app/(authenticated)/analytics/flow/page.tsx` |
| MODIFY | `apps/app/app/(authenticated)/analytics/flow/components/flow-metrics-dashboard.tsx` |
| MODIFY | `apps/app/app/(authenticated)/arts/[artId]/program-board/components/program-board-client.tsx` |
| CREATE | `apps/app/__tests__/actions/flow-intelligence/staleness-service.test.ts` |
| CREATE | `apps/app/__tests__/actions/sprints/close-sprint.test.ts` |
| CREATE | `apps/app/__tests__/api/cron-anomaly-detection.test.ts` |

---

## Fora de escopo

- OAuth para Linear
- Group synergy (`GroupSynergy` model existe — cálculo futuro)
- `PersonSkillProfile` computation (S5 — schema existe, sem lógica)
- Notificações push de anomalias (Slack/email)
