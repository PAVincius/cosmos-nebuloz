# Charter — bootstrap cria biblioteca de cláusulas (spec 011) — Complete

**Date:** 2026-09-27 · **Spec:** `specs/011-bootstrap-clausulas-charter/` · **Intent/plan/tasks:** aprovados pelo CEO em 2026-09-27 (9922e24f)

## Scope

Fecha a questão 1 do `docs/produto/charter-prd.md:178` e o FR-9 (`:139`):
`bootstrapCharter` não criava a biblioteca de cláusulas CL-01–CL-08 — só o seed
de demonstração criava. Sem CL-01, o teto de fornecedor de qualquer tenant
provisionado pelo back-office travava em `PUBLIC`.

## O que entrou

- `packages/provisioning/src/charter-clauses.ts` (novo): `CHARTER_CLAUSES`,
  catálogo único das 8 cláusulas (código/nome/criticidade), extraído sem
  alteração do array `CLAUSES` que só existia em `seed-charter.ts`.
- `packages/provisioning/src/charter.ts`: `bootstrapCharter` cria as cláusulas
  ausentes via `charterClause.createMany({ skipDuplicates: true })`, dentro do
  mesmo `withTenantDb` (RLS FORCE) — tanto no branch de política nova quanto
  no branch onde a política já existe (`bootstrap_skipped`), via a função
  interna `ensureCharterClauses`. Idempotente pela chave `(tenantId, code)` já
  existente no schema: re-rodar não duplica nem sobrescreve cláusula editada
  manualmente (nenhum `update`/`upsert` é chamado). Grava
  `charter.clauses_bootstrapped` em auditoria, mesmo padrão do
  `charter.bootstrapped` já existente para a política.
- `apps/app/scripts/seed-charter.ts`: removido o array local `CLAUSES`;
  importa `CHARTER_CLAUSES` de `@repo/provisioning` — única fonte agora.
- `packages/provisioning/src/index.ts`: exporta `CHARTER_CLAUSES`.

## Comportamento explícito (ponto 4 do pedido)

Cláusulas são criadas **mesmo quando a política já existe** e o bootstrap
retorna `bootstrap_skipped` — a spec decidiu isso no edge case de US2
("bootstrap parcial anterior, ou estado inconsistente": cria só o que falta,
sem tocar no que existe). O early-return de `bootstrap_skipped` acontece
**depois** de `ensureCharterClauses`, não antes.

## Fora de escopo (decisão do CEO, 2026-09-27)

Sem backfill: tenants já provisionados hoje (todos internos/teste) não
recebem as cláusulas automaticamente por esta feature — só quem for
(re)provisionado depois da entrega.

## Verificação

- TDD por task, ordem do `tasks.md` (T001→T020), RED confirmado antes de cada
  GREEN.
- `npx vitest run packages/provisioning/src/__tests__` (dentro do pacote):
  **138/138 passou**.
- Cobertura de `charter.ts` + `charter-clauses.ts`: **100%**
  statements/branch/funcs/lines (`vitest --coverage`, escopado aos dois
  arquivos).
- `tsc --noEmit` limpo em `packages/provisioning` e em `apps/app`.
- `biome check --write` nos 7 arquivos tocados: 0 erros (só reformatação).
- Teste de integração adicional (`charter-clauses-integration.test.ts`, T020,
  pedido explícito de Morgana fora do `tasks.md` original): prova que os
  códigos criados pelo bootstrap, associados a um fornecedor, tiram o teto de
  `PUBLIC` para `RESTRICTED` via `deriveVendorMaxClass` — e que sem eles
  (estado de hoje) o mesmo fornecedor trava em `PUBLIC`. Fecha SC-002.
- **Não executado**: verificação manual do `quickstart.md` (passos 2-7, UI
  local) — feature não muda nenhuma tela; o teste de integração acima cobre o
  mesmo resultado observável sem precisar de banco local nem back-office
  rodando. Ver T018 no `tasks.md`.

## Escopo respeitado

Não toquei em `packages/provisioning` além do Charter (nenhum outro domínio
tocado). Não toquei nos arquivos de outros terminais presentes no working
tree (`app/(charter)/layout.tsx`, `actions/shell.ts`,
`components/charter/shell.tsx` — US2 spec 009, domínio do Alicerce) nem
fiz stage deles.

## Em aberto

- Backfill dos tenants existentes: decisão explícita de não fazer nesta
  entrega (CEO, 2026-09-27) — abrir nova spec se/quando decidido o contrário.
- Aval jurídico do conteúdo das 8 cláusulas (ADR-0003, linhas 92-94): pendência
  de processo (Lacre), não bloqueia esta entrega de engenharia.
- Verificação manual em navegador (quickstart passos 2-7): fica para quem
  revisar rodar localmente, se quiser confirmar visualmente — não é
  bloqueante dado o teste de integração automatizado equivalente.
- `charter-rules.ts` mantém seu próprio `CLAUSE_LABEL` (code→nome), já
  duplicado do mesmo catálogo antes desta feature — fora de escopo do FR-002
  (que fala de bootstrap × seed), registrado no `data-model.md` como limpeza
  futura opcional.
