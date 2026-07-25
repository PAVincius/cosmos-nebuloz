# COSMOS — Screen Manifest (Re-skin Porting Contract)

Fonte de design (vanilla JS prototype): `~/Downloads/cosmos-app/design_handoff_cosmos_platform/prototype/`
Alvo (Next.js App Router): `apps/app/app/(authenticated)/`
Specs: `design_handoff_cosmos_platform/screens/*.md` + `DESIGN.md`

O protótipo é um SPA de hash-route. `app.js` tem `ROUTER` (hash → render fn) e `NAV` (5 grupos). Cada render fn retorna `{crumbs, phRgb, head, body}`. Modais são overlays (`.ov` / `.modal`), não rotas.

---

## Tabela-resumo

| # | Tela | Hash route | Render fn (arquivo) | Rota apps/app | Complex. |
|---|------|-----------|---------------------|---------------|----------|
| 1 | Visão Geral (Dashboard multi-persona) | `#/dashboard` | `screenDashboard` (screens-personas.js) | `dashboard/page.tsx` (+ root `page.tsx`) | Alta |
| 2 | Épicos (Portfolio Kanban) | `#/epics` | `screenEpicsKanban` (screens-kanban.js) | `portfolio/page.tsx` | Alta |
| 3 | WSJF | `#/wsjf` | `screenWsjf` (screens-portfolio.js) | `portfolio/wsjf/page.tsx` | Média |
| 4 | OKRs | `#/okrs` | `screenOkrs` (screens-portfolio.js) | `portfolio/okrs/page.tsx` | Baixa |
| 5 | Strategy Map | `#/strategy` | `screenStrategyMap` (screens-analytics.js) | `portfolio/strategy-map/page.tsx` | Alta |
| 6 | Roadmap | `#/roadmap` | `screenRoadmap` (screens-cross.js) | `portfolio/roadmap/page.tsx` | Média |
| 7 | Governance | `#/governance` | `screenGovernance` (screens-gov.js) | `portfolio/governance/page.tsx` | Baixa |
| 8 | Lean Budget / Budget Flow | `#/budget` (`?artId=` via `budget/ART-x`) | `screenBudget` (screens-cross.js) | `portfolio/budgets/page.tsx` | Alta |
| 9 | Anomalies | `#/anomalies` | `screenAnomalies` (screens-admin.js) | `portfolio/budgets/anomalies/page.tsx` | Baixa |
| 10 | ARTs (ART Detail) | `#/art/ART-PAY` | `screenArt` (screens-entity.js) | `arts/[artId]/page.tsx` | Alta |
| 11 | PI Planning (detail, 4 tabs) | `#/pi/PI-2026-Q2/{tab}` | `screenPi` (screens-entity.js) | `arts/[artId]/pi-planning/page.tsx` (+ `pi-planning/page.tsx`) | Alta |
| 12 | Solution Trains | `#/solutions` | `screenSolutionTrains` (screens-analytics.js) | `solution-trains/page.tsx` | Baixa |
| 13 | Histórico | `#/history` | `screenHistory` (screens-admin.js) | **SEM ROTA** | Média |
| 14 | Dependencies | `#/deps` | `screenDeps` (screens-cross.js) | `dependencies/page.tsx` | Alta |
| 15 | Risks (ROAM board) | `#/risks` | `screenRisks` (screens-team.js) | `risks/page.tsx` | Média |
| 16 | Flow Metrics | `#/flow` | `screenFlow` (screens-analytics.js) | `analytics/flow/page.tsx` | Média |
| 17 | Velocity | `#/velocity` | `screenVelocity` (screens-analytics.js) | `analytics/velocity/page.tsx` | Média |
| 18 | Measure & Grow (Maturity) | `#/maturity` | `screenMaturity` (screens-analytics.js) | `analytics/measure-grow/page.tsx` | Média |
| 19 | Teams | `#/teams` | `screenTeams` (screens-team.js) | `teams/page.tsx` | Baixa |
| 20 | Copilot | `#/copilot` | `screenCopilot` (screens-admin.js) | `copilot/page.tsx` | Média |
| 21 | Workflows | `#/workflows` | `screenWorkflows` (screens-admin.js) | `workflows/page.tsx` (+ `workflows/[teamId]/bpmn`) | Média |
| 22 | Integrações | `#/integrations` | `screenIntegrations` (screens-admin.js) | `integrations/page.tsx` (+ `settings/integrations`) | Baixa |
| 23 | Members | `#/members` | `screenMembers` (screens-admin.js) | `settings/members/page.tsx` | Baixa |
| 24 | Audit Log | `#/audit` | `screenAudit` (screens-admin.js) | `settings/audit/page.tsx` | Baixa |
| 25 | Epic Detail | `#/epic/EP-0042` | `screenEpic` (screens-entity.js) | `epics/[epicId]/page.tsx` | Alta |
| 26 | Standup | `#/standup/SQ-AUTH` | `screenStandup` (screens-team.js) | `teams/[teamId]/standup/page.tsx` | Baixa |
| 27 | Decision Log | `#/decisions` | `screenDecisions` (screens-gov.js) | `portfolio/governance/decision-log/page.tsx` | Baixa |
| 28 | Value Stream Detail | `#/vs/VS-PAY` | `screenValueStream` (screens-budget.js) | **SEM ROTA** | Alta |
| 29 | Investment Horizon Detail | `#/horizon/H1` | `screenHorizon` (screens-budget.js) | **SEM ROTA** | Média |
| — | **Modais (overlays, sem rota)** | | | | |
| M1 | Criar Épico | CTA `+ Épico` | `openEpicModal` (modal.js) | overlay | Alta |
| M2 | Nova Feature | CTA `+ Feature` | `openFeatureModal` (feature-modal.js) | overlay | Alta |
| M3 | Nova Story | CTA `+ Story` | `openStoryModal` (story-modal.js) | overlay | Média |
| M4 | Novo Risco (ROAM) | CTA `+ Risco` | `openRiskModal` (risk-modal.js) | overlay | Média |
| M5 | PI Planning Wizard (5 etapas) | CTA `PI Planning` | `openPiPlanModal` (pi-modal.js) | overlay | Alta |
| M6 | Novo Value Stream | CTA `+ Novo VS` | `openNewValueStreamModal` (budget-modal.js) | overlay | Alta |
| M7 | Novo Investment Horizon | CTA `+ Novo Horizon` | `openNewHorizonModal` (budget-modal.js) | overlay | Alta |
| M8 | Novo Tema / + Épico (Strategy) | CTA `+ Novo Tema` / `+ Épico` | `openNewThemeModal` / `openAddEpicModal` (screens-analytics.js) | overlay | Média |
| M9 | Rebalance WSJF | CTA `Rebalance` | `openRebalanceDialog` (screens-portfolio.js) | overlay | Média |

