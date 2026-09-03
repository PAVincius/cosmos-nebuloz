# Data Model — Signal

Origem: `signal-data.jsx` (protótipo) + §12 do PRD. Convenções herdadas de `meridian.prisma`:

- Toda tabela tem `tenantId`. Não há tabela global neste produto.
- Fórmula não vira coluna (ver [research.md D3](./research.md)). Exceções congeladas: `SignalBaseline`, `SignalRoiFormula`, `SignalReportSnapshot.payload`, `SignalConnection.health`.
- Auditoria reusa `AuditLog` (`system.prisma`), append-only, `entityType = "signal.<entidade>"`, `diff = Array<[campo, antes, depois]>`.
- Arquivo novo: `packages/database/prisma/schema/signal.prisma`.

---

## Enums

```prisma
enum SignalInitiativeStatus { DRAFT ACTIVE PAUSED CLOSED CANCELLED }
enum SignalCategory        { PRODUCTIVITY QUALITY RISK REVENUE }
enum SignalConnHealth      { HEALTHY STALE DOWN }
enum SignalMappingState    { ACTIVE REVIEW BROKEN STALE }
enum SignalAlertKind       { LOW WEAK STALE }
enum SignalAlertState      { OPEN ACKNOWLEDGED RESOLVED }
enum SignalReportState     { DRAFT FINAL }
enum SignalReportKind      { EXECUTIVE PORTFOLIO }
enum SignalObservationSource { SYNC MANUAL IMPORT }
enum SignalRole            { VIEWER OWNER ANALYST ADMIN }
enum SignalRoiEntryKind    { RETURN COST }
```

Veredito (`PROVEN | VANITY | PROMISE | STOP`) **não** é enum persistido: é derivado de adoção × ROI contra os limiares do tenant. Persistir congelaria a decisão fora do momento em que os limiares mudam.

---

## Entidades

### SignalInitiative
Unidade de investimento medida.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `tenantId` | `String` | índice; RLS |
| `code` | `String` | `IN-014` · único por tenant · via `SignalSequence` |
| `name` | `String` | |
| `businessUnit` | `String` | "Operações", "Jurídico" |
| `category` | `SignalCategory` | |
| `status` | `SignalInitiativeStatus @default(DRAFT)` | |
| `ownerId` | `String` | usuário do tenant |
| `hypothesis` | `String @db.Text` | FR-1 · a frase falseável |
| `expectedValue` | `Decimal?` | valor esperado declarado na criação |
| `startedAt` | `DateTime?` | nulo em `DRAFT` |
| `closedAt` / `closedById` / `closureReason` | `DateTime? / String? / String?` | FR-3 · encerrar exige motivo |
| `createdAt` / `updatedAt` / `updatedBy` | | |

`@@unique([tenantId, code])` · `@@index([tenantId, status])` · `@@index([tenantId, category])`

**Transições válidas**: `DRAFT → ACTIVE | CANCELLED` · `ACTIVE → PAUSED | CLOSED | CANCELLED` · `PAUSED → ACTIVE | CLOSED | CANCELLED` · `CLOSED`/`CANCELLED` terminais. `DRAFT → ACTIVE` exige baseline assinado (FR-4: baseline vem **antes** da adoção). Transição inválida → `StateConflictError` (409).

### SignalBaseline
Versão assinada da linha de base. Imutável após assinatura; nova versão é linha nova.

| Campo | Tipo | Nota |
|---|---|---|
| `id`, `tenantId`, `initiativeId` | | |
| `version` | `Int` | 1, 2, 3… |
| `windowLabel` | `String` | "4 semanas · mai/2026" |
| `windowStart` / `windowEnd` | `DateTime` | |
| `signedById` / `signedAt` | `String? / DateTime?` | nulo = rascunho; preenchido = congelado |
| `createdAt` | | |

`@@unique([tenantId, initiativeId, version])`

### SignalBaselineDimension
FR-5. Cinco dimensões mínimas, cada uma com fonte declarada.

`id`, `tenantId`, `baselineId`, `key` (`TIME | COST | THROUGHPUT | QUALITY | USER_BASE` + `custom`), `label`, `value` (String — o protótipo mistura "46 min", "R$ 64", "8,2% retrabalho"), `numericValue` `Decimal?`, `unit`, `sourceLabel`, `connectionId?`.

> `value` é texto e `numericValue` é o par numérico opcional: o baseline precisa ser legível na tela exatamente como foi assinado, e comparável quando houver unidade limpa.

### SignalConnection
FR-7, FR-9.

