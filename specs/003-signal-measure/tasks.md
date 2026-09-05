---
description: "Task list — Signal: medição de adoção e valor de IA"
---

# Tasks: Signal — medição de adoção e valor de IA

**Input**: `specs/003-signal-measure/` — [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: OBRIGATÓRIOS. Constituição, Princípio III (NÃO NEGOCIÁVEL): teste escrito → falha (RED) → implementação mínima (GREEN) → refactor. Toda tarefa `T…` de teste precede a de implementação correspondente e **deve falhar** antes de a implementação existir. Cobertura ≥ 80%.

**Organização**: por user story. Cada fase de US é um incremento entregável e testável isoladamente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos distintos, sem dependência pendente)
- **[Story]**: US1..US7, mapeando as user stories abaixo
- Todo caminho de arquivo é relativo à raiz do repositório

## User Stories (de [spec.md](./spec.md) §6 e do PRD §10)

| ID | Prioridade | História | Teste independente |
|---|---|---|---|
| **US1** | P0 | Como AI program owner, registro a iniciativa e capturo um baseline versionado e assinado, para que o ganho reportado depois seja crível | Criar iniciativa → assinar baseline v1 → ativar. Ativar sem baseline é recusado com regra nomeada |
| **US2** | P0 | Como CFO/gestora, vejo adoção e resultado juntos e o ROI com fórmula e confiança visíveis, com o veredito da iniciativa | Abrir detalhe: adoção, resultado, ROI, versão da fórmula, confiança e veredito na mesma tela |
| **US3** | P0 | Como CTO/PMO, comparo iniciativas do portfólio para priorizar o que escalar | Visão geral: KPIs agregados, matriz adoção × valor, ranking, valor em risco |
| **US4** | P1 | Como analista, conecto fontes e mapeio evento → métrica, e cada número aponta para a origem | Conectar fonte → mapear → observar → evidência rastreia até a transformação. Derrubar a fonte propaga estado |
| **US5** | P1 | Como administrador de programa, recebo alertas de adoção baixa, uso sem valor e dado parado | As três regras disparam com o quê, próximo passo e dono |
| **US6** | P1 | Como executivo, congelo e exporto um relatório board-ready | Congelar → mudar a fórmula → o relatório não muda. Congelar com fonte caída é recusado com blockers |
| **US7** | P1 | Como auditor/administrador, vejo a trilha completa e ajusto limiares do tenant | Toda mudança aparece com `de → para` e autor; mudar `valueBar` entra na trilha |

**Escopo MVP**: Fase 1 + Fase 2 + **US1 + US2** — é o menor conjunto em que o produto cumpre a regra-mãe (adoção e resultado juntos; ROI nunca sem fórmula e confiança).

---

## Phase 1: Setup (infraestrutura compartilhada)

**Objetivo**: estrutura de diretórios e ativos portados do protótipo, sem lógica.

- [X] T001 Criar a árvore de diretórios do módulo conforme plan.md: `apps/app/app/(signal)/actions/`, `apps/app/app/(signal)/signal/[[...seg]]/`, `apps/app/components/signal/screens/`, `apps/app/lib/signal/`, `apps/app/__tests__/signal/{unit,integration,e2e}/`
- [X] T002 [P] Portar os tokens CSS do `<style>` de `signal.html` para `apps/app/components/signal/signal.css` sem alterar nenhum valor (dois temas por `data-theme`, tons semânticos com `--x/--x-rgb/--x-soft/--x-text`, `.kpi`/`.wm`/`.dots`/`.sig`, `.bubble`, `.skeleton`, `.skip`, `data-contrast="high"`, `data-motion="reduced"`) — ver [contracts/ui-contract.md](./contracts/ui-contract.md) §4
- [X] T003 [P] Acrescentar os glifos do Signal ao set de ícones. **Corrigido na execução**: o set não é `ICON_PATHS` com SVG cru em `components/cosmos/icons.tsx` — é `ICONS`, lucide-backed, em `packages/design-system/cosmos/icons.tsx`. Adicionados só os que faltavam (`signal`→SignalHigh, `ruler`, `database`, `eyeOff`, `edit`→Pencil, `link2`, `list`, `box`); `flag2` não entrou porque o `flag` existente cobre o mesmo significado, e os outros 16 do handoff já existiam
- [X] T004 [P] Criar fixtures de teste em `apps/app/__tests__/signal/fixtures.ts` com os números do protótipo. **Achado**: 2 dos 8 casos do mock não fecham com as próprias listas (IN-031 aplica o desconto de atribuição de 70% duas vezes; IN-014 guarda score 86 contra fatores somando 93). As fixtures assertam os valores **derivados** e registram o headline divergente em `mockHeadline` — ver a revisão de `SignalRoiFormula` em [data-model.md](./data-model.md)

**Checkpoint**: `pnpm check` verde; nenhum comportamento novo.

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Objetivo**: banco, papéis, guards, motor de cálculo e casca. **Nenhuma user story pode começar antes desta fase terminar.**