**Contagem:** 29 telas (24 no NAV + 2 detail extra `epic`/`standup`/`decisions` fora do NAV visível + `vs`/`horizon` detail) · 9 modais/CTAs. **Total: 38 unidades de UI.**

---

## Componente compartilhado: Relation Chip (`relChip`) — DESIGN.md §3

Definido em `screens-entity.js:3`. É um botão-badge clicável no header (`ph-top`) que navega a uma tela relacionada:

```
relChip(k, label, tone, target) →
  <button class="relchip" onclick="go('<target>')">
    <span class="rc-icon">…</span>
    <span><span class="rc-k">{k}</span><br>{label}</span>
  </button>
```

Classes: `.relchip`, `.relchip-wrap`, `.rc-icon`, `.rc-k`, `.rc-chev`, `.has-pop` (variante com popover), `.pipop*` (popover de PIs).
Sem `target` → chip é somente-display (não navega). No re-skin, todo header de página deve montar sua fila de relation chips (`row` com `flex-wrap`, `gap:8px`, `margin-top:11px`).

**Variante com popover** (`piRelationChip`, screens-entity.js:9): quando a ART tem >1 PI, o chip "PI ativo" vira `has-pop` e abre `#pipop` listando todos os PIs (past/current/future). Fecha com Esc (`piPopKey`) e click-outside (`closePiPopOut`).

> **Importante:** no protótipo, relation chips ricos só existem nas telas de detalhe (`screenEpic`, `screenArt`, `screenPi`). Nas demais telas do NAV o "cross-linking" acontece via cards clicáveis (`go(...)`) no corpo, não via chips no header. O grafo completo está no fim deste doc.

---

## Detalhamento por tela

### 1. Visão Geral / Dashboard (`#/dashboard` → `dashboard/page.tsx`)
- **Render:** `screenDashboard` (screens-personas.js:215) — hub multi-persona. Sub-render por persona: `screenDashLPM` (10), `screenDashRTE` (59), `screenDashPO` (117), `screenDashSM` (157). Header tem seletor de persona (`ph-persona`).
- **Blocos/CSS:** layout `bento` / `span2`; KPI duplas `mkpi2`, `mkpi2-row`, `m2l/m2v/m2b`; `health-tile` (`ht-goal/ht-name/ht-stat/ht-stats/ht-v/ht-l`); `wsjf-list` (`wsjf-list-row/wsjf-rank/wsjf-t/wsjf-v`); `risk-mini` (`risk-mini-row/rmr-sev/rmr-t`); `feat-mini` (`feat-mini-row/fm-id/fm-t/fm-sp/fm-wsjf`); `conf-stars` (`conf-star/conf-art-row/conf-art-name`); `imped-row` (`imped-dot/imped-txt/imped-who`); `bud-rings` (`bud-ring-item`, ring SVG); mini stacked bar (`bar-stack/bar-seg/bar-track/bar-x/bar-col`); botões `gov-btn` (approve/reject).
- **Relation chips (header):** seletor de persona (LPM/RTE/PO/SM), não navega para rota — troca o corpo.
- **Cross-nav (cards clicáveis `go()`):** → `okrs`, `epics`, `wsjf`, `governance`, `budget`, `anomalies`, `deps`, `risks`, `pi/PI-2026-Q2`, `teams`, `standup/SQ-AUTH`.
- **Interações:** troca de persona re-renderiza o bento; rings/bars são estáticos (sem animação de entrada no protótipo); botões approve/reject disparam toast.
- **Forms/CTA:** nenhum modal próprio; CTAs levam a outras telas.
- **Entidades:** `epics`, `okrs`, `governance`, `anomalies`, `teams`, `piPlan.risks`, `features`, `budget`.
- **Complexidade:** Alta (4 layouts distintos + agregações).

### 2. Épicos — Portfolio Kanban (`#/epics` → `portfolio/page.tsx`)
- **Render:** `screenEpicsKanban` (screens-kanban.js:80).
- **Blocos/CSS:** toolbar `ktoolbar` (`kt-filter-lbl/kt-sep/kicon-btn`); board `kboard` com 5 colunas `kcol` (`kcol-head/kcol-dot/kcol-name/kcol-count/kcol-count-v/kcol-body/kcol-add/kcol-actions/kcol-vert/kcol-wip/kcol-wip-bar/kcol-wip-txt`); cards `kcard` (`kcard-title/kcard-meta/kcard-stats/kcard-foot/kc-badge/kc-open/kc-type/kc-wsjf/ks-l/ks-v/kf-dot`); estado `collapsed`.
- **Colunas:** Funnel · Analyzing · Portfolio Backlog · Implementing · Done (Rejected = filtro, não 6ª coluna).
- **Interações/animações:** **drag-and-drop** entre colunas (`draggable`, `dragstart/dragover/drop` — ver screens-kanban.js) = transição de lifecycle. **Gate INVEST no drop em Implementing:** score <50 bloqueia (warning inline), 50–69 confirma, ≥70 livre. Coluna vazia mostra drop-target tracejado. Export CSV (`exportEpicsCSV`). Card abre `openEpicModal` / detalhe.
- **Relation chips:** header sem relation chips; toolbar com filtros.
- **Forms/CTA:** `+ Épico` (topo/coluna) → **M1 Criar Épico**.
- **Entidades:** `epics` (id, tone, art, title, lifecycle, wsjf, size, budget, invest).
- **Complexidade:** Alta (DnD + gate + export).

