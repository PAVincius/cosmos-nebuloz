# Inngest em produção — chaves ausentes no `cosmos-nebuloz-app`

**Levantamento de 2026-09-28 (Infra/SRE).** Só leitura: código, Vercel (lista de
envs, deploys, logs) e um `GET` público. Nada foi escrito em produção. Tudo que
altera produção está marcado **[VAI]** e espera o go-ahead do CEO, por operação.

## 1. Diagnóstico

**Estado (conferido em 2026-09-28):**

- `GET https://app.nebuloz.ai/api/inngest` → `500 {"code":"internal_server_error"}`
  (curl). Causa reportada: "In cloud mode but no signing key found".
- Env do projeto `cosmos-nebuloz-app` (Vercel, `prj_SHxAelyyw3tZ9BEYONG10Tw7QvzQ`):
  54 variáveis listadas, **nenhuma `INNGEST_*`**. Também não aparecem
  `CRON_SECRET`, `UPSTASH_REDIS_*` nem `LINEAR_WEBHOOK_SECRET` — fora do escopo
  deste runbook, mas conferir depois (ver §5).
- `cosmos-nebuloz-backoffice`, `cosmos-nebuloz-api`, `nebuloz-web`: **não usam
  Inngest**. Nenhuma referência em `apps/backoffice`, `apps/api`, `apps/web`; o
  pacote `inngest` só está em `apps/app/package.json` (SDK 4.4.0). Só precisa de
  chave o projeto do app.

**O que o SDK faz sem a chave** (lido em `node_modules/inngest/components/Inngest.js`
4.4.0): em modo cloud (produção) sem event key, `inngest.send()` **lança**
`Failed to send event … We couldn't find an event key`. Não há fallback. E o
`serve()` de `/api/inngest` responde 500 sem signing key, então nenhuma função
registra nem executa.

### 1.1 Funções registradas (`apps/app/app/api/inngest/route.ts`) — 21

Por evento (11): `billingSyncFunction` (`billing/sync.requested`),
`aiLawWatchFunction` (`ai-law/watch.requested`), `processErasureRequest`
(`lgpd/erasure.requested` — DSAR), `deliverWebhookEvent`
(`webhook/event.dispatch`), `fetchFirefliesTranscriptFn`
(`integration/fireflies.webhook`), `fetchFathomTranscriptFn`
(`integration/fathom.webhook`), `mapFirefliesInsightsFn`
(`integration/fireflies.transcript.ready`), `consumeLinearWebhook`
(`integration/linear.webhook`), `releaseWorkflowWaitState`
(`integration/github.webhook`), `runExport` (`reporting/export.run`),
`runScheduledReport` (`reporting/scheduled-report.run`).

Por cron (10): `eliminateExpiredMeridianEvidence` (`0 3 * * *`, retenção 90d),
`checkScaffoldStall` (`0 3 * * *`), `closeScaffoldObservation` (`0 4 * * *`),
`checkSolutionStaleness` (`0 2 * * *`), `checkGovernanceSLA` (`*/30 * * * *`),
`checkWorkflowSla` (`0 * * * *`), `scheduledReportDispatch` (`*/15 * * * *`),
`linearFullPullDispatch` (`0 */6 * * *`), `drainJobFallbackQueue` (`*/5 * * * *`),
`monthlyIsolationAudit` (`0 0 1 * *`).

**Eventos enviados sem nenhuma função ouvindo** (achado à parte — ligar o
Inngest não faz esses rodarem): `portfolio/analysis.requested`,
`epic/status.changed`, `billing/remap.requested`.

### 1.2 Quem chama `inngest.send` e o que quebra hoje

