# Contract — Server actions do Scaffold

Superfície de RPC do produto. Todas em `apps/app/app/(scaffold)/actions/`, exceto
a fila de supervisão, que vive em `apps/backoffice` (ver `research.md` §R4).

**Invariantes que valem para todas:**

- Retornam `Result<T>` — `{ ok: true, data } | { ok: false, error }`. Nunca
  `throw` para erro de domínio (constituição II).
- Envelopadas por `safeAction`, e **cada uma repete os três portões** —
  `requireTenantSession(await headers())` → módulo `SCAFFOLD` contratado →
  papel `ScaffoldRole`. O layout protege navegação; não protege RPC.
- Input validado com Zod na entrada, reusando `actions/_base.ts`.
- Auditoria via `logAudit` fire-and-forget (SN-03, ADR-0009): falha de audit não
  derruba a operação.
- `tenantId` **sempre** da sessão, nunca do payload.

---

## `tracks.ts`

| Action | Input | Output | Notas |
|---|---|---|---|
| `listTracks` | `{ status?, phase?, archetype?, ownerId? }` | `TrackSummary[]` | S-07. Inclui `stalledDays` derivado de `lastGateAt` |
| `getTrack` | `{ trackId }` | `TrackDetail` | fases, passos, gates, overlay, caso de negócio |
| `createTrackFromGap` | `{ gapId, promotionId, templateId, overlayId?, processName, ownerId, archetype? }` | `{ trackId }` | **S-01.** Instancia 4 fases + passos da versão pinada, numa transação. Grava `MeridianGapPromotion.targetEntityId = trackId` |
| `createTrack` | idem sem `gapId`/`promotionId` | `{ trackId }` | trilha sem lacuna de origem |
| `cancelTrack` | `{ trackId, rationale }` | `Result<void>` | não apaga; `status = CANCELLED`. Falha se houver caso de negócio `SIGNED` sem decisão explícita sobre a leitura do Signal |

**Erros nomeados:** `GAP_ALREADY_PROMOTED`, `OVERLAY_HAS_UNRESOLVED_CONFLICT`,
`TEMPLATE_HAS_NO_PUBLISHED_VERSION`.

---

## `steps.ts`

| Action | Input | Output |
|---|---|---|
| `setStepState` | `{ stepInstanceId, state }` | `Result<void>` |
| `attachArtefact` | `{ stepInstanceId, filename, contentType, sizeBytes }` | `{ uploadUrl, artefactId }` |
| `readArtefact` | `{ artefactId }` | `{ signedUrl, expiresAt }` |

`readArtefact` grava `AccessLog` **antes** de emitir a URL, e a URL é de curta
duração. SN-02 exige log na leitura; URL do Blob no HTML tornaria o log
decorativo.

---

## `gates.ts` — o núcleo

| Action | Input | Output |
|---|---|---|
| `evaluateGate` | `{ phaseInstanceId }` | `{ criteria: {key, statement, met, note}[], canClose, blockers }` |
| `closePhase` | `{ phaseInstanceId, approverId, criteriaSnapshot }` | `Result<{ gateResultId }>` |
| `overridePhase` | `{ phaseInstanceId, unmetCriteria: string[], rationale }` | `Result<{ gateResultId, overrideId }>` |
| `reopenPhase` | `{ phaseInstanceId, rationale }` | `Result<void>` |
| `acknowledgeCharterPolicy` | `{ phaseInstanceId, policyId }` | `Result<void>` |

### Contrato de bloqueio (SG-01..SG-08)

`closePhase` é a **única** função no repositório que escreve
`ScaffoldPhaseInstance.state = CLOSED`. Recusa, com erro nomeado:

| Erro | Quando | Req |
|---|---|---|
| `STEPS_INCOMPLETE` | algum passo requerido ≠ `DONE` | SG-01 |
| `CRITERIA_UNMET` | critério não atendido e sem override | SG-02 |
| `BASELINE_NOT_SIGNED` | fase `ASSESS` sem caso de negócio `SIGNED` | SG-04 |
| `CHARTER_POLICY_NOT_ACKED` | fase `SCALE`, Charter ativo, sem ack | SG-05 |