### 3. WSJF (`#/wsjf` → `portfolio/wsjf/page.tsx`)
- **Render:** `screenWsjf` (screens-portfolio.js:9).
- **Blocos/CSS:** tabela `dt` sortável; header com `sort-caret`; `wsjf-score` (mono, accent, bold). Colunas: rank · ID/título · BV · TC · RR · Job Size · WSJF (sort desc default).
- **Interações:** click em header re-ordena; **Rebalance** abre **M9** (3 sliders + presets Balanced/Time-to-Market/Risk que recomputam e re-rankeiam ao arrastar). Regra de consistência Size⇄JobSize (S→1-2 … XL→8-10) validada no form de épico.
- **Relation chips:** nenhum.
- **Forms/CTA:** `Rebalance` → **M9** (`openRebalanceDialog`, screens-portfolio.js:51): sliders `seg`/range para pesos BV/TC/RR + botões preset; recompute live de todas as linhas.
- **Entidades:** `epics` (wsjfBreak: bv/tc/rr/js, wsjf).
- **Complexidade:** Média.

### 4. OKRs (`#/okrs` → `portfolio/okrs/page.tsx`)
- **Render:** `screenOkrs` (screens-portfolio.js:86).
- **Blocos/CSS:** um card por objetivo `okr-card` (`okr-head/okr-obj/okr-meta/okr-pct/okr-ring/okr-krs`); KRs `kr-row` (`kr-top/kr-name/kr-val`); trace `trace-*` (`trace-col/trace-lane/trace-node/trace-okr/trace-connect/trace-h/trace-col-lbl`); chips `tn-id/tn-t`.
- **Interações:** toggle de "traceability" revela chips de épicos linkados (`go('epic/…')`). Progress arc (`okr-ring` SVG).
- **Relation chips:** owner (ART, tone) display; épicos linkados clicáveis → Epic detail.
- **Forms/CTA:** nenhum modal de criação no protótipo.
- **Entidades:** `okrs` (objective, owner, tone, progress, krs[cur/target/unit/dir/prog], epics[]).
- **Complexidade:** Baixa.

### 5. Strategy Map (`#/strategy` → `portfolio/strategy-map/page.tsx`)
- **Render:** `screenStrategyMap` (screens-analytics.js:129) — superfície de **autoria** (não read-only).
- **Blocos/CSS:** árvore `smap` (`smap-body/smap-theme-h/smap-theme-tools/smap-name-input/smap-palette-btn/smap-palette-wrap/smap-tones-pop/smap-add-btn/smap-add-ic/smap-del-btn/smap-epic/smap-rm`); header do tema `st-caret/st-name/st-alloc`; epic chip `se-*` (`se-id/se-t/se-top/se-wsjf/se-wsjf-v`).
- **Interações/animações:** rename inline (Enter commita / Esc cancela); popover de paleta (6 swatches) recolore o tema; `+ Épico` por tema (M8 add), `✕` remove épico (hover-revealed), delete tema com confirm; expand/collapse sem perder scroll. WSJF chip ancorado sob o título (não flutuar à direita — bug conhecido).
- **Relation chips:** épicos clicáveis → Epic detail.
- **Forms/CTA:** `+ Novo Tema` → **M8** (`openNewThemeModal`, l.260): name* + budget US$M + tone (radio swatches `nt-tone-opt/ntc-dot`) + checklist de épicos pré-linkáveis (`tpl-list/tpl-item2`). `+ Épico` por tema → `openAddEpicModal` (l.222): checklist multi-select dos épicos NÃO no tema (se todos já estão → toast, não abre).
- **Entidades:** `budget.themes` (name/tone/alloc/spent/epics), `epics`.
- **Complexidade:** Alta (CRUD de árvore + popovers + inline edit).

### 6. Roadmap (`#/roadmap` → `portfolio/roadmap/page.tsx`)
- **Render:** `screenRoadmap` (screens-cross.js:6) — tint purple.
- **Blocos/CSS:** Gantt `gantt` (`gantt-head/gh-pi/gantt-lane/gantt-art/gantt-track/gt-cell`); barras posicionadas por start PI + span, cor por state (done=green/active=blue/plan=purple/risk=amber); legend top-right.
- **Interações:** barra linkada a épico é clicável → Epic detail, com hover-glow + tooltip (nome + % completion). Barras sem épico = decorativas. Coluna PI vazia = célula vazia (nunca esconder coluna). Ação "Now/Next/Later".
- **Relation chips:** nenhum no header; barras cross-navegam.
- **Forms/CTA:** nenhum modal.
- **Entidades:** `roadmap` (pis[], lanes[art/tone/items{name,start,span,state,epicId}]).
- **Complexidade:** Média (posicionamento de grid).

### 7. Governance (`#/governance` → `portfolio/governance/page.tsx`)
- **Render:** `screenGovernance` (screens-gov.js:14).
- **Blocos/CSS:** `gov-grid` de `gov-card` (`gov-col/gov-col-b/gov-col-h/gc-dot/gc-name/gc-count/gv-id/gv-meta/gv-t/gov-actions/gov-btn` approve|reject); `seg-toggle`.
- **Interações:** Approve/Reject inline (só LPM/admin por RBAC) → toast + move estado. `go('decisions')` para o log.
- **Relation chips:** link para Decision Log.
- **Forms/CTA:** ações inline approve/reject (sem modal dedicado).
- **Entidades:** `governance` (id/title/art/tone/state/wsjf/budget/by/when).
- **Complexidade:** Baixa.

