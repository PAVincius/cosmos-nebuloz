# Contrato — Server Actions do Signal

Local: `apps/app/app/(signal)/actions/`. Toda action é `"use server"`, devolve `Result<T>` (`{ ok: true, data } | { ok: false, error }`) e **repete o guard completo** — layout protege navegação, não protege RPC.

## Preâmbulo obrigatório de toda action

```ts
const ctx = await requireSignalContext();            // sessão → módulo SIGNAL → papel
requireSignalPermission(ctx, "<permissão>");         // papel concede esta ação
const input = Schema.parse(raw);                     // Zod no boundary, primitivos de _base.ts
return withTenantDb(ctx.tenantId, async (db) => { …; await logSignalAudit(db, ctx, …); });
```

Erros: `AuthError` `UNAUTHORIZED` (401) / `FORBIDDEN` (403) · `SignalRuleError` (422, regra nomeada) · `StateConflictError` (409, `blockers[]`) · Zod (400).

---

## `shell.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `getShellData()` | `signal.read` | — | `{ user, organization, modules, role, badges: { alerts, brokenConnections, evidence, finalReports, activeInitiatives }, settings }` |

`badges` alimenta os contadores do sidebar (`SG_NAV`) e o chip de saúde de fontes do topbar.

---

## `initiatives.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `listInitiatives(filter)` | `signal.read` | `{ status?, category?, businessUnit?, verdict?, q? }` | `InitiativeCard[]` (código, nome, BU, categoria, status, adoção%, ROI×, confiança, veredito, dono, lastSync) |
| `getInitiative(code)` | `signal.read` | `{ code }` | `InitiativeDetail` — hipótese, baseline ativo + dimensões, adoção (série), resultado (primária + secundária, série), ROI (componentes, custos, premissas, série), confiança (fatores), evidências (contagem), alertas, encerramento |
| `createInitiative(input)` | `signal.initiative.write` | nome, BU, categoria, `ownerId`, hipótese, `expectedValue?` | `{ code }` — status `DRAFT` |
| `updateInitiative(input)` | `signal.initiative.write` | `code` + campos editáveis | `{ code }` |
| `transitionInitiative(input)` | `signal.initiative.write` (`CLOSE` exige `signal.initiative.close`) | `{ code, to, reason? }` | `{ status }` |

`transitionInitiative`: `DRAFT → ACTIVE` sem baseline assinado → `SignalRuleError("baseline.required")`. `→ CLOSED` sem `reason` → `SignalRuleError("closure.reason.required")`. Transição fora da máquina → `StateConflictError("initiative.transition")`.

---

## `baseline.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `getBaselines(code)` | `signal.read` | `{ code }` | todas as versões + dimensões |
| `draftBaseline(input)` | `signal.baseline.write` | `{ initiativeCode, windowStart, windowEnd, windowLabel, dimensions[] }` | `{ version }` — não assinado |
| `signBaseline(input)` | `signal.baseline.write` | `{ initiativeCode, version }` | `{ version, signedAt }` |

Assinar exige as 5 dimensões mínimas com fonte declarada → senão `SignalRuleError("baseline.dimensions.incomplete")`. Baseline assinado é imutável: editar cria versão nova.

---

## `connections.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `listConnections()` | `signal.read` | — | conexão + saúde + último sync + iniciativas alimentadas + nº de métricas + erro/impacto |
| `upsertConnection(input)` | `signal.connection.write` | nome, kind, ícone, `expectedFreqMinutes?`, `ownerId?`, `config` | `{ code }` |
| `recordSync(input)` | `signal.connection.write` | `{ code, ok, rowsLabel?, error? }` | `{ health }` |
| `recomputeHealth()` | `signal.connection.write` | — | `{ changed: number }` — reavalia todas contra `staleHours` |

`recordSync(ok=false)` com erro de auth ⇒ `health = DOWN`, mapeamentos da fonte → `BROKEN`, observações abertas ganham `flag` + `frozenAt`, alerta `STALE` criado. Tudo na mesma transação.

---

## `mapping.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `listMappings(filter?)` | `signal.read` | `{ connectionCode?, initiativeCode? }` | mapeamentos + estado + versão + autor |
| `upsertMapping(input)` | `signal.mapping.write` | `{ connectionCode, initiativeCode?, eventKey, metricLabel, transform, unit }` | `{ code, version }` — nova versão, nunca sobrescrita |
| `setMappingState(input)` | `signal.mapping.write` | `{ code, state, note }` | `{ state }` |

---

## `evidence.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `listEvidence(filter?)` | `signal.read` | `{ initiativeCode?, connectionCode?, flaggedOnly? }` | observações com fonte, mapeamento, janela, linhas, transformação, flag |
| `getEvidence(code)` | `signal.read` | `{ code }` | observação + cadeia: mapeamento → conexão → transformação → fórmula que a consome |
| `recordObservation(input)` | `signal.evidence.write` | `{ initiativeCode, mappingCode? , metricLabel, value, numericValue?, unit, windowStart, windowEnd, rowCount?, transform, source }` | `{ code }` |