### Banco

- [X] T005 Criar os 11 enums em `packages/database/prisma/schema/signal.prisma` (`SignalInitiativeStatus`, `SignalCategory`, `SignalConnHealth`, `SignalMappingState`, `SignalAlertKind`, `SignalAlertState`, `SignalReportState`, `SignalReportKind`, `SignalObservationSource`, `SignalRole`, `SignalRoiEntryKind`) conforme [data-model.md](./data-model.md)
- [X] T006 Criar os 15 modelos em `packages/database/prisma/schema/signal.prisma` (`SignalInitiative`, `SignalBaseline`, `SignalBaselineDimension`, `SignalConnection`, `SignalMetricMapping`, `SignalMetricObservation`, `SignalRoiFormula`, `SignalRoiEntry`, `SignalRoiAssumption`, `SignalAdoptionSnapshot`, `SignalOutcomeSnapshot`, `SignalConfidenceRule`, `SignalConfidenceScore`, `SignalAlert`, `SignalReportSnapshot`, `SignalMember`, `SignalSettings`, `SignalSequence`) com `tenantId` em todas, `@@unique` e `@@index` conforme data-model.md
- [X] T007 Back-relations em `Tenant` (18) e `User` (11, nomeadas porque a mesma pessoa aparece em dois papéis na mesma tabela) + migration `20260902090000_signal_measure` aplicada em `cosmos_dev`. **Correção**: `pnpm migrate` roda `migrate deploy`, não `db push` como o CLAUDE.md afirma — o repo trabalha com arquivos de migration. O SQL foi gerado por `prisma migrate diff --from-config-datasource` e **recortado para conter só objetos `Signal*`**: o diff bruto trazia junto drift pré-existente da base (4 tabelas do catálogo comercial sem migration própria, e dois `DROP CONSTRAINT` em `MeetingParticipant`) que não pertencem a esta feature
- [X] T008 RLS nas 18 tabelas `Signal*` — `ENABLE` + `FORCE` + policy com `USING` **e** `WITH CHECK`. Verificado no banco por asserção (falha se qualquer tabela estiver incompleta). **Correção da tarefa**: o padrão a seguir era o do **Charter** (`20260728120000_charter_module`), não o do Meridian — a migration do Meridian não tem RLS nenhuma, o que é lacuna pré-existente dele. **Ressalva**: local o app conecta como `postgres` (superuser + `bypassrls`), então as policies não são exercidas em dev — ver o completion doc
- [X] T009 [P] Seed em `packages/database/seed-signal.ts`: 9 iniciativas (as 8 do handoff + a em rascunho), 6 conexões, 8 mapeamentos, 5 alertas, 4 relatórios, baselines assinados, séries de adoção e resultado, fórmulas com componentes e premissas, fatores de confiança e sequências alinhadas. Idempotente (verificado rodando duas vezes). Semeia no tenant `cosmos-dev` existente, não cria "Vanta Saúde" novo — o banco local tem um tenant só e criar outro exigiria um usuário que não existe

### RBAC e guards

- [X] T010 [P] Escrever testes de permissão. **Corrigido na execução**: movido para `packages/rbac/src/__tests__/signal-matrix.test.ts`, onde vivem os testes de matriz do repo, importando `../signal-matrix` direto — pelo barrel `@repo/rbac` o teste arrasta os resolvers e estoura a guarda de env de servidor. Cobre cobrindo a matriz papel × permissão de [contracts/server-actions.md](./contracts/server-actions.md) (13 permissões × 4 papéis), incluindo `signal.initiative.write` restrito às próprias iniciativas para `OWNER`
- [X] T011 Implementar `packages/rbac/src/signal-matrix.ts` + `signal-resolve.ts` (dois arquivos, como Charter e Meridian, em vez do `signal.ts` único que a tarefa previa) (`getSignalRole`, `hasSignalPermission`, `signalDenialReason`, tipo `SignalPermission`) e exportá-lo em `packages/rbac/src/index.ts`
- [X] T012 Escrever testes negativos de guard em `apps/app/__tests__/signal/integration/guards.test.ts`: sem sessão → 401; tenant sem `TenantModule.SIGNAL` → 403; usuário sem `SignalMember` → 403; papel insuficiente → 403; código de outro tenant → não encontrado (nunca "sem permissão")
- [X] T013 Implementar `apps/app/lib/signal/guards.ts` (com um quinto portão que a tarefa não previa: `requireInitiativeOwnership`, porque a restrição do OWNER depende da linha e não do papel, e parar no quarto deixaria um OWNER editar iniciativa alheia) com `requireModule`, `requireSignalContext`, `requireSignalPermission`, `SignalRuleError` (422, `rule`) e `StateConflictError` (409, `blockers[]`), na ordem fixa de [research.md](./research.md) D7/D8
- [X] T014 Escrever testes em `apps/app/__tests__/signal/integration/shared.test.ts` para `nextCode` (duas criações concorrentes não colidem; falha na transação não queima número) e `buildDiff` (campo inalterado não entra no diff)
- [X] T015 Implementar `apps/app/app/(signal)/actions/_shared.ts` com `Db`, `AuditDiff`, `logSignalAudit` (transacional, `entityType: "signal.<entidade>"`), `logSystemAudit`, `buildDiff`, `nextCode` e `FIELD_LABELS` em pt-BR

