# Migração do Inngest para Vercel Cron + fila no Postgres

**Plano de execução do [ADR-0021](../adr/0021-inngest-sai-vercel-cron-e-fila-no-postgres.md)** (Infra/SRE, 2026-09-29).
Implementação: Alicerce (Dev Plataforma). **Decisão do CEO (2026-09-29): o Inngest não será religado e o corte é agora**; a Fase 1 já está sendo implementada pelo Alicerce em paralelo — este plano e o ADR devem ser lidos como o alinhamento dela e o roteiro das seguintes, não como pré-requisito.
Tudo que escreve em produção está marcado **[VAI]** e espera o go-ahead do CEO,
por operação. Migration de esquema em produção: Infra aplica, uma por vez, depois
de a Plataforma escrever e o QA aprovar.

## 1. Como o desenho funciona

```
agendado   Vercel Cron ──GET /api/cron/<rotina>──► handler (idempotente, com prazo)
                       └─ registra check-in no Sentry Cron Monitors

evento     ação/webhook ──enqueueJob(tipo, payload, {dedupeKey, tenantId, runAt})──► JobFallbackQueue
           (na mesma transação da escrita de domínio, quando há)                       │
           Vercel Cron ──GET /api/cron/queue (1 min)──► reivindica com FOR UPDATE SKIP LOCKED
                                                        ├─ handler(tipo) ok      → DONE
                                                        └─ erro → attempts+1, runAt = backoff, ou FAILED (+ Sentry)
```

- **Rotas `/api/cron/*` respondem a `GET`** (é o que a Vercel manda) e, se quiserem, também a `POST`.
- **Auth** de toda rota `/api/cron/*`: `Authorization: Bearer ${CRON_SECRET}`,
  comparação em tempo constante. Hoje `validateCronSecret` compara o header cru
  (nunca casa com o que a Vercel manda) e `CRON_SECRET` não existe em Production.
- **Idempotência** é regra do handler, não do transporte: cron pode chegar
  atrasado ou duplicado; a fila é at-least-once.
- **Prazo**: cada rota tem `maxDuration` e para de trabalhar perto dele, deixando o
  restante para a próxima volta.

### Cron por rotina × despachante

Depende do plano do time (**a confirmar no painel; não consegui ler o plano**):

| Plano | Consequência |
|---|---|
| Pro (dezenas de crons/projeto, até 1 min) | **Um cron por rotina agendada** (10) + `queue` a cada minuto = 11 entradas em `vercel.json`. Recomendado. |
| Hobby (poucos crons, diário) | Não comporta `*/5`, `*/15` nem drenagem em minutos, e uso comercial contraria os termos. Exige Pro. Até lá, nada de migrar. |
| Se o limite de quantidade apertar | **Despachante** `/api/cron/tick` a cada 5 min, lendo um registro `SCHEDULES` em código e uma tabela `CronRun(id, lastRunAt)` para decidir o que venceu. Mesmas rotinas, só muda quem chama. |

## 2. As 25 funções

Origem: `apps/app/app/api/inngest/route.ts` e `apps/app/lib/inngest/*`. "P" é a
fase da §3. "Perde" é o que o Inngest dava e deixa de existir; "Compensa" é o que
o substitui.

### 2.1 Fase 1 — bloqueiam o Meridian apto para cliente externo

