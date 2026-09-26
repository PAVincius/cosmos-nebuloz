# Research: Login genérico + seleção de produto pós-login

Sem `NEEDS CLARIFICATION` remanescente no Technical Context — decisões abaixo fecham as questões técnicas que faltavam (o produto já foi decidido em `/speckit-clarify`).

## 1. Onde plugar a resolução de destino pós-login

**Decisão**: Centralizar em `apps/app/app/(authenticated)/page.tsx` (server component). `sign-in.tsx:39` (callbackURL) e `sign-in.tsx:81` (redirect pós-TOTP) passam a apontar pra `/` em vez de `/cosmos/dashboard`.

**Rationale**: Hoje a regra "pra onde vai" está hardcoded em 3 lugares (`sign-in.tsx:39,81`, `page.tsx:8`). Adicionar uma segunda condição (`isInternalTenant`) nos 3 pontos tríplica a chance de divergência. `page.tsx` já roda no servidor, já tem acesso a sessão via `requireTenantSession`, e já é o lugar que decide "isto entra direto no Cosmos" — só precisa aprender a decidir diferente.

**Alternatives considered**: Decidir no `callbackURL` do client (`sign-in.tsx`) — rejeitado porque exigiria expor `isInternalTenant` e o estado de contrato pro client antes do redirect, e duplicaria a regra nos dois pontos de `sign-in.tsx` mesmo assim.

## 2. Reaproveitar `(authenticated)/produto` como catálogo pós-login

**Decisão**: A mesma tela e a mesma action (`listarProdutos()`) servem de landing pós-login para tenants internos, em vez de uma tela nova.

**Rationale**: A tela já resolve habilitação por contrato real (`TenantModule` via `listModules()`), já tem badge de estado, já trata "sem rota" como não-clicável. É quase literalmente o pedido (c) do intent. Duplicar essa lógica numa tela nova violaria a restrição do intent de não reescrever o modelo de contrato, e criaria uma segunda fonte de verdade sobre "o que está habilitado".

**Ajustes necessários**: (a) adicionar `perfis: string[]` em `ProdutoNoPainel` — vem dos enums de papel por produto já existentes (`MeridianRole` etc., ver spec Assumptions); (b) quando a tela serve de landing pós-login (não de hub de contratação normal), o rótulo de "não disponível" deve ler como "em breve" — ver seção 5 sobre como diferenciar os dois contextos sem duplicar o componente.

**Alternatives considered**: Tela nova só para o catálogo pós-login — rejeitada por duplicar a fonte de habilitação (viola restrição do intent) e por já existir uma versão battle-tested em produção.

## 3. `isInternalTenant`: schema e leitura

**Decisão**: Campo booleano em `Tenant` (`packages/database/prisma/schema/tenant.prisma`), default `false`, via migration Prisma padrão. Lido a partir da sessão do tenant (`requireTenantSession`), nunca de input.

**Rationale**: Decisão do CEO (via Norte/CPO) — flag dedicada, não ID/slug fixo no código nem config/env (isso tornaria o comportamento não-auditável via schema e dependente de deploy pra mudar). Segue o precedente já existente de `Tenant.isSystem` (`tenant.prisma:31-36`) como padrão de "boolean de tenant especial, filtrado explicitamente onde importa".

**Alternatives considered**: Reaproveitar `isSystem` — rejeitado explicitamente no intent: propósito diferente (tenant técnico de auditoria vs. tenant real de dogfood).

## 4. Envio do e-mail de redefinição de senha

**Decisão**: Plugar `sendResetPassword` em `emailAndPassword` (`packages/auth/server.ts:45-48`), chamando `packages/email` (o mesmo proxy com catcher local em dev / Resend em produção que `templates/invite.tsx` já usa). Novo template `packages/email/templates/reset-password.tsx`, mesmo padrão de `invite.tsx`. Remetente: reaproveita `keys().RESEND_FROM` (já usado por todo envio no repo) — não hardcoda `no-reply@nebuloz.ai` no código; esse é o valor que a env var precisa ter em produção (dependência operacional do CEO, registrada no spec).

**Rationale**: `packages/email` já resolve dev vs. produção (catcher local vs. Resend) num único ponto (`_emailsComCatcher`/`escolherTransporte`) — reimplementar isso no callback do Better Auth duplicaria essa decisão.

## 5. Rota `/reset-password`

**Decisão**: Nova rota `apps/app/app/(unauthenticated)/reset-password/[[...reset-password]]/page.tsx`, no mesmo padrão de `sign-in`/`sign-up`/`forgot-password` (catch-all opcional, porque o Better Auth injeta parâmetros de token na URL). Client component chama `authClient.resetPassword({ newPassword, token })`.

**Rationale**: Better Auth já expõe esse método no client (`better-auth/react`); a única peça que falta é a rota — hoje o link do e-mail (se enviado) cairia em 404.

## 6. Troca de senha logado

**Decisão**: Nova aba `apps/app/app/(authenticated)/settings/security/page.tsx`, formulário (senha atual + nova) chamando `authClient.changePassword({ currentPassword, newPassword })` (método padrão do Better Auth, já disponível via `authClient` sem plugin extra). Entrada na nav de settings (`settings-nav.tsx`).

**Rationale**: Não existe hoje nenhuma aba de conta/segurança (`settings/` só tem audit, integrations, members, reports, roles, sso, workspace). `changePassword` é built-in do Better Auth core — não precisa de plugin novo, diferente de `twoFactor`.

## 7. Issuer do 2FA

**Decisão**: `packages/auth/server.ts:78` — `issuer: "Cosmos"` → `issuer: "Nebuloz"`.

**Rationale**: O issuer é só o rótulo mostrado no app autenticador (Google Authenticator, etc.) — não faz parte do segredo TOTP (`otpauth://` guarda o segredo, o issuer é metadado de exibição). Trocar não invalida 2FA já cadastrado (critério de aceite explícito do CEO, FR-015).
