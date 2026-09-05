# Data Model — Scaffold

Destino: `packages/database/prisma/schema/scaffold.prisma`.
Convenções herdadas de `meridian.prisma`: `cuid()`, `tenantId` em toda tabela de
tenant, `@@index([tenantId])`, comentários `///` em PT-BR explicando o **porquê**
de cada escolha não óbvia.

Fonte: SRD §3 (esqueleto) + `scaffold-data.jsx` e `scaffold-baseline.jsx`
(especificação vigente — ver [`research.md`](research.md) §R3).

---

## Diagrama

```
Tenant ──1:N── ScaffoldTrack ──1:N── ScaffoldPhaseInstance
                    │                        │
                    │                        ├──1:N── ScaffoldStepInstance ──1:N── ScaffoldArtefact
                    │                        └──0:1── ScaffoldGateResult ──0:1── ScaffoldGateOverride
                    │
                    ├──0:1── MeridianGapPromotion   (S-01, targetEntityId → track.id)
                    ├──0:1── ScaffoldBusinessCase ──1:N── ScaffoldBusinessCaseVersion
                    │                              ├──1:N── ScaffoldBusinessCaseMetric
                    │                              └──0:N── ScaffoldBusinessCaseContest
                    └──1:1── ScaffoldTemplateVersion (pinada na criação, ST-03)

ScaffoldTemplate ──1:N── ScaffoldTemplateVersion ──1:N── ScaffoldStepTemplate
                 │                                └──1:N── ScaffoldGateCriterion
                 └──1:N── ScaffoldTemplateOverlay ──0:N── ScaffoldOverlayConflict
```

---

## Enums

```prisma
enum ScaffoldPhase { ASSESS PILOT SCALE EMBED }          // ordem é a progressão; não pular

enum ScaffoldPhaseState {
  IDLE          /// não iniciada
  OPEN
  GATE_READY    /// SG-01: só entra aqui com todo passo requerido completo
  BLOCKED       /// critérios avaliados e não atendidos
  CLOSED
  OBSERVING     /// SG-06: só na EMBED, janela de 30 dias
  REOPENED
}

enum ScaffoldStepState { TODO ACTIVE DONE }

enum ScaffoldGateOutcome { PENDING PASSED OVERRIDDEN }
/// FAILED não existe: gate que não passa deixa a fase BLOCKED, não produz
/// resultado. Resultado é append-only (SG-07) e só nasce ao fechar.

enum ScaffoldTrackStatus { ACTIVE STALLED EMBEDDED CANCELLED }

enum ScaffoldRole { TEAM_MEMBER PROCESS_OWNER TRANSFORMATION_LEAD CONSULTANT ADMIN }
/// SN-05. Mapeia as personas de SC_PERSONAS; sponsor lê como TRANSFORMATION_LEAD
/// com assinatura de caso de negócio — ver research §R11.

enum ScaffoldArchetype { TRIAGE DOC_REVIEW REPORTING }    // S-12

enum ScaffoldBusinessCaseState { DRAFT AWAITING CONTESTED SIGNED SUPERSEDED }

enum ScaffoldMetricDirection { DOWN UP }
enum ScaffoldMetricConfidence { MEASURED ESTIMATED DECLARED }
enum ScaffoldBenefitKind { COST_AVOIDED REVENUE_PROTECTED REVENUE_NEW }

enum ScaffoldOverlayOp { ADD REMOVE REPLACE }             // research §R9
```

E, em `modules.prisma`, `ProductModule` ganha `SCAFFOLD` (research §R2).

---

## Trilha e progressão

### ScaffoldTrack

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `tenantId` | `String` | tenant do **cliente** |
| `code` | `String` | `TR-104`; único por tenant |
| `processName` | `String` | "Triagem de autorizações prévias" |
| `archetype` | `ScaffoldArchetype?` | S-12 |
| `ownerId` | `String` | dono do processo, do lado do cliente |
| `consultantId` | `String?` | staff Nebuloz |
| `templateVersionId` | `String` | **pinado na criação, nunca migra** (ST-03) |
| `overlayId` | `String?` | overlay aplicado; com o anterior responde ST-04 |
| `sourceGapId` | `String?` | `MeridianGap.id` (S-01) |
| `sourcePromotionId` | `String?` | `MeridianGapPromotion.id` |
| `status` | `ScaffoldTrackStatus @default(ACTIVE)` | |
| `currentPhase` | `ScaffoldPhase @default(ASSESS)` | derivável, materializado para o portfólio |
| `startedAt` `lastGateAt` | `DateTime?` | `lastGateAt` alimenta a estagnação (S-09) |
| `embeddedAt` | `DateTime?` | preenchido ao fim da janela de observação |

