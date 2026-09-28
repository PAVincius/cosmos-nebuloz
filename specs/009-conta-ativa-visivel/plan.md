# Implementation Plan: Conta ativa sempre visível (Fase 0 do modelo de contas)

**Branch**: `009-conta-ativa-visivel` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-conta-ativa-visivel/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Exibir o nome da conta ativa como texto sempre visível (não tooltip) no topo
dos 5 produtos, com um componente único compartilhado que inclui seletor com
confirmação explícita; tornar determinístico o fallback de conta ativa
quando a sessão não tem `activeTenantId` (`TenantMember.createdAt` ascendente);
e restringir aceitar-convite e completar-onboarding a trocar `activeTenantId`
só da sessão que executou a ação, não de todas via `session.updateMany`. Sem
schema novo — `TenantMember.createdAt` já existe. Abordagem técnica: reusar o
mecanismo já correto de `/api/auth/switch-tenant` (limpa
`better-auth.session_data`, escopado por sessão) como base do novo seletor;
não corrigir nem usar `switchOrg` (documentado como risco conhecido).

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 15 App Router (React 19)

**Primary Dependencies**: `@repo/auth` (better-auth, `requireTenantSession`),
`@repo/database` (Prisma), `@repo/design-system` (shadcn/ui), `@repo/rbac`

**Storage**: PostgreSQL via Prisma — sem migration nesta fase
(`TenantMember.createdAt` já existe, `packages/database/prisma/schema/tenant.prisma:423`)

**Testing**: Vitest (unit/integration, `apps/app/__tests__/`), Playwright (E2E,
`apps/app/e2e/`)

**Target Platform**: Web (Next.js), 5 produtos em `apps/app/app/(meridian|scaffold|cosmos|signal|charter)`

**Project Type**: Web application — monorepo pnpm/Turborepo (`apps/app` +
pacotes compartilhados)

**Performance Goals**: N/A — feature de UI/sessão, sem requisito de
performance específico além dos já vigentes (troca de conta reflete sem
esperar a janela de 60s do cache de sessão, FR-009/SC-004)

**Constraints**: Nenhuma migration de schema permitida (Assumptions do spec);
não introduzir leitura cross-tenant (FR-014); não corrigir `switchOrg` nesta
fase (FR-013)

**Scale/Scope**: 5 shells de produto (`apps/app/components/{meridian,scaffold,cosmos,signal,charter}/shell.tsx`)
+ 1 componente novo compartilhado + 2 pontos de sessão (convite, onboarding)
+ 1 função de fallback (`requireTenantSession`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Multi-Tenant Safety (NON-NEGOTIABLE)** — PASS. Toda leitura de contas
  da pessoa continua via `TenantMember` filtrado por `userId` da sessão (mesmo
  padrão de `/api/tenants` e `switchOrg`); nenhuma leitura cross-tenant nova
  (FR-014). A troca de conta continua validando membership antes de gravar
  (`switch-tenant/route.ts:34-40`).
- **II. Result<T>, não throw** — PASS. Pontos de sessão tocados
  (`invite/[token]/complete/page.tsx`, `actions/onboarding.ts`) são Server
  Components/actions que já usam `redirect`/exceções no padrão existente do
  arquivo; o único server action no escopo (`switchOrg`, não usado nesta fase)
  já segue `Result<T>`. Nenhum novo action introduzido além do necessário para
  o seletor, que deve seguir o padrão de `switchOrg`/`_base.ts` se for criado.
- **III. Test-First (NON-NEGOTIABLE)** — PASS, gate para `/speckit-tasks`:
  cada FR tem cenário Given/When/Then testável no spec; tasks.md deve ordenar
  teste antes de implementação por FR.
- **IV. Validação em Boundaries** — PASS. Nenhum boundary novo de input
  externo; o seletor reusa `SwitchTenantSchema` (`app/actions/schemas.ts`) já
  validado em `/api/auth/switch-tenant`.
- **V. Webhook Receiver Pattern** — N/A, sem webhook nesta feature.

Nenhuma violação — não há entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/
├── auth/
│   └── server.ts                        # requireTenantSession — fallback determinístico (FR-007/008), linhas 195-259
├── database/prisma/schema/
│   └── tenant.prisma                     # TenantMember.createdAt já existe (linha 423) — sem migration
└── design-system/components/
    └── account-switcher/                 # NOVO — componente único compartilhado (FR-001..006)
        ├── active-account-badge.tsx       # nome da conta como texto visível
        └── switch-account-dialog.tsx      # seletor + confirmação explícita

apps/app/
├── app/
│   ├── (meridian|scaffold|cosmos|signal|charter)/
│   │   ├── layout.tsx                    # já chama getShellData()
│   │   └── actions/shell.ts              # estender para incluir tenants[] + activeTenantId (só cosmos usa caminho próprio, ver components/cosmos/shell.tsx)
│   ├── api/auth/switch-tenant/route.ts   # mecanismo já correto a reusar (FR-012) — limpa better-auth.session_data
│   ├── actions/auth/switch-org.ts        # NÃO tocar — risco conhecido documentado (FR-013), sem call site
│   ├── (authenticated)/_lib/resolve-post-login-destination.ts  # reusar para destino pós-troca (FR-006)
│   ├── (unauthenticated)/invite/[token]/complete/page.tsx  # linha 53-56 — session.updateMany → escopar a session.session.id (FR-010)
│   └── actions/onboarding.ts             # linha 57-60 — mesmo ajuste (FR-011)
└── components/
    ├── meridian/shell.tsx                # linha 520 — title={organization} só tooltip, trocar pelo componente novo
    ├── signal/shell.tsx                  # linha 630 — mesmo bug
    ├── scaffold/shell.tsx                # linha 266 — já visível, mas implementação própria; trocar pelo componente novo
    ├── charter/shell.tsx                 # linha 636 — idem
    └── cosmos/shell.tsx                  # linha 344-355 — já tem nome+seletor visual (sem confirmação, sem ação de troca); trocar pelo componente novo

apps/app/__tests__/
├── actions/auth/switch-org.test.ts       # padrão de teste de action a seguir
├── auth/                                  # NOVO — teste de requireTenantSession (fallback determinístico) e de session.updateMany escopado
└── produto/resolve-post-login-destination.test.ts  # padrão de teste a seguir para destino pós-troca

apps/app/e2e/
├── workspace-switcher.spec.ts            # padrão de E2E de troca de conta a seguir/estender
└── personas/{po,sm}.spec.ts              # padrão de E2E de switch-tenant a seguir
```

**Structure Decision**: componente único novo em `packages/design-system/components/account-switcher/`
(mesmo pacote de onde `workspace-switcher.tsx` já importa `DropdownMenu` etc.),
consumido pelos 5 `components/<produto>/shell.tsx`. Servidor: cada
`(<produto>)/actions/shell.ts` passa a devolver a lista de tenants da pessoa
(mesma leitura de `/api/tenants`) + `activeTenantId`, evitando um round-trip
client-side extra e a "piscada" que violaria SC-001. Cliente: troca reusa
`/api/auth/switch-tenant` (já limpa cache, já valida membership) — não um
novo endpoint. Sessão: os dois pontos de vazamento (FR-010/011) recebem o
mesmo ajuste pontual (`session.updateMany` → `session.update` por
`session.session.id`), sem tocar no restante das duas rotas.

## Complexity Tracking

Nenhuma violação da constituição — seção não aplicável.
