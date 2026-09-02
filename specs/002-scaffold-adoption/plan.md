# Implementation Plan: Scaffold — framework de adoção em trilhas guiadas

**Branch**: `claude/scaffold-html-impl-baa4f7` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)

**Input**: import do projeto Claude Design `691f7fe5-e623-458e-aa9f-92b8c46dbbd9`
(`scaffold.html` + `charter-base.jsx` + `cosmos-icons.jsx` + `cosmos-kit.jsx` +
os oito `scaffold-*.jsx`), com PRD v1.0 e SRD v1.0 anexados ao mesmo projeto.

---

## Summary

Portar o protótipo `scaffold.html` para um quarto produto do monorepo: route
group `(scaffold)` em `apps/app`, schema Prisma próprio, e uma fila de
supervisão cross-tenant em `apps/backoffice`.

O produto é uma **máquina de estado de gate bloqueante**. Cinco telas de
cliente — portfólio de trilhas, detalhe de trilha, casos de negócio, detalhe de
caso de negócio, biblioteca de templates — mais uma tela Nebuloz de fila de
gates. Tudo o mais existe para servir a invariante que o SRD nomeia como *o
produto*: nenhum caminho de código fecha uma fase sem critérios atendidos ou um
override atribuído.

A abordagem técnica é cópia deliberada do Meridian, que resolveu a mesma forma
de problema há um ciclo: rota única `[[...seg]]`, registry de telas em Server
Components, shell `"use client"` recebendo só as chaves, guard triplo no layout
repetido em cada action.

> ⚠️ **Uma decisão precede tudo.** Existem dois Scaffolds documentados com
> escopos incompatíveis — produto completo (design) versus ligação
> Meridian→`Engagement` (`docs/produto/scaffold-prd.md`, que diz que tratá-lo
> como produto "seria o erro mais caro possível"). Este plano assume o produto,
> por instrução explícita. Ver [`spec.md`](spec.md) § conflito e
> [`research.md`](research.md) §R1. **Se a decisão for revertida, só a Fase 1
> sobrevive.**

---

## Technical Context

**Language/Version**: TypeScript 5.9 · Next.js 15 App Router · React 19 (RSC)

**Primary Dependencies**: `@repo/auth` (`requireTenantSession`, `requireRole`),
`@repo/database` (Prisma + `withTenantDb`), `@repo/provisioning` (`platformDb`,
só no back-office), `@repo/storage` (Vercel Blob), `@repo/notifications`,
`@repo/audit` (`logAudit`), Zod 4, Inngest, shadcn/ui + Tailwind

**Storage**: PostgreSQL com RLS · Vercel Blob para artefatos

**Testing**: Vitest (unit + integration) · Playwright (e2e) · cobertura ≥ 80%

**Target Platform**: web, `apps/app` em `:3012` e `apps/backoffice` em `:3013`

**Project Type**: web application (monorepo pnpm + Turborepo)

**Performance Goals**: nenhum alvo de throughput. SRD §8: trilhas são
longevas (semanas a meses) e de baixo volume por tenant; **o sistema otimiza
correção e auditabilidade, não vazão.**

**Constraints**:
- RLS por tenant (SN-01) · artefato cifrado em repouso e logado na leitura (SN-02)
- Audit trail em toda transição, sign-off e override (SN-03)
- Fila cross-tenant expõe **só** metadado de gate (SN-06)
- WCAG 2.2 AA em toda superfície de cliente (SN-10)
- Degradação graciosa quando Charter ou Signal não estão provisionados (SRD §8)
- Residência de dado configurável (SN-04) **declarada fora do V1** — research §R6

**Scale/Scope**: 6 telas · ~18 modelos Prisma · ~28 server actions · 3 templates
seed com 4 fases cada

---

## Constitution Check

*GATE: passa antes da Fase 0. Reavaliado após a Fase 1.*

| Princípio | Como este plano atende | Status |
|---|---|---|
| **I — Multi-Tenant Safety** (non-negotiable) | Toda query por `withTenantDb`; `tenantId` sempre da sessão. A única leitura cross-tenant é a fila de supervisão, e ela foi **movida para `apps/backoffice`** justamente para não quebrar a ADR-0013 (research §R4). RLS cobre o resto. | ✅ |
| **II — `Result<T>`, não throw** | Todas as actions envelopadas por `safeAction`, retornando `Result<T>`. Audit e notificação de estagnação são fire-and-forget. | ✅ |
| **III — Test-First** (non-negotiable) | Gate engine é **Crítico** no BMAD-TEA: unit + integration + e2e + negative. A task de teste precede a de implementação em toda fatia. SC-002 é literalmente "verificado por teste automatizado". | ✅ |
| **IV — Validação em boundaries** | Zod em toda action, reusando `_base.ts`. Refinements listados em [`data-model.md`](data-model.md) §Validação. | ✅ |
| **V — Webhook receiver pattern** | Não se aplica: o Scaffold V1 não recebe webhook. A varredura de estagnação é Inngest agendado, não receiver. | n/a |
| **pnpm only** | Sim. | ✅ |
| **SAFe alignment** | Lean Portfolio Management · nível Portfolio. | ✅ |
| **Idioma** | Prosa PT-BR, termos técnicos em inglês. | ✅ |
| **Quality gates** | `biome check` → `test:coverage` ≥80% → audit → `build`. Completion doc por task. | ✅ |