`id`, `tenantId`, `code` (`CN-01`), `name`, `kind` (String — "Rastreador de tarefas", "Data warehouse"), `icon`, `config` `Json` (sem segredo em claro — credencial via `integrations-vault`), `health` `SignalConnHealth`, `lastSyncAt?`, `expectedFreqMinutes?` (nulo = manual), `rowsLabel?`, `ownerId?`, `errorMessage?`, `impactNote?`, timestamps.

`@@unique([tenantId, code])` · `@@index([tenantId, health])`

`health` é materializado (cache com invalidação explícita) para permitir índice e disparo de alerta; a regra de derivação vive em `lib/signal/health.ts`.

### SignalMetricMapping
FR-8. Versionado.

`id`, `tenantId`, `code` (`MP-01`), `connectionId`, `initiativeId?` (nulo = vale para todas — o `"todas"` do protótipo), `eventKey` (`jira.issue.transitioned → Done`), `metricLabel`, `transform` (String), `unit`, `version` `Int`, `state` `SignalMappingState`, `changedById`, `changedAt`.

`@@unique([tenantId, code, version])` · `@@index([tenantId, connectionId])`

`state` deriva de `connection.health` + revisão humana: fonte `down` → `BROKEN`; fonte `stale` → `STALE`; contestação registrada → `REVIEW`.

### SignalMetricObservation (evidência)
FR-19. É a `EvidenceItem` do PRD — uma tabela, dois nomes.

`id`, `tenantId`, `code` (`EV-8841`), `initiativeId`, `mappingId?` (nulo = entrada manual), `connectionLabel`, `metricLabel`, `value` (String), `numericValue` `Decimal?`, `unit`, `windowStart`, `windowEnd`, `rowCount` `Int?`, `transform` (String), `source` `SignalObservationSource`, `observedAt`, `recordedById?` (nulo = sync), `flag` `String?` (ressalva: "Congelada — fonte desconectada em 05 jul"), `frozenAt` `DateTime?`.

`@@unique([tenantId, code])` · `@@index([tenantId, initiativeId])` · `@@index([tenantId, mappingId])`

> **Regra**: nenhuma observação existe sem referência de origem (`mappingId` **ou** `recordedById` + `transform`). É o que torna o número defensável — sem isso, a evidência é opinião.

### SignalRoiFormula
FR-12. Versionada; nunca sobrescrita.

`id`, `tenantId`, `initiativeId`, `version` `Int`, `horizonMonths` `Int`, `state` (`ACTIVE | SUPERSEDED`), `changedById`, `changedAt`, `note?`.

`@@unique([tenantId, initiativeId, version])`

`invested`, `returned` e `multiple` **não** são colunas. Os dois primeiros são `sum(SignalRoiEntry.total)` por `kind`; o terceiro é a razão entre eles. Tudo em `lib/signal/roi.ts`.

> **Revisado durante a implementação.** A versão anterior deste documento guardava `invested` e `returned` como colunas, ao lado das entradas que deveriam produzi-los. Ao transcrever o protótipo para as fixtures (`apps/app/__tests__/signal/fixtures.ts`), 2 dos 8 casos não fechavam: a IN-031 tinha `returned` 379.200 contra componentes somando 421.760 (o desconto de atribuição de 70% aplicado duas vezes — uma no mapeamento MP-04, outra no total), e a IN-014 tinha `score` 86 contra fatores somando 93. Guardar o total separado das partes é o que permite essa divergência existir, e é precisamente o que o produto existe para impedir. Derivar elimina a classe inteira de erro em vez de adicionar mais uma invariante para vigiá-la. Mesma decisão para `SignalConfidenceScore` (ver abaixo).

### SignalRoiEntry
Componente de retorno ou de custo da fórmula.

`id`, `tenantId`, `formulaId`, `kind` `SignalRoiEntryKind`, `label`, `quantityLabel?` ("1.870 h"), `unitLabel?` ("R$ 84/h"), `total` `Decimal`, `sourceLabel`, `connectionId?`, `order` `Int`.

### SignalRoiAssumption
Premissa visível (FR-12 — "assumptions visíveis").

`id`, `tenantId`, `formulaId`, `label`, `value` (String), `note` (String — de onde veio o número), `order`.

### SignalAdoptionSnapshot
FR-10. Uma linha por período medido; a série do gráfico é a coleção.

`id`, `tenantId`, `initiativeId`, `periodStart`, `periodEnd`, `activeUsers` `Int`, `licensedUsers` `Int`, `frequencyLabel`, `depthNote` `String?`, `createdAt`.

`pct` = `activeUsers / licensedUsers × 100`, derivado. `@@unique([tenantId, initiativeId, periodStart])`

### SignalOutcomeSnapshot
FR-11.