### 8. Lean Budget / Budget Flow (`#/budget`, scoped `#/budget/ART-x` ≙ `?artId=`) → `portfolio/budgets/page.tsx`
- **Render:** `screenBudget(artId)` (screens-cross.js:84) — tint amber.
- **Blocos/CSS:** filtro `budget-filter-chip` (chip "Filtrado por: {ART}" com ✕ e `ph-chips`); **Capital Allocation Flow** Sankey `bflow` (`bflow-col/bflow-link/bn-bar/bn-name/bn-val/bfc-x`), nós dim/hl quando filtrado (`bnode-dim/bnode-hl`); cards `grid2` **Value Streams** (linhas clicáveis → `vs/[id]`, header `+ Novo VS`) e **Investment Horizons** (linhas clicáveis → `horizon/[id]`, header `+ Novo Horizon`); `grid3` KPIs.
- **Interações:** conectores bezier SVG tema→épico coloridos por tone; scoping via `artId` dimma não-correspondentes e destaca match; `go('budget')` limpa filtro; linhas de VS/Horizon clicáveis.
- **Relation chips:** vindo do ART detail via chip `Budget Flow` (`budget/ART-x`).
- **Forms/CTA (DETALHE — crítico):**
  - **`+ Novo VS` → M6** (`openNewValueStreamModal`, budget-modal.js:6): modal 900px com **preview-rail ao vivo** (`pvs-*`). Campos: Nome*, Tipo (`seg` `vsTypeSeg`: development|operational → `vs-type`), Missão (textarea `vs-mission`), Alocado US$M (`vs-alloc` number), Consumido US$M (`vs-spent` number), Horizonte (select `vs-horizon` de `DB.investmentHorizons`), ARTs (`<select multiple>` → em prod virar combobox), Themes (`<select multiple>`), Owner (`vs-owner` text), Cycle Time dias (`vs-cycletime` number min1), Flow Efficiency % (`vs-floweff` number 0-100). Preview recalcula util% (verde<75/amber≥75/red≥90). Submit: `submitValueStream` valida Nome obrigatório → toast.
  - **`+ Novo Horizon` → M7** (`openNewHorizonModal`, budget-modal.js:149): modal 900px, preview-rail (`ph-*` card + lista de VS). Campos: ID* (select H1/H2/H3 `h-id`), Tone (select `h-tone`), Label* (`h-label` text), Descrição (`h-desc` textarea), Perfil de retorno (`h-return` text), % do portfolio* (range 5-80 step5 `h-pct-slider`), Guardrail min/max, Value Streams (`<select multiple>` de `DB.valueStreams`). Preview mostra guardrail min/max e lista live de VS.
  - Ação header **Reallocate** (feedback via toast no protótipo — `modal.js:254`).
- **Entidades:** `budget` (total/spent/themes), `valueStreams`, `investmentHorizons`, `epics`, `arts`.
- **Complexidade:** Alta (Sankey + 2 modais com preview + scoping).

### 9. Anomalies (`#/anomalies` → `portfolio/budgets/anomalies/page.tsx`)
- **Render:** `screenAnomalies` (screens-admin.js:127).
- **Blocos/CSS:** `anom-list` de `anom-card` (`anom-ic/anom-t/anom-d/anom-metric/anom-actions`).
- **Interações:** `go('budget')` a partir das ações. Empty state positivo ("Nenhuma anomalia detectada"). Thresholds de geração (DESIGN.md §6): >90% alocado / burn 2× / <60% subalocado.
- **Forms/CTA:** ações levam a Budget; sem modal.
- **Entidades:** `anomalies` (art/tone/sev/title/detail/metric).
- **Complexidade:** Baixa.

### 10. ART Detail (`#/art/ART-PAY` → `arts/[artId]/page.tsx`)
- **Render:** `screenArt(id)` (screens-entity.js:126) — tint = ART tone.
- **Blocos/CSS:** `ph-top` (eyebrow + `ph-titlerow` com `ph-title/ph-id` + status badge dot + `bdg neutral mono` cadence); KPI `grid4`; **Team health grid** `health-grid`/`health-card` (`hc-top/hc-name/hc-sub/health-metric/hm-v`, avatar `av av-*`); **Lean Budget + Themes** `grid2` (`obj/obj-title/obj-meta/obj-val`, progress bar).
- **Relation chips (header) → destinos:**
  - `PI ativo` → `pi/{active}` (ou popover `has-pop` multi-PI se >1 → cada linha `go('pi/{id}')`)
  - `Roadmap` (Multi-PI) → `roadmap`
  - `Budget Flow` (Lean Budget) → `budget/{art.id}` (scoped)
  - `PIs anteriores` (n finalizados) → `history`
- **Interações:** click em team card → Standup (`standup/{teamId}`); popover de PIs com Esc + click-outside.
- **Forms/CTA:** `Program Board` (secondary, feedback); **`PI Planning` (primary)** → **M5 Wizard** (`openPiPlanModal(a.name)`).
- **Entidades:** `arts`, `epics` (por art), `pisByArt`, `history.pastPis`, `teams`.
- **Complexidade:** Alta.

### 11. PI Planning Detail — 4 tabs (`#/pi/PI-2026-Q2/{tab}` → `arts/[artId]/pi-planning/page.tsx` + `pi-planning/page.tsx`)
- **Render:** `screenPi(id, tab)` (screens-entity.js:186). Tab default `objectives`. `ph-tabs`/`ph-tab` com `tcount`.
- **Tabs:** Objectives (`obj/obj-title/obj-meta/obj-prog/obj-val`, stretch badge) · Burnup (`burnupChart` SVG: Scope/Started/Completed, área shaded, legend `lk`) · ROAM (`roam-grid`/`roam-col`/`roam-col-h`/`roam-card`/`rc-owner`, 4 tones R/O/A/M) · Confidence (`sparkline`, threshold 3.0 linha).
- **Interações:** troca de tab = swap client-side do corpo abaixo do header/KPI persistentes (`go('pi/{id}/{tab}')`). KPI `grid4` persiste.
- **Relation chips (header) → destinos:** `ART` → `art/ART-PAY` · `Semana` (display, sem target) · `Roadmap` → `roadmap`.
- **Forms/CTA:** `Program Board` (secondary); `Confidence Vote` (primary, modal leve); tab ROAM tem `+ Risco` → **M4**.
- **Entidades:** `piPlan` (objectives/risks/confidence/burnup/scope/completion/ppm/weeks/currentWeek).
- **Complexidade:** Alta (tabs + 2 charts SVG).

