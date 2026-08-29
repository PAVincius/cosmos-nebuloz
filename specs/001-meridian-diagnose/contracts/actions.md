# Contrato · Server Actions do Meridian

Toda action:

- vive em `apps/app/app/(meridian)/actions/`;
- começa por `requireMeridianContext()` (exceto as de respondente, que começam por `resolveRespondentToken()`);
- valida o input com Zod reusando os primitivos de `app/actions/_base.ts`;
- retorna `Result<T>` via `safeAction()` — nunca lança para o cliente;
- executa escrita e auditoria na mesma transação.

Erros nomeados, herdados do padrão do Charter:

| Erro | Status | Quando |
|---|---|---|
| `AuthError("UNAUTHORIZED")` | 401 | sem sessão de tenant |
| `AuthError("FORBIDDEN")` | 403 | módulo não contratado, ou papel sem a permissão |
| `MeridianRuleError(rule, message)` | 422 | regra de domínio violada (rationale curto, ciclo no grafo, eixo sem dono) |
| `StateConflictError(rule, message, blockers)` | 409 | transição de estado inválida (fechar coleta com eixo sem respondente) |

---

## `shell.ts`

### `getShellData(): ShellData`
Uma consulta por render de layout. Devolve `{ ctx, modules, organization, user, badges }`, onde `badges` traz `queue` (eixos contestados na carteira) e `gapsOpen` (gaps em `OPEN`).

---

## `assessments.ts`

### `listAssessments(input: { status?: MeridianAssessmentStatus }): AssessmentRow[]`
Carteira. Cada linha traz organização, código, setor, faixa, versão de template, progresso de respostas, composite e scores por eixo, prazo, status e `reassessmentOf`.

### `getAssessment(input: { id: string }): AssessmentDetail`
Detalhe com respondentes, scores por eixo, overrides, gaps, itens de plano.

### `createAssessment(input): Assessment`
`{ orgName, sector, sizeBand, templateId, deadline, consultantId, benchmarkOptIn, reassessmentOfId? }`
Permissão `assessment.manage`. Efeitos: cria o assessment em `DRAFT`; grava `lockedAt` no template se ainda nulo; audita `meridian.assessment` com `["status", "", "DRAFT"]`.

---

## `collection.ts`

### `assignRespondent(input): Respondent`
`{ assessmentId, name, role, email, axis }`
Permissão `assessment.manage`. Gera token de 32 bytes, guarda o SHA-256, devolve o token em claro **uma única vez** para montagem do link. Audita.

### `revokeRespondent(input: { respondentId }): void`
Marca `REVOKED` e regrava `tokenHash` com valor aleatório. Audita.

### `sendReminder(input: { respondentId }): void`
Recusa se `status = DONE`. Atualiza `lastRemindedAt`.

### `closeCollection(input: { assessmentId }): { pendingResponses: number }`
Permissão `assessment.manage`.
- Recusa com `StateConflictError` se algum eixo estiver sem respondente ativo, listando os eixos em `blockers` (FR-011).
- Aceita respostas pendentes, devolvendo a contagem para a UI declarar o impacto na confiança (FR-012).
- Move o assessment para `REVIEW` e dispara `runScoring` na mesma transação.

---

## `scoring.ts`

### `runScoring(input: { assessmentId }): AxisScore[]`
Permissão `scoring.run`. Determinístico (R-04). Escreve um `MeridianAxisScore` por eixo, marcando `CONTESTED` quando `spread >= template.contestedSpread`. Deriva gaps dos eixos com score abaixo de `template.gapThreshold`. Idempotente: rodar de novo sobre o mesmo conjunto de respostas reescreve os mesmos valores e não duplica gaps.

### `listReviewQueue(): QueueItem[]`
Eixos `CONTESTED` de toda a carteira do tenant, com assessment, eixo, spread e nota.

### `getDivergence(input: { assessmentId, axis }): DivergenceRow[]`
Resposta a resposta, com autor, papel, valor exibido, valor normalizado e contagem de evidências. Permissão `evidence.read`.

---

## `overrides.ts`

