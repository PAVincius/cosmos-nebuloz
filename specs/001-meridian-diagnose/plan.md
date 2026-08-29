# Implementation Plan: Meridian V1 · Diagnose

**Branch**: `claude/meridian-design-impl-70bdd2` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-meridian-diagnose/spec.md`

## Summary

Meridian é o quarto módulo contratável da suíte (depois de Cosmos, Charter e Signal): diagnóstico de prontidão para IA em cinco eixos, com coleta multi-respondente, scoring determinístico, revisão humana auditável, registro canônico de gaps e benchmark anônimo.

A abordagem é portar o handoff de design (`meridian.html` + `meridian-*.jsx` + `nebuloz-seams.jsx`) para o mesmo padrão arquitetural que o Charter já estabeleceu no repositório: grupo de rotas próprio com guard de três portões, rota única com registry de telas, casca client-side, telas como Server Components, actions retornando `Result<T>`, e um schema Prisma dedicado com auditoria no `AuditLog` existente.

Nada de novo em infraestrutura. O único trabalho genuinamente novo é o domínio: motor de scoring determinístico, grafo acíclico de gaps com ordenação topológica, e agregação de coortes com limiar de leitura.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 15 (App Router), React 19

**Primary Dependencies**: `@repo/database` (Prisma + PostgreSQL, `withTenantDb`), `@repo/auth/server` (`requireTenantSession`), `@repo/rbac` (`hasModule`, matriz de papéis), `@repo/design-system/cosmos/kit` + `/cosmos/icons` (primitivas visuais compartilhadas), `@repo/observability/log`, Zod

**Storage**: PostgreSQL via Prisma (schema `meridian.prisma`); evidências em object storage segregado por tenant — mesmo provedor já usado pelo repositório, referência guardada no banco

**Testing**: Vitest (unit + action, `apps/app/__tests__/`), Playwright (E2E, `apps/app/e2e/`)

**Target Platform**: Web (app de tenant, `apps/app`, porta 3012)

**Project Type**: Web application — monorepo pnpm + Turborepo

**Performance Goals**: carteira e registro de gaps abaixo de 2s com 200 assessments / 2.000 gaps (SC-010); scoring de um assessment em uma transação

**Constraints**: multi-tenant estrito (RLS + `tenantId` em toda query); registro de override e trilha de auditoria append-only; scoring determinístico e reproduzível

**Scale/Scope**: 9 telas (7 de nav + detalhe com 5 abas + visão do respondente), 13 modelos Prisma, ~9 arquivos de action

## Constitution Check

*GATE: verificado antes da Phase 0 e revalidado após a Phase 1.*

| Princípio | Como este plano atende | Status |
|-----------|------------------------|--------|
| I. Multi-Tenant Safety | Todo entry point começa por `requireMeridianContext()` → `requireTenantSession` → `requireModule("MERIDIAN")` → papel. Toda leitura passa por `withTenantDb(ctx.tenantId, …)` com `tenantId` explícito no `where`. A rota do respondente é a única sem sessão e resolve o tenant **a partir do token**, nunca do request. | PASS |
| II. Result\<T\>, não throw | Toda server action retorna `Result<T>` via `safeAction()` de `app/actions/_base.ts`. Auditoria de escrita participa da transação (evidência não pode faltar); telemetria de leitura é fire-and-forget. | PASS |
| III. Test-First | `tasks.md` ordena teste antes de implementação em cada slice. Motor de scoring, detecção de ciclo, ordenação topológica e limiar de coorte nascem de teste — são as quatro regras onde erro é silencioso. | PASS |
| IV. Validação em Boundaries | Zod em todo input de action, reusando `nnStr`, `optStr`, `cuid`, `isoDate` de `_base.ts`. Token do respondente validado antes de qualquer query. | PASS |
| V. Webhook Receiver Pattern | Não se aplica — Meridian V1 não expõe webhook. | N/A |
| SAFe alignment | Competência: *Lean Portfolio Management* (avaliação de prontidão que alimenta o funil de portfólio). Nível: *Portfolio*. | PASS |
| Idioma | Prosa e UI em PT-BR; identificadores e termos técnicos em inglês, igual ao Charter. | PASS |
| Gate de teste risk-based | **Crítico**: guard de tenant, token do respondente, override append-only → unit + integration + e2e + negativo. **Alto**: scoring, grafo de gaps, plano, limiar de coorte → unit + integration ≥80%. **Médio**: telas → component. **Baixo**: escala de confiança (tela estática) → smoke. | PASS |

**Complexidade a justificar**: nenhuma. Ver Complexity Tracking.

**Re-avaliação pós-Phase 1**: PASS — o data model não introduziu tabela sem `tenantId`, nem escrita fora de `withTenantDb`, nem estado derivado persistido sem invalidação explícita.

## Project Structure

### Documentation (this feature)

```text
specs/001-meridian-diagnose/
├── spec.md
├── plan.md              # este arquivo
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── actions.md       # contrato das server actions
│   └── plan-export.md   # contrato do export legível por máquina
├── checklists/
│   └── requirements.md
└── tasks.md             # criado por /speckit-tasks
```

### Source Code (repository root)

```text
packages/database/prisma/schema/
├── meridian.prisma                     # NOVO — 13 modelos + 11 enums
├── modules.prisma                      # ALTERADO — ProductModule += MERIDIAN
└── tenant.prisma                       # ALTERADO — relações do Tenant com os modelos Meridian