**Resultado: passa.** Uma tensão arquitetural real foi encontrada (fila
cross-tenant × ADR-0013) e resolvida movendo a superfície, sem ADR novo e sem
ampliar a porta que a ADR-0013 fechou.

### Reavaliação pós-Fase 1

Sem violação nova. A Fase 1 acrescentou uma restrição própria — `closePhase()`
é a única função autorizada a escrever `state = CLOSED`, com teste de
arquitetura que falha se a string aparecer em outro arquivo. É reforço do
princípio III, não exceção a ele.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-scaffold-adoption/
├── plan.md                              # este arquivo
├── spec.md                              # derivado do PRD/SRD v1.0 do design
├── research.md                          # Fase 0 — 11 decisões
├── data-model.md                        # Fase 1 — ~18 modelos
├── quickstart.md                        # Fase 1 — validação executável
├── contracts/
│   ├── server-actions.md                # ~28 actions, erros nomeados
│   └── signal-baseline-export.md        # S-06 / SC-004
└── tasks.md                             # /speckit-tasks — NÃO criado aqui
```

### Source Code (repository root)

```text
packages/database/prisma/schema/
├── scaffold.prisma                      # novo — ~18 modelos, 11 enums
└── modules.prisma                       # editado — ProductModule += SCAFFOLD

apps/app/
├── app/(scaffold)/
│   ├── layout.tsx                       # guard: sessão → módulo → papel
│   ├── scaffold/[[...seg]]/page.tsx     # rota única + generateMetadata
│   └── actions/
│       ├── _shared.ts                   # guard triplo reutilizado
│       ├── shell.ts                     # getShellData + badges
│       ├── tracks.ts                    # S-01, S-07
│       ├── steps.ts                     # S-04, artefatos
│       ├── gates.ts                     # SG-01..08  ← o núcleo
│       ├── business-case.ts             # S-06, SG-04
│       ├── templates.ts                 # S-05, ST-01..04
│       └── export.ts                    # contrato Signal
├── app/scaffold-indisponivel/page.tsx   # módulo não contratado
├── components/scaffold/
│   ├── scaffold.css                     # tokens do design (paleta Nebuloz)
│   ├── shell.tsx                        # "use client" — sidebar, topbar, TITLES
│   └── screens/
│       ├── registry.ts                  # SCREENS: id → Server Component
│       ├── portfolio.tsx                # scaffold-screens-1.jsx
│       ├── track-detail.tsx             # scaffold-screens-1/2.jsx
│       ├── baselines.tsx                # scaffold-screens-baseline.jsx
│       ├── baseline-detail.tsx          # scaffold-baseline.jsx
│       └── templates.tsx                # scaffold-screens-3.jsx
├── lib/scaffold/
│   ├── gate-machine.ts                  # transições puras, testáveis sem DB
│   ├── overlay-merge.ts                 # ops + detecção de conflito (R9)
│   └── business-case-hash.ts            # contentHash
├── lib/inngest/scaffold-stall.ts        # S-09 / SN-07
└── __tests__/scaffold/
    ├── gate-machine.test.ts             # unit — a máquina, sem DB
    ├── gates-negative.test.ts           # ← a suíte que prova o produto
    ├── gates-architecture.test.ts       # falha se CLOSED escrito fora de closePhase
    ├── overlay-merge.test.ts            # ST-02, conflito Vanta v3→v4
    ├── business-case.test.ts            # imutabilidade, contestação
    ├── signal-export.test.ts            # SC-004
    └── tenant-isolation.test.ts         # SC-005

apps/backoffice/
└── app/scaffold-supervision/            # S-08 / SN-06 — platformDb (ADR-0013)
    ├── page.tsx
    └── actions.ts                       # listGateQueue, enterTenantContext