| Ponto | Comportamento sem event key |
|---|---|
| `actions/settings/lgpd.ts` (DSAR, `submitErasureRequest`) | **Cria `DataSubjectRequest` PENDING e depois o `send` lança → a ação devolve erro.** Pior: a próxima tentativa acha o PENDING (`findFirst`) e devolve o mesmo `requestId` **sem reenviar o evento**. Pedido preso para sempre, mesmo depois de ligar o Inngest. |
| `actions/meeting/consent.ts` (liberar consentimento) | Grava `consentState: GRANTED` e o `send` lança antes do `logAudit` → consentimento concedido **sem log de auditoria** e sem mapeamento. |
| `actions/finops/billingSyncTrigger.ts`, `actions/billing/index.ts`, `actions/billing/tag-rules.ts` | Cria `BillingSyncRun` PENDING (ou atualiza a regra) e o `send` lança → ação falha; `SyncRun` órfão em PENDING; em `tag-rules` a regra já foi atualizada e o `logAudit` não roda. |
| `actions/reporting/export.ts` (export > limite síncrono) | Falha; exportação pequena (síncrona) funciona. |
| `actions/portfolio/analysis.ts` | Cria relatório QUEUED, `send` lança → fica QUEUED. (Evento sem função, ver §1.1.) |
| `actions/epics/transition-status.ts` | **Transição já commitada**, depois o `send` lança → o usuário vê erro numa mudança que valeu. (Evento sem função.) |
| `(cosmos)/actions/webhooks.ts` (envio de teste) | Cria log PENDING, `send` lança → ação falha. |
| Webhooks de entrada: Linear, GitHub, Fathom, Fireflies (`app/api/webhooks/*`) | `enqueueToInngest` lança → o handler devolve 500 (Linear: "Internal error"; GitHub: loga `inngest enqueue error`). O provedor reenvia por um tempo e depois desiste: **eventos perdidos**. |
| `api/cron/billing-sync-dispatch` (Vercel cron 02:00Z) | Captura o erro por página, loga e segue; responde OK com 0 despachados. |
| `api/cron/ai-law-watch` (Vercel cron 08:00Z) | `send` sem try/catch → 500 todo dia. (Se `CRON_SECRET` também faltar, nem chega lá.) |
| `lib/inngest/send-safe.ts` (cai para `JobFallbackQueue`) | **Ninguém usa** fora do teste de health: a rede de segurança existe e não está ligada em nenhum ponto. |
| `api/platform/health` | `getInngestMetrics` reporta `configured:false` sem event key — o health não denuncia o problema. |

Nos logs de runtime de produção dos últimos 7 dias, a busca por `event key`
não retornou linhas: ninguém (ou quase ninguém) exercitou esses caminhos —
consistente com uso ainda pequeno, mas não prova ausência (o log pode não ter a
mensagem). **Não medi impacto real em dados sem consulta ao banco** — ver §4.

## 2. Desde quando

