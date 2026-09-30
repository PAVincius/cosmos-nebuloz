# ADR-0021 — Inngest sai; Vercel Cron para o agendado e fila no Postgres para o disparado por evento

**Status**: Accepted (CEO, #302; direção decidida em 2026-09-29: sair do Inngest, **não religar** — sem Resync — e cortar agora)
**Data**: 2026-09-29
**Contexto de origem**: levantamento de Infra em `docs/runbooks/inngest-producao.md` (2026-09-28) e falha do sync do Inngest em Production desde 28/09 20:00

## Contexto

O Inngest entrou no repositório em 2026-05-25 (`c23191ac`, "install inngest + aws-sdk deps") como parte do template, **sem ADR** e sem decisão de produto. Cresceu para 25 funções e hoje sustenta rotinas que o produto promete ao cliente: retenção de 90 dias da evidência do Meridian, eliminação de titular (LGPD), vencimento de controles do Charter, SLA e estagnação do Scaffold/Cosmos, relatórios agendados e as integrações (Linear, Fireflies, Fathom, GitHub, webhooks de saída).

Evidência:

- `apps/app/app/api/inngest/route.ts` registra **25 funções** (14 disparadas por evento e 11 por cron; o runbook de 28/09 contava 21, e depois entraram `consumeScaffoldGateClosed`, `freezePlanOnBaseline`, `reactToCharterControlExpired` e `expireCharterControls`). Lista completa em `docs/runbooks/migracao-inngest-para-vercel-cron.md` §2.
- Em produção **nunca houve chave**: `GET app.nebuloz.ai/api/inngest` responde 500 ("In cloud mode but no signing key found") e o projeto `cosmos-nebuloz-app` não tinha nenhuma `INNGEST_*` (runbook, §1). Sem event key, `inngest.send()` **lança**; nenhuma função registra nem roda. As 21 funções então existentes não rodavam desde julho de 2026 (`.maestri/memoria/engenharia.md`, 2026-09-28).
- Depois que a integração foi ligada, o sync de Production **falha desde 28/09 20:00** (informado por Morgana em 29/09, lido no painel do Inngest; Infra não tem acesso ao painel): o plano gratuito limita concorrência a 5 e as funções pedem mais (`billing-sync` declara 50). Resultado: zero funções registradas.
- Configuração espalhada e sem dono: integração Vercel↔Inngest, chaves de Branch × Production, quatro envs duplicadas `INNGEST_SIGNING_KEY_INNGEST_*`, e ninguém acompanha o painel.
- Consequência de produto: enquanto isso, a retenção de 90 dias do Meridian e a eliminação de titular **não executam**. O Meridian não pode ser declarado apto para cliente externo (aviso de 90 dias mantido fora da main a pedido do Lacre, #291, para não prometer sobre job parado).
- Achados do runbook que a migração precisa fechar de qualquer forma (§1.2): `submitErasureRequest` grava `DataSubjectRequest` PENDING e depois o `send` lança, e a tentativa seguinte devolve o mesmo pedido **sem reenviar o evento**; webhooks de entrada devolvem 500 e o provedor desiste (eventos perdidos); `sendSafe`/`JobFallbackQueue` existem e ninguém usa; três eventos são enviados sem função ouvindo (`portfolio/analysis.requested`, `epic/status.changed`, `billing/remap.requested`).
- Segundo achado, sobre o que vamos usar no lugar: **nenhuma rotina agendada roda hoje**. `apps/app/vercel.json` só tem `ignoreCommand` (sem `crons`). As cinco rotas de `apps/app/app/api/cron/*` existem e não estão agendadas em lugar nenhum que o projeto do app leia: `ai-law-watch` e `billing-sync-dispatch` aparecem só no `vercel.json` da **raiz** do monorepo (a conferir se o projeto o lê; a evidência é que o do app não as tem), e `anomaly-scheduler`, `reindex-knowledge` e `staleness-check` não aparecem em nenhum. Além disso: `anomaly-scheduler` e `reindex-knowledge` são **esqueletos** (respondem `ok` sem fazer nada; `reindex-knowledge` exige `tenantId` no corpo, o que um cron não manda) e serão apagados; `anomaly-scheduler`, `reindex-knowledge` e `staleness-check` exportam **só `POST`**, e a Vercel invoca cron por `GET` (só `ai-law-watch` e `billing-sync-dispatch` encaminham `GET` para `POST`); e `ai-law-watch`/`billing-sync-dispatch` disparam evento do Inngest, ou seja, dependem do que estamos removendo.
- Terceiro achado: as rotas exigem `CRON_SECRET` e **comparam o header inteiro** com ele (`apps/app/app/api/cron/_utils/validate-cron-secret.ts`). A Vercel manda `Authorization: Bearer <CRON_SECRET>` (documentação de Cron Jobs). Logo, com o valor puro no env, **toda chamada de cron da Vercel recebe 401**. E `CRON_SECRET` **não existe em Production** (runbook, §1).
- **Decisão do CEO (2026-09-29): o Inngest não será religado** (nem Resync do painel para tentar registrar as funções). O corte é agora; a Fase 1 (retenção do Meridian e eliminação de titular) está sendo implementada pelo Alicerce em paralelo à redação deste ADR.

## Decisão

**Sair do Inngest.** Substituir por três peças, todas dentro da plataforma que já pagamos e operamos (Vercel + Postgres):

1. **Vercel Cron para o agendado.** Cada rotina agendada vira uma rota `GET /api/cron/<nome>` (as cinco existentes ganham `GET` e são de fato **agendadas** em `apps/app/vercel.json`) protegida por `CRON_SECRET` (comparação corrigida para `Bearer ${CRON_SECRET}`, em tempo constante), com o schedule declarado em `vercel.json` do projeto do app. Se o plano não comportar um cron por rotina, cai-se para um **cron despachante** (`/api/cron/tick`, a cada 5 min) que executa o que venceu segundo um registro em código; o desenho das rotinas é o mesmo nos dois casos (§ "Limites do plano").
2. **Fila no Postgres para o disparado por evento**, drenada por cron. **Reaproveitar `JobFallbackQueue`** como a fila principal, evoluída por migration aditiva (ver "Fila"), não criar uma segunda tabela. Quem hoje chama `inngest.send` passa a chamar `enqueueJob(tipo, payload, { dedupeKey, tenantId, runAt })`, **na mesma transação** da escrita de domínio quando houver uma (outbox transacional). Isso elimina de raiz o defeito do DSAR (pedido PENDING sem evento).
3. **Handlers por tipo, idempotentes**, em `apps/app/lib/jobs/` (lógica hoje em `apps/app/lib/inngest/*`, movida sem reescrever a regra de negócio). Onde o Inngest dava memoização de `step.run`, a compensação é idempotência no banco (chave única, cursor persistido, `upsert`) — princípio que o repositório já adota ("a idempotência de verdade do consumidor é a chave única no banco", `product-events.ts`).

### Fila: reaproveitar `JobFallbackQueue`

Já existe (migration `20260609000026`, modelo em `packages/database/prisma/schema/onboarding.prisma`): `tenantId?`, `jobType`, `payload Json`, `status` (`PENDING|PROCESSING|DONE|FAILED`), `attempts`, `lastError`, timestamps, índice `(status, createdAt)`. Serve de base. Falta, e a migration aditiva acrescenta:

| Necessidade | Hoje | Acréscimo |
|---|---|---|
| Backoff / agendamento | não há; o drain reprocessa na próxima volta | `runAt timestamptz not null default now()` (elegível quando `runAt <= now()`); backoff = `runAt = now() + f(attempts)` |
| Lock que sobrevive a queda | não há; `findMany` + `update` deixa dois drains pegarem o mesmo job | reivindicar em uma instrução: `UPDATE ... SET status='PROCESSING', lockedAt=now() WHERE id IN (SELECT id FROM "JobFallbackQueue" WHERE status='PENDING' AND "runAt"<=now() ORDER BY priority, "runAt" LIMIT $n FOR UPDATE SKIP LOCKED) RETURNING *` + `lockedAt` para reaver `PROCESSING` parado além do limite (visibility timeout) |
| Idempotência de envio | não há | `dedupeKey text` com índice único parcial (`WHERE dedupeKey IS NOT NULL`), o equivalente do `id` de evento que o Inngest descartava por 24h |
| Prioridade | não há | `priority smallint default 100` (DSAR e retenção antes de integração) |
| Terminal com alerta | `FAILED` fica calado | `FAILED` dispara Sentry (ver "Observabilidade") |
| Nome | "Fallback" | manter o nome da tabela (renomear é migration destrutiva sem ganho); o modelo Prisma pode ganhar `@@map`/apelido em código como `Job` depois |

Reivindicação por `SKIP LOCKED` numa única instrução funciona pelo pooler (6543, modo transação) porque não depende de sessão. A migration é de esquema em produção: quem aplica é Infra, uma por vez, depois de a Plataforma escrever e o QA aprovar, com o "vai" do CEO por operação.

### Limites do plano da Vercel

**O time `nebulozs-projects` está no plano Pro** (confirmado pelo CEO em 2026-09-29; as ferramentas de API que Infra usa não expõem billing, então o plano é declarado, não lido do painel; os limites abaixo são da documentação). Consequências:

- **Cron por rotina**, não despachante: 10 rotinas agendadas + 1 de drenagem da fila (`/api/cron/queue`, a cada minuto) = 11 crons, mais as rotas já existentes que forem agendadas, longe do limite de 100. O despachante (`/api/cron/tick`) deixa de ser necessário por quantidade.
- Limites (documentação da Vercel, "Usage & Pricing for Cron Jobs", https://vercel.com/docs/cron-jobs/usage-and-pricing, página atualizada em 15/07/2026, lida em 29/09/2026): **100 crons por projeto** em todos os planos; **Pro: intervalo mínimo de 1 minuto e precisão por minuto**. Hobby: uma vez por dia, precisão de hora (±59 min), e expressão mais frequente **falha o deploy** — por isso Hobby não serviria. Com 11 crons há folga de sobra; o despachante só se justificaria por outro motivo. Cron invoca uma Function, então valem os limites e o preço de Functions.
- Duração da função: o `vercel.json` da raiz hoje dá `maxDuration: 300` à rota do Inngest; cada rota de cron precisa do seu `maxDuration` e de trabalho **limitado por tempo** (o handler para de reivindicar job perto do limite e deixa o resto para a próxima volta).
- Cron da Vercel **não reenvia** invocação que falhou e pode entregar com atraso ou, raramente, mais de uma vez: por isso as rotinas são idempotentes e a fila (não o cron) é quem carrega o retry.
- Verificar em Production, com `vercel crons run`, que a invocação passa pela proteção de deployment do projeto (`ssoProtection: all_except_custom_domains` hoje).

### Proteção das rotas de cron

`CRON_SECRET` obrigatório em Production (hoje ausente). Corrigir `validateCronSecret` para comparar `Bearer ${CRON_SECRET}`, com teste que use o header real da Vercel. Rota sem segredo configurado responde 401 (já é o comportamento) e a ausência do env em Production passa a ser checada no health. Criar o env é escrita em produção: **[VAI]** do CEO; valor gerado por Infra (≥ 32 bytes aleatórios), nunca pelo chat.

### Observabilidade

Sentry já está no repositório (`@repo/observability`). Cada rota de cron e o drenador registram check-in em **Sentry Cron Monitors** (`withMonitor`/check-in com o schedule esperado): alerta quando a rotina **falha ou não roda** na janela. Além disso, o drenador reporta a cada volta a profundidade da fila e a idade do job mais antigo; alerta quando `PENDING` mais antigo passa do limite por tipo, quando entra qualquer `FAILED`, ou quando `PROCESSING` estoura o visibility timeout. O `api/platform/health` troca `getInngestMetrics` por `cronHeartbeat` + profundidade da fila (já existe `getFallbackQueueDepth`).

## Alternativas consideradas

- **Pagar o Inngest (plano com mais concorrência).** Resolve o sintoma de 28/09, mas mantém uma dependência externa sem ADR, com configuração espalhada (integração, chaves por ambiente, envs duplicadas), mais um painel que ninguém acompanha e custo recorrente por um recurso que usamos como agendador e fila simples. As 25 funções raramente usam o que só o Inngest dá (`step.sleep`, `waitForEvent`, `invoke` não aparecem no código). Descartada pelo CEO.
- **Vercel Workflow / Queues (produtos da Vercel).** Dariam retry e fan-out nativos, mas são produtos novos, com preço por uso e outro conjunto de envs, sem histórico aqui; trocaríamos um serviço externo por outro. Reavaliar se a fila em Postgres virar gargalo.
- **Worker próprio (BullMQ/Redis, pg-boss em processo longo).** Exige processo persistente; a plataforma é serverless. `pg-boss`/`graphile-worker` numa Function não têm `LISTEN` estável e o pooler transacional (6543) não sustenta a sessão que eles assumem. Descartado.
- **Supabase pg_cron + Edge Functions.** Acopla o agendamento ao banco e afasta o código de job do repositório, do teste e do deploy do app. Descartado.
- **Cron por rotina apenas, sem fila.** Serve para o agendado, mas o disparado por evento (DSAR, webhooks) perderia retry e a garantia de "gravei o pedido, logo ele será processado". Por isso a fila.

## Consequências

**Ganha-se**
- Uma dependência a menos, configuração em um lugar (Vercel + Postgres) e envs a apagar: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` e as duplicatas.
- Outbox transacional: pedido de titular e consentimento deixam de ficar sem processamento; webhooks de entrada gravam na fila e respondem 200 rápido, sem perder evento.
- Auditável: a fila é uma tabela consultável, com tenant, tentativas e último erro, o que o painel do Inngest não dava a quem opera.
- Corrige `CRON_SECRET`/Bearer, que hoje impede qualquer cron da Vercel de rodar.

**Perde-se, e como se compensa** (detalhe por função em `docs/runbooks/migracao-inngest-para-vercel-cron.md` §2)
- *Memoização por `step.run`*: handler longo que caía no meio retomava do passo seguinte. Agora o handler reexecuta inteiro; exige idempotência e, nos longos (`lgpd-erasure`, `billing-sync`, varreduras por tenant), **cursor/etapa persistidos** ou divisão em jobs menores.
- *Retry com backoff nativo*: vira `attempts` + `runAt`. Granularidade limitada pela frequência do drenador (1 min no Pro): o backoff de 2 a 32 s do `webhook-delivery` passa a 1 min → 5 min → 30 min → 2 h → 12 h, mudança de comportamento para quem recebe o webhook.
- *`concurrency` por chave* (`trackId`, `useCaseId`, `initiativeId`, `integrationId`): vira `SKIP LOCKED` + unicidade no banco; onde a ordem por chave importa, o handler pega `pg_advisory_xact_lock` da chave.
- *Dedupe de evento por `id` (24h)*: vira `dedupeKey` único.
- *Painel, replay e histórico de execução*: ficam com Sentry (falhas), a tabela (estado) e log estruturado.
- *Latência*: evento processado na próxima volta do drenador (até 1 min no Pro, até 5 min com despachante) em vez de imediato. Aceitável para tudo, exceto talvez export síncrono grande e envio de webhook; ambos podem receber um "chute" opcional (`after()` chamando o drenador, protegido pelo mesmo lock) sem mudar o modelo.

**Riscos e a revisitar**
- Um único drenador serial limita a vazão; o limite prático é o tamanho do lote por volta e o tempo de função. Medir na fase 1 e, se preciso, drenar por tipo em crons separados.
- Migração é por função e está detalhada, com fases, estimativas e a lista de envs a apagar, em `docs/runbooks/migracao-inngest-para-vercel-cron.md`. Como o Inngest **não será religado**, não há convivência: as funções ainda não migradas ficam paradas, como estão hoje, até a fase delas. **Não há rollback para o Inngest**; o rollback de cada corte é reverter o PR da função. A ordem das fases deixa de ser conforto e passa a ser a ordem em que o produto volta a cumprir o que promete. Nenhuma escrita em produção acontece sem "vai" do CEO.
- Decisão do Norte (29/09), registrada no runbook §2.5 e §2.6: os três eventos sem ouvinte (`portfolio/analysis.requested`, `epic/status.changed`, `billing/remap.requested`) **perdem o envio**, e as rotas-esqueleto `anomaly-scheduler` e `reindex-knowledge` são **apagadas**. O remapeamento de billing e a reindexação por tenant voltam depois como tipos de job na fila.
