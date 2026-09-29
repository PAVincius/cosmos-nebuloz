# Implementation Plan: Bootstrap do Charter cria biblioteca de cláusulas

**Branch**: `011-bootstrap-clausulas-charter` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-bootstrap-clausulas-charter/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

`bootstrapCharter` (`packages/provisioning/src/charter.ts`) monta papel COMPLIANCE, `CharterSettings` e a política em 9 seções, mas não cria as 8 cláusulas contratuais (CL-01–CL-08) — só o seed de demonstração cria. Sem CL-01, a derivação de teto de fornecedor (`charter-rules.ts`) nunca sai de PUBLIC para tenant provisionado pelo back-office. A entidade `CharterClause` e o índice `@@unique([tenantId, code])` já existem no schema — não há migração de banco nesta feature.

Abordagem: extrair o catálogo das 8 cláusulas (código, nome, criticidade), hoje duplicado só em `seed-charter.ts`, para um módulo compartilhado em `packages/provisioning`; fazer `bootstrapCharter` criar as cláusulas ausentes desse catálogo via `createMany` com `skipDuplicates` (idempotência pela chave `(tenantId, code)` já garantida pelo schema); fazer o seed de demonstração consumir o mesmo catálogo em vez de manter sua própria cópia.

## Technical Context

**Language/Version**: TypeScript 5.9 (monorepo pnpm/Turborepo existente)

**Primary Dependencies**: Prisma Client (`@repo/database`), infraestrutura já existente do pacote `packages/provisioning` (`withTenantDb`, `logPlatformAudit` de `./audit`, `ProvisioningError`)

**Storage**: PostgreSQL via Prisma — tabela `CharterClause` já existe (`packages/database/prisma/schema/charter.prisma:302-317`), com `@@unique([tenantId, code])`. Nenhuma migração de schema nesta feature.

**Testing**: Vitest, seguindo o padrão já usado em `packages/provisioning/src/__tests__/charter.test.ts` (mock de cada método do client por teste, sem banco real)

**Target Platform**: pacote de servidor Node.js consumido pelo fluxo de contratação do back-office (`apps/backoffice`) e pelo script de seed de demonstração (`apps/app/scripts/seed-charter.ts`)

**Project Type**: pacote de biblioteca dentro do monorepo (`packages/provisioning`) — sem interface HTTP/pública nova

**Performance Goals**: N/A — 8 registros fixos por tenant, custo desprezível

**Constraints**: idempotência obrigatória pela chave natural `(tenantId, code)`; criação deve ocorrer dentro do mesmo `withTenantDb` do bootstrap (RLS FORCE já exige contexto de tenant); não sobrescrever cláusula existente mesmo que editada manualmente

**Scale/Scope**: 8 cláusulas fixas (CL-01–CL-08); toca `packages/provisioning/src/charter.ts`, um novo módulo de catálogo compartilhado, os testes desses dois, e `apps/app/scripts/seed-charter.ts` (troca de fonte, sem mudar o dado gerado)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Multi-Tenant Safety (NON-NEGOTIABLE)** — PASS. A criação das cláusulas entra no mesmo bloco `withTenantDb(input.tenantId, ...)` que já existe para política/settings/membership; nenhuma query nova fora desse contexto.
- **II. Result\<T\>, não throw** — N/A para este arquivo especificamente, sem mudança de padrão: `bootstrapCharter` já é uma função do pacote `provisioning` (não uma server action) e já usa `throw new ProvisioningError(...)` para os casos de falha existentes (`TENANT_NOT_FOUND`, `USER_NOT_FOUND`); esta feature não introduz nem muda esse padrão, só adiciona uma escrita ao fluxo já existente.
- **III. Test-First (NON-NEGOTIABLE)** — aplicável; `tasks.md` ordena teste (RED) antes de implementação (GREEN) para cada mudança, seguindo o padrão já usado em `charter.test.ts`.
- **IV. Validação em Boundaries** — N/A para dado novo: o catálogo de 8 cláusulas é constante interna (não input de usuário); `tenantId` e `complianceEmail` já são validados pelo `bootstrapCharter` existente e não mudam nesta feature.
- **V. Webhook Receiver Pattern** — N/A, não é endpoint de webhook.

Nenhuma violação. Sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/011-bootstrap-clausulas-charter/
├── intent.md             # Aprovado pelo CEO em 2026-09-27
├── plan.md               # This file (/speckit-plan command output)
├── research.md           # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md   # Spec quality checklist (/speckit-specify)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

Sem `contracts/`: esta feature não expõe nem muda nenhuma interface externa
(API HTTP, evento, contrato de UI) — é uma função interna de um pacote de
biblioteca (`packages/provisioning`), chamada por processos já existentes
(contratação do back-office, seed de demonstração).

### Source Code (repository root)

```text
packages/provisioning/src/
├── charter.ts                        # bootstrapCharter — EDITAR: cria as 8 cláusulas
├── charter-clauses.ts                # NOVO — catálogo único (code, name, critical)
├── charter-rules.ts                  # NÃO EDITAR nesta feature — deriva teto a partir de CharterClause já existente
└── __tests__/
    ├── charter.test.ts               # EDITAR — novos casos de criação/idempotência das cláusulas
    └── charter-clauses.test.ts       # NOVO — formato do catálogo (8 códigos únicos, sem duplicata)

apps/app/scripts/
└── seed-charter.ts                   # EDITAR — usa CHARTER_CLAUSES do catálogo em vez do array local CLAUSES
```

**Structure Decision**: pacote de biblioteca já existente (`packages/provisioning`), sem novo serviço nem migração de banco. `CharterClause` e seu `@@unique([tenantId, code])` já existem no schema (`packages/database/prisma/schema/charter.prisma:302-317`); a mudança é só de código de aplicação. O catálogo novo (`charter-clauses.ts`) fica em `packages/provisioning` — não em `apps/app` — porque `bootstrapCharter` é quem precisa dele em produção; o seed importa de lá, invertendo a dependência atual (hoje só o seed tem os dados).

## Complexity Tracking

Sem violações da Constitution — seção não se aplica.