### Motor de cálculo puro (test-first, sem I/O)

- [X] T016 [P] Escrever `apps/app/__tests__/signal/unit/roi.test.ts` usando as fixtures de T004: múltiplo = retornado/investido, componente com total zero, fórmula sem componente (múltiplo 0), série temporal
- [X] T017 [P] Escrever `apps/app/__tests__/signal/unit/confidence.test.ts`: soma ponderada, as quatro faixas (≥80 Alta, ≥65 Média, >0 Baixa, 0 Sem dado), fator com desconto e nota
- [X] T018 [P] Escrever `apps/app/__tests__/signal/unit/verdict.test.ts`: os quatro quadrantes contra `adoptionBar`/`valueBar`, incluindo os valores exatamente na fronteira (≥, não >)
- [X] T019 [P] Escrever `apps/app/__tests__/signal/unit/adoption.test.ts`: pct com `licensedUsers = 0` (não divide por zero), tendência
- [X] T020 [P] Escrever `apps/app/__tests__/signal/unit/outcome.test.ts`: delta % com `LOWER_IS_BETTER` e `HIGHER_IS_BETTER`, tom verde/âmbar/vermelho
- [X] T021 [P] Implementar `apps/app/lib/signal/roi.ts` — múltiplo, agregação de componentes e custos, série; devolve também o passo a passo do cálculo (TR-3)
- [X] T022 [P] Implementar `apps/app/lib/signal/confidence.ts` — score ponderado + faixa
- [X] T023 [P] Implementar `apps/app/lib/signal/verdict.ts` — `PROVEN | VANITY | PROMISE | STOP` + rótulo, tom e ação sugerida
- [X] T024 [P] Implementar `apps/app/lib/signal/adoption.ts` — pct, frequência, profundidade, tendência
- [X] T025 [P] Implementar `apps/app/lib/signal/outcome.ts`. **Achado**: o `outcome.tone` do protótipo não é reproduzível por regra (−7% ficou vermelho e −8% ficou âmbar) — era cor de narrativa, não campo calculado. Implementada uma regra declarada e defensável (piorou → vermelho; melhorou < 10% → âmbar; ≥ 10% → verde; sem número → neutro), documentada no arquivo — delta, direção, tom

### Casca, rota e navegação

- [X] T026 Escrever `apps/app/__tests__/signal/integration/shell.test.ts` para `getShellData`: badges batem com o banco (ativas, alertas, evidências, relatórios congelados, fontes não saudáveis) e o guard é aplicado
- [X] T027 Implementar `apps/app/app/(signal)/actions/shell.ts` com `getShellData()` conforme [contracts/server-actions.md](./contracts/server-actions.md)
- [X] T028 [P] Implementar `apps/app/components/signal/base.tsx` com os primitivos reusados do kit (`Eyebrow`, `StatusDot`, `LivePulse`, `Chip`, `Card`, `Avatar`, `Sparkline`) apontando para `@repo/design-system` e para os componentes já portados do Cosmos/Charter
- [X] T029 Implementar `apps/app/components/signal/shell.tsx`. **Desvio deliberado do contrato de UI**: o switcher de PERSONA não foi portado. No protótipo ele reordenava a leitura; em produção, um dropdown sem comportamento por trás é pior que a ausência dele, e um que mudasse permissão seria escalada de privilégio — mesma razão pela qual o Meridian deixou o dele de fora. O papel real aparece no topbar. Registrar em [contracts/ui-contract.md](./contracts/ui-contract.md) §3 quando a lente tiver comportamento especificado. Implementado (`"use client"`) com `SG_NAV` (4 seções, contadores e tons), `SignalSidebar` com o card de portfólio e valor em risco, `SignalTopbar` (marca, breadcrumb, busca ⌘K, chip de saúde de fontes, persona, tema, settings), `TITLES`, `ComingSoon` e o contexto de persona — recebendo `screenIds: string[]`, nunca o registry
- [X] T030 [P] Implementar `apps/app/components/signal/palette.tsx` — paleta ⌘K navegando para as 10 telas e buscando iniciativa por código e nome, com foco preso e devolução do foco ao gatilho
- [X] T031 [P] Implementar as preferências em `apps/app/components/signal/prefs.tsx` (tema fica com o `next-themes` que a plataforma já usa; o dicionário pt-BR/en-US fica para quando houver segundo idioma — hoje seria indireção sem consumidor). Implementado: `data-theme`, `data-contrast`, `data-motion` no `<html>` persistidos em `localStorage`, e o dicionário pt-BR (`SG_DICT`) com a fronteira pronta para en-US
- [X] T032 Implementar `apps/app/components/signal/screens/registry.tsx` mapeando os 10 ids de tela, inicialmente todos para `ComingSoon`
- [X] T033 Implementar `apps/app/app/(signal)/layout.tsx` com o guard (`getShellData` → `AuthError` `UNAUTHORIZED` → `/sign-in`; `FORBIDDEN` → `/signal-indisponivel`), importando o registry só aqui e passando `screenIds`
- [X] T034 Implementar `apps/app/app/(signal)/signal/[[...seg]]/page.tsx` com `seg[0]` (default `overview`), `seg[1]` como parâmetro de detalhe e `generateMetadata` devolvendo `"<title> | <parent> · Signal"`
- [X] T035 [P] Implementar `apps/app/app/signal-indisponivel/page.tsx` fora do guard, distinguindo módulo não contratado (falar com comercial) de papel ausente (pedir a um administrador)

