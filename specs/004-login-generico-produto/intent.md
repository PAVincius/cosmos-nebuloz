---
status: approved
---

# Intent: Login genérico + seleção de produto pós-login

**Feature Branch**: `004-login-generico-produto`

**Created**: 2026-09-24

**Input**: descrição original do usuário: "Login genérico da Nebuloz + tela de seleção de produto pós-login, para o laboratório de usabilidade do Meridian com o CEO. Pedido do CEO (24/set, via Morgana): (a) tela de login genérica da Nebuloz, sem marca do Cosmos como padrão; (b) depois do login, tela de seleção de produto — catálogo dos 5 produtos da suíte (Meridian, Scaffold, Charter, Cosmos, Signal) com os perfis possíveis de cada um; (c) só o Meridian habilitado/clicável agora, os demais visíveis mas desabilitados (ex.: 'em breve'); (d) escolher um produto habilitado leva a ele." **Adendo do CEO (mesmo dia, via Morgana)**: incluir troca de senha — (1) tela "alterar senha" para usuário logado (senha atual + nova); (2) "esqueci a senha" funcionando de ponta a ponta em produção.

## Problema

`app.nebuloz.ai` — o mesmo domínio onde a Nebuloz vai operar como cliente da própria esteira (laboratório de usabilidade do Meridian) — hoje se apresenta e se comporta como se só existisse um produto: o Cosmos.

- A tela de login (`apps/app/app/(unauthenticated)/layout.tsx:73,78-83,104`) tem wordmark "Cosmos" e uma headline específica do Cosmos ("Cinco iterações. Uma janela de IP...", com um `CadenceRail` ilustrando o modelo de PI). O formulário (`apps/app/app/(unauthenticated)/sign-in/[[...sign-in]]/page.tsx:6`) descreve o destino como "seu workspace no Cosmos".
- Após autenticar, o destino é sempre `/cosmos/dashboard`, hardcoded em três pontos — `packages/auth/components/sign-in.tsx:39` (callback do login por email), `packages/auth/components/sign-in.tsx:81` (depois do TOTP), `apps/app/app/(authenticated)/page.tsx:8` (rota raiz `/`) — nenhum deles consulta módulo contratado.
- Não existe hoje nenhuma noção de "isto está pronto para uso, aquilo ainda não" independente do contrato do tenant: a única fonte de habilitação de produto é `TenantModule` (contrato real), via `listModules()`/`hasModule()` em `packages/rbac/src/modules.ts`.
- O plugin `twoFactor` do Better Auth também carrega a marca errada: `issuer: "Cosmos"` (`packages/auth/server.ts`, dentro do bloco `plugins`) — é o nome que aparece no app autenticador de qualquer usuário da suíte, outro vazamento de marca do Cosmos como padrão.

**Adendo — troca de senha não funciona hoje:**

- "Esqueci a senha" tem UI (`packages/auth/components/forgot-password.tsx`, chama `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`) mas **não envia e-mail em produção**: `packages/auth/server.ts:45-48` configura `emailAndPassword` sem `sendResetPassword`, e sem esse callback o Better Auth nunca dispara o envio. Confirmado também que **não existe rota `/reset-password`** no app — mesmo que o e-mail saísse, o link cairia em 404.
- Existe pacote de e-mail pronto e já usado em produção para outro fluxo (`packages/email/transporte.ts` + `packages/email/keys.ts`, transporte Resend via `RESEND_TOKEN`/`RESEND_FROM`, usado hoje por `packages/email/templates/invite.tsx`) — não plugado ao Better Auth. Documentado em `docs/runbooks/liberar-meridian-usuario.md:156-191`.
- Não existe nenhuma tela de "trocar senha" para usuário já logado — `apps/app/app/(authenticated)/settings/` não tem aba de conta/segurança hoje.

## Contexto

O CEO vai operar a Nebuloz como cliente real do Meridian (plano de dogfood, `docs/qualidade/2026-09-23-plano-dogfood-esteira.md`), entrando por `app.nebuloz.ai` como qualquer cliente entraria. Hoje essa porta de entrada empurra ele (e qualquer outra pessoa) para o Cosmos, não para o Meridian — o produto que está sendo validado nesta fase da esteira. Isso não é só estética: atrapalha o próprio laboratório de usabilidade, porque o primeiro obstáculo de qualquer sessão seria "por que caí no Cosmos".

A troca de senha entrou no mesmo pedido porque é a mesma superfície (fluxo de autenticação de `app.nebuloz.ai`) e porque, segundo o runbook `docs/runbooks/liberar-meridian-usuario.md`, o caminho "oficial" hoje para qualquer problema de senha seria gravar hash por SQL — explicitamente rejeitado ali (diverge da tabela `Account` do Better Auth, cria um segundo lugar que sabe hashear senha) e explicitamente rejeitado de novo pelo CEO neste pedido. Sem um forgot-password que realmente envia e-mail, qualquer pessoa (CEO, respondente, futuro cliente) que esquecer a senha fica sem saída limpa.

Achado relevante: parte da solução **já existe em produção** e não foi pensada para isto:

