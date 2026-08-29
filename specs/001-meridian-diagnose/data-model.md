# Data Model: Meridian V1 · Diagnose

Alvo: `packages/database/prisma/schema/meridian.prisma`. Convenções herdadas de `charter.prisma`:

- `id String @id @default(cuid())`, `tenantId String` em toda tabela de tenant, relação com `Tenant` por `onDelete: Cascade`, `@@index([tenantId])`.
- Fórmula não vira coluna — exceto quando o valor é contrato firmado num momento (aqui: score computado ao fechar a coleta) ou cache com invalidação explícita (aqui: agregados de coorte).
- Auditoria no `AuditLog` existente, `entityType = "meridian.<entidade>"`.

---

## Enums

```prisma
enum MeridianAxis { DATA PROCESS PEOPLE GOVERNANCE INFRASTRUCTURE }

/// draft → collecting → review → finalised. Sem volta: reabrir é novo assessment.
enum MeridianAssessmentStatus { DRAFT COLLECTING REVIEW FINALISED }

enum MeridianRespondentStatus { INVITED PENDING DONE OVERDUE REVOKED }

enum MeridianQuestionType { LIKERT YES_NO SCALE }

/// computed → contested (dispersão acima do limiar) → overridden (decisão do consultor).
enum MeridianScoreStatus { COMPUTED CONTESTED OVERRIDDEN }

enum MeridianSeverity { HIGH MEDIUM LOW }

enum MeridianEffort { S M L }

/// open → planned → promoted → resolved. Transições registradas na trilha.
enum MeridianGapState { OPEN PLANNED PROMOTED RESOLVED }

/// Escala de confiança da suíte. O Meridian é dono; Signal, Scaffold e Cosmos
/// aplicam sem redefinir. Não crie um segundo vocabulário em outro produto.
enum MeridianConfidence { MEASURED ESTIMATED DECLARED }

/// Papéis do Meridian. Ortogonais ao MemberRole (SAFe) e ao CharterRole.
/// Ausência de MeridianMembership = sem acesso, mesmo com o módulo contratado.
enum MeridianRole { CONSULTANT REVIEWER VIEWER }

enum MeridianPromotionTarget { COSMOS CHARTER SIGNAL SCAFFOLD }
```

Em `modules.prisma`: `enum ProductModule { COSMOS CHARTER SIGNAL MERIDIAN }`.

---

## Modelos

### MeridianMembership

Papel da pessoa no Meridian, por tenant.

| Campo | Tipo | Regra |
|---|---|---|
| `tenantId`, `userId` | String | `@@unique([tenantId, userId])` |
| `role` | `MeridianRole` | |

### MeridianTemplate

Versão da bateria. **Imutável após o primeiro uso** (FR-006).

| Campo | Tipo | Regra |
|---|---|---|
| `version` | String | ex. `"v3.2"`. `@@unique([tenantId, version])` |
| `name` | String | |
| `contestedSpread` | Int `@default(25)` | limiar de contestação (R-05) |
| `gapThreshold` | Int `@default(60)` | limiar de derivação de gap (R-05) |
| `lockedAt` | DateTime? | preenchido no primeiro assessment criado com ele |
| `questions` | `MeridianQuestion[]` | |

Invariante: qualquer escrita em `MeridianTemplate` ou em suas `questions` com `lockedAt != null` é recusada.

### MeridianQuestion

| Campo | Tipo | Regra |
|---|---|---|
| `templateId` | String | |
| `code` | String | ex. `"Q-D01"`. `@@unique([templateId, code])` |
| `axis` | `MeridianAxis` | |
| `ordinal` | Int | ordem canônica — o scoring itera por ela, nunca por `Object.keys` |
| `type` | `MeridianQuestionType` | |
| `text` | String `@db.Text` | |
| `weight` | Int `@default(1)` | peso na média do eixo |
| `inverted` | Boolean `@default(false)` | `true` quando a faixa alta é pior (R-04) |
| `scaleLabels` | String[] | só para `SCALE` |

### MeridianAssessment