**Checkpoint**: `/signal` carrega com as 10 telas em `ComingSoon`, navegação e contadores funcionando; tenant sem módulo cai em `/signal-indisponivel`; testes de guard e do motor puro verdes.

---

## Phase 3: US1 — Registrar iniciativa e capturar baseline (P0)

**Objetivo**: o program owner cria a iniciativa, assina o baseline e ativa.

**Teste independente**: criar `IN-01` → tentar ativar (recusado com `baseline.required`) → assinar baseline v1 com as 5 dimensões → ativar → trilha registra `DRAFT → ACTIVE`.

- [X] T036 [P] [US1] Escrever `apps/app/__tests__/signal/integration/initiatives.test.ts`: criação emite código sequencial; `DRAFT → ACTIVE` sem baseline assinado → `SignalRuleError("baseline.required")`; `→ CLOSED` sem motivo → `SignalRuleError("closure.reason.required")`; transição fora da máquina → `StateConflictError`; `OWNER` não edita iniciativa alheia; toda escrita grava `AuditLog` na mesma transação
- [X] T037 [P] [US1] Escrever `apps/app/__tests__/signal/integration/baseline.test.ts`: assinar com menos de 5 dimensões → `SignalRuleError("baseline.dimensions.incomplete")`; dimensão sem fonte declarada é rejeitada; baseline assinado é imutável (editar cria `v2`, `v1` permanece)
- [X] T038 [US1] Implementar `apps/app/app/(signal)/actions/initiatives.ts` — `listInitiatives`, `getInitiative`, `createInitiative`, `updateInitiative`, `transitionInitiative`, com Zod reusando os primitivos de `_base.ts` e a máquina de estados de [data-model.md](./data-model.md)
- [X] T039 [US1] Implementar `apps/app/app/(signal)/actions/baseline.ts` — `getBaselines`, `draftBaseline`, `signBaseline`, com versionamento e imutabilidade pós-assinatura
- [X] T040 [P] [US1] Filtros da lista. **Corrigido na execução**: nenhum `filterbar.tsx` novo — o `FilterChips` de `components/charter/base` já faz exatamente isto e é o mesmo componente do handoff. Escrever um segundo seria um segundo lugar para corrigir o mesmo bug.
- [X] T041 [US1] Implementar a tela `apps/app/components/signal/screens/initiatives.tsx` (Server Component) + `initiatives-client.tsx`: lista com código, nome, BU, categoria, status, adoção, ROI, confiança, veredito e dono; estado vazio explicando que é preciso hipótese + baseline
- [X] T042 [US1] `apps/app/components/signal/modal.tsx` — três formulários: criar/editar iniciativa, capturar+assinar baseline (5 dimensões com fonte obrigatória) e encerrar iniciativa. **Desvio**: encerrar ganhou formulário próprio em vez do `prompt()` que eu tinha usado — o motivo do encerramento é o texto que o comitê lê e que fica na trilha para sempre; caixa do navegador não tem contador, não tem rótulo e é ignorada por parte dos leitores de tela. `ModalProvider` foi para a casca (um host, não um por tela).
- [X] T043 [US1] `initiatives` registrado no `registry.tsx` + `apps/app/__tests__/signal/unit/screens-initiatives.test.tsx` — estado vazio que ensina o que é preciso ter em mãos, ordem por veredito (decisão primeiro, não alfabética), a regra-mãe na linha da lista, aviso de baseline ausente e erro da action.

**Checkpoint**: Jornada 1 de [quickstart.md](./quickstart.md), passos 1–5, passa.

---

## Phase 4: US2 — Adoção, resultado, ROI, confiança e veredito no detalhe (P0)

**Objetivo**: a tela que cumpre a regra-mãe do produto.

**Teste independente**: abrir `/signal/initiative/IN-01` e ver, na mesma tela, adoção, resultado, ROI com a versão da fórmula e o score de confiança, e o veredito com ação sugerida.

