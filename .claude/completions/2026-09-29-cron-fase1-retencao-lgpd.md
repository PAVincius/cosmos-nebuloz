# Cron fase 1 — retenção de evidência e eliminação LGPD (ADR-0021)

Branch `feat/cron-fase1-retencao-lgpd`, a partir de `github/main` (c5208d82).

## O que mudou
- `validateCronSecret` aceita `Authorization: Bearer <CRON_SECRET>` (formato da Vercel). Destrava também `billing-sync-dispatch` e `ai-law-watch`.
- `lib/jobs/meridian-evidence-retention.ts` (sem Inngest) + `/api/cron/meridian-evidence-retention`, `0 3 * * *`. Teto 500, fileName anonimizado, audit com id estável, falha isolada por assessment.
- `lib/jobs/lgpd-erasure.ts` + `/api/cron/lgpd-erasure`, `*/15 * * * *`. O `DataSubjectRequest` PENDING é o outbox. Lock por `updateMany` condicional, lease de 10 min, 3 tentativas em `metadata` (attempts/lastError), FAILED com log + auditoria. Perfil do usuário anonimizado por último, para o retry achar o e-mail. Sem mudança de schema.
- `submitErasureRequest` só grava o pedido; PENDING antigo sem evento passa a ser processado pelo cron.
- `processErasureRequest` e `eliminateExpiredMeridianEvidence` saíram do `serve()` do Inngest (parado em produção); arquivo da retenção removido.

## Evidência: qual vercel.json vale
Build da Vercel de `cosmos-nebuloz-app` (`dpl_6Ds1MEtFxLAxEQKJhaLdgsTFGMME`) roda `node ../../scripts/skip-ci.js` e `cd ../.. && pnpm install`: Root Directory = `apps/app`. Vale `apps/app/vercel.json`. O da raiz (crons `billing-sync-dispatch`, `ai-law-watch`, maxDuration do inngest) não é lido.

## Pré-requisitos de deploy (não feitos aqui)
- `CRON_SECRET` não existe em produção: criar (CEO/Pilar) no projeto `cosmos-nebuloz-app` antes do deploy. Sem ele as rotas respondem 401.
- Plano Pro confirmado pelo CEO (cron a cada 15 min ok).

## Pendências registradas (fora do escopo)
- `anomaly-scheduler`, `reindex-knowledge`, `staleness-check` só exportam POST (a Vercel chama GET) e nenhuma das 5 rotas antigas está agendada em `apps/app/vercel.json`.
- Runbook `docs/runbooks/inngest-producao.md` ainda descreve as duas funções no Inngest.

## Testes
App inteiro: 522 arquivos, 5662 testes verdes. Novos: validate-cron-secret, cron-fase1-routes (401/200/500), vercel-crons, lgpd-erasure-queue (lock, concorrência, lease, tentativas), retenção (falha isolada, idempotência).

## Correções pós-Vigia (reprovação de 1cbac7dc)
- ALTO: retry após falha parcial deixava dado pessoal com o pedido COMPLETED. Agora o conteúdo (transcrição; objeto do bucket e fileName) é eliminado ANTES de anonimizar a linha-chave (participante/respondente), e o perfil do usuário por último. Teste `lgpd-erasure-retry.test.ts` (banco fake com estado; falha em erase-meeting-transcript-content, delete-meridian-evidence-objects e fileName; nova execução elimina o conteúdo). Comentário de "idempotente" reescrito.
- MÉDIO: claim com `attempts > 3` grava FAILED + audit sem executar.
- BAIXO: `recordFailure` lançando é logado e não derruba o lote.
- Bearer nas outras 5 rotas: nenhum chamador no repositório (ci.yml, dark-matter.yml, scripts, docker-compose não chamam /api/cron; `docker-start.sh` só exige a env). A Vercel envia Bearer. Chamadores fora do repositório (n8n etc.) não verificados: se houver algum mandando o segredo cru, precisa passar a mandar `Bearer <segredo>`.

## Correções pós-QA do Crivo (#310)
- Audit `compliance.lgpd_erasure.completed` agora é aguardado; falha vai para `log.error` sem desfazer a eliminação.
- Rota `/api/cron/lgpd-erasure` devolve 500 e `ok:false` quando algum pedido esgotou as tentativas (`failed > 0`), como a retenção; pedido só retentado segue 200.
- Retenção sem claim (baixo): o `updateMany` passou a casar só linhas ainda sem o marcador e o job conta o `count` dele, então execuções simultâneas não superconta a métrica `eliminated`. Delete no bucket e audit continuam idempotentes; não há claim explícito.