- `apps/app/app/(authenticated)/produto/page.tsx` + `apps/app/app/actions/produtos/index.ts` (`listarProdutos()`) já é um catálogo dos 5 produtos, com badge de estado por contrato (`DISPONIVEL | SEM_CONTRATO | SUSPENSO | CANCELADO | EXPIRADO | SEM_ROTA`) e já trata "sem rota" com o rótulo "Em breve aqui" — quase literalmente o pedido (c). Está linkado na sidebar autenticada como "hub de contratação" (`apps/app/app/(authenticated)/components/sidebar.tsx:46`), não como destino pós-login.
- A habilitação nessa tela vem inteiramente do contrato real (`TenantModule`). O pedido do CEO — "só o Meridian habilitado agora" — não é hoje uma propriedade configurável independente de contrato; seria dizer que só o tenant Nebuloz tem Meridian contratado (o que pode até já ser verdade) ou introduzir um mecanismo novo de "prontidão de produto" que não existe.
- Perfis (roles) são um enum por produto (`MeridianRole`, `CharterRole`, `ScaffoldRole`, `SignalRole`, mais `MemberRole` genérico que cobre o Cosmos) — não há um vocabulário único de "perfil da suíte" pronto para exibir lado a lado no catálogo.

## Restrições

- Não reescrever o modelo de contrato (`TenantModule`/`ProductModule`/`ModuleStatus`) — é infraestrutura madura e usada por outros produtos; qualquer mudança de comportamento de habilitação deve compor com ele, não substituí-lo.
- **Decisão final (2026-09-26, CEO via Norte/CPO, corrige uma resposta anterior via Morgana que dizia o oposto — ver `## Clarifications` em spec.md para o histórico do conflito)**: o catálogo pós-login continua exclusivo do tenant Nebuloz, via **flag dedicada no tenant** (`Tenant.isInternalTenant`, booleana) — não por ID/slug fixo no código, nem por config/env. Demais tenants (a flag é `false` ou ausente) mantêm o comportamento atual: vão direto pro produto contratado, sem ver o catálogo.
  - **Dono do campo**: a entidade Tenant tem um dono só, per `docs/produto/mapa-de-fronteiras.md:61` — no alvo de arquitetura é o **Charter**; hoje, como o mapa registra um `gap`, o tenant nasce tecnicamente em `packages/provisioning/src/tenant.ts:53-116` (chamado por `apps/backoffice/app/actions/provisioning.ts:145-178` e `apps/app/app/actions/onboarding.ts:36-52`). A flag `isInternalTenant` entra no model `Tenant` (`packages/database/prisma/schema/tenant.prisma:25-42`), que já tem um precedente parecido — `isSystem` (linhas 31-36), para o tenant interno de auditoria, com o aviso explícito de filtrar em qualquer listagem customer-facing. `isInternalTenant` é um campo novo e distinto de `isSystem` (propósito diferente: dogfood real vs. tenant técnico de sistema).
  - **Migration**: o campo entra via migration Prisma padrão (`prisma migrate`), não por seed manual nem SQL solto.
  - **ADR**: se o Maestro (dev) julgar a mudança arquiteturalmente significativa na hora de implementar (ex.: por tocar a entidade de dono-gap Tenant), abre ADR em `docs/adr/` — decisão dele conforme a rotina de `development-workflow.md`.
- A tela de login genérica (sem marca Cosmos) — isso sim é pedido pra **todo mundo** que acessa `app.nebuloz.ai`, não só Nebuloz, já que hoje ela sempre mostra marca do Cosmos independente do tenant.
- Não afeta tenants de clientes reais de forma destrutiva: qualquer mudança em login/redirect roda em produção (`app.nebuloz.ai`) atrás do mesmo domínio que atende clientes de verdade, não só a Nebuloz.
- Escopo desta rodada é o laboratório de usabilidade do Meridian — não é pedido para entregar telas equivalentes dentro de cada produto (isso já existe parcialmente, ex. o app-switcher interno do Meridian em `apps/app/components/meridian/shell.tsx`).
- **Nunca gravar ou alterar senha por SQL direto**, em nenhuma hipótese, nem como atalho temporário — toda escrita de senha passa pelo Better Auth (tabela `Account`), conforme já decidido em `docs/runbooks/liberar-meridian-usuario.md:181-191` e reforçado pelo CEO neste pedido.

## Resultado desejado

Uma pessoa que nunca usou a suíte entra em `app.nebuloz.ai`, vê uma tela de login sem identidade de nenhum produto específico (só a marca Nebuloz) — isso vale pra qualquer tenant. Se essa pessoa é do tenant Nebuloz, depois de autenticar vê um catálogo com os 5 produtos e os perfis de cada um — hoje só o Meridian é clicável, os outros aparecem claramente como "em breve" (ou equivalente) e não são um beco sem saída nem um erro; escolher o Meridian leva direto para dentro dele. Um usuário de outro tenant (cliente real, não-Nebuloz) continua indo direto pro produto que seu tenant tem contratado, como hoje — o catálogo pós-login não muda o comportamento dele.

Além disso: um usuário logado consegue trocar a própria senha informando a senha atual e a nova, sem sair do produto. Um usuário deslogado que esqueceu a senha pede redefinição, recebe um e-mail de verdade, e o link do e-mail leva a uma tela real (não 404) onde ele define a nova senha e consegue logar com ela — ponta a ponta, em produção.

## Fora de escopo

- Decidir ou implementar a "prontidão" real de Scaffold/Charter/Signal (isso é do roteiro de dogfood de cada produto, não desta feature).
- Redesenhar o app-switcher interno de cada produto (o que já existe dentro da casca do Meridian, por exemplo).
- Qualquer mudança na modelagem de contrato/módulo em si (`TenantModule` continua sendo a fonte de verdade sobre o que um tenant comprou).
- Qualquer forma de gravar/alterar senha fora do fluxo do Better Auth (SQL direto, script, etc.) — está fora de escopo por ser explicitamente proibido, não por falta de necessidade.
- Renomear o `issuer` do 2FA (`"Cosmos"` em `packages/auth/server.ts`) fica registrado como achado, mas não é pedido explícito do CEO — vira pergunta de clarificação, não item automático de escopo.