### `registerOverride(input): Override`
`{ assessmentId, axis, toScore, rationale }`
Permissão `override.write`.
- `MeridianRuleError("override.rationale", …)` se `rationale.trim().length < 20`.
- `MeridianRuleError("override.no-change", …)` se `toScore === computed`.
- Insere linha nova; nunca atualiza linha existente. Atualiza `MeridianAxisScore.final` e `status = OVERRIDDEN`.
- Audita com `[["final", from, to], ["rationale", "", rationale]]`.

### `listOverrides(input: { assessmentId }): Override[]`
Ordem cronológica crescente.

---

## `gaps.ts`

### `listGapRegister(input: { axis?, severity?, state? }): GapRow[]`
Registro canônico do tenant, ordenado por `costOfDelay` decrescente. Traz promoção ativa quando houver.

### `getGap(input: { id }): GapDetail`
Com dependências, evidências contadas e destino.

### `upsertGap(input): Gap` / `deleteGap(input: { id })`
Permissão `gap.write`. `deleteGap` recusa gap com promoção ativa.

### `linkGapDependency(input: { gapId, dependsOnGapId }): void`
Permissão `gap.write`. `MeridianRuleError("gap.cycle", "Ciclo: G-01 → G-02 → G-01")` quando a aresta fecha ciclo (FR-023).

### `unlinkGapDependency(input: { gapId, dependsOnGapId }): void`

### `promoteGap(input): Promotion`
`{ gapId, targetProduct, targetLabel }`
Permissão `gap.promote`. Cria o trabalho no destino quando o produto existe no repositório, sempre carregando `originGapId`. Move o gap para `PROMOTED`. O enunciado, a severidade e o custo de atraso continuam editáveis somente aqui (FR-028).

### `revokePromotion(input: { promotionId }): void`
Marca `revokedAt` e devolve o gap ao estado anterior à promoção.

---

## `plan.ts`

### `generatePlan(input: { assessmentId, capacityNote? }): PlanItem[]`
Permissão `gap.write`. Ordenação topológica (Kahn, desempate por `costOfDelay` desc, depois `code`), bucketizada em quatro trimestres. Invariante verificada antes de gravar: nenhum item precede um pré-requisito (FR-024).

### `exportPlan(input: { assessmentId }): PlanExport`
Formato em [plan-export.md](./plan-export.md).

---

## `benchmark.ts`

### `listCohorts(): CohortRow[]`
Cada linha: `cohortKey`, `n`, e `percentiles` **apenas** quando `n >= 5`; abaixo disso, `{ withheld: true }` (FR-033).

### `readCohort(input: { cohortKey }): CohortRead`
`{ withheld: true, n } | { withheld: false, n, percentiles }`. Ponto único de aplicação do limiar.

### `contributeToBenchmark(input: { assessmentId }): void`
Chamada por `runScoring` quando `benchmarkOptIn = true`. Grava as contribuições e recalcula o agregado da coorte. Nunca grava nada que identifique a organização (FR-034).

---

## `report.ts`

### `getReport(input: { assessmentId }): Report`
Shape por eixo com score final, confiança e marcação de override; narrativa dos três gaps de maior custo de atraso; leitura de coorte já filtrada pelo limiar.

### `getReassessmentDiff(input: { assessmentId }): Diff`
`MeridianRuleError("report.no-previous", …)` quando o assessment não é reavaliação. Devolve variação por eixo, gaps resolvidos, persistentes e saldo de itens de plano.

### `requestEvidenceUrl(input: { evidenceId }): { url: string; expiresIn: number }`
Permissão `evidence.read`. **Audita antes de emitir** a URL assinada (R-08, FR-037).

---

## `respondent.ts` — sem sessão

### `resolveRespondentToken(token: string): RespondentContext`
Hash do token → `MeridianRespondent`. Recusa com 404 genérico quando não encontrado, expirado ou revogado. O `tenantId` sai do respondente.

### `getBattery(token: string): Battery`
Somente as perguntas do eixo daquele respondente, com respostas já salvas.

### `saveDraft(token, answers): void`
Salva respostas parciais; `status` vira `PENDING`.

### `submitBattery(token): { missing: number }`
`missing > 0` → devolve a contagem e não conclui. `missing = 0` → `status = DONE`, `completedAt` preenchido, lembretes cessam.

### `attachEvidence(token, questionId, file): Evidence`
Upload para `meridian-evidence`, caminho `${tenantId}/${assessmentId}/${id}`. Audita com `actor = respondent:<id>`.