| Campo | Tipo | Regra |
|---|---|---|
| `code` | String | ex. `"AS-104"`. `@@unique([tenantId, code])` |
| `orgName`, `sector`, `sizeBand` | String | organização avaliada. `sector` + `sizeBand` formam a `cohortKey` |
| `templateId` | String | versão congelada |
| `status` | `MeridianAssessmentStatus` `@default(DRAFT)` | |
| `consultantId` | String | |
| `openedAt`, `deadline`, `closedAt` | DateTime / DateTime? | |
| `benchmarkOptIn` | Boolean `@default(false)` | porta da contribuição (FR-032) |
| `reassessmentOfId` | String? | run anterior; `onDelete: SetNull` |

Invariantes:
- `status` só avança; `COLLECTING → REVIEW` exige todos os eixos com ao menos um respondente (FR-011);
- `REVIEW → FINALISED` exige nenhum eixo em `CONTESTED`.

### MeridianRespondent

| Campo | Tipo | Regra |
|---|---|---|
| `assessmentId` | String | |
| `name`, `role` | String | papel declarado na organização |
| `email` | String | destino do convite |
| `axis` | `MeridianAxis` | um respondente cobre um eixo |
| `status` | `MeridianRespondentStatus` `@default(INVITED)` | |
| `tokenHash` | String | SHA-256 do token; `@unique` (R-03) |
| `tokenExpiresAt` | DateTime | = `deadline` do assessment |
| `invitedAt`, `lastRemindedAt`, `completedAt` | DateTime? | |

`@@index([assessmentId, axis])`. Revogar = `status = REVOKED` + `tokenHash` regravado com valor aleatório (o token antigo deixa de casar).

### MeridianResponse

| Campo | Tipo | Regra |
|---|---|---|
| `respondentId`, `questionId` | String | `@@unique([respondentId, questionId])` |
| `rawValue` | Int | índice da opção escolhida |
| `normalized` | Decimal `@db.Decimal(4,3)` | 0–1, calculado na escrita a partir de `type`/`inverted` |
| `answeredAt` | DateTime | |

### MeridianEvidence

Metadado; o arquivo vive no bucket `meridian-evidence` (R-08).

| Campo | Tipo | Regra |
|---|---|---|
| `assessmentId`, `responseId` | String / String? | evidência pode existir sem resposta (anexo do consultor) |
| `storagePath` | String | `${tenantId}/${assessmentId}/${id}` |
| `fileName`, `mimeType` | String | |
| `sizeBytes` | Int | |
| `uploadedById` | String? | null quando veio por token de respondente |
| `uploadedByRespondentId` | String? | |

### MeridianAxisScore

Resultado do scoring — contrato firmado no fechamento da coleta, por isso persistido.

| Campo | Tipo | Regra |
|---|---|---|
| `assessmentId`, `axis` | | `@@unique([assessmentId, axis])` |
| `computed` | Int | 0–100, nunca alterado depois de escrito |
| `final` | Int? | preenchido só por override |
| `confidence` | Decimal `@db.Decimal(3,2)` | 0–1 |
| `respondentCount` | Int | `n` |
| `spread` | Int | dispersão em pontos |
| `status` | `MeridianScoreStatus` | |
| `note` | String? `@db.Text` | motivo legível da contestação ou da confiança baixa |
| `computedAt` | DateTime | |

Invariante: `computed` é write-once. Toda mudança de número visível passa por `MeridianOverride`.

### MeridianOverride

Append-only (FR-018). Sem `updatedAt`, sem delete.

| Campo | Tipo | Regra |
|---|---|---|
| `assessmentId`, `axis` | | |
| `fromScore`, `toScore` | Int | `toScore != fromScore`, senão recusa |
| `rationale` | String `@db.Text` | `length >= 20`, senão recusa |
| `reviewerId` | String | |
| `createdAt` | DateTime `@default(now())` | |

`@@index([assessmentId, axis, createdAt])`. O `final` do `MeridianAxisScore` é sempre o `toScore` do override mais recente.

### MeridianGap

Registro canônico: atravessa assessments (FR-026).