Sem `mappingCode` **e** sem `transform` → `SignalRuleError("evidence.origin.required")`.

---

## `roi.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `getRoi(code)` | `signal.read` | `{ initiativeCode }` | fórmula ativa: versão, componentes, custos, premissas, investido, retornado, múltiplo derivado, série |
| `versionRoiFormula(input)` | `signal.formula.write` | `{ initiativeCode, horizonMonths, entries[], assumptions[], note }` | `{ version, multiple }` |
| `recomputeRoi(code)` | `signal.formula.write` | `{ initiativeCode }` | `{ multiple, computedAt }` |

Versionar sem baseline assinado → `SignalRuleError("roi.baseline.required")`. Nova versão marca a anterior `SUPERSEDED` na mesma transação.

---

## `confidence.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `getConfidence(code)` | `signal.read` | `{ initiativeCode }` | `{ score, band, factors: [{ key, label, weight, got, note }] }` |
| `evaluateConfidence(code)` | `signal.formula.write` | `{ initiativeCode }` | `{ score, band }` — reavalia os fatores contra o estado atual |
| `setConfidenceRules(input)` | `signal.settings.write` | `{ rules: [{ key, label, weight, order }] }` | `{ rules }` |

`sum(weight) != 100` → `SignalRuleError("confidence.weights.sum")`.

---

## `alerts.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `listAlerts(filter?)` | `signal.read` | `{ state?, kind?, initiativeCode? }` | alerta + regra + o quê + próximo passo + dono |
| `evaluateAlerts()` | `signal.alert.write` | — | `{ opened, resolved }` — aplica as 3 regras a todo o portfólio |
| `setAlertState(input)` | `signal.alert.write` | `{ code, state, note? }` | `{ state }` |

Regras (limiares de `SignalSettings`): `LOW` adoção < `lowAdoptionPct` após `lowAdoptionWeeks` · `WEAK` adoção ≥ `adoptionBar` e ROI < `weakRoi` · `STALE` fonte sem sync > `staleHours`.

---

## `reports.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `listReports()` | `signal.read` | — | relatórios + estado + período + autor + bloqueio |
| `draftReport(input)` | `signal.report.write` | `{ name, kind, periodStart, periodEnd, initiativeCodes[] }` | `{ code }` |
| `freezeReport(code)` | `signal.report.freeze` | `{ code }` | `{ code, generatedAt, pageCount }` |
| `exportReport(code)` | `signal.read` | `{ code, format: "pdf" \| "json" }` | `{ url }` — sempre a partir de `payload` |

`freezeReport` com conexão `DOWN` alimentando métrica citada → `StateConflictError("report.sources.down", blockers)`. Escrever em relatório `FINAL` → `SignalRuleError("report.frozen")`.

---

## `settings.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `getSettings()` | `signal.read` | — | limiares + moeda + FY |
| `updateSettings(input)` | `signal.settings.write` | `{ adoptionBar?, valueBar?, lowAdoptionPct?, lowAdoptionWeeks?, weakRoi?, staleHours?, currency?, fiscalYearLabel? }` | settings |
| `listMembers()` / `setMemberRole(input)` | `signal.read` / `signal.member.write` | `{ userId, role }` | membros |

`updateSettings` grava trilha com `de → para` por campo: mudar `valueBar` muda o veredito de todo o portfólio.

---

## `audit.ts`

| Action | Permissão | Entrada | Saída |
|---|---|---|---|
| `listAudit(filter?)` | `signal.read` | `{ entityType?, entityId?, from?, to?, actorId? }` | entradas append-only com `de → para`, autor, papel no momento, nota |

Nenhuma action do Signal pode chamar `auditLog.update` ou `auditLog.delete`.

---

## Matriz papel × permissão

| Permissão | VIEWER | OWNER | ANALYST | ADMIN |
|---|:-:|:-:|:-:|:-:|
| `signal.read` | ✓ | ✓ | ✓ | ✓ |
| `signal.initiative.write` | | ✓ (próprias) | ✓ | ✓ |
| `signal.baseline.write` | | ✓ (próprias) | ✓ | ✓ |
| `signal.evidence.write` | | ✓ (próprias) | ✓ | ✓ |
| `signal.mapping.write` | | | ✓ | ✓ |
| `signal.formula.write` | | | ✓ | ✓ |
| `signal.alert.write` | | | ✓ | ✓ |
| `signal.report.write` | | | ✓ | ✓ |
| `signal.connection.write` | | | | ✓ |
| `signal.report.freeze` | | | | ✓ |
| `signal.initiative.close` | | | | ✓ |
| `signal.settings.write` | | | | ✓ |
| `signal.member.write` | | | | ✓ |

"(próprias)" = `initiative.ownerId === ctx.userId`. Verificado na action, não na UI.