### 12. Solution Trains (`#/solutions` → `solution-trains/page.tsx`)
- **Render:** `screenSolutionTrains` (screens-analytics.js:311).
- **Blocos/CSS:** `strain-grid` de `strain-card` (`strain-h/strain-arts/strain-art/strain-b/strain-foot`).
- **Interações:** ARTs = chips clicáveis → `art/{id}`; milestone com ícone calendar. 1 ART já é válido.
- **Forms/CTA:** nenhum.
- **Entidades:** `solutionTrains` (name/desc/arts[]/capabilities/milestone).
- **Complexidade:** Baixa.

### 13. Histórico (`#/history` → **SEM ROTA** / gap)
- **Render:** `screenHistory` (screens-admin.js:4) — read-mostly; chega direto ou via chip "PIs anteriores" (pré-filtra por ART).
- **Blocos/CSS:** duas seções — **Past PIs** `hist-cards`/`hist-card` (`hist-top/hist-pi/hist-q/hist-q-lbl/hist-metrics/hist-m/hist-deliv/hist-retro/hist-timeline`) e **Retired ARTs** `retired-grid`/`retired-card` (`retired-h/retired-reason`).
- **Interações:** filtragem por ART (via chip de origem); empty filtrado ("Nenhum PI encerrado ainda para este ART").
- **Relation chips:** origem via ART detail (`history`).
- **Forms/CTA:** nenhum (read-only, compliance).
- **Entidades:** `history.pastPis` (id/art/quarter/ppm/predictability/objAchieved/objTotal/confidence/velocity/delivered/retro), `history.retiredArts` (name/team/retiredOn/pisRun/reason/members/finalPredictability).
- **Complexidade:** Média. **GAP: criar rota** (ex. `arts/[artId]/history` ou `analytics/history`). Parcial: `analytics/pi-retro/[piPlanId]` cobre retro de um PI, não o arquivo completo.

### 14. Dependencies (`#/deps` → `dependencies/page.tsx`)
- **Render:** `screenDeps` (screens-cross.js:35) — tint red.
- **Blocos/CSS:** `depmap` com `dep-cols` (4 colunas por ART, `dep-col-h`), nós `dn-id/dn-title` (state badge, dep-count badge, borda-esquerda vermelha se BLOCKED); camada SVG `dep-svg` com beziers (vermelho tracejado se dependente BLOCKED / amber sólido senão) + arrowheads; legenda flat de pares `dep → feature`.
- **Interações/animações:** **conectores redesenhados no resize** (`ResizeObserver`/resize listener) via `getBoundingClientRect` dos nós — NÃO usar coordenadas SVG estáticas (ver screens-cross.js:192). Coluna vazia = "—" centrado.
- **Relation chips:** header badge estático "N bloqueios críticos"; sem navegação de chip.
- **Forms/CTA:** nenhum modal (read-only map). Dependências são criadas no **M2 Feature modal** (campo `dependencies` multi-select).
- **Entidades:** `features` (id/art/title/state/deps[]).
- **Complexidade:** Alta (SVG dinâmico + reflow no resize).

### 15. Risks — ROAM Board (`#/risks` → `risks/page.tsx`)
- **Render:** `screenRisks` (screens-team.js:63).
- **Blocos/CSS:** filtro PI no topo; `roam5`/`roam-col`/`roam-col-h`/`roam-col-b`/`roam-card`/`rc-owner` (5 colunas Raised/Owned/Accepted/Mitigated/Resolved, tones distintos).
- **Interações:** stage alterável inline (drag entre grupos ou stage-select) → alimenta audit `risk.move`. Owned foregrounds owner. Empty positivo/calmo verde ("Nenhum risco aberto — bom sinal").
- **Forms/CTA:** `+ Risco` → **M4** (`openRiskModal`).
- **Entidades:** `piPlan.risks` (title/roam/owner/sev).
- **Complexidade:** Média.

### 16. Flow Metrics (`#/flow` → `analytics/flow/page.tsx`)
- **Render:** `screenFlow` (screens-analytics.js:4).
- **Blocos/CSS:** line chart SVG cycle-time (`an-chart`); stacked bar distribuição (`bar-stack/bar-seg/bar-track/bar-x/dist-row/d-l/d-v`); headline flow-efficiency %.
- **Interações:** linha tone verde/amber por direção de tendência; <2 pontos → "Coletando dados".
- **Forms/CTA:** nenhum.
- **Entidades:** `flow` (cycleTime[], distribution[], efficiency).
- **Complexidade:** Média (2 charts).

### 17. Velocity (`#/velocity` → `analytics/velocity/page.tsx`)
- **Render:** `screenVelocity` (screens-analytics.js:35).
- **Blocos/CSS:** multi-série bar/line, uma série por time (`bar-col/ga-dot` legend), x=sprints.
- **Interações:** times sem sprint omitidos da legenda.
- **Forms/CTA:** nenhum.
- **Entidades:** `velocity` (sprints[], teams[name/tone/data[]]).
- **Complexidade:** Média.

### 18. Measure & Grow / Maturity (`#/maturity` → `analytics/measure-grow/page.tsx`)
- **Render:** `screenMaturity` (screens-analytics.js:62).
- **Blocos/CSS:** `mat-grid`/`mat-row` (`mat-name/mat-track/mat-fill/mat-score`) — 1 linha por dimensão (score 0-5 + barra). Considerar radar (padrão SAFe).
- **Interações:** estático; empty prompt de auto-avaliação. Protótipo tem 6 dimensões (confirmar 7ª "Enterprise Solution Delivery").
- **Forms/CTA:** nenhum.
- **Entidades:** `maturity.dimensions` (name/score).
- **Complexidade:** Média.

### 19. Teams (`#/teams` → `teams/page.tsx`)
- **Render:** `screenTeams` (screens-team.js:4).
- **Blocos/CSS:** `teams-grid`/`team-card` (`team-card-h/team-card-b/team-goal/team-metrics/tm-cell/tm-l/tm-v`) — avatar, ART tone, sprint goal, 3 métricas (Velocity/WIP/Flow Eff).
- **Interações:** card → Standup (`go('standup/{id}')`).
- **Forms/CTA:** nenhum.
- **Entidades:** `teams` (id/name/art/tone/velocity/wip/flowEff/sprintGoal/members).
- **Complexidade:** Baixa.