`overridePhase` recusa com `RATIONALE_REQUIRED` se `rationale.trim()` for vazia
e com `UNMET_CRITERIA_REQUIRED` se a lista vier vazia (SG-03).

Fechar a fase `EMBED` **não** marca `EMBEDDED`: muda para `OBSERVING` e agenda o
fim da janela em `observationEndsAt = now + 30d` (SG-06).

Nada em `gates.ts` faz `UPDATE` ou `DELETE` em `ScaffoldGateResult` ou
`ScaffoldGateOverride` (SG-07).

> **Gate de teste — Crítico (BMAD-TEA):** unit + integration + e2e + **negative**.
> A suíte negativa é a que prova o produto: uma asserção por linha da tabela
> acima, mais um teste de arquitetura que falha se `CLOSED` for escrito fora de
> `closePhase`.

---

## `business-case.ts`

| Action | Input | Output |
|---|---|---|
| `getBusinessCase` | `{ trackId }` \| `{ businessCaseId }` | `BusinessCaseDetail` |
| `saveDraft` | `{ businessCaseId, metrics[], window, benefit }` | `Result<void>` |
| `submitForSignature` | `{ businessCaseId }` | `Result<void>` |
| `signBusinessCase` | `{ businessCaseId, versionId }` | `Result<{ contentHash }>` |
| `contestBusinessCase` | `{ businessCaseId, versionId, objection, asks }` | `Result<void>` |
| `newVersionFromSigned` | `{ businessCaseId, note }` | `{ versionId }` |

- `saveDraft` recusa com `VERSION_IMMUTABLE` se a versão alvo não for `DRAFT`.
- `signBusinessCase` calcula `contentHash`, marca a versão anterior
  `SUPERSEDED`, e é a **única** que escreve `signedVersionId`.
- `submitForSignature` congela a versão em `AWAITING`; `contestBusinessCase`
  leva a `CONTESTED` e a `ASSESS` permanece bloqueada.

---

## `templates.ts`

| Action | Input | Output |
|---|---|---|
| `listTemplates` | `{}` | `TemplateSummary[]` com contagem de trilhas por versão |
| `getTemplate` | `{ templateId }` | versões, passos, critérios, overlays |
| `publishVersion` | `{ templateId, label, note, steps[], criteria[] }` | `{ versionId, conflicts[] }` |
| `saveOverlay` | `{ templateId, baseVersionId, name, ops[] }` | `{ overlayId, conflicts[] }` |
| `resolveConflict` | `{ conflictId, resolution }` | `Result<void>` |

`publishVersion` reaplica todo overlay ativo contra a base nova e devolve os
`ScaffoldOverlayConflict` gerados (ST-02). **Não** toca em trilha existente
(ST-03) — nenhum `UPDATE` em `ScaffoldStepInstance` sai deste arquivo.

---

## `supervision.ts` — em `apps/backoffice`

| Action | Input | Output |
|---|---|---|
| `listGateQueue` | `{ kind?: "sign-off" \| "blocked" \| "observing" }` | `QueueEntry[]` |
| `enterTenantContext` | `{ trackId, rationale }` | `{ granted, accessLogId }` |

`QueueEntry` é **exatamente**: `{ trackCode, orgName, phase, ageLabel,
criteriaMet, criteriaTotal, kind }`. Nenhum artefato, nenhum texto de critério,
nenhum PII do cliente — SN-06.

`enterTenantContext` é a travessia explícita e logada: grava `AccessLog` e só
então a consultora navega para o app do cliente. Sem ela, não há link direto da
fila para o artefato.

---

## `shell.ts`

`getShellData` → `{ user, organization, modules, badges, role }`. Espelha
`(meridian)/actions/shell.ts`. `badges` traz contagem de trilhas estagnadas e
de casos de negócio aguardando/contestados — os dois números que a sidebar do
protótipo mostra.