- [X] T044 [P] [US2] Escrever `apps/app/__tests__/signal/integration/roi.test.ts`: versionar sem baseline assinado → `SignalRuleError("roi.baseline.required")`; nova versão marca a anterior `SUPERSEDED` na mesma transação; `recomputeRoi` não altera versões passadas
- [X] T045 [P] [US2] Escrever `apps/app/__tests__/signal/integration/confidence.test.ts`: `sum(weight) != 100` → `SignalRuleError("confidence.weights.sum")`; `evaluateConfidence` reavalia contra o estado atual e registra a nota do desconto
- [X] T046 [P] [US2] Escrever `apps/app/__tests__/signal/integration/evidence-manual.test.ts`: `recordObservation` sem `mappingCode` e sem `transform` → `SignalRuleError("evidence.origin.required")`; entrada manual grava `recordedById` e `source: MANUAL`
- [X] T047 [US2] Implementar `apps/app/app/(signal)/actions/roi.ts` — `getRoi`, `versionRoiFormula` (componentes, custos, premissas), `recomputeRoi`
- [X] T048 [P] [US2] Implementar `apps/app/app/(signal)/actions/confidence.ts` — `getConfidence`, `evaluateConfidence`, `setConfidenceRules`
- [X] T049 [P] [US2] Implementar `apps/app/app/(signal)/actions/evidence.ts` — `listEvidence`, `getEvidence`, `recordObservation` (a parte manual; o caminho por mapeamento entra em US4)
- [X] T050 [P] [US2] `apps/app/components/signal/charts.tsx` — sparkline em SVG puro (sem biblioteca), escala relativa à própria série, régua como linha de referência, tooltip via `ChartTip` do kit e direção em texto para não depender de cor. Variantes de domínio: adoção (régua do tenant), ROI (break-even 1,0×) e resultado (lê a direção da métrica). **Ressalva**: só adoção e resultado foram ligados à tela — o ROI não tem série no modelo, e inventar uma seria fabricar dado.
- [X] T051 [US2] Implementar a tela `apps/app/components/signal/screens/initiative-detail.tsx`: hipótese, baseline assinado com dimensões e fontes, adoção (pct, ativos/licenciados, frequência, profundidade, série), resultado (primária + secundária, era → agora → Δ), ROI (componentes, custos, premissas, **versão da fórmula**), confiança (fatores com peso, obtido e nota), veredito com ação sugerida, e o bloco de encerramento quando `CLOSED`
- [X] T052 [US2] Escrever `apps/app/__tests__/signal/unit/content-rules.test.tsx` — teste normativo das 7 regras de conteúdo de [contracts/ui-contract.md](./contracts/ui-contract.md) §6: nenhuma renderização exibe múltiplo de ROI sem versão de fórmula e confiança; adoção nunca aparece sem resultado; score 0 exibe o ROI como "sem lastro" em vez de escondê-lo
- [X] T053 [US2] Registrar `initiative` no `registry.tsx` com resolução por `seg[1]` e ajustar o breadcrumb do topbar para `IN-014 · Nome`

**Checkpoint (MVP)**: Jornada 1 completa. O produto já responde à pergunta do CFO com metodologia visível.

---

## Phase 5: US3 — Portfólio e comparação (P0)

**Objetivo**: a visão executiva de entrada.

**Teste independente**: `/signal` mostra KPIs agregados, matriz adoção × valor com as iniciativas nos quadrantes corretos, ranking e valor em risco coerentes com o banco.

- [X] T054 [P] [US3] Escrever `apps/app/__tests__/signal/unit/portfolio.test.ts`: múltiplo agregado = `sum(returned)/sum(invested)`; valor em risco = soma do investido com veredito `VANITY` ou `STOP`; portfólio sem iniciativa ativa não divide por zero
- [X] T055 [US3] Implementar `getPortfolioSummary` em `apps/app/app/(signal)/actions/initiatives.ts` com agrupamento por BU, categoria e programa (FR-17)
- [X] T056 [P] [US3] Implementar `apps/app/components/signal/matrix.tsx` — matriz adoção × valor com as quatro zonas de veredito, bolhas dimensionadas pelo investido, animação `bubbleIn` e navegação para o detalhe ao clicar
- [X] T057 [US3] Implementar a tela `apps/app/components/signal/screens/overview.tsx`: KPI cards (com os efeitos `.wm`/`.dots`/`.sig` só no tema escuro), matriz, ranking por veredito, alertas recentes e narrativa de portfólio
- [X] T058 [US3] Registrar `overview` no `registry.tsx` e escrever `apps/app/__tests__/signal/unit/screens-overview.test.tsx` cobrindo portfólio vazio, populado e com valor em risco

**Checkpoint**: Jornada 1 + entrada executiva. US1–US3 entregam o V1 mínimo defensável.

---