| # | Função | Tipo / gatilho | Freq. | Perde | Compensa |
|---|---|---|---|---|---|
| 1 | `eliminateExpiredMeridianEvidence` | cron | `0 3 * * *` (retenção 90d) | `concurrency:1`, retry 2, um `step.run` por assessment (não repete o que já eliminou) | Cron dedicado com trava (`pg_try_advisory_lock`); a eliminação já é idempotente por assessment (`deleteObjects` + marca no banco); erro de um assessment não aborta os demais; Sentry Monitor. |
| 2 | `processErasureRequest` | evento `lgpd/erasure.requested` | fila, prioridade máxima | retry 3, ~9 `step.run` sequenciais (anonimizar perfil, standup, copilot, access log, transcrições) que retomam do passo seguinte | `enqueueJob` **na mesma transação** que grava o `DataSubjectRequest` (fecha o bug do pedido PENDING sem evento); cada etapa de anonimização é `UPDATE` idempotente; etapa concluída gravada no pedido (campo novo a criar, ex. `erasureStep`) para retomar; `dedupeKey = requestId`; reprocessar pedido PENDING antigo na 1ª volta. Prazo legal (LGPD art. 18) monitorado: alerta se PENDING > 24 h. |
| — | Base comum (Fase 0) | — | — | — | `enqueueJob`, drenador `/api/cron/queue`, migration aditiva da fila, `validateCronSecret` corrigido, `CRON_SECRET`, monitores Sentry, `vercel.json` do projeto do app. |

### 2.2 Fase 2 — Charter

| # | Função | Tipo | Freq. | Perde | Compensa |
|---|---|---|---|---|---|
| 3 | `expireCharterControls` | cron | `0 4 * * *` | `concurrency:1`, `step.run` por tenant | Trava advisory; laço por tenant com try/catch isolado; emite o evento do #4 via `enqueueJob`. |
| 4 | `reactToCharterControlExpired` | evento `charter/control.expired` | fila | retry 3, `concurrency` por `useCaseId` | `dedupeKey = controlId+expiraEm`; chave única no banco já protege o efeito (Scaffold). Pode virar chamada direta dentro do #3 se a ordem não exigir fila. |

### 2.3 Fase 3 — Scaffold, Signal, Cosmos e plataforma

| # | Função | Tipo | Freq. | Perde | Compensa |
|---|---|---|---|---|---|
| 5 | `checkScaffoldStall` | cron | `0 3 * * *` | `concurrency:1`, `step.run` por tenant | Cron + trava; laço por tenant isolado. |
| 6 | `closeScaffoldObservation` | cron | `0 4 * * *` | idem, `step.run` por janela | Cron + trava; fechar janela é `UPDATE ... WHERE status` idempotente. |
| 7 | `consumeScaffoldGateClosed` | evento `scaffold/gate.closed` | fila | retry 3, `concurrency` por `trackId` | `dedupeKey = gateResultId` (o contrato de `product-events.ts` já manda o id sair do fato); chave única no consumidor; lock por `trackId` (advisory). |
| 8 | `freezePlanOnBaseline` | evento `signal/baseline.frozen` | fila | retry 3, `concurrency` por `initiativeId` | `dedupeKey` do fato; lock por `initiativeId`. |
| 9 | `checkSolutionStaleness` | cron | `0 2 * * *` | `step.run` por feature | Cron; notificação idempotente por feature/dia. |
| 10 | `checkGovernanceSLA` | cron | `*/30 * * * *` | `concurrency:1`, `step.run` por step | Cron `*/30` (Pro) ou despachante; escalonamento marcado no registro (não escalona duas vezes). |
| 11 | `checkWorkflowSla` | cron | `0 * * * *` | `step.run` por story | Cron horário; checagem por story idempotente. |
| 12 | `releaseWorkflowWaitState` | evento `integration/github.webhook` | fila | `concurrency` 5 | Webhook grava na fila e responde 200; libera story por `UPDATE` condicional. |
| 13 | `scheduledReportDispatch` | cron | `*/15 * * * *` | `concurrency:1`, `step.run` por relatório | Cron `*/15`; marca-e-cria-execução em uma transação; enfileira #14. |
| 14 | `runScheduledReport` | evento `reporting/scheduled-report.run` | fila | retry, `onFailure` que marca FAILED, `concurrency` 5 | `attempts` + estado FAILED no próprio relatório ao esgotar; `dedupeKey = executionId`. |
| 15 | `runExport` | evento `reporting/export.run` | fila | `concurrency` 3 | Lote de 3 por volta; opcionalmente "chute" via `after()` para latência. |
| 16 | `billingSyncFunction` | evento `billing/sync.requested` | fila (despachada por `billing-sync-dispatch`, `0 2 * * *`) | retry 3, **concurrency 50 (a causa do erro no painel)**, um `step.run` por página | Já tem cursor persistido (`load-cursor`/`advance-cursor`): cada volta processa N páginas e re-enfileira com o cursor; concorrência = tamanho do lote; `dedupeKey = integrationId+janela`. |
| 17 | `aiLawWatchFunction` | evento `ai-law/watch.requested` | cron `0 8 * * *` | retry 3, 2 steps | Cron chama o handler direto (sem evento no meio); upsert+diff já é idempotente. |
| 18 | `monthlyIsolationAudit` | cron | `0 0 1 * *` | retry 2 | Cron mensal + monitor de "não rodou" (importante: falha silenciosa dura 30 dias). |
| 19 | `drainJobFallbackQueue` | cron | `*/5 * * * *` | é o drenador antigo, **reenvia para o Inngest** | **Substituído** pelo drenador novo (`/api/cron/queue`). Remover na fase 5. |