### 20. Copilot (`#/copilot` → `copilot/page.tsx`)
- **Render:** `screenCopilot` (screens-admin.js:179), stream `renderCopStream` (174).
- **Blocos/CSS:** `copilot-wrap` (`cop-stream/cop-bubble/cop-chip/cop-input/cop-action/cop-suggest`).
- **Interações:** chat-style; integração de modelo fora do escopo visual (reusar padrão de IA de `apps/web`). Disponível às 4 personas.
- **Forms/CTA:** input de chat (`cop-input`).
- **Entidades:** N/A (mock stream).
- **Complexidade:** Média.

### 21. Workflows (`#/workflows` → `workflows/page.tsx` + `workflows/[teamId]/bpmn`)
- **Render:** `screenWorkflows` (screens-admin.js:195).
- **Blocos/CSS:** canvas BPMN `bpmn-canvas`/`bpmn-svg`/`bpmn-node` (`gateway/start/end`); linhas `lint-row`.
- **Interações:** rules-list CRUD (trigger→condition→action); spec parcial (flag a produto). LPM+RTE full.
- **Forms/CTA:** rules builder (não detalhado no protótipo).
- **Entidades:** N/A (mock).
- **Complexidade:** Média.

### 22. Integrações (`#/integrations` → `integrations/page.tsx` + `settings/integrations`)
- **Render:** `screenIntegrations` (screens-admin.js:52).
- **Blocos/CSS:** `intg-grid`/`intg-card` (`intg-top/intg-name/intg-desc/intg-stat`).
- **Interações:** Connect/Disconnect por card; deep-link com integração pré-destacada (destino dos avisos "não conectada" dos modais). GitHub desconectado no mock.
- **Forms/CTA:** ação Connect (`connectIntegration(src)` — chamado dos modais Feature/Story).
- **Entidades:** `integrations` (id/ic/tone/connected/desc/items/lastSync).
- **Complexidade:** Baixa.

### 23. Members (`#/members` → `settings/members/page.tsx`)
- **Render:** `screenMembers` (screens-admin.js:78).
- **Blocos/CSS:** tabela `dt` (nome/email/role badge/ART/status); `role-pill`, `mrow-user`.
- **Interações:** invited = badge muted distinto de active; ação Invite.
- **Forms/CTA:** Invite member (form não detalhado no protótipo).
- **Entidades:** `members` (name/email/role/art/tone/status).
- **Complexidade:** Baixa.

### 24. Audit Log (`#/audit` → `settings/audit/page.tsx`)
- **Render:** `screenAudit` (screens-admin.js:110).
- **Blocos/CSS:** lista reverse-chrono `dt` — timestamp/actor/action key (mono, ex `epic.approve`)/entity/detail.
- **Interações:** append-only (sem edit/delete UI).
- **Forms/CTA:** nenhum.
- **Entidades:** `audit` (when/who/action/entity/detail).
- **Complexidade:** Baixa.

### 25. Epic Detail (`#/epic/EP-0042` → `epics/[epicId]/page.tsx`)
- **Render:** `screenEpic(id)` (screens-entity.js:37) — tint = ART tone. Duas "modos" empilhados (estratégico → entrega).
- **Blocos/CSS:** `ph-top`; KPI `grid4` (INVEST/WSJF/Budget/Features, `kpiCard`); **Strategic** `grid2` — INVEST gauge (`gauge`) + barras `invest-bars/invest-bar/ib-lbl/ib-num/invest-wrap` (I/N/V/E/S/T, gradient+glow) · Hipótese (outcomes check verde / indicators activity azul); **Lifecycle** `funnel`/`funnel-step`/`fs-k` (stepper numerado); **Features table** `dt` (ID/Feature/Time badge/Estado/Progress mini-bar/WSJF/Deps).
- **Relation chips (header) → destinos:** `Strategic Theme` (display) · `ART` → `art/{artId}` · `PI` → `pi/PI-2026-Q2`.
- **Interações:** feature rows devem **expandir** para revelar Stories filhas (`DB.stories` keyed por feature) — gap a implementar. INVEST bars/hipótese edit-in-place (LPM/PO) / read-only (RTE/SM). Empty feature table = "Sem features — épico ainda em {lifecycle}".
- **Forms/CTA:** `Business Case` (secondary) · **`+ Feature`** (primary) → **M2** · **`+ Story`** (na tabela) → **M3** pré-escopado ao épico/feature.
- **Entidades:** `epics` (breakdown/hypothesis/outcomes/indicators/wsjfBreak/lifecycle), `features`, `stories`.
- **Complexidade:** Alta.

### 26. Standup (`#/standup/SQ-AUTH` → `teams/[teamId]/standup/page.tsx`)
- **Render:** `screenStandup(id)` (screens-team.js:37).
- **Blocos/CSS:** `standup-grid`/`su-head`/`su-body`/`su-name`/`su-role`/`su-slot`/`su-slot-l`/`su-slot-v`/`su-empty` — 1 linha por membro, colunas Yesterday/Today/Blocker (blocker flag vermelho quando não-vazio).
- **Interações:** sem blockers → afirmação "Sem bloqueios hoje" no topo. `go('teams')` back.
- **Forms/CTA:** nenhum.
- **Entidades:** `teams[].members` (n/r/y/t/b).
- **Complexidade:** Baixa.

### 27. Decision Log (`#/decisions` → `portfolio/governance/decision-log/page.tsx`)
- **Render:** `screenDecisions` (screens-gov.js:42).
- **Blocos/CSS:** lista reverse-chrono; action badge (Approved/Rejected/Deferred); decider+role; nota.
- **Interações:** append-only (sem edit/delete).
- **Forms/CTA:** nenhum.
- **Entidades:** `decisions` (when/epic/title/action/by/note).
- **Complexidade:** Baixa.