apps/app/e2e/
└── scaffold-track-lifecycle.spec.ts     # SC-001: gap → Embed sem engenharia
```

**Structure Decision**: espelho literal do Meridian
(`apps/app/app/(meridian)/` + `components/meridian/` + `lib/meridian/` +
`__tests__/meridian/`), com a **única** divergência sendo a fila de supervisão
em `apps/backoffice`. Essa divergência não é preferência de layout: é o que a
ADR-0013 exige, porque `apps/app` não pode importar `platformDb` e um teste de
fronteira já falha se importar.

---

## Faseamento da entrega

Ordem por dependência, não por tela. Cada fase é entregável e testável sozinha.

| # | Fatia | Entrega | Requisitos | Depende de |
|---|---|---|---|---|
| **1** | **Ligação Meridian → trilha** | `scaffold.prisma` mínimo (`Track`, `PhaseInstance`, `StepInstance`, `Membership`), `ProductModule += SCAFFOLD`, migration, `createTrackFromGap`, `MeridianGapPromotion.targetEntityId` preenchido | S-01 | — |
| **2** | **Gate engine** | `gate-machine.ts`, `gates.ts`, `GateResult`, `GateOverride`, suíte negativa completa, teste de arquitetura | S-02, S-03, SG-01..03, SG-07 | 1 |
| **3** | **Shell + portfólio + detalhe de trilha** | layout com guard, rota única, registry, shell, duas telas, `scaffold.css` | S-04, S-07 | 2 |
| **4** | **Caso de negócio** | modelos versionados, máquina `draft→awaiting→signed`, contestação, `contentHash`, duas telas, SG-04 ligado ao `closePhase` | S-06, SG-04 | 2, 3 |
| **5** | **Templates** | versões imutáveis, overlays como ops, detecção de conflito, tela | S-05, S-12, ST-01..04 | 3 |
| **6** | **Supervisão + estagnação** | fila em `apps/backoffice`, `AccessLog` na travessia, cron Inngest, badges | S-08, S-09, SN-06, SN-07, SG-08 | 3 |
| **7** | **Charter + observação + export** | vínculo de política na Fase 3, janela de 30 dias, `exportBusinessCase` | S-11, SG-05, SG-06 | 4, 5 |
| **8** | **Handover pack** | export ZIP auto-contido | S-10, SN-09 | 7 |

**Fatia mínima defensável** (se a decisão R1 apertar o escopo): **1 + 2**. Ela
entrega a ligação que o PRD do repositório pede e, ainda assim, a invariante que
faz o produto valer.

---

## Riscos

| Risco | Mitigação |
|---|---|
| **R1 revertida depois da Fase 3** | Fases 1–2 sobrevivem intactas; 3+ vira trabalho perdido. **Confirmar antes de `/speckit-tasks`.** |
| Gate vira formalidade waivable | A suíte negativa e o teste de arquitetura são a defesa, e não são opcionais |
| Overlay de template vira fork | `ops` como lista, nunca cópia de árvore (R9); ST-01 sustentado pela ausência de `updatedAt` |
| Fila de supervisão vaza dado de cliente | `QueueEntry` tem shape fechado e testado; artefato exige `enterTenantContext` logado |
| Signal inexistente vira bloqueio | Só o contrato de saída é implementado; a UI degrada para "aguardando promessa" (R10) |
| Escopo de 6 telas engolir o ciclo | Faseamento acima; 1–2 entregam valor sem nenhuma tela nova |

---

## Complexity Tracking

Nenhuma violação de constituição a justificar. Duas complexidades **deliberadas**,
registradas para quem revisar:

| Complexidade | Por que é necessária | Alternativa simples rejeitada porque |
|---|---|---|
| Produto separado em dois apps (`apps/app` + `apps/backoffice`) | ADR-0013 proíbe `apps/app` importar `platformDb`, e a fila de supervisão é inerentemente cross-tenant | Tudo em `apps/app` quebraria o teste de fronteira da ADR-0013; ampliar a porta é barato agora e caro na primeira auditoria |
| Caso de negócio versionado em vez de tabela plana de baseline | Confiança por métrica (`measured`/`estimated`/`declared`) é o que torna a contestação do patrocinador representável — e contestação é um estado real do produto | O `baseline` plano do SRD §3 tem três métricas fixas e não descreve "laudos dentro da janela de plantio"; achatar perde o mecanismo (research §R3) |

---

## Próximo passo

`/speckit-tasks` — **depois** de confirmar R1. As telas ainda não lidas do
projeto de design (`scaffold-screens-1/2/3.jsx`, `scaffold-screens-baseline.jsx`)
são a referência de render a consumir naquele momento, por fatia; puxá-las agora
encheria o contexto de JSX sem mudar nenhuma decisão deste plano.