### 2.4 Fase 4 — integrações

| # | Função | Tipo | Freq. | Perde | Compensa |
|---|---|---|---|---|---|
| 20 | `deliverWebhookEvent` | evento `webhook/event.dispatch` | fila | retry 5 com backoff 2–32 s | `attempts` + `runAt`: 1 min → 5 min → 30 min → 2 h → 12 h. **Muda o backoff visto por quem recebe.** Assinatura e `dedupeKey` por entrega. |
| 21 | `fetchFirefliesTranscriptFn` | evento `integration/fireflies.webhook` | fila | retry 3, 5 `step.run` | Webhook grava na fila e responde 200 (hoje devolve 500 sem chave e o provedor desiste); persistência idempotente por id da transcrição. |
| 22 | `fetchFathomTranscriptFn` | evento `integration/fathom.webhook` | fila | idem | idem. |
| 23 | `mapFirefliesInsightsFn` | evento `integration/fireflies.transcript.ready` | fila | retry 3 | Enfileirado pelo #21; `dedupeKey = transcriptId`. |
| 24 | `consumeLinearWebhook` | evento `integration/linear.webhook` | fila | retry 3, `concurrency` por `integrationId` | Lock por `integrationId`; fila grava o corpo bruto do webhook. |
| 25 | `linearFullPullDispatch` | cron | `0 */6 * * *` | `concurrency:1`, `step.run` por integração/página | Cron a cada 6 h; laço por integração com cursor; trava. |

### 2.5 As cinco rotas `/api/cron/*` que já existem

Achado de 29/09: **nenhuma está agendada** no `apps/app/vercel.json` (que só tem
`ignoreCommand`); `CRON_SECRET` não existe em Production; e o
`validateCronSecret` não aceita o `Bearer` da Vercel. Ou seja, hoje nada disso roda.

