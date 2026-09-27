---
status: approved
---

# Intent: Conta ativa sempre visível (Fase 0 do modelo de contas)

**Feature Branch**: `009-conta-ativa-visivel`

**Created**: 2026-09-27

**Input**: descrição original do usuário: "Da Morgana — CEO deu 'vai' na Fase 0 do modelo de contas (docs/produto/modelo-de-contas/proposta.md, e0f8a647; base: as-is.md e negocio-e-referencias.md). Spec nova (próximo número livre), escopo FECHADO, sem schema: (1) nome e seletor da conta ativa visíveis no topo dos 5 produtos (Meridian, Scaffold, Charter, Cosmos, Signal) — um componente comum, não um por produto; hoje só (authenticated)/layout.tsx tem WorkspaceSwitcher e o Meridian só mostra o tenant num title tooltip (components/meridian/shell.tsx:520); (2) confirmação explícita ao trocar de conta, e a troca leva ao catálogo/produto da conta nova com feedback visível; (3) fallback determinístico em requireTenantSession quando não há activeTenantId (hoje findFirst sem orderBy em packages/auth/server.ts) — defina a regra (ex.: último tenant usado, depois o mais antigo) e registre; (4) a troca limpa o cache de sessão (switch-tenant/route.ts:53 já apaga better-auth.session_data — confirme que basta). Fora: conta na URL, tipo de conta, papéis (fases 1-3). Critério de aceite testável — inclusive o cenário real do dogfood (usuário ADMIN em 6 tenants, nomes 'Nebula' e 'Nebuloz', sempre sabe qual está ativo em qualquer produto)."

## Problema

Ninguém sempre sabe em qual conta está. No dogfood de 2026-09-27 o próprio CEO
— `ADMIN` em 6 tenants — teve a sessão caindo no tenant "Nebula" enquanto
achava que estava no "Nebuloz": um diagnóstico foi criado no tenant errado e
duas decisões de produto foram tomadas em cima de identificação errada
(`docs/produto/modelo-de-contas/proposta.md:10`). Causas técnicas confirmadas
em `docs/produto/modelo-de-contas/as-is.md`:

1. **Nenhum dos 5 produtos tem seletor de conta.** `WorkspaceSwitcher`
   (`apps/app/app/(authenticated)/components/workspace-switcher.tsx`) só é
   montado pelo layout do grupo `(authenticated)` (catálogo/settings), que
   **não é ancestral** de nenhum dos 5 grupos de produto — `(cosmos)`,
   `(meridian)`, `(charter)`, `(scaffold)`, `(signal)` são irmãos, cada um com
   layout/shell próprio (`as-is.md` §3).
2. **A visibilidade do nome da conta é inconsistente e, em 2 produtos, nula
   na prática.** Cosmos, Charter e Scaffold mostram o nome como texto visível;
   Meridian (`components/meridian/shell.tsx:520`) e Signal
   (`components/signal/shell.tsx:630`) só colocam o nome num atributo `title`
   (tooltip — nunca aparece sem hover) (`as-is.md` §3.1).
3. **A conta "ativa" default é escolhida sem ordem definida, em 2 lugares
   independentes.** `requireTenantSession` (`packages/auth/server.ts:209-212`)
   faz `tenantMember.findFirst({ where: { userId } })` **sem `orderBy`**
   quando `activeTenantId` é nulo na sessão — o Postgres devolve o que
   estiver mais acessível fisicamente, não o primeiro criado nem o mais
   recente. O fallback de onboarding do layout `(authenticated)`
   (`layout.tsx:31-36,65-66`) repete o mesmo padrão sem `orderBy`. Isso é o
   mecanismo mais provável por trás do "caiu no tenant errado sem escolher"
   do dogfood (`as-is.md` §2.1, §10.2).