### 28. Value Stream Detail (`#/vs/VS-PAY` → **SEM ROTA** / gap)
- **Render:** `screenValueStream(vsId)` (screens-budget.js:4).
- **Blocos/CSS:** KPI row (Budget/Util%/Flow Eff/Cycle Time); description card (mission/owner/type/horizon/return); Flow Metrics (3 stat tiles + mini bar 6 sem, `ch-right`); ARTs contribuintes (linhas clicáveis); Epics no VS (linhas + progress); Budget Guardrail (barra 3-way alloc/spent/available).
- **Relation chips:** ARTs e Epics como linhas clicáveis → `art/{id}` / `epic/{id}`; horizon linkado → `horizon/{id}`.
- **Forms/CTA:** editar via **M6** (`openNewValueStreamModal(existingId)`).
- **Entidades:** `valueStreams` (mission/owner/type/horizon/budget/themes/epics/metrics/kpis/description), `arts`, `epics`, `investmentHorizons`.
- **Complexidade:** Alta. **GAP: criar rota** (ex. `portfolio/value-streams/[id]`).

### 29. Investment Horizon Detail (`#/horizon/H1` → **SEM ROTA** / gap)
- **Render:** `screenHorizon(hId)` (screens-budget.js:180).
- **Blocos/CSS:** KPI row (Budget/Util%/VS count/Épicos ativos); Overview (3 stat tiles de `h.kpis` + guardrail range bar min/max + posição atual); Value Streams no horizon (linhas clicáveis + nested progress); Epics (lista compacta clicável).
- **Relation chips:** VS/Epics clicáveis → `vs/{id}` / `epic/{id}`.
- **Forms/CTA:** editar via **M7** (`openNewHorizonModal(existingId)`).
- **Entidades:** `investmentHorizons` (pct/alloc/spent/desc/returnProfile/valueStreams/themes/guardrails/kpis), `valueStreams`, `epics`.
- **Complexidade:** Média. **GAP: criar rota** (ex. `portfolio/horizons/[id]`).

---

## Modais / Forms (replicar idênticos)

Shell comum (DESIGN.md §3, `modal.js`): `.ov` backdrop (click-outside fecha, mousedown na própria `ov`) → `.modal` (`modal-head/modal-icon/modal-title/modal-sub/modal-head-actions/modal-x/modal-grid/mprev` preview-rail/`mform`/`modal-foot/mf-hint/mf-actions`). **Esc** fecha; **⌘/Ctrl+Enter** submete (`#modal-submit`). Toasts (`toast()`) confirmam create/update/delete (tone+icon+title+sub, auto-dismiss ~4.2s). Templates configuráveis via engrenagem (`toggleTplMenu`, salva em `localStorage`) fazem swap do form com shimmer skeleton (`.swapping`, delay 240ms).

### M1 — Criar Épico (`openEpicModal`, modal.js:72)
- **Preview-rail:** card do épico (título/tone/lifecycle badge/WSJF/size/hipótese) + INVEST gauge animando conforme WSJF/size.
- **Templates (`FORM_TEMPLATES`):** `standard` (title,art,theme,size,wsjf,hyp) · `lean` (title,art,size) · `enabler` (title,art,size,wsjf,nfr) · `governed` (+approver).
- **Campos (`fieldBuilders`):** título* (text), ART (select), Strategic Theme (select), Size (`seg` XS/S/M/L/XL, hint mostra Job Size band), WSJF (4 range 1-10 `wsjfBox` BV/TC/RR/JS, score live), Hipótese (textarea), NFR (textarea, só enabler), Approver (select, só governed).
- **Validação/acoplamento:** Size⇄JobSize bidirecional (`sizeToJs`/`jsToSize`, bands XS[1-2] S[3-4] M[5] L[6-7] XL[8-10]); título obrigatório (borda vermelha + toast). Submit → toast verde.

### M2 — Nova Feature (`openFeatureModal`, feature-modal.js:86)
- **Templates:** `standard` (title,art,epic,team,sp,wsjf,accept) · `lean` (title,art,epic,sp) · `integrated` (+external) · `ready` (+readiness,accept).
- **Campos:** título* · ART (select) · Épico pai (select filtrado por ART) · Time (select TEAMS) · Story Points (`seg` Fibonacci 1/2/3/5/8/13/21, hint Job Size via `SP_JS`) · WSJF (`wsjfBox`, JS⇄SP acoplado) · Acceptance (textarea) · Readiness (`seg` NOT_READY/READY) · **Fonte externa** (select Jira/Linear/GitHub → painel: `ext-warn` se não conectado com botão Conectar; `ext-import` com input URL + Importar; `ext-ok` mostra extId importado; `convertExternal` puxa schema).
- **Deps:** `dependencies` multi-select (alimenta Dependency Map).

### M3 — Nova Story (`openStoryModal`, story-modal.js:48)
- **Templates:** `standard` (title,feature,sprint,sp,assignee,priority,accept) · `lean` (title,feature,sp) · `integrated` (+external) · `spike` (title,feature,sp,accept — sem priority).
- **Campos:** título* · Feature pai (select, drives ART inheritance) · Sprint (select Sprint 12/13/Backlog) · SP (`seg` 1/2/3/5/8/13) · Responsável (select ASSIGNEES) · Prioridade (`seg` Baixa/Média/Alta/Crítica) · Acceptance (textarea) · Fonte externa (mesmo padrão M2).

### M4 — Novo Risco ROAM (`openRiskModal`, risk-modal.js:31)
- **Templates:** `standard` (title,pi,owner,severity,roam,mitigation) · `lean` (title,pi,severity) · `escalated` (+escalate).
- **Campos:** título* · Vinculado a (select PI/Portfolio) · Owner (select) · Severidade (`seg` Baixa/Média/Alta/Crítica) · Status ROAM (`seg` Raised/Owned/Accepted/Mitigated/Resolved) · Mitigação (textarea) · Escalar para (select RTE/LPM/Arch Board).