| Rota | Estado no código | O que fazer | Fase |
|---|---|---|---|
| `ai-law-watch` | `GET`→`POST`; dispara `ai-law/watch.requested` (Inngest). Só no `vercel.json` da raiz | Chamar o handler direto (#17), agendar `0 8 * * *` em `apps/app/vercel.json` | 3 |
| `billing-sync-dispatch` | `GET`→`POST`; dispara `billing/sync.requested` por integração. Só no `vercel.json` da raiz | Trocar `inngest.send` por `enqueueJob` (#16), agendar `0 2 * * *` | 3 |
| `staleness-check` | Só `POST`; trabalho real (`FlowMetricSnapshot.lastStalenessCheck`, até 50 tenants × 20 linhas); **não agendada em lugar nenhum** | Adicionar `GET`, agendar (frequência a decidir com o dono do Cosmos; o corte de 20 h sugere diária), monitor Sentry | 3 |
| `anomaly-scheduler` | Só `POST`; **esqueleto**: responde `ok` sem fazer nada | Decisão de produto: implementar ou apagar. Não agendar até fazer algo | — |
| `reindex-knowledge` | Só `POST`; **esqueleto**: exige `tenantId` no corpo (cron não manda) e não reindexa | Idem; se for por tenant, vira tipo de job na fila em vez de cron | — |

Um cron agendado que só responde `ok` é pior que nenhum: acende o monitor verde
sem entregar nada. Por isso os esqueletos **não** entram no agendamento.

**Fora da migração, precisa de decisão de produto:** os eventos
`portfolio/analysis.requested`, `epic/status.changed` e `billing/remap.requested`
são enviados e **nenhuma função os ouve**. Ligar o mecanismo novo não os faz rodar.
Opções: apagar o envio, ou implementar o handler (Norte/PO decide).

## 3. Fases e estimativas

Estimativa de esforço de 1 pessoa (Alicerce), em dias úteis, **sem** contar a
espera de aprovação do CEO, QA do Crivo e janelas de deploy. São estimativas
(inferência a partir do tamanho dos arquivos), não medição.

| Fase | Conteúdo | Estimativa | Saída verificável |
|---|---|---|---|
| **0 — Fundação** | Confirmar plano da Vercel e onde vive o `vercel.json` do app; corrigir `validateCronSecret` (Bearer) + teste; adicionar `GET` às rotas que só têm `POST`; **agendar em `apps/app/vercel.json`** (hoje sem `crons`) as rotas que já fazem trabalho, decidindo sobre os dois esqueletos (§2.5); migration aditiva da fila (`runAt`, `lockedAt`, `dedupeKey` único parcial, `priority`); `enqueueJob`; drenador `/api/cron/queue` com `SKIP LOCKED`, backoff e visibility timeout; monitores Sentry; `CRON_SECRET` em Production **[VAI]**; migration em produção **[VAI]**; `vercel crons run` de teste | 3,5 dias | Job de teste enfileirado e drenado em Production; Sentry recebe o check-in; alerta dispara ao forçar uma falha |
| **1 — Meridian** | #1 retenção 90d; #2 DSAR com outbox transacional e reprocessamento dos PENDING antigos | 2 dias | Evidência vencida eliminada por cron em Production; pedido de titular percorre a fila até o fim; **só aí** o Lacre libera o aviso de 90 dias (`feat/aviso-90-dias`) |
| **2 — Charter** | #3, #4 | 1 dia | Controle vencido detectado e reação aplicada no Scaffold |
| **3 — Scaffold / Signal / Cosmos / plataforma** | #5 a #19 (15 funções, várias com o mesmo molde) | 5 dias | Cada rotina com monitor Sentry verde por 3 execuções |
| **4 — Integrações** | #20 a #25 e os 4 webhooks de entrada | 4 dias | Webhook de entrada responde 200 e o job aparece na fila; sem perda com o app reiniciado |
| **5 — Remoção** | Ver §5 | 1 dia | Nenhuma referência a `inngest` no repositório |
| **Total** | | **~16,5 dias úteis** (3 a 4 semanas corridas com QA e deploys) | |

Ordem dentro de uma fase: função menos arriscada primeiro; um PR por função ou
por par (agendado + evento que ela emite), para o corte ser reversível.

## 4. Corte (sem convivência)

O CEO decidiu **não religar o Inngest** (nem Resync). O Inngest não roda em
Production hoje e assim fica; portanto não há duas implementações concorrendo e
**não há rollback para ele**.

1. Função ainda não migrada = **parada**, como está hoje. A ordem das fases (§3)
   é a ordem em que o produto volta a cumprir o que promete; por isso Meridian
   (retenção, DSAR) vem primeiro e a Fase 1 corre em paralelo já.
2. Corte **por função**: o PR que migra (a) adiciona a rota/tipo novo, (b) troca o
   emissor (`inngest.send` → `enqueueJob`) e (c) remove a função da lista do
   `serve()`. Rollback = reverter o PR (a fila é aditiva e tolera job de tipo
   desconhecido, que fica PENDING).
3. O `drainJobFallbackQueue` antigo (#19) reenvia para o Inngest e nunca teve
   quem o chamasse com sucesso em Production; sai no mesmo deploy em que o
   drenador novo passa a tratar todos os tipos da fila.
4. O que os emissores fazem **enquanto** a função deles não migrou: `inngest.send`
   continua lançando sem event key (§1.2 do runbook do Inngest). Migrar o
   **emissor** cedo (para `enqueueJob`) já resolve o erro na ação do usuário e
   deixa o job na fila esperando o handler; recomendado fazer emissor e handler
   no mesmo PR, mas se o handler atrasar, enfileirar antes é melhor que lançar.

## 5. Remoção final (Fase 5) — cada item **[VAI]** do CEO

**No repositório** (PR normal, sem produção): remover `inngest` de
`apps/app/package.json`; `apps/app/app/api/inngest/route.ts`;
`apps/app/lib/inngest/` (o que sobrou: `client.ts`, `send-safe.ts`,
`emit-product-event.ts`); `functions."app/api/inngest/route.ts"` do
`vercel.json` da raiz; `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` de
`apps/app/.env.example`; `getInngestMetrics` de `api/platform/health`; marcar
`docs/runbooks/inngest-producao.md` como substituído por este runbook.

**Em produção / fora do repositório** (cada uma pede o "vai" do CEO, por operação):

| O que apagar | Onde |
|---|---|
| `INNGEST_EVENT_KEY` | Vercel, projeto `cosmos-nebuloz-app`, Production e Preview |
| `INNGEST_SIGNING_KEY` | idem |
| As quatro `INNGEST_SIGNING_KEY_INNGEST_*` duplicadas (e qualquer outra `INNGEST_*` criada pela integração) | idem; **listar antes de apagar** (`vercel env ls`), conferindo o nome exato |
| Integração Vercel ↔ Inngest | Vercel, Integrations do time `nebulozs-projects` |
| App/conta no painel do Inngest | app.inngest.com (dono da conta) |

Antes de apagar qualquer env: confirmar que nenhuma função ainda depende dela e
que o último deploy de Production já não referencia `inngest` (busca no build).

## 6. Observabilidade

- **Sentry Cron Monitors**: um monitor por rotina agendada com o schedule
  esperado e margem; alerta em falha ou ausência de check-in.
- **Fila**: o drenador registra, a cada volta, profundidade por `status`, idade
  do `PENDING` mais antigo e contagem de `FAILED`/`PROCESSING` vencido.
  Alertas: `FAILED` > 0; `PENDING` mais antigo > 15 min (DSAR e retenção: > 1 h
  de prioridade máxima); `PROCESSING` além do visibility timeout.
- `api/platform/health`: troca o bloco `inngest` por batimento dos crons e
  profundidade da fila (a consulta já existe).
- Conferir depois de cada deploy que mexe em job: **endpoint do provedor e log**
  do cron, não só o build (lição de 2026-09-28 em `.maestri/memoria/engenharia.md`).

## 7. Pendências que dependem de terceiros

| Item | Quem | Bloqueia |
|---|---|---|
| Plano da Vercel do time (Hobby × Pro) e limites de cron | CEO / dono da conta (Infra não vê billing) | Fase 0 |
| O projeto do app lê o `vercel.json` da raiz? (`apps/app/vercel.json` não tem `crons`; os dois crons da raiz podem nunca ter valido) | Infra (Settings → General → Root Directory; `vercel crons ls`) | Fase 0 |
| Aprovação do ADR-0021 | CEO | tudo |
| `CRON_SECRET` em Production | Infra gera, CEO dá o "vai" | Fase 0 |
| Destino dos três eventos sem ouvinte e dos dois esqueletos de cron (`anomaly-scheduler`, `reindex-knowledge`) | Norte / PO | nenhuma fase |
