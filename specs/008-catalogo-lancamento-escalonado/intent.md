---
status: pausada — absorvida pela Fase 1 do modelo de contas
---

# Intent: Catálogo pós-login respeita o lançamento escalonado

> **Pausada em 2026-09-27** (via Morgana, em nome do CEO): não vai para dev.
> A "lista de produtos lançados" pedida aqui é absorvida pela Fase 1 do
> modelo de contas (`docs/produto/modelo-de-contas/proposta.md`) como feature
> flag por coorte (tipo de conta). Retomar só se a Fase 1 não cobrir o caso,
> ou se o CEO priorizar isto antes da Fase 1 entrar em dev.

**Feature Branch**: `008-catalogo-lancamento-escalonado`

**Created**: 2026-09-26

**Input**: descrição original do usuário: "Da Morgana — decisão do CEO (26/set), vira spec curta 008 (já decidida, sem clarify de escopo): no catálogo pós-login da spec 004, para tenant interno, um card só fica clicável se o produto está (1) com TenantModule ACTIVE no tenant E (2) na lista de produtos LANÇADOS — lista única em configuração/código (hoje só MERIDIAN), alinhada à decisão de lançamento escalonado do Norte (docs/produto/prontidao-lancamento.md, 994dd36b). Produto ativo mas não lançado aparece 'Em breve'. Motivo real: o tenant nebuloz em produção tem os 5 módulos ACTIVE, e o CEO quer só o Meridian clicável sem tirar acesso da Nebuloz aos outros por URL direta — decida na spec se a lista de lançados também bloqueia acesso direto (/cosmos etc.) ou só o card do catálogo, e registre como pergunta para o CEO se não houver resposta no PRD."

## Problema

O catálogo pós-login (spec 004) documentou que, para o tenant interno (Nebuloz),
"só o Meridian está habilitado; os demais aparecem visíveis mas desabilitados,
com indicação clara de 'em breve'" — mas isso nunca foi implementado como regra
própria. `listarProdutos()` (`apps/app/app/actions/produtos/index.ts`) decide se
um card é clicável (`href != null`) só olhando `TenantModule` via
`listModules()`. Como o tenant Nebuloz em produção tem os 5 módulos com status
`ACTIVE`, hoje os 5 cards aparecem clicáveis, contradizendo o texto da spec 004
e a decisão de lançamento escalonado (`docs/produto/prontidao-lancamento.md`,
commit `994dd36b`): só o Meridian está de fato lançado para cliente externo;
Scaffold, Charter, Cosmos e Signal ainda não passaram no gate de maturidade.

## Contexto

- CEO decidiu (26/set, via Morgana) que o card do catálogo só é clicável se
  **(1)** `TenantModule` do produto está `ACTIVE` no tenant **E** **(2)** o
  produto está numa lista de produtos **lançados** — lista única, em
  configuração/código, hoje contendo só `MERIDIAN`. Produto com módulo `ACTIVE`
  mas fora da lista de lançados aparece "Em breve" (UI já existe: badge
  "Em breve" em `CartaoDeProduto`, `apps/app/app/(authenticated)/produto/page.tsx`).
- A lista de lançados espelha a ordem já decidida da esteira de dogfood
  (Meridian → Scaffold → Charter → Cosmos → Signal,
  `docs/produto/prontidao-lancamento.md`) e cresce conforme cada produto passa
  no gate de maturidade (spec 007, tema separado — esta spec não mexe no gate,
  só consome a ideia de "lançado" como fato consultável).
- Afeta hoje só o tenant Nebuloz (`Tenant.isInternalTenant = true`), único com
  catálogo pós-login e com os 5 módulos contratados internamente para dogfood.
  Sem essa mudança, qualquer pessoa da Nebuloz pode entrar em Cosmos, Charter,
  Scaffold ou Signal pelo catálogo achando que são produtos disponíveis, quando
  na verdade não passaram por dogfood nem compliance para uso real.
- Pergunta em aberto que o CEO levantou e não respondeu ainda: a lista de
  lançados também deve bloquear acesso direto por URL (`/cosmos`, `/charter`
  etc., contornando o catálogo) para o tenant Nebuloz, ou só afeta o que o
  card do catálogo mostra/permite clicar? Motivo dado para não fechar sozinho:
  o CEO quer "sem tirar acesso da Nebuloz aos outros por URL direta" — o que
  sugere manter acesso direto como está, mas o próprio CEO pediu que a spec
  decida ou registre como pergunta se não houver resposta clara.

## Restrições

- Não muda a regra de acesso para tenants não-internos (comportamento atual
  por contrato via `TenantModule`/`listModules`, intocado).
- Não reimplementa nem duplica a checagem de acesso que hoje vive em
  `listModules()`/`hasModule()` (`@repo/rbac`) — o "lançado" é uma condição
  adicional para o *card*, não uma segunda fonte de verdade sobre contrato.
- Não mexe no gate de maturidade/carga (spec 007) — essa spec só consome o
  conceito de "produto lançado"; não define o processo de promover um produto
  à lista.
- Critérios de aceite MUST ser testáveis — nada de "aparece corretamente" sem
  um cenário Given/When/Then verificável.
- Dono da implementação é o Alicerce (Maestro); esta sessão (PO) entrega
  intent → spec → clarify → plan → tasks, sem tocar em código de app.

## Resultado desejado

No catálogo pós-login do tenant interno, um card só é clicável (leva para
dentro do produto) quando o produto está `ACTIVE`/`TRIAL` em `TenantModule`
**e** está na lista de produtos lançados. Hoje isso significa: só Meridian
clicável; Scaffold, Charter, Cosmos e Signal aparecem com badge "Em breve",
mesmo tendo `TenantModule` `ACTIVE`. Quando um novo produto passa no gate de
maturidade e entra na lista de lançados, ele passa a ficar clicável no
catálogo sem exigir mudança na regra de contrato. A spec registra explicitamente
a decisão (ou a pergunta pendente ao CEO) sobre se essa lista também bloqueia
acesso direto por URL.

## Fora de escopo

- Definir o processo/gate que promove um produto à lista de lançados (spec 007).
- Mudar o comportamento do catálogo ou de acesso para tenants não-internos.
- Qualquer UI de gestão da lista de lançados (fica em código/config, sem tela
  administrativa nesta rodada).
- Implementação em código — dono é o Alicerce.