## Phase 6: US4 — Conexões, mapeamento e evidência rastreável (P1)

**Objetivo**: todo número aponta para a origem; fonte caída propaga estado.

**Teste independente**: Jornada 2 de [quickstart.md](./quickstart.md) inteira.

- [X] T059 [P] [US4] Escrever `apps/app/__tests__/signal/unit/health.test.ts`: `> staleHours` sem sync → `STALE`; erro de auth → `DOWN`; conexão manual (`expectedFreqMinutes` nulo) nunca fica `STALE` por tempo
- [X] T060 [P] [US4] Escrever `apps/app/__tests__/signal/integration/connections.test.ts`: `recordSync(ok=false)` com erro de auth marca a conexão `DOWN`, os mapeamentos `BROKEN`, as observações abertas com `flag` + `frozenAt` e abre alerta `STALE` — **tudo na mesma transação** (falha parcial não deixa estado misto)
- [X] T061 [P] [US4] Escrever `apps/app/__tests__/signal/integration/mapping.test.ts`: `upsertMapping` cria versão nova e nunca sobrescreve; `state` deriva da saúde da fonte
- [X] T062 [US4] Implementar `apps/app/lib/signal/health.ts` — derivação de saúde e materialização do campo, conforme [research.md](./research.md) D9
- [X] T063 [US4] Implementar `apps/app/app/(signal)/actions/connections.ts` — `listConnections`, `upsertConnection`, `recordSync`, `recomputeHealth`, com credencial via `integrations-vault` (nunca segredo em claro no `config`)
  - **Correção de execução**: não existe pacote `integrations-vault` no monorepo. `upsertConnection` não aceita credencial em nenhuma forma — `config` nunca é escrito por esta action, então não há segredo em claro por construção. Quando houver conector real, a credencial entra por um caminho próprio, não por este formulário.
- [X] T064 [US4] Implementar `apps/app/app/(signal)/actions/mapping.ts` — `listMappings`, `upsertMapping`, `setMappingState`
- [X] T065 [US4] Estender `recordObservation` em `actions/evidence.ts` para o caminho por mapeamento (`source: SYNC | IMPORT`), preservando a invariante de origem rastreável
- [X] T066 [P] [US4] Implementar a tela `apps/app/components/signal/screens/connections.tsx`: fonte, saúde, último sync, frequência, o que alimenta, nº de métricas, e — quando não saudável — **o conserto e o impacto declarado** (quais métricas de quais iniciativas congelaram)
- [X] T067 [P] [US4] Implementar a tela `apps/app/components/signal/screens/mapping.tsx`: evento → métrica, transformação, unidade, versão, autor, data e estado
- [X] T068 [P] [US4] Implementar a tela `apps/app/components/signal/screens/evidence.tsx`: observações com valor, janela, conexão, mapeamento, nº de linhas, transformação e ressalva; drill-down mostrando a cadeia até a fórmula que consome o número
- [X] T069 [US4] Registrar `connections`, `mapping` e `evidence` no `registry.tsx` e ligar o chip de saúde do topbar e os contadores do sidebar aos dados reais

**Checkpoint**: Jornada 2 passa. Confiança cai quando a fonte cai — e a tela explica por quê.

---

## Phase 7: US5 — Alertas (P1)

**Objetivo**: as três regras disparam com próximo passo e dono.

**Teste independente**: forçar cada uma das três condições e ver o alerta correspondente com `what`, `nextStep` e `owner`.

- [X] T070 [P] [US5] Escrever `apps/app/__tests__/signal/integration/alerts.test.ts`: `LOW` (adoção < `lowAdoptionPct` após `lowAdoptionWeeks`), `WEAK` (adoção ≥ `adoptionBar` e ROI < `weakRoi`), `STALE` (fonte sem sync > `staleHours`); `evaluateAlerts` é idempotente (rodar duas vezes não duplica alerta aberto) e resolve o que deixou de valer
- [X] T071 [US5] Implementar `apps/app/app/(signal)/actions/alerts.ts` — `listAlerts`, `evaluateAlerts`, `setAlertState`, lendo os limiares de `SignalSettings`
  - **Nota de execução**: `computeRoi` devolve múltiplo `0` para iniciativa sem nenhuma entrada de fórmula — isso é "rascunho", não "não rende". A action traduz isso para `null` antes de chamar as regras; sem essa tradução a regra WEAK acusaria de fracasso quem ainda nem lançou a primeira linha da conta.
- [X] T072 [US5] Implementar a tela `apps/app/components/signal/screens/alerts.tsx`: fila por severidade, com a regra que disparou, o quê, próximo passo, dono e link para a iniciativa
- [X] T073 [US5] Registrar `alerts` no `registry.tsx` e ligar o contador do sidebar (tom vermelho se houver `WEAK`, âmbar caso contrário)

---

## Phase 8: US6 — Relatórios congeláveis e exportação (P1)

**Objetivo**: snapshot estruturado imutável (TR-4).