`id`, `tenantId`, `initiativeId`, `periodStart`, `periodEnd`, `metricLabel`, `baselineValue` (String), `currentValue` (String), `numericBaseline`/`numericCurrent` `Decimal?`, `isSecondary` `Boolean @default(false)`, `direction` (`LOWER_IS_BETTER | HIGHER_IS_BETTER`).

`delta%` derivado; `tone` (verde/âmbar/vermelho) derivado do delta contra a hipótese, em `lib/signal/outcome.ts`.

### SignalConfidenceFactor
FR-13. Fatores do tenant, com o obtido por iniciativa.

Duas tabelas para não repetir o catálogo em cada iniciativa:
- `SignalConfidenceRule`: `id`, `tenantId`, `key`, `label`, `weight` `Int`, `order`. Soma dos pesos = 100 (validado na escrita).
- `SignalConfidenceScore`: `id`, `tenantId`, `initiativeId`, `ruleId`, `got` `Int`, `note` `String?`, `evaluatedAt`.

`score` total = `sum(got)`, derivado. Faixa (Alta/Média/Baixa/Sem dado) em `lib/signal/confidence.ts`.

### SignalAlert
FR-21..23.

`id`, `tenantId`, `code` (`AL-31`), `kind` `SignalAlertKind`, `state` `SignalAlertState @default(OPEN)`, `initiativeId`, `what` `@db.Text`, `nextStep` `@db.Text`, `ownerId?`, `raisedAt`, `resolvedAt?`, `resolvedById?`.

`@@unique([tenantId, code])` · `@@index([tenantId, state])`

### SignalReportSnapshot
FR-18, TR-4. Congelado = imutável.

`id`, `tenantId`, `code` (`RP-118`), `name`, `kind` `SignalReportKind`, `periodLabel`, `periodStart`, `periodEnd`, `state` `SignalReportState @default(DRAFT)`, `payload` `Json` (o snapshot estruturado inteiro), `pageCount` `Int?`, `note?`, `generatedById?`, `generatedAt?`, `blockedReason?`.

`@@unique([tenantId, code])`

> **Regra**: `state = FINAL` ⇒ `payload` nunca muda. Toda escrita em relatório `FINAL` é rejeitada na action, não só na UI. Congelar com conexão `DOWN` que alimenta métrica citada → `StateConflictError` (409) com `blockers` = as fontes.

### SignalMember
`id`, `tenantId`, `userId`, `role` `SignalRole @default(VIEWER)`, `createdAt`, `updatedAt`. `@@unique([tenantId, userId])`

### SignalSettings
Limiares do tenant. Uma linha por tenant.

`id`, `tenantId @unique`, `adoptionBar` `Int @default(60)`, `valueBar` `Decimal @default(1.5)`, `lowAdoptionPct` `Int @default(40)`, `lowAdoptionWeeks` `Int @default(8)`, `weakRoi` `Decimal @default(1.0)`, `staleHours` `Int @default(48)`, `currency` `String @default("BRL")`, `fiscalYearLabel` `String?`, `updatedAt`, `updatedBy`.

Mudança aqui **entra na trilha**: altera o veredito de todas as iniciativas.

### SignalSequence
`id`, `tenantId`, `kind` (`initiative | evidence | alert | report | mapping | connection`), `next` `Int`. `@@unique([tenantId, kind])`

---

## Relações

```
Tenant 1─n SignalInitiative 1─n SignalBaseline 1─n SignalBaselineDimension
                            1─n SignalRoiFormula 1─n SignalRoiEntry
                                                 1─n SignalRoiAssumption
                            1─n SignalAdoptionSnapshot
                            1─n SignalOutcomeSnapshot
                            1─n SignalConfidenceScore n─1 SignalConfidenceRule
                            1─n SignalMetricObservation n─1 SignalMetricMapping
                            1─n SignalAlert
Tenant 1─n SignalConnection 1─n SignalMetricMapping
Tenant 1─n SignalReportSnapshot · SignalMember · SignalSequence · 1─1 SignalSettings
```

---

## Invariantes

1. `tenantId` presente e filtrado em toda query. Nenhum join cruza tenant.
2. Baseline assinado (`signedAt != null`) é imutável — mudança gera versão nova.
3. Fórmula ativa é única por iniciativa (`state = ACTIVE`); versionar supersede a anterior na mesma transação.
4. Observação sem origem rastreável não é gravável (`mappingId` ou `recordedById` + `transform`).
5. `SignalReportSnapshot.state = FINAL` ⇒ `payload` congelado.
6. `sum(SignalConfidenceRule.weight)` por tenant = 100.
7. `SignalInitiative.status = CLOSED` ⇒ `closureReason` não nulo.
8. Toda escrita nas entidades acima grava `AuditLog` na **mesma transação**.