Índices: `@@unique([tenantId, code])`, `@@index([tenantId, status])`,
`@@index([tenantId, lastGateAt])` — este último é o que a varredura de
estagnação percorre.

> `sourceGapId` é `String?` e **não** relação FK: a lacuna vive no tenant do
> cliente avaliado e a trilha no mesmo tenant, mas a promoção é registrada do
> lado do Meridian. Relação forte aqui acoplaria os dois schemas e faria a
> exclusão de um diagnóstico derrubar trilhas em curso.

### ScaffoldPhaseInstance

`id`, `trackId`, `phase`, `state`, `openedAt`, `closedAt`,
`observationEndsAt` (só EMBED, SG-06), `reopenedAt`, `reopenCount`.

`@@unique([trackId, phase])` — quatro linhas por trilha, criadas juntas no seed.

### ScaffoldStepInstance

`id`, `phaseInstanceId`, `stepTemplateId`, `seq`, `statement`, `expectedArtefact`,
`required Boolean @default(true)`, `state`, `completedById`, `completedAt`.

> `statement` e `expectedArtefact` são **copiados** do `ScaffoldStepTemplate` na
> instanciação, não lidos por join. É o que garante ST-03 na prática: publicar
> nova versão não pode reescrever o texto de um passo que alguém já executou.

### ScaffoldArtefact

`id`, `stepInstanceId`, `objectKey`, `kind`, `filename`, `sizeBytes`,
`uploadedById`, `uploadedAt`. `objectKey` é chave opaca do `@repo/storage`
(research §R5); toda leitura passa por action que grava `AccessLog` antes de
emitir URL assinada (SN-02).

---

## Gate engine — o núcleo

### ScaffoldGateResult

`id`, `phaseInstanceId @unique`, `outcome`, `approverId`, `decidedAt`,
`criteriaSnapshot Json`.

- `criteriaSnapshot` congela, no momento da decisão, cada critério com `met`
  e `note`. Sem isso, editar o template depois reescreveria a história do gate
  — e SG-07 diz que ele é append-only.
- **Sem `updatedAt`, sem delete.** Reabrir a fase cria um novo `PhaseInstance`
  lógico (`reopenCount++`) e um novo resultado; não mexe no anterior.

### ScaffoldGateOverride

`id`, `gateResultId @unique`, `actorId`, `unmetCriteria String[]`,
`rationale String @db.Text`, `createdAt`.

SG-03: os três campos são obrigatórios e `rationale` valida como não-vazia no
Zod **e** no banco. Um override sem rationale é a falha que o PRD §7 nomeia
como o risco número um do produto.

### Máquina de estados (SRD §4)

```
IDLE → OPEN → (todos os passos requeridos DONE, SG-01) → GATE_READY
GATE_READY → (todos os critérios met, SG-02) ─────────→ CLOSED
GATE_READY → (algum critério unmet) ──────────────────→ BLOCKED
BLOCKED   → (override atribuído, SG-02/SG-03) ────────→ CLOSED
CLOSED    → (reabertura atribuída) ───────────────────→ REOPENED → OPEN
CLOSED (EMBED) ──────────────────────────────────────→ OBSERVING (30d, SG-06)
OBSERVING → (30d sem reabrir) → track.status = EMBEDDED
OBSERVING → (reabriu) → REOPENED
```

Guardas adicionais no fechamento:
- **ASSESS**: exige `ScaffoldBusinessCase` com versão `SIGNED` (SG-04).
- **SCALE**: exige `charterPolicyAckAt` **se** `TenantModule(CHARTER)` ativo (SG-05).

> **Invariante.** Esta transição existe em **uma** função —
> `closePhase()` em `app/(scaffold)/actions/gates.ts`. Nenhuma outra action
> escreve `ScaffoldPhaseInstance.state = CLOSED`. Um teste de arquitetura
> falha se `state: "CLOSED"` aparecer em qualquer outro arquivo.

---

## Biblioteca de templates

| Modelo | Campos |
|---|---|
| `ScaffoldTemplate` | `id`, `key` (`triage`/`docreview`/`reporting`), `name`, `archetype`, `currentVersionId?` |
| `ScaffoldTemplateVersion` | `id`, `templateId`, `label` (`v4`), `publishedAt`, `publishedById`, `authorLabel` (`"método Nebuloz"` \| pessoa), `note`, `immutable Boolean @default(true)` |
| `ScaffoldStepTemplate` | `id`, `versionId`, `phase`, `seq`, `key`, `statement`, `expectedArtefact`, `required`, `estimateMinutes?` |
| `ScaffoldGateCriterion` | `id`, `versionId`, `phase`, `key`, `statement`, `evaluationType` (`MANUAL` \| `DERIVED`) |
| `ScaffoldTemplateOverlay` | `id`, `tenantId`, `templateId`, `baseVersionId`, `name`, `ops Json` |
| `ScaffoldOverlayConflict` | `id`, `overlayId`, `againstVersionId`, `targetKey`, `field`, `note`, `resolvedAt?`, `resolvedById?` |