packages/rbac/src/
├── meridian-matrix.ts                  # NOVO — MeridianPermission × MeridianRole
├── meridian-resolve.ts                 # NOVO — getMeridianRole + cache
└── index.ts                            # ALTERADO — re-export

packages/design-system/cosmos/
└── icons.tsx                           # ALTERADO — +crosshair, +diff, +outbound

apps/app/lib/meridian/
├── guards.ts                           # sessão → módulo → papel; erros nomeados
├── axes.ts                             # os cinco eixos, rótulos, ícones, ordem canônica
├── scoring.ts                          # motor determinístico: score, confidence, dispersão
├── graph.ts                            # DAG de gaps: validação de ciclo, ordenação topológica
├── plan.ts                             # ordenação topológica → trimestres
├── benchmark.ts                        # coorte, percentis, limiar de leitura
└── respondent-token.ts                 # emissão e validação do token de link seguro

apps/app/app/(meridian)/
├── layout.tsx                          # guard + casca
├── meridian/[[...seg]]/page.tsx        # rota única + generateMetadata
├── responder/[token]/page.tsx          # visão do respondente, fora do guard de sessão
└── actions/
    ├── _shared.ts                      # Db, AuditDiff, MeridianEntity, logMeridianAudit
    ├── shell.ts                        # dados da casca (badges, org, papel)
    ├── assessments.ts                  # CRUD de assessment, carteira, detalhe
    ├── collection.ts                   # respondentes, convites, lembretes, fechar coleta
    ├── scoring.ts                      # executar scoring, fila de revisão
    ├── overrides.ts                    # registrar override (append-only)
    ├── gaps.ts                         # gap register, dependências, promoção
    ├── plan.ts                         # gerar plano, exportar JSON
    ├── benchmark.ts                    # pool, coortes, contribuição
    ├── report.ts                       # relatório, diff de reavaliação
    └── respondent.ts                   # actions do link seguro (sem sessão)

apps/app/components/meridian/
├── meridian.css                        # tokens + primitivas reescopadas em .meridian-root
├── shell.tsx                           # topbar + sidebar + modal host + toasts ("use client")
├── base.tsx                            # re-export das primitivas do Charter + primitivas próprias
├── charts.tsx                          # ScoreRing, Radar, BenchBand
├── seams.tsx                           # ConfPill, InheritedFrom, AwaitingUpstream (fronteira entre produtos)
├── modals.tsx                          # OverrideModal, GapDetail, ReassessDiffModal
└── screens/
    ├── registry.tsx
    ├── assessments.tsx
    ├── assessment-detail.tsx           # Server Component: carrega dados e escolhe a aba
    ├── assessment-detail-client.tsx    # abas
    ├── tab-coleta.tsx
    ├── tab-scoring.tsx
    ├── tab-gaps.tsx
    ├── tab-plano.tsx
    ├── tab-relatorio.tsx
    ├── queue.tsx
    ├── benchmark.tsx
    ├── gap-register.tsx
    ├── confidence-scale.tsx
    └── respondent.tsx

apps/app/__tests__/
├── lib/meridian-scoring.test.ts
├── lib/meridian-graph.test.ts
├── lib/meridian-plan.test.ts
├── lib/meridian-benchmark.test.ts
├── lib/meridian-respondent-token.test.ts
├── actions/meridian/assessments.test.ts
├── actions/meridian/collection.test.ts
├── actions/meridian/overrides.test.ts
├── actions/meridian/gaps.test.ts
└── screens/meridian.test.tsx

apps/app/e2e/
└── meridian-diagnose.spec.ts
```

**Structure Decision**: grupo de rotas `(meridian)` dentro de `apps/app`, irmão de `(cosmos)` e `(charter)`. A escolha não é estética: o guard de módulo, a sessão de tenant, o `AuditLog` e o kit visual já vivem ali, e Meridian é um módulo contratável pelo mesmo tenant que contrata os outros — um app separado exigiria duplicar sessão, RBAC e auditoria para ganhar nada.

A visão do respondente é a única exceção estrutural: fica em `app/(meridian)/responder/[token]`, fora do layout com guard, porque o respondente não tem conta na plataforma. O tenant é resolvido do token, nunca do request.

## Complexity Tracking

Sem violações da constituição. Três decisões que parecem complexidade e não são, registradas para não serem "simplificadas" depois:

| Decisão | Por que não é complexidade gratuita |
|---------|-------------------------------------|
| `meridian.css` como cópia reescopada de `charter.css` | O repositório já paga esse preço uma vez (charter.css é cópia reescopada do cosmos.css) porque as primitivas do kit compartilhado dependem de nomes de classe escopados por raiz. Reusar `.charter-root` numa tela do Meridian resolveria o CSS e mentiria no DOM. |
| Papel próprio (`MeridianRole`) em vez de reusar `MemberRole` | Mesma razão do Charter: um admin de plataforma que contorna o papel de consultor invalida a trilha. Quem decide override precisa ser nomeável. |
| Tabela de override separada do score de eixo | Append-only exige linha própria com `from`/`to`/`rationale`/autor. Guardar o override como coluna do score apagaria o computado — que é exatamente o que a auditoria precisa ler. |