4. **Existem 3 caminhos de troca de conta, só 1 usado e correto hoje.**
   `POST /api/auth/switch-tenant` (`switch-tenant/route.ts:31-53`) confere
   membership, grava `activeTenantId` e **deleta o cookie**
   `better-auth.session_data` — é o único caminho com call site
   (`workspace-switcher.tsx:70-76`) e o único que evita servir a conta antiga
   pelos próximos 60s (`cookieCache`, `server.ts:71-89`). `switchOrg`
   (`actions/auth/switch-org.ts`) faz a troca mas **não limpa o cookie** e não
   tem nenhum call site em produto hoje — risco latente se alguém wireá-lo a
   uma tela nova sem notar (`as-is.md` §2.2).
5. **Aceitar convite e completar onboarding trocam a conta ativa de TODAS as
   sessões da pessoa, silenciosamente.** Confirmado no código (achado do
   Alicerce, verificado nesta sessão):
   `apps/app/app/(unauthenticated)/invite/[token]/complete/page.tsx:53-57` e
   `apps/app/app/actions/onboarding.ts:57-60` chamam
   `database.session.updateMany({ where: { userId }, data: { activeTenantId } })`
   — isso muda a conta ativa em **qualquer outra sessão aberta daquela
   pessoa** (outro navegador, outro dispositivo), sem aviso. É o oposto de "a
   pessoa sempre sabe qual conta está ativa": alguém pode estar trabalhando
   numa conta em uma aba, aceitar um convite em outra aba/dispositivo, e ver a
   primeira aba pular de conta sem ter pedido.

## Contexto

- Base aprovada: `docs/produto/modelo-de-contas/proposta.md` (Morgana,
  commit `e0f8a647`), que descreve 5 fases indo do mais barato/redutor de
  risco ao mais estrutural. Documentos-base: `as-is.md` (Alicerce, técnico,
  `arquivo:linha` para cada afirmação) e `negocio-e-referencias.md` (Norte,
  ângulo comercial e benchmarks — não usado nesta Fase 0, relevante só a
  partir da Fase 1).
- **CEO deu 'vai' só na Fase 0** ("Conta visível" na tabela de fases,
  `proposta.md:36`): seletor e nome no topo dos 5 produtos, confirmação ao
  trocar, fallback determinístico, sem mexer em schema. Fecha o incidente
  Nebula/Nebuloz. As fases 1-4 (tipo de conta/lançamento, conta na URL,
  papéis, contrato/suporte) dependem de respostas do CEO às perguntas em
  `proposta.md` §"Decisões do CEO" e **não fazem parte desta spec**.
- A spec 008 (lista de produtos lançados no catálogo, pausada) foi
  explicitamente marcada como absorvida pela **Fase 1**, não pela Fase 0 —
  esta spec não toca nisso.
- Invariantes de segurança que a proposta já cita e que esta spec precisa
  preservar (`as-is.md` §9, ADR-0012/ADR-0013): toda query segue filtrando
  `tenantId` da sessão, nunca do cliente; um seletor dentro de `apps/app` lista
  só as contas do próprio usuário via `TenantMember` (não é leitura
  cross-tenant, não precisa de `platformDb`); `activeTenantId` continua
  `input: false` — a troca sempre passa por uma rota/action que confere
  `TenantMember` antes de gravar, nunca por escrita direta do cliente.
- Cenário de validação que a spec precisa cobrir de ponta a ponta: uma pessoa
  `ADMIN` em 6 tenants (nomes incluindo "Nebula" e "Nebuloz", como o cenário
  real do dogfood) consegue, em qualquer um dos 5 produtos, ver sem ambiguidade
  qual conta está ativa, e trocar de conta com confirmação e feedback visível
  de que a troca aconteceu.