| Campo | Tipo | Regra |
|---|---|---|
| `code` | String | ex. `"G-01"`. `@@unique([tenantId, code])` |
| `assessmentId` | String | origem; `onDelete: Restrict` — apagar o assessment não pode apagar o registro |
| `axis` | `MeridianAxis` | |
| `statement` | String `@db.Text` | |
| `severity` | `MeridianSeverity` | |
| `effort` | `MeridianEffort` | |
| `costOfDelay` | Int | 0–100 |
| `confidence` | `MeridianConfidence` | selo do achado |
| `ownerLabel` | String | dono sugerido, texto livre |
| `state` | `MeridianGapState` `@default(OPEN)` | |
| `derived` | Boolean `@default(true)` | `false` quando criado à mão pelo consultor |

### MeridianGapDependency

| Campo | Tipo | Regra |
|---|---|---|
| `gapId`, `dependsOnGapId` | String | `@@unique([gapId, dependsOnGapId])` |

Invariantes: `gapId != dependsOnGapId`; a inserção é recusada se fechar ciclo (FR-023), verificado por DFS na mesma transação.

### MeridianPlanItem

| Campo | Tipo | Regra |
|---|---|---|
| `assessmentId`, `gapId` | String | `@@unique([assessmentId, gapId])` |
| `quarter` | Int | 1–4 |
| `seq` | Int | ordem global no plano |
| `capacityNote` | String? | premissa de capacidade, texto livre |

Invariante: para toda dependência `g → d`, `quarter(g) >= quarter(d)` e `seq(g) > seq(d)`.

### MeridianGapPromotion

| Campo | Tipo | Regra |
|---|---|---|
| `gapId` | String | |
| `targetProduct` | `MeridianPromotionTarget` | |
| `targetEntityId` | String? | null enquanto o produto de destino não existir no repositório |
| `targetLabel` | String | |
| `promotedById` | String | |
| `promotedAt` | DateTime `@default(now())` | |
| `revokedAt` | DateTime? | destino removido → gap volta ao estado anterior |

### MeridianBenchmarkCohort

Cache com invalidação explícita: recalculado a cada contribuição.

| Campo | Tipo | Regra |
|---|---|---|
| `cohortKey` | String | `"<setor> · <faixa>"`. `@unique` — **sem `tenantId`**: a coorte é global e anônima por definição |
| `n` | Int | organizações contribuintes |
| `percentiles` | Json | `{ [axis]: { p25, p50, p75 } }` |
| `recalculatedAt` | DateTime | |

`MeridianBenchmarkContribution(cohortKey, assessmentId, axis, score)` guarda a linha que alimenta o agregado; `assessmentId` permite remover a contribuição quando o opt-in é retirado. Esta é a única tabela do módulo sem `tenantId` no filtro de leitura — e é exatamente por isso que nenhuma coluna dela identifica organização.

---

## Relações no `Tenant`

`tenant.prisma` ganha as relações inversas dos modelos com `tenantId`: `meridianMemberships`, `meridianTemplates`, `meridianAssessments`, `meridianRespondents`, `meridianResponses`, `meridianEvidence`, `meridianAxisScores`, `meridianOverrides`, `meridianGaps`, `meridianGapDependencies`, `meridianPlanItems`, `meridianGapPromotions`.

`MeridianBenchmarkCohort` e `MeridianBenchmarkContribution` **não** entram — são globais.

---

## Máquina de estados do gap

```
        derivado do scoring ou criado à mão
                     │
                     ▼
                  ┌──────┐  entra no plano   ┌─────────┐
                  │ OPEN │ ────────────────► │ PLANNED │
                  └──────┘                   └─────────┘
                     │                            │
                     │  promoção direta           │ promoção
                     ▼                            ▼
                             ┌──────────┐
                             │ PROMOTED │ ◄── carrega origin_gap_id;
                             └──────────┘     posse permanece no Meridian
                                   │
              reavaliação fecha    │   destino removido → volta ao anterior
                                   ▼
                             ┌──────────┐
                             │ RESOLVED │
                             └──────────┘
```

`RESOLVED` só é alcançável por reavaliação com evidência — nunca por edição manual do estado.