- O código do Inngest existe desde **2026-05-25** (`c23191ac`, "install inngest
  + aws-sdk deps; add Inngest client + API route"). A lista de funções foi
  crescendo até hoje; o cron de retenção do Meridian entrou em `7b035212`
  (2026-09-28, PR #277).
- O projeto Vercel foi criado em 2026-05-21, mas **não há deploy de produção
  anterior a ~2026-07-24** (janelas de 25/05 a 24/07 voltaram vazias). Os
  deploys de produção mais antigos que achei são de 2026-07-30 (dois em ERROR)
  e o primeiro READY confirmado é de 2026-07-31 (PR #36, `c709c8f3`).
  Como a rota já estava no código, **todo deploy de produção teve Inngest no
  código sem chave**.
- Não consigo ver histórico de envs removidas: não dá para afirmar que as chaves
  *nunca* existiram; só que hoje não existem e não há sinal de que já existiram.

## 3. Roteiro para o CEO (a chave nunca passa pelo chat)

Nada abaixo é executado pela Infra. Cada passo que muda produção é do CEO.

1. **Inngest Cloud → app.** Entrar em <https://app.inngest.com>, escolher (ou
   criar) o workspace da Nebuloz, ambiente **Production**. O app se chama
   `cosmos-nebuloz` (é o `id` em `apps/app/lib/inngest/client.ts`); ele
   aparece sozinho no passo 5.
2. **Pegar as duas chaves** (no Production, não no Branch/Dev):
   - *Event Key*: menu **Manage → Event Keys** → criar uma (nome
     `cosmos-nebuloz-app-prod`) → copiar. Vira `INNGEST_EVENT_KEY`.
   - *Signing Key*: menu **Manage → Signing Key** (ou **Settings**, conforme a
     versão do painel) → copiar o valor começando por `signkey-prod-…`. Vira
     `INNGEST_SIGNING_KEY`.
   Copiar direto do painel para a Vercel; não colar no chat nem em arquivo.
3. **Cadastrar na Vercel** — projeto `cosmos-nebuloz-app` → Settings →
   Environment Variables → *Add*: nome `INNGEST_EVENT_KEY`, valor = chave,
   ambiente **Production** só, marcar **Sensitive**. Repetir para
   `INNGEST_SIGNING_KEY`. **[VAI]** — escrita em produção.
   Alternativa por terminal, valor digitado no prompt (não vai para o histórico
   nem para o chat): `vercel env add INNGEST_SIGNING_KEY production --sensitive`
   dentro de `apps/app` e idem para `INNGEST_EVENT_KEY`.
   (A integração Inngest do Vercel Marketplace faz os passos 2–3 e o sync do
   passo 5 sozinha; é uma opção se o CEO preferir, mas cria vínculo novo com a
   conta — decidir antes.)
4. **Redeploy** para as envs valerem (env nova só vale em deploy novo):
   Vercel → Deployments → último de produção → *Redeploy* (sem cache não é
   preciso). **[VAI]**. A Infra pode fazer com o vai, como no #277.
5. **Sync no Inngest:** Inngest → **Apps → Sync new app** → URL
   `https://app.nebuloz.ai/api/inngest` → *Sync*. Deve listar 21 funções.
   Se falhar com 401/403, ver se o domínio está atrás de Vercel Authentication
   (não deveria: `app.nebuloz.ai` é o domínio público de produção).
6. **Verificar** (a Infra faz, só leitura):
   - `GET https://app.nebuloz.ai/api/inngest` → **200** (não 500) com JSON de
     introspecção: `function_count: 21`, modo `cloud`, e as chaves reportadas
     como presentes (nomes de campo podem variar na v4 do SDK; o que importa é
     200 e `function_count` = 21).
   - Painel Inngest → Apps → app **Synced**, 21 funções, crons agendados.
   - Log de runtime da Vercel (`/api/inngest`) sem 500 por 10 minutos.
   - Fumaça de escrita **[VAI]**: disparar um evento inócuo (ex.: o envio de
     teste de webhook em Cosmos → Webhooks) e ver a execução no painel.
7. **Depois:** dar `GET /api/platform/health` e conferir `inngest.configured:true`.

## 4. Risco de ligar — o que roda pela primeira vez em produção

Ao sincronizar, os 10 crons começam a valer e **nunca rodaram em produção**.
Ordem de preocupação:

1. **`eliminateExpiredMeridianEvidence` (03:00Z) — destrutivo, irreversível.**
   Apaga objeto do bucket `meridian-evidence` de assessments fechados há mais de
   90 dias (`closedAt < agora − 90d`), anonimiza `fileName`/`storagePath` e grava
   `AuditLog`. Teto de **500 evidências por execução**, o resto no dia seguinte.
   O Meridian é recente (rota/produto de setembro), então a expectativa é
   pequena, **mas não medi**. Consulta de contagem **[VAI]**, somente `SELECT`,
   depois de conferir o host do `DATABASE_URL`:

   ```sql
   SELECT count(*) AS evidencias_elegiveis,
          count(DISTINCT e."assessmentId") AS assessments,
          min(a."closedAt") AS fechado_mais_antigo
   FROM "MeridianEvidence" e
   JOIN "MeridianAssessment" a ON a.id = e."assessmentId"
   WHERE e."storagePath" <> 'eliminado-por-retencao'
     AND a."closedAt" < now() - interval '90 days';
   ```
   (Nomes conferidos em `meridian.prisma`; sem `@@map`. Confirmar colunas antes de rodar.)
   Se `evidencias_elegiveis > 0`, o CEO decide **antes** do sync: aceitar a
   eliminação, ou adiar o sync do cron (o Inngest permite pausar uma função no
   painel depois do sync, antes das 03:00Z).
2. **`drainJobFallbackQueue` (a cada 5 min)** reenvia tudo que estiver PENDING
   em `JobFallbackQueue`. Como `sendSafe` não é usado, a fila deve estar vazia
   — confirmar com `SELECT status, count(*) FROM "JobFallbackQueue" GROUP BY 1`
   **[VAI]**.
3. **`processErasureRequest` (DSAR) não reprocessa o passado.** Pedidos de
   apagamento criados enquanto o Inngest estava fora ficaram PENDING sem evento
   e o dedup impede o reenvio (§1.2). Contar com
   `SELECT status, count(*), min("createdAt") FROM "DataSubjectRequest" WHERE type='ERASURE' GROUP BY 1`
   **[VAI]**. Se houver, é **prazo LGPD** correndo: reemitir `lgpd/erasure.requested`
   à mão para cada um (operação de escrita **[VAI]**, uma por pedido) — ou
   corrigir a ação para reenviar quando achar PENDING (tarefa da Plataforma).
4. **Crons que escrevem/notificam em todos os tenants**: `checkScaffoldStall`
   (03:00Z) e `checkSolutionStaleness` (02:00Z) criam notificações;
   `checkGovernanceSLA` (30 min) e `checkWorkflowSla` (hora em hora) criam
   escalonamentos e registros; `closeScaffoldObservation` (04:00Z) fecha janelas
   de observação de 30 dias; `scheduledReportDispatch` (15 min) dispara
   relatórios agendados por e-mail (Resend). Primeira execução pode gerar uma
   **rajada de notificações/e-mails acumulados**. Antes do sync, conferir a
   contagem de itens elegíveis (com vai) e avisar os donos de produto.
5. **`monthlyIsolationAudit` (dia 1, 00:00Z)** exige o tenant `system` e a
   checklist pré-flip de `docs/runbooks/app-db-role.md`; a primeira rodada é
   em 2026-10-01. Só leitura de catálogo + um `AuditLog`.
6. **`linearFullPullDispatch` (a cada 6 h)** faz pull completo do Linear das
   integrações ativas: carga externa e custo de API na primeira rodada.
7. **Webhooks de entrada voltam a funcionar** (Linear/GitHub/Fathom/Fireflies):
   eventos novos passam a ser processados; os que o provedor desistiu de
   reenviar estão perdidos e exigem re-sync manual por integração.

**Sugestão de ordem para reduzir o risco:** rodar as consultas de contagem (com
vai) → decidir sobre retenção e DSAR pendentes → cadastrar envs → redeploy →
sync → **pausar no painel** as funções que o CEO quiser adiar → verificar.

## 5. Achados adjacentes (não fazem parte da correção)

- `CRON_SECRET` não está nas envs do projeto: os dois Vercel crons
  (`/api/cron/billing-sync-dispatch`, `/api/cron/ai-law-watch`) provavelmente
  respondem 401 ou 500. Confirmar o nome da variável em `validateCronSecret`
  antes de cadastrar.
- `UPSTASH_REDIS_REST_URL` ausente: o dedup de webhooks (Linear/GitHub) fica
  desligado; com Inngest ligado, reentregas do provedor viram execuções em
  dobro.
- Três eventos sem consumidor (§1.1) — Plataforma decide criar a função ou
  remover o `send`.
- `sendSafe` não é usado em nenhum caminho de produção; ação de usuário e
  webhook deveriam usá-lo (ou pelo menos o DSAR e o consentimento).
- O health deveria falhar (não `configured:false`) quando o `NODE_ENV` é
  produção e a chave falta.
