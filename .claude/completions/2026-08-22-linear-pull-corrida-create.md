# Corrida create-vs-create no sync do Linear (limitação do PR #91)

**Data:** 2026-08-22
**Worktree:** cosmos-linear-sync (`feat/linear-webhook-consumer`, pós-merge do PR #91)

## Problema

Consumer do webhook e cron de full pull são functions Inngest independentes;
a concurrency key por `integrationId` só serializa execuções da mesma
function. Duas chamadas concorrentes de `handleLinearWebhook` para a mesma
issue nova passam ambas pelo find-then-create sem se enxergar e criam duas
Stories para a mesma issue do Linear.

## Correção (opção 1 — unique constraint + convergência no P2002)

- `packages/database/prisma/schema/team-delivery.prisma`: `@@unique([tenantId,
  externalId, externalSource])` em `Story`. NULLs distintos no Postgres —
  Stories manuais ilimitadas.
- Migration `20260822160000_story_externo_unico` (`CREATE UNIQUE INDEX
  "Story_tenantId_externalId_externalSource_key"`). Pressupõe ausência de
  duplicatas pré-existentes (create-path só ficou alcançável no PR #91);
  se houver, falha ruidosa e limpeza manual.
- `linear-pull.ts`: `story.create` num try/catch; P2002 → re-consulta a Story
  por `(tenantId, externalId, externalSource)` e converge para
  `syncInboundUpdate` + `upsertLinearMapping` (mesmo resultado de um webhook
  chegando um segundo depois). Erro não-P2002 propaga intacto (retry do
  Inngest preservado). Detecção por `error.code === "P2002"` estrutural, sem
  `instanceof` da classe do runtime.

## Alternativas rejeitadas

- **Transação + `SELECT FOR UPDATE`**: não há linha para travar quando a
  Story ainda não existe; exigiria advisory lock e só protege quem opta.
- **`story.upsert`**: o caminho de update não é um payload estático — é o
  merge por política (`resolveField`) que precisa ler o estado atual; e o
  upsert exigiria o mesmo unique de qualquer forma.

## Relação com NEB-122

NEB-122 (coluna `webhookId` em `LinearSyncEvent`) é dedup de ENTREGA de
webhook — camada diferente. Este unique é integridade de ENTIDADE e não
depende nem conflita com aquela migration futura. Os dois se complementam;
NEB-122 segue aberto.

## TDD

`apps/app/__tests__/actions/integrations/linear-pull-race.test.ts`:
- corrida determinística (barreira segura os dois lookups pré-create antes de
  qualquer INSERT; fake impõe o unique) → RED com P2002 vazando, GREEN após;
- erro não-P2002 propaga (guarda contra catch largo demais);
- schema pin do `@@unique` no arquivo fonte do Prisma → RED antes da edição.

## Verificação

- Suíte completa `apps/app`: 311 arquivos / 2983 testes passando, 17 skipped
  pré-existentes, 0 falhas.
- `tsc --noEmit` limpo; `biome check --write` nos arquivos tocados.
- `prisma generate` regenerado (unique presente em `generated/schema.prisma`);
  reformatação colateral do `prisma format` em arquivos alheios revertida.

## Pendências

- `pnpm migrate` / aplicar a migration num banco real (não havia DB nesta
  sessão; SQL segue a convenção de nome de índice do Prisma).
- Cobertura completa verificada: `linear-pull.ts` é o único escritor de
  `Story` com `externalId`/`externalSource` (`github-pull.ts` não cria
  Stories; `linear-full-pull.ts` afunila em `handleLinearWebhook`) — não
  existe outro create-path para proteger.
