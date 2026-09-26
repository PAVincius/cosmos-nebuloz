---
status: approved
---

# Intent: Reemitir link do respondente (Meridian)

**Feature Branch**: `006-reemitir-link-respondente`

**Created**: 2026-09-26

**Input**: descrição original do usuário: pedido do Norte (CPO), já decidido e registrado em `docs/produto/meridian-prd.md:243-277` (§10, decisão de 2026-09-26). P0: (1) "Reemitir link" por respondente — gira o `tokenHash` do mesmo respondente (mantém id, eixo, rascunho e status), bloqueado para `DONE` e `REVOKED`, com auditoria `meridian.respondent.reissue`, define um `tokenExpiresAt` próprio (achado P2 do Vigia, `docs/qualidade/dogfood/meridian/atrito.md:42`). (2) "Reemitir e copiar todos os pendentes" — reemite todos os respondentes `INVITED`, `PENDING` e `OVERDUE` do assessment e devolve nome · eixo · link pra copiar tudo de uma vez e baixar `.txt`/`.csv`. Corre em paralelo com a spec 004 (superfícies diferentes: autenticação vs. coleta do Meridian).

## Problema

No dogfood do assessment AS-112, o consultor (o próprio CEO) perdeu os 10 links de respondente duas vezes seguidas (`docs/qualidade/dogfood/meridian/diario.md:8-9`). O token do respondente só existe em claro no modal de atribuição (`assignRespondent`, `apps/app/app/(meridian)/actions/collection.ts:65-80`) — o banco guarda só o hash (`collection.ts:75`, comentário em `collection.ts:36-38`). Hoje o único remédio pra recuperar um link perdido é revogar o respondente (`revokeRespondent`, `collection.ts:111-144`) e atribuir de novo — o que cria **outro** respondente (perde id, associação e qualquer rascunho de resposta). A trava "Concluir só depois de Copiar" (modal `AssignRespondentModal`, `apps/app/components/meridian/screens/tab-coleta.tsx:35-221`, fluxo de `confirmDiscard` ~linhas 232-330) não resolveu — copiar não é colar em lugar nenhum (`docs/qualidade/dogfood/meridian/atrito.md:138-144`). A causa não é pressa do consultor: perder o link hoje é terminal, e deveria ser um atraso de um clique.

## Contexto

Decisão já tomada pelo CPO (Norte) em `docs/produto/meridian-prd.md:243-277`, motivada pelo dogfood ao vivo com o CEO. Duas entregas P0 na mesma rodada:

1. **Reemitir link (por respondente)** — regira o `tokenHash` do mesmo respondente, mata o link antigo na hora, bloqueado quando `status` é `DONE` ou `REVOKED` (esses dois já não têm link válido por design). Mostra o link novo no mesmo modal do #253.
2. **Reemitir e copiar todos os pendentes** — em cima da (1): uma ação reemite todo respondente `INVITED`/`PENDING`/`OVERDUE` do assessment de uma vez, devolve lista nome · eixo · link, com "copiar tudo" e baixar `.txt`/`.csv`. A variante "copiar todos ao fim das atribuições" foi descartada pelo CPO porque segura tokens em claro no estado do cliente — um reload perde tudo de novo, mesmo problema de origem.

Uma terceira opção (e-mail ao respondente) fica **fora desta rodada**: depende da spec `004-login-generico-produto` plugar o Resend no Better Auth, e de parecer da Lacre sobre e-mail do respondente (base legal, retenção, controlador no fluxo de consultoria).

## Restrições

- Reemitir **não** cria novo respondente — mantém `id`, `axis`, rascunho de resposta e `status` do respondente existente; só troca o `tokenHash` (mesmo padrão de `revokeRespondent`, que regrava o hash com valor aleatório).
- Bloqueado para respondentes em `DONE` e `REVOKED` — reemitir um `DONE` não faz sentido (já respondeu) e um `REVOKED` já está morto por decisão explícita anterior.
- Toda reemissão grava auditoria (`meridian.respondent.reissue`), seguindo o padrão já existente de `logMeridianAudit` usado em `assignRespondent`/`revokeRespondent`.
- Reemissão define seu próprio `tokenExpiresAt`, em vez de copiar `assessment.deadline` como hoje (`collection.ts:76`) — isso corrige o achado P2 do Vigia (`atrito.md:42`): sem isso, estender o prazo do assessment depois de emitir tokens dá vida extra silenciosa a tokens já emitidos. **Decisão (Morgana/CEO, 2026-09-26)**: `tokenExpiresAt` da reemissão é fixado no momento da emissão como `min(agora + 14 dias, assessment.deadline)`, e nunca recalculado depois (desacopla do prazo mutável do assessment). Se `assessment.deadline` já passou, a reemissão MUST recusar com mensagem clara ("prazo do assessment vencido").
- "Reemitir e copiar todos os pendentes" não pode depender de manter tokens em claro no estado do cliente entre reloads — é reemissão + entrega imediata (lista pra copiar/baixar), não um carrinho que sobrevive a navegação.
- Fora de escopo: e-mail automático ao respondente (opção b do PRD) — depende da spec 004 e de parecer jurídico, não entra nesta rodada.
- Não mexe na superfície de autenticação (`packages/auth`) — é a mesma coleta do Meridian (`actions/collection.ts`, `tab-coleta.tsx`), corre em paralelo com a spec 004 sem disputar arquivos.

## Resultado desejado

O consultor fecha a aba no meio da atribuição de respondentes, volta depois, e recupera os 10 links num único passo — sem revogar nada, em produção. Pra um respondente específico, existe um botão "Reemitir link" ao lado de "Lembrar"/"Revogar" (`tab-coleta.tsx:603-635`) que gira o token e mostra o link novo. Pra recuperar todos de uma vez, existe uma ação "Reemitir e copiar todos os pendentes" que devolve a lista completa (nome · eixo · link) de todo mundo `INVITED`/`PENDING`/`OVERDUE`, com botão de copiar tudo e opção de baixar `.txt`/`.csv`.

## Fora de escopo

- E-mail automático ao respondente com o link (opção b do PRD) — aguarda a spec 004 (Resend plugado no Better Auth) e parecer da Lacre.
- Qualquer mudança no fluxo de atribuição inicial (`assignRespondent`) ou de revogação (`revokeRespondent`) além de reaproveitar o padrão de girar `tokenHash`.
- Decidir o valor exato de `tokenExpiresAt` da reemissão — registrado como decisão técnica do Maestro na implementação, não bloqueia esta spec.
- Qualquer mudança na superfície de autenticação (`packages/auth`) — isso é escopo da spec 004, que corre em paralelo sem dependência nesta direção.