- **Adendo de escopo (via Morgana, achado do Alicerce, confirmado no código
  nesta sessão)**: aceitar convite e completar onboarding trocam
  `activeTenantId` de todas as sessões da pessoa via `session.updateMany`
  (problema #5 acima). Entra no escopo da Fase 0 corrigir isso para afetar só
  a sessão que executou a ação — as demais sessões continuam na conta que já
  tinham. `switchOrg` (sem call site) **fica fora do conserto** nesta fase,
  mas entra registrado como risco conhecido na spec (não removido, não
  wireado, não corrigido — só documentado para quem for usá-lo depois notar
  que ele não limpa cookie nem escopa a sessão).

## Restrições

- **Sem migration de schema.** Fase 0 é UI + regra de fallback + confirmação
  de comportamento já existente — não cria enum de tipo de conta
  (`isInternalTenant`/`isSystem` ficam como estão; isso é Fase 1). Por essa
  restrição, o fallback determinístico usa `TenantMember.createdAt asc`
  (membership mais antiga), não "última conta usada de fato" — ver
  "Resultado desejado".
- **Fora de escopo, explicitamente adiado**: conta na URL (Fase 2), tipo de
  conta e lançamento por coorte (Fase 1 — absorve a spec 008 pausada),
  papel de conta separado do SAFe (Fase 3), contrato/suporte (Fase 4).
- **Um componente comum**, não cinco implementações por produto — os 5
  grupos de rota de produto são irmãos de `(authenticated)`, então o
  componente precisa ser importável por todos sem duplicar código nem subir
  para o layout raiz genérico (`app/layout.tsx`, reservado a providers
  globais, `as-is.md` §11).
- Não pode regredir o único caminho de troca correto hoje
  (`/api/auth/switch-tenant`, que já limpa o cookie) — se a Fase 0 introduzir
  um novo ponto de entrada para trocar de conta (ex.: dentro do produto), ele
  usa o mesmo mecanismo de limpeza de cache, não reintroduz o gap do
  `switchOrg` sem call site.
- Critérios de aceite MUST ser testáveis, incluindo o cenário do dogfood
  (6 tenants, "Nebula" vs "Nebuloz").
- Dono da implementação é o Alicerce (Maestro); esta sessão (PO) entrega
  intent → spec → clarify → plan → tasks, sem tocar em código de app.

## Resultado desejado

Em qualquer um dos 5 produtos, no topo da tela, a pessoa vê o nome da conta
ativa como texto sempre visível (nunca só tooltip) e um seletor — o mesmo
componente em todos os 5, não uma cópia por produto. Trocar de conta pede
confirmação explícita antes de efetivar, e depois da troca a pessoa é levada
ao catálogo (ou ao produto de origem, se fizer sentido manter) da conta nova,
com feedback visível de que a conta mudou. Quando a sessão perde
`activeTenantId` (login novo, cookie limpo) e a pessoa tem mais de uma
membership, o sistema escolhe a conta seguinte por uma regra determinística e
registrada (não mais um `findFirst` sem `orderBy`): a membership mais antiga,
`orderBy TenantMember.createdAt asc` — decisão fechada aqui porque "última
conta usada de fato" exigiria um campo novo (ex.:
`TenantMember.lastUsedAt`/`User.lastActiveTenantId`, nenhum existe hoje),
o que violaria a restrição "sem schema" desta fase; `createdAt` asc já existe,
é determinístico e não precisa de migration. A troca de conta continua limpando
o cache da sessão (`better-auth.session_data`), e a spec confirma
explicitamente — com um teste, não só leitura de código — que isso já basta
para não servir a conta antiga na janela de 60s do `cookieCache`.

## Fora de escopo

- Conta na URL (`/<conta>/<produto>`) — Fase 2.
- Tipo de conta (enum substituindo `isInternalTenant`/`isSystem`) e lista de
  produtos lançados por coorte — Fase 1 (absorve a spec 008 pausada).
- Papel de conta separado do enum SAFe, convite com papéis por produto —
  Fase 3.
- Proposta comercial provisionando conta/módulos automaticamente, acesso de
  suporte temporário/auditado do staff — Fase 4.
- Qualquer migration de schema.
- Implementação em código — dono é o Alicerce.