- **ST-01**: `ScaffoldTemplateVersion` não tem `updatedAt`. Nenhuma action
  atualiza; publicar cria linha nova.
- **ST-02**: `ops` é a lista de operações de `research.md` §R9 —
  `[{ op, target: "stepKey"|"criterionKey", key, patch }]`. Reaplicar em base
  nova cujo alvo mudou gera `ScaffoldOverlayConflict` **pendente**; até resolver,
  nenhuma trilha nova pode ser criada com esse overlay.
- **ST-04**: `track.templateVersionId` + `track.overlayId` respondem à pergunta
  em duas colunas, sem reconstrução.
- `versionsInUse` (quantas trilhas em cada versão, mostrado no mock) é query
  agregada, não coluna.

---

## Caso de negócio / baseline

Fonte da verdade do Scaffold. Emitido, assinado, imutável, versionado; o Signal
apura contra ele e nunca o edita (research §R3).

### ScaffoldBusinessCase

`id`, `tenantId`, `trackId @unique`, `code` (`BC-104`), `state`,
`currentVersionId?`, `signedVersionId?`, `sponsorId`, `sponsorRoleLabel`,
`authorId`, `signalInitiativeRef String?`,
janela: `windowStart?`, `windowMonths?`, `cadence?`, `firstReadAt?`,
benefício: `benefitKind`, `benefitHard Boolean`, `benefitAnnualCents BigInt?`,
`benefitBasis`, `financeReviewedAt?`, `financeReviewedBy?`.

> `signedVersionId` e `currentVersionId` são **campos separados** de propósito.
> É o que faz o painel "Contrato com o Signal" dizer `v2 vigente · v3 em edição`:
> o Signal continua apurando contra a assinada enquanto um rascunho existe por
> cima. Uma coluna só perderia essa distinção.

### ScaffoldBusinessCaseVersion

`id`, `businessCaseId`, `label` (`v1`), `state`, `note`, `authoredById`,
`authoredAt`, `signedById?`, `signedAt?`, `contentHash String?`.

`contentHash` é o `ref` do mock (`a7f3c2e9`) — hash do payload assinado. É o
que permite provar, depois, que o artefato não mudou. Nulo enquanto não
assinado.

### ScaffoldBusinessCaseMetric

`id`, `versionId`, `key`, `label`, `unit`, `baseValue Decimal`,
`targetValue Decimal`, `direction`, `confidence`, `sourceLabel`, `sampleLabel`.

Pendurada na **versão**, não no caso: alterar uma meta cria versão nova
(imutabilidade). O delta percentual é derivado, nunca armazenado.

### ScaffoldBusinessCaseContest

`id`, `businessCaseId`, `versionId`, `byId`, `roleLabel`, `at`,
`objection @db.Text`, `asks @db.Text`, `resolvedAt?`.

Transições: `DRAFT → AWAITING → SIGNED`; `AWAITING → CONTESTED → DRAFT`;
assinar uma nova versão marca a anterior `SUPERSEDED`.

---

## Supervisão e acesso

`ScaffoldMembership` — `id`, `tenantId`, `userId`, `role: ScaffoldRole`,
`@@unique([tenantId, userId])`. Espelha `MeridianMembership`.

A **fila de supervisão não tem tabela**: é query agregada sobre
`ScaffoldPhaseInstance` em estado `GATE_READY` / `BLOCKED` / `OBSERVING`,
executada em `apps/backoffice` via `platformDb` (research §R4), projetando
**apenas** trilha, org, fase, idade e contagem de critérios. Artefato e prosa
de critério não entram na projeção — SN-06.

---

## Validação (constituição IV)

Todo boundary com Zod, reusando os primitivos de `actions/_base.ts`
(`nnStr`, `optStr`, `cuid`, `isoDate`). Regras que não são só de forma:

| Regra | Onde |
|---|---|
| `rationale` de override não-vazia após trim | Zod + `@db.Text` + teste negativo |
| `unmetCriteria` não-vazio quando há override | Zod refine |
| `targetValue ≠ baseValue` | Zod refine em métrica |
| `direction` coerente com o sinal do delta | **não validado** — meta pior que a base é caso legítimo (contenção de piora) |
| `windowMonths` ∈ [1, 36] | Zod |
| `label` de versão único por pai | `@@unique` |