### M5 — PI Planning Wizard (`openPiPlanModal`, pi-modal.js:122) — 5 etapas
- **Preview-rail:** card do PI (name/duração/confidence/times/objetivos) live.
- **Track:** `wiz-track`/`wiz-step` (`done/active/pending`, `wiz-circle/wiz-label/wiz-line`), Voltar/Próximo.
- **Etapa ID:** Nome (readonly, `nextPiName`) · ART (select, muda name+teams) · Data início (`type=date`, **estilizar dark-mode** — bug conhecido) · Duração (`seg` 8/10/12 sem → `PI_DURATION_SPRINTS` iterações, hint com término calculado).
- **Etapa Equipes:** `chip-multi`/`chip-t` toggle (default 3 primeiras do ART); warn se 0.
- **Etapa Objetivos:** `obj-tpl-row` chips SAFe 6.0 (`OBJ_KINDS`: Capacidade/Enabler/Redução de risco/NFR/Débito, cada com template fill-in-the-blank) · `obj-row` (kind-tag, título, BV number 1-10, stretch toggle `S`, remove); **`@mention`** de riscos ROAM (`checkMention`/`showMentionMenu`, teclado ↑↓/Enter/Esc); add até 6; contador live comprometidos/stretch.
- **Etapa Roadmap:** info card (vínculo de features vem depois no Program Board).
- **Etapa Revisão:** resumo read-only + checkbox fist-of-five confidence (range 1-5 step .5). Submit → toast.

### M6 — Novo Value Stream (`openNewValueStreamModal`, budget-modal.js:6)
Ver §8. Preview-rail `pvs-*`; Nome*, Tipo seg, Missão, Alocado/Consumido US$M, Horizonte, ARTs/Themes multi-select, Owner, Cycle Time, Flow Eff; util% live; edit via `existingId`.

### M7 — Novo Investment Horizon (`openNewHorizonModal`, budget-modal.js:149)
Ver §8. Preview-rail `ph-*` + lista VS; ID* (H1/H2/H3), Tone, Label*, Descrição, Perfil retorno, % portfolio (range 5-80), Guardrail min/max, Value Streams multi-select.

### M8 — Strategic Theme modals (`openNewThemeModal` / `openAddEpicModal`, screens-analytics.js:260/222)
`+ Novo Tema`: name* + budget US$M + tone radio swatches + checklist épicos (list-picker, sem preview-rail). `+ Épico`: checklist multi-select dos épicos fora do tema (toast se todos já linkados).

### M9 — Rebalance WSJF (`openRebalanceDialog`, screens-portfolio.js:51)
3 sliders de peso (BV/TC/RR) + presets Balanced/Time-to-Market/Risk; recompute + re-rank live ao arrastar.

---

## Grafo de navegação (tela → [chip/card → destino])

- **Dashboard** → okrs, epics, wsjf, governance, budget, anomalies, deps, risks, pi/PI-2026-Q2, teams, standup/SQ-AUTH
- **Epic Detail** → [chip ART→art/{id}] [chip PI→pi/PI-2026-Q2] · CTAs: M2 Feature, M3 Story
- **ART Detail** → [chip PI ativo→pi/{id} (popover multi)] [chip Roadmap→roadmap] [chip Budget Flow→budget/{art.id}] [chip PIs anteriores→history] · team card→standup/{id} · CTA: M5 PI Wizard
- **PI Detail** → [chip ART→art/ART-PAY] [chip Roadmap→roadmap] · tabs→pi/{id}/{tab} · CTA: M4 Risco
- **Roadmap** → barra linkada→epic/{id}
- **OKRs** → épico linkado→epic/{id}
- **Strategy Map** → épico→epic/{id} · CTAs: M8
- **Budget Flow** → VS row→vs/{id} · Horizon row→horizon/{id} · limpar filtro→budget · CTAs: M6, M7
- **Value Stream Detail** → art/{id}, epic/{id}, horizon/{id} · CTA: M6 (edit)
- **Horizon Detail** → vs/{id}, epic/{id} · CTA: M7 (edit)
- **Governance** → decisions
- **Anomalies** → budget
- **Solution Trains** → art/{id}
- **Teams** → standup/{id}
- **Standup** → teams

---

## GAPS — telas do protótipo SEM rota no apps/app

1. **Histórico** (`#/history`, `screenHistory`) — sem `history/*`. Sugestão: `arts/[artId]/history` ou `analytics/history`. Parcial existente: `analytics/pi-retro/[piPlanId]` (só retro de 1 PI).
2. **Value Stream Detail** (`#/vs/[id]`, `screenValueStream`) — sem rota. Sugestão: `portfolio/value-streams/[id]`. (Existe `portfolio/finops` mas é outro conceito.)
3. **Investment Horizon Detail** (`#/horizon/[id]`, `screenHorizon`) — sem rota. Sugestão: `portfolio/horizons/[id]`.
4. **Modais como rota** — protótipo não tem rota para modais (M1-M9); no apps/app alguns viraram páginas próprias (ex. `portfolio/[epicId]/business-case`) — decidir modal vs rota no re-skin.

## Rotas apps/app SEM equivalente no protótipo (extras a preservar/ignorar)

- `access-exceptions` · `analytics/executive` · `analytics/page` (índice) · `analytics/pi-retro/[piPlanId]`
- `arts/[artId]/impediments` · `.../pre-pi` · `.../post-pi` · `.../program-board`
- `dashboard/portfolio` · `epics/[epicId]/features`
- **`features/[featureId]`** (Feature detail — protótipo só tem modal, sem tela de detalhe de feature)
- `integrations/health` · `integrations/linear/import`
- `lace` · `meetings` · `meetings/[transcriptId]/review` · `notifications`
- `onboarding/company(+/complete)` · `onboarding/migration(+/complete)`
- `pi-planning` (standalone, além do scoped por ART)
- `portfolio/[epicId]/business-case` · `portfolio/ai-playground` · `portfolio/finops` · `portfolio/themes(+/[id])` · `portfolio/budgets/[id]`
- `profile` · `search` · `suppliers` · `webhooks`
- `settings/integrations(/meeting)` · `settings/reports` · `settings/roles` · `settings/sso` · `settings/workspace`
- `solution-trains/[stId]` (detail — protótipo só lista) · `workflows/[teamId]/bpmn`
- `teams/[teamId]` (detail) · `teams/[teamId]/defects` · `/impediments` · `/kanban` · `/sprints(/[sprintId])`

> Nota: `portfolio/themes` (apps/app) ≈ conceito de Strategic Themes que no protótipo vive dentro de Strategy Map (`#/strategy`), não como rota própria de listagem.
