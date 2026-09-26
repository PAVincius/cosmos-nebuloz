# Implementation Plan: Login genérico + seleção de produto pós-login

**Branch**: `004-login-generico-produto` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-login-generico-produto/spec.md`

## Summary

Remove a marca do Cosmos da tela de login em `app.nebuloz.ai` (todos os tenants) e troca o destino pós-login fixo (`/cosmos/dashboard`) por uma resolução dinâmica: tenants com `isInternalTenant = true` (hoje só Nebuloz) caem no catálogo de produtos já existente (`(authenticated)/produto`, hoje só acessível pela sidebar); os demais seguem direto pro produto contratado, como hoje. Junto: troca de senha logada e "esqueci a senha" ponta a ponta (Resend plugado no Better Auth + rota `/reset-password` real). Abordagem de reuso: o catálogo já resolve contrato real via `listarProdutos()`/`listModules()` — não reimplementamos habilitação, só adicionamos a flag de tenant que decide **se** a tela aparece, e estendemos o catálogo com perfis por produto.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 15 (App Router)

**Primary Dependencies**: Better Auth (`packages/auth`) com plugin `twoFactor`; Prisma + PostgreSQL (`packages/database`); `@repo/rbac` (`listModules`/`hasModule`); Resend via `packages/email` (proxy com catcher local em dev, `packages/email/transporte.ts`); React Email (`@react-email/components`) pros templates de e-mail.

**Storage**: PostgreSQL via Prisma. Nova coluna `Tenant.isInternalTenant` (boolean, default `false`) via migration.

**Testing**: Vitest (unit/integration) nos packages e em `apps/app/__tests__`; Playwright E2E em `apps/app/e2e` para os fluxos críticos (login → catálogo → Meridian; esqueci senha ponta a ponta).

**Target Platform**: Web, Vercel (Next.js), domínio `app.nebuloz.ai`.

**Project Type**: Monorepo Turborepo — mudanças em `packages/auth`, `packages/database`, `packages/email`, `apps/app`.

**Performance Goals**: Sem meta nova de performance — segue os padrões já existentes de SSR/server actions do app (sem budget de latência específico pedido).

**Constraints**: Multi-tenant safety (constituição I) — toda leitura de tenant/módulo passa por `requireTenantSession`/`requireMeridianPermissionContext` já existentes, nunca por `tenantId` de input. Não reescrever `TenantModule`/`listModules` (restrição do intent). Não alterar `packages/auth` fora do necessário pra esta feature (a spec 006, em paralelo, mexe só em `actions/collection.ts`/`tab-coleta.tsx` do Meridian — sem overlap de arquivos).

**Scale/Scope**: Feature de superfície — não introduz novo serviço; poucos arquivos em `packages/auth`, `packages/email`, `apps/app/app/(unauthenticated)`, `apps/app/app/(authenticated)/settings`, `apps/app/app/(authenticated)/produto`, `apps/app/app/actions/produtos`, `packages/database/prisma/schema/tenant.prisma`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Multi-Tenant Safety (NON-NEGOTIABLE)** — PASS. A resolução do destino pós-login e a leitura de `isInternalTenant` usam a sessão do tenant autenticado (`requireTenantSession`), nunca um `tenantId` vindo de input/URL. A troca de senha e o reset operam sobre o próprio usuário autenticado (Better Auth), sem cruzar tenant.
- **II. Result\<T\>, não throw** — PASS. Novas server actions (troca de senha, e o que for necessário para orquestrar a reemissão de e-mail) seguem `safeAction`/`Result<T>` de `_base.ts`, como as demais actions do app.
- **III. Test-First (NON-NEGOTIABLE)** — PASS (a garantir na execução). `/speckit-tasks` ordena teste antes de implementação para cada FR; cobertura ≥80% nos arquivos tocados.
- **IV. Validação em Boundaries** — PASS. Formulário de troca de senha e de redefinição validam com Zod nos boundaries de server action, reaproveitando primitivos de `_base.ts`.
- **V. Webhook Receiver Pattern** — N/A. Nenhum endpoint de webhook nesta feature.

Nenhuma violação — sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-login-generico-produto/
├── intent.md             # Aprovado
├── spec.md               # Aprovado, com clarificações integradas
├── plan.md               # Este arquivo
├── research.md           # Phase 0
├── data-model.md         # Phase 1
├── quickstart.md         # Phase 1
├── contracts/            # Phase 1
│   └── actions.md
└── tasks.md               # /speckit-tasks (a seguir)
```

### Source Code (repository root)

```text
packages/
├── database/prisma/schema/tenant.prisma      # + campo isInternalTenant, migration
├── auth/
│   ├── server.ts                             # sendResetPassword callback; issuer 2FA "Cosmos"→"Nebuloz"
│   ├── client.ts                             # authClient.changePassword (já exposto pelo better-auth/react; sem novo wrapper se não for preciso)
│   └── components/
│       ├── forgot-password.tsx               # já existe, sem mudança funcional (só copy se precisar)
│       └── sign-in.tsx                       # callbackURL / redirect deixam de apontar direto pra /cosmos/dashboard
└── email/
    └── templates/reset-password.tsx          # novo template, mesmo padrão de templates/invite.tsx

apps/app/
├── app/(unauthenticated)/
│   ├── layout.tsx                            # remove wordmark/headline/CadenceRail do Cosmos
│   ├── sign-in/[[...sign-in]]/page.tsx       # copy genérica (não "workspace no Cosmos")
│   └── reset-password/[[...reset-password]]/page.tsx   # NOVA rota — hoje 404
├── app/(authenticated)/
│   ├── page.tsx                              # resolve destino por tenant (isInternalTenant → catálogo; senão → produto contratado)
│   ├── produto/page.tsx                      # + perfis por produto; ajusta copy "em breve" quando servir de landing pós-login
│   └── settings/
│       └── security/page.tsx                 # NOVA aba — trocar senha (atual + nova)
└── app/actions/
    └── produtos/index.ts                     # + perfis por produto no ProdutoNoPainel
```

**Structure Decision**: Reaproveita o catálogo já existente (`(authenticated)/produto` + `actions/produtos`) como destino pós-login para tenants internos, em vez de criar uma tela nova — é o "achado relevante" já registrado no intent. A resolução de destino sai dos 3 pontos hardcoded (`sign-in.tsx:39,81`, `(authenticated)/page.tsx:8`) e concentra em `(authenticated)/page.tsx`, que já é um server component: os dois pontos de `sign-in.tsx` passam a redirecionar para `/` (raiz), que resolve o destino uma vez só, no servidor, com a sessão já disponível — evita triplicar a regra "isInternalTenant → catálogo; senão → contrato".
