# Meridian — P0 do dogfood: tela pra criar assessment e atribuir respondente

**Data:** 2026-09-24 · **Branch:** `main`

Origem: plano de dogfood da esteira, produto 1 (Meridian). O Crivo achou um P0
em `docs/qualidade/dogfood/meridian/atrito.md`, confirmado pela Morgana —
`createAssessment` (`actions/assessments.ts:348`) e `assignRespondent`
(`actions/collection.ts:40`) não tinham nenhuma tela chamando. Sem isso M1
(criar o AS-NBZ-002) e M2 (convidar dez respondentes) não rodavam em
produção, mesmo com toda a lógica de servidor pronta desde a entrega original
de `specs/001-meridian-diagnose/` (28/08).

## Três itens antes do P0

1. **`specs/001-meridian-diagnose/tasks.md` reconciliado** (commits `24594bf9`
   e `90fe8420`) — 79 de 82 tasks eram `[x]` na prática mas estavam `[ ]` no
   doc. Restam `[ ]` de verdade só T005/T080/T081 (dependem de rodar comando
   local). Os 9 testes de action "faltando" existiam todos em
   `apps/app/__tests__/meridian/*.test.ts` — o doc original apontava
   `__tests__/actions/meridian/`, caminho errado, corrigido depois da Morgana
   pegar o erro.
2. **Inventário de actions sem chamador de UI** — além do par do P0, mais 11
   ficaram órfãs: `revokeRespondent`, `upsertGap`/`deleteGap`/
   `linkGapDependency`/`unlinkGapDependency`/`revokePromotion`,
   `listOverrides`, `requestEvidenceUrl`, `resolveRespondentToken` (órfão
   duplicado — `loadRespondent` interno faz o trabalho real), `runScoring`
   público e `withdrawContribution`/`readCohortAction`. Fora do escopo desta
   tarefa (só US1/US2), reportado pra Morgana decidir prioridade.
3. **Opt-in do benchmark** — `MeridianAssessment.benchmarkOptIn` é por
   assessment, default `false`, tabela de contribuição sem `tenantId`. Query
   de verificação entregue pra Morgana rodar via Pilar em prod; decisão de
   quem roda ficou com ela (M1 não trava por isso).

## O P0

- **Carteira** (`components/meridian/screens/assessments.tsx`): botão "Novo
  assessment" no `PageHeader`, abre modal com organização, setor, porte,
  template (carregado por uma action nova, `listTemplates` — não existia
  nenhuma forma de listar templates do tenant) e prazo. Chama
  `createAssessment`, navega pro detalhe no sucesso.
- **Aba Coleta** (`components/meridian/screens/tab-coleta.tsx`): botão
  "Atribuir respondente" por eixo, abre modal com nome/papel/e-mail. Chama
  `assignRespondent` e, no sucesso, troca o corpo do modal por uma view só de
  leitura mostrando `/meridian-responder/<token>` com botão copiar — o banco
  só guarda o hash, então esse é o único momento em que o token aparece.

Nenhum dos dois modais tem canal de envio automático (e-mail) — confirmado no
item 3 do relatório: não existe, `sendReminder` só atualiza timestamp. Fica
copiar-colar manual por enquanto, fora do escopo desta tarefa.

## `listTemplates` — o que faltava e não estava no pedido original

`createAssessment` sempre exigiu `templateId`, mas nenhuma action listava
templates do tenant — não dava pra montar o seletor sem isso. Adicionada com a
mesma permissão de `createAssessment` (`assessment.manage`), só leitura.

## seed-meridian.ts — decisão do item 6

101 linhas não commitadas do Crivo (assessment `AS-200` + 4 respondentes
plantados direto no banco) eram workaround do próprio P0. Com o P0 corrigido,
decisão: **vira fixture deliberada**, não sai. O spec ativo de
`e2e/meridian-dogfood.spec.ts` (fecha coleta → scoring → override → plano →
relatório → promoção pro Scaffold) precisa de estado pronto e determinístico;
refazer tudo pela UI a cada corrida seria lento e frágil. Só o comentário do
bloco foi reescrito — deixa de dizer "workaround do atrito P0" (que não existe
mais) e passa a explicar por que a fixture continua valendo. Commitado junto
do P0 (`4cf68a24`).

## Discrepância com o E2E do Crivo — não resolvida aqui

`e2e/meridian-dogfood.spec.ts` tem dois testes `test.fixme()` (M1/M2,
desligados) escritos a partir do roteiro, não da implementação real. Esperam
"Organização" como `<select>` com "Nebuloz" (não texto livre), rótulo "Versão
do template" (aqui é só "Template"), e um campo "Papel" com opções fixas
("fundador"/"auditoria de repositório") em vez de texto livre — isso é
específico do cenário de dogfood (CEO auditando a própria Nebuloz com
personas fixas), não um requisito do produto que veio no meu pedido. Não
mudei a UI pra bater com esses dois testes fixme — implementei exatamente o
que foi pedido (form com os campos do modelo `MeridianAssessment`/
`MeridianRespondent`, texto livre). Reportado pro Crivo revisar os dois
`fixme` à luz da tela real.

## Verificação

- `apps/app/__tests__/meridian/assessments.test.ts` — 2 casos novos
  (`listTemplates`), 122+ testes do escopo meridian verdes.
- `apps/app/__tests__/screens/meridian.test.tsx` — 1 fluxo completo (clica
  "Novo assessment", preenche, envia, confirma `createAssessment` chamado com
  o payload certo e navegação pro detalhe) com Testing Library, DOM real.
- `tsc --noEmit` limpo no escopo meridian depois de `npx prisma generate`
  local (sem `migrate deploy`, sem tocar banco — client não estava gerado
  neste checkout, é a causa raiz de T005/T080/T081 ficarem `[ ]`).
- `biome check --write` só nos arquivos tocados, nunca `pnpm fix` na raiz.
- **Não verificado no navegador**: porta 3012 já em uso por outro floor
  (regra do canvas — um dev server por vez) e o Next recusa segunda
  instância contra o mesmo `.next` mesmo trocando de porta. Sinalizado, não
  contornado (não matei o processo de outro floor).

## O que ficou de fora

- As 12 actions órfãs restantes (item 2 do relatório) — fora do escopo, US1/
  US2 só.
- Canal de envio automático do link do respondente (e-mail) — não pedido,
  não existe hoje.
- Ajustar a UI pra bater com os dois `test.fixme()` do Crivo — decisão dele,
  não minha, sobre o que o roteiro de dogfood realmente precisa.