**Teste independente**: Jornada 3 de [quickstart.md](./quickstart.md).

- [X] T074 [P] [US6] Escrever `apps/app/__tests__/signal/integration/reports.test.ts`: congelar com conexão `DOWN` alimentando métrica citada → `StateConflictError("report.sources.down")` com `blockers`; após congelar, alterar a fórmula não muda o `payload`; escrever em relatório `FINAL` → `SignalRuleError("report.frozen")`
- [X] T075 [US6] Implementar `apps/app/lib/signal/report-payload.ts` — montagem do snapshot estruturado (iniciativas, adoção, resultado, ROI com versão de fórmula, confiança, veredito, evidências citadas), função pura e testável
- [X] T076 [US6] Implementar `apps/app/app/(signal)/actions/reports.ts` — `listReports`, `draftReport`, `freezeReport`, `exportReport` (sempre a partir de `payload`, nunca da tela)
- [X] T077 [US6] Implementar a tela `apps/app/components/signal/screens/reports.tsx`: lista com estado, período, autor, nº de páginas e — em rascunho bloqueado — a razão do bloqueio com as fontes a destravar
- [X] T078 [US6] Registrar `reports` no `registry.tsx` e ligar o contador do sidebar (relatórios congelados)

---

## Phase 9: US7 — Trilha de auditoria e configurações (P1)

**Objetivo**: nada muda sem rastro; limiares do tenant são decisão auditada.

**Teste independente**: alterar `valueBar` e ver a entrada na trilha com `de → para`; nenhuma action consegue atualizar ou apagar `AuditLog`.

- [X] T079 [P] [US7] Escrever `apps/app/__tests__/signal/integration/audit.test.ts`: a trilha é append-only (tentativa de `update`/`delete` falha); toda escrita das fases 3–8 aparece com `de → para`, autor e papel no momento do ato
- [X] T080 [P] [US7] Escrever `apps/app/__tests__/signal/integration/settings.test.ts`: mudar `valueBar` recalcula o veredito do portfólio e grava a trilha; `adoptionBar` fora de 0–100 é rejeitado no Zod
- [X] T081 [US7] Implementar `apps/app/app/(signal)/actions/audit.ts` — `listAudit` com filtros por entidade, período e ator
- [X] T082 [US7] Implementar `apps/app/app/(signal)/actions/settings.ts` — `getSettings`, `updateSettings`, `listMembers`, `setMemberRole`
  - **Nota de execução**: a tela de configuração também precisava LER os fatores de confiança, e só havia `setConfidenceRules`. Adicionado `listConfidenceRules` em `actions/confidence.ts`, com queda para o catálogo padrão quando o tenant nunca configurou — devolver lista vazia daria um formulário em branco cujo primeiro salvamento quebraria a soma 100.
- [X] T083 [P] [US7] Implementar a tela `apps/app/components/signal/screens/audit.tsx`: linha do tempo com quem, quando, ato, alvo, `de → para` e nota
- [X] T084 [P] [US7] Implementar a tela `apps/app/components/signal/screens/settings.tsx`: limiares de veredito e alerta, pesos dos fatores de confiança, moeda e FY, papéis dos membros, e as preferências locais (tema, contraste, movimento, idioma)
- [X] T085 [US7] Registrar `audit` e `settings` no `registry.tsx` — completando as 10 telas

---

## Phase 10: Polish e transversais

- [X] T086 [P] Escrever `apps/app/__tests__/signal/e2e/signal-journey.spec.ts` (Playwright) cobrindo as Jornadas 1, 2 e 3 de [quickstart.md](./quickstart.md) ponta a ponta
  - **Nota de execução**: escrito em `apps/app/e2e/signal-journey.spec.ts` — o `playwright.config.ts` do repositório tem `testDir: "./e2e"`, então o caminho pedido na tarefa (`__tests__/signal/e2e/`) produziria specs que o runner nunca executa. **Não executado**: precisa de dev server + banco semeado + `AUTH_TEST=1`.
- [X] T087 [P] Escrever `apps/app/__tests__/signal/e2e/signal-tenant-isolation.spec.ts` cobrindo a Jornada 4: sem sessão, sem módulo, papel insuficiente, iniciativa de outro tenant, e a prova de que trocar a persona **não** revela dado novo
  - **Nota de execução**: em `apps/app/e2e/signal-tenant-isolation.spec.ts`. O caso “trocar a persona não revela dado novo” virou o seu oposto: o switcher **não foi portado**, e o spec trava a ausência dele. **Não executado** (mesma razão de T086).
- [X] T088 [P] Escrever `apps/app/__tests__/signal/e2e/signal-a11y.spec.ts` (Jornada 5): axe sem violação nas 10 telas nos dois temas; skip link; foco visível; ⌘K com foco preso; `data-contrast="high"` remove decoração sem remover container; `data-motion="reduced"` e `prefers-reduced-motion`
  - **Nota de execução**: em `apps/app/e2e/signal-a11y.spec.ts`. **Não executado** (mesma razão de T086).
