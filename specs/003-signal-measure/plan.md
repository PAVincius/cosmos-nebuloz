# Implementation Plan: Signal — medição de adoção e valor de IA

**Branch**: `claude/signal-html-implementation-636f46` | **Data**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/003-signal-measure/spec.md` · design `signal.html` (Claude Design `691f7fe5`) · PRD `uploads/signal-prd-detailed.md`

## Summary

Portar o produto **Signal** do protótipo React-in-browser para o monorepo, como quarto módulo da plataforma (`ProductModule.SIGNAL`, já no enum). 10 telas, 15 entidades novas, 4 papéis, motor de cálculo puro (ROI, confiança, veredito).

A abordagem técnica é **imitação deliberada do Meridian**: mesmo route group com rota única `[[...seg]]`, mesmo guard em quatro camadas, mesmo `_shared.ts` de auditoria transacional, mesma `nextCode()` para códigos legíveis, mesma fronteira Server/Client (registry só no layout, `screenIds` cruzando como strings). O que é próprio do Signal é o domínio: baseline versionado e assinado, fórmula de ROI versionada com componentes/premissas visíveis, score de confiança ponderado, veredito por cruzamento adoção × valor, e relatório congelável.

Duas regras do produto governam o desenho inteiro: **adoção e resultado moram juntos** e **ROI nunca aparece sem fórmula e confiança**. Elas viram invariantes de contrato (`contracts/ui-contract.md` §6), não recomendação de estilo.

## Technical Context

**Language/Version**: TypeScript 5.9 · Node 24 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 19, Prisma, Zod, `@repo/auth`, `@repo/rbac`, `@repo/database`, `@repo/design-system`
**Storage**: PostgreSQL via Prisma; schema novo em `packages/database/prisma/schema/signal.prisma`; RLS por `tenantId`
**Testing**: Vitest (unit/integration) · Playwright (E2E) · axe (a11y)
**Target Platform**: Web, `apps/app` na porta 3012
**Project Type**: Web application (monorepo pnpm + Turborepo)
**Performance Goals**: visão geral < 1,5 s p95 com 50 iniciativas (FR-15/TR-5, "rápido para uso executivo"); detalhe < 1 s
**Constraints**: multi-tenant estrito; auditoria na mesma transação da escrita; nenhum conector de fonte hardcoded (TR-1); relatório congelado imutável (TR-4)
**Scale/Scope**: 10 telas · 15 modelos Prisma · ~30 server actions · 4 papéis · até ~200 iniciativas/tenant

## Constitution Check

*GATE: passa antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Conformidade |
|---|---|
| **I · Multi-Tenant Safety** | ✅ `requireSignalContext()` inicia toda entrada (layout, page, action); `withTenantDb(ctx.tenantId)` em toda query; `tenantId` nunca vem do body. Testes negativos cross-tenant são obrigatórios (D11, classe Crítico). |
| **II · Result\<T\>, não throw** | ✅ Toda action devolve `Result<T>`. Auditoria **não** é fire-and-forget aqui: é evidência, e roda na mesma transação (research D5). |
| **III · Test-First** | ✅ Ordem imposta em `tasks.md`: teste antes de implementação em cada bloco. Motor de cálculo puro é o primeiro alvo — os quatro quadrantes de veredito e as faixas de confiança são testáveis sem banco. Cobertura ≥ 80%. |
| **IV · Validação em boundaries** | ✅ Zod em toda action, reusando `nnStr`, `optStr`, `cuid`, `isoDate` de `_base.ts`. Nenhum primitivo duplicado. |
| **V · Webhook Receiver Pattern** | ⚪ N/A no V1 — nenhuma rota `/api/webhooks/*`. Quando conector real chegar, `recordSync` passa a ser consumido por webhook e o padrão de cinco etapas se aplica integralmente. |
| **pnpm only** | ✅ |
| **SAFe alignment** | ✅ Competência **Lean Portfolio Management** · nível **Portfolio** — Signal mede retorno de investimento de iniciativa, que é a decisão de portfólio. |
| **Idioma** | ✅ Prosa PT-BR, termos técnicos em inglês. |
| **Gate risk-based** | ✅ Classificado em research D11: guards e isolamento = Crítico; cálculo, congelamento e trilha = Alto; telas = Médio; paleta/preferências = Baixo. |

**Complexity Tracking**: nenhuma violação a justificar. As 15 tabelas parecem muitas para uma feature, mas são o modelo mínimo do PRD §12 sem sobreposição: cada uma existe porque um requisito funcional a nomeia. A duplicação consciente de `logSignalAudit`/`nextCode` em relação ao Meridian está registrada em research D5 com o trade-off aceito.

## Project Structure

### Documentation (this feature)

```text
specs/003-signal-measure/
├── plan.md              # este arquivo
├── spec.md              # especificação da feature
├── research.md          # Fase 0 — 11 decisões
├── data-model.md        # Fase 1 — 15 entidades + invariantes
├── quickstart.md        # Fase 1 — validação executável
├── contracts/
│   ├── server-actions.md   # ~30 actions, permissões, erros
│   └── ui-contract.md      # rotas, nav, tokens, a11y, regras de conteúdo
└── tasks.md             # Fase 2 — /speckit-tasks (NÃO criado aqui)
```

### Source Code (repository root)

```text
packages/database/prisma/
├── schema/signal.prisma                    # NOVO — 15 modelos + 11 enums
└── migrations/<ts>_signal_measure/         # NOVO

packages/rbac/src/
└── signal.ts                               # NOVO — getSignalRole, hasSignalPermission, signalDenialReason

apps/app/lib/signal/                        # NOVO — motor puro, sem I/O
├── guards.ts          # requireSignalContext, requireSignalPermission, SignalRuleError, StateConflictError
├── roi.ts             # múltiplo, componentes, séries
├── confidence.ts      # score ponderado + faixa
├── verdict.ts         # cruzamento adoção × valor
├── adoption.ts        # % , tendência
├── outcome.ts         # delta, direção, tom
├── health.ts          # derivação de saúde de conexão
└── report-payload.ts  # snapshot estruturado do relatório

apps/app/app/(signal)/                      # NOVO
├── layout.tsx                              # guard + SignalShell + screenIds
├── signal/[[...seg]]/page.tsx              # rota única + generateMetadata
└── actions/
    ├── _shared.ts     # Db, AuditDiff, logSignalAudit, buildDiff, nextCode, FIELD_LABELS
    ├── shell.ts  initiatives.ts  baseline.ts  connections.ts  mapping.ts
    ├── evidence.ts  roi.ts  confidence.ts  alerts.ts  reports.ts
    ├── settings.ts  audit.ts

apps/app/app/signal-indisponivel/page.tsx   # NOVO — fora do guard

apps/app/components/signal/                 # NOVO
├── shell.tsx          # "use client" — sidebar, topbar, persona, ⌘K, prefs, TITLES, ComingSoon
├── signal.css         # tokens portados de signal.html sem alteração de valor
├── base.tsx  charts.tsx  matrix.tsx  filterbar.tsx  palette.tsx  modal.tsx
└── screens/
    ├── registry.tsx
    ├── overview.tsx  initiatives.tsx  alerts.tsx  initiative-detail.tsx
    ├── evidence.tsx  audit.tsx  reports.tsx
    ├── connections.tsx  mapping.tsx  settings.tsx

apps/app/__tests__/signal/                  # NOVO
├── unit/         roi · confidence · verdict · adoption · health · report-payload
├── integration/  actions com banco (guards, transições, congelamento, trilha)
└── e2e/          jornada completa (Playwright)
```

## Phase 0 — Research

Concluída. `research.md` resolve 11 pontos: adoção do formato de produto (D1), fronteira server/client (D2), derivado vs. congelado (D3), motor de cálculo puro (D4), auditoria transacional (D5), sequências atômicas (D6), papéis e a distinção persona ≠ permissão (D7), taxonomia de erro 403/409/422 (D8), ingestão sem conector hardcoded (D9), preferências locais vs. limiares do tenant (D10), estratégia de teste risk-based (D11).

Nenhum `NEEDS CLARIFICATION` remanescente no Technical Context. As quatro perguntas abertas do PRD (§18) têm encaminhamento decidido para o V1 em `spec.md` §10 — não bloqueiam implementação.

## Phase 1 — Design & Contracts

Concluída:

- **[data-model.md](./data-model.md)** — 15 entidades, 11 enums, relações, máquina de estados da iniciativa e 8 invariantes. Veredito e múltiplo de ROI ficam **fora** do banco por decisão explícita (D3).
- **[contracts/server-actions.md](./contracts/server-actions.md)** — ~30 actions em 12 arquivos, com permissão, entrada, saída, regras de negócio e erro esperado; matriz papel × permissão fechada.
- **[contracts/ui-contract.md](./contracts/ui-contract.md)** — rotas, navegação com contadores e tons, sistema visual, piso de acessibilidade, 7 regras de conteúdo e estados.
- **[quickstart.md](./quickstart.md)** — jornada executável que prova a feature ponta a ponta.

**Re-check da constituição pós-design**: sem violação nova. O contrato de actions repete o guard em todas as ~30 entradas (I), devolve `Result<T>` em todas (II), define Zod por action (IV), e a ordenação test-first está declarada como pré-condição do `tasks.md` (III).

**Agent context**: seção Spec Kit do `CLAUDE.md` apontada para este plano.

## Phase 2 — Sequência de implementação (visão; tarefas em `/speckit-tasks`)

Sete blocos, cada um verificável isoladamente:

| # | Bloco | Verificação |
|---|---|---|
| 1 | Schema `signal.prisma` + migration + `SignalRole` no RBAC | `pnpm migrate` limpo; RLS ativa; enum exportado |
| 2 | Motor puro (`lib/signal/*`) — **teste primeiro** | unit ≥ 80%: 4 quadrantes de veredito, 4 faixas de confiança, ROI com componente zerado, derivação de saúde |
| 3 | Guards + `_shared.ts` — **teste primeiro** | negativos: sem sessão (401), sem módulo (403), papel insuficiente (403), cross-tenant (não vaza) |
| 4 | Actions por domínio, na ordem iniciativa → baseline → conexão → mapeamento → evidência → ROI → confiança → alerta → relatório → settings | integration por action: caminho feliz + regra violada (422) + conflito (409) + trilha gravada |
| 5 | Shell + rota + registry + `signal-indisponivel` | navegação nas 10 telas; `<title>` correto; módulo ausente redireciona |
| 6 | Telas, das mais simples às mais densas: `settings` → `audit` → `evidence` → `mapping` → `connections` → `reports` → `alerts` → `initiatives` → `initiative` → `overview` | component tests; axe sem violação; contadores do sidebar batendo com o banco |
| 7 | E2E da jornada + relatório congelado + fonte caída | `quickstart.md` passa integralmente |

Dependência dura: **1 → 2 → 3 → 4 → (5,6) → 7**. Dentro de 4 e 6 há paralelismo por domínio/tela.

## Riscos

| Risco | Mitigação |
|---|---|
| 15 tabelas numa migration só | Migration única mas revisada modelo a modelo contra `data-model.md`; seed de demonstração (tenant Vanta Saúde do protótipo) valida as relações antes de qualquer tela existir |
| Cálculo divergir do protótipo | Fixtures dos testes unitários usam os números literais de `signal-data.jsx` (IN-014 → 4,2× e confiança 86; IN-021 → 0,9× e 64; IN-027 → 0,6× e 52). Divergência é falha de teste, não ajuste de expectativa |
| Regressão visual na porta dos tokens | `signal.css` copia os valores do `<style>` de `signal.html` sem edição; qualquer mudança de valor exige justificativa no PR |
| Confundir persona com papel | Explicitado em research D7 e no contrato de UI; teste negativo garante que trocar persona não amplia leitura |
| Escopo do overview (tela mais densa) | Deixada por último na ordem de telas, quando todas as actions já existem e estão testadas |