- [X] T089 Verificar cobertura: `pnpm --filter app test:coverage -- signal` ≥ 80%, com guards, motor de cálculo e congelamento de relatório acima do piso
  - **Resultado**: 25 arquivos Signal — linhas **88,0%**, statements 87,5%, funções 79,4%, branches 77,9%. Motor puro 100% (`report-payload.ts` 93,3%), guards 100%, congelamento de relatório 90,4%. Funções e branches ficaram **abaixo** do piso de 80%: o que falta é ramo de erro em `initiatives.ts` (67,5% de linhas), `evidence.ts` e `confidence.ts`.
- [ ] T090 *(não executado — exige a aplicação rodando com sessão autenticada)* [P] Medir a visão geral com 50 iniciativas semeadas e confirmar p95 < 1,5 s e detalhe < 1 s; adicionar índice se faltar
- [ ] T091 *(não executado — exige a aplicação rodando com sessão autenticada)* [P] Comparar as telas portadas com os screenshots do protótipo (`screenshots/signal-brand.png`) e corrigir divergência de token — mudança de valor exige justificativa no PR
- [X] T092 Escrever o completion doc em `.claude/completions/2026-09-02-signal-measure.md` com o que foi entregue, o que ficou para V1.5 (conectores reais, benchmarking) e as decisões revisadas durante a implementação
- [~] T093 Rodar `pnpm check && pnpm --filter app typecheck && pnpm build` e deixar tudo verde
  - `pnpm --filter app typecheck` **verde**; `pnpm --filter app build` **verde** (`/signal/[[...seg]]` e `/signal-indisponivel` no manifesto de rotas); `ultracite check` na árvore Signal **zero erro**.
  - `pnpm check` falha em 2 erros `lint/suspicious/useAwait` em `apps/api/app/webhooks/payments/route.ts` — arquivo não tocado por este trabalho.
  - `pnpm build` falha em `api#build` e `web:build` por **variável de ambiente ausente** (chaves de `@repo/auth` e `BASEHUB_TOKEN`), não por código.

---

## Dependências

```
Phase 1 (Setup)
   ↓
Phase 2 (Foundational)  ← BLOQUEIA TUDO
   ↓
Phase 3 (US1) ──→ Phase 4 (US2) ──→ Phase 5 (US3)
                      ↓
                  Phase 6 (US4) ──→ Phase 7 (US5)
                      ↓                  ↓
                  Phase 8 (US6) ←────────┘
                      ↓
                  Phase 9 (US7)
                      ↓
                  Phase 10 (Polish)
```

**Dependências duras**:
- US2 depende de US1 (não há ROI sem baseline assinado).
- US3 depende de US2 (o portfólio agrega vereditos).
- US5 depende de US4 para a regra `STALE` (as regras `LOW` e `WEAK` já funcionam com US2).
- US6 depende de US4 para o bloqueio por fonte caída.
- US7 é independente de US4–US6 na implementação, mas seus testes de trilha cobrem o que aquelas fases gravam — rodar por último dá cobertura maior.

**Independentes entre si** (podem ser feitas em paralelo por pessoas diferentes após a Fase 2): US4 e US7.

---

## Paralelismo

**Fase 1** — T002, T003 e T004 em paralelo após T001.

**Fase 2** — três frentes simultâneas depois do banco (T005–T009):
- RBAC/guards: T010 → T011 → T012 → T013 → T014 → T015
- Motor puro: T016–T020 em paralelo, depois T021–T025 em paralelo
- Casca: T026 → T027, com T028, T030, T031 e T035 em paralelo

**Fase 3** — T036 e T037 em paralelo; T040 em paralelo com T038/T039.

**Fase 4** — T044, T045 e T046 em paralelo; T048, T049 e T050 em paralelo após T047.

**Fase 6** — T059, T060 e T061 em paralelo; T066, T067 e T068 em paralelo após as actions.

**Fase 10** — T086, T087, T088, T090 e T091 em paralelo.

---

## Estratégia de entrega

| Incremento | Fases | Entrega |
|---|---|---|
| **MVP** | 1, 2, 3, 4 | Registrar iniciativa, assinar baseline, ver adoção + resultado + ROI + confiança + veredito. Cumpre a regra-mãe do produto |
| **V1 executivo** | + 5 | Visão geral com portfólio, matriz e valor em risco. É o que se mostra ao CFO |
| **V1 defensável** | + 6, 7 | Fontes, mapeamento, evidência rastreável e alertas. É o que sobrevive à contestação em comitê |
| **V1 completo** | + 8, 9, 10 | Relatório congelável e exportável, trilha e configurações. Fecha os critérios de aceite de [spec.md](./spec.md) §9 |

Cada incremento é implantável. Parar em qualquer um deles deixa o produto coerente — nunca com ROI exibido sem lastro.
