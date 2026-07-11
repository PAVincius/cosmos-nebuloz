# Cosmos.html → apps/app — GAP LIST

Telas do **cosmos.html** (design original) que ainda **não foram re-skinnadas** no `apps/app`.

## Fonte do original
Os arquivos JSX do cosmos.html estão em disco em:
`/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/design/components/`
(o tool DesignSync não está disponível nesta sessão — a fonte foi lida diretamente do disco).

## Conjunto oficial de telas (dispatch de `cosmos-app.jsx`)
26 chaves de tela: `dashboard, kanban, wsjf, program, piplanning, flow, themes, okrs, budgets, roadmap, anomalies, dependencies, risks, teams, velocity, measure, strategy, tags, governance, decisions, solution, workflows, integrations, webhooks, settings, copilot`.
(`decisions` e `webhooks` não têm `screen-*.jsx` próprio: vivem dentro de `screen-governance.jsx` e `screen-integrations.jsx`.)

Referência de navegação e primitivos salva junto:
- `.design-ref/cosmos-jsx/cosmos-app.jsx` — router + dispatch de telas
- `.design-ref/cosmos-jsx/cosmos-kit.jsx` — primitivos (PageHeader, KpiCard, SectionCard, Badge, Button, Icon, Avatar…)

---

## GAPS (6)

### 1. Program Board
- **Tela cosmos:** `program` (ProgramBoardScreen)
- **Fonte em disco:** `.design-ref/cosmos-jsx/screen-program.jsx`
- **Rota alvo:** `app/(authenticated)/arts/[artId]/program-board/page.tsx` — **EXISTE (vazia / não re-skinnada)**
- **Blocos/interações:** PageHeader "Program Board" (subtitle "PI-26 · features por time e iteração…"); ações `Por feature` (filter) e `Nova feature` (plus); board de `FeatureCard` por time × iteração (marcos, dependências, capacidade da ART).

### 2. Temas Estratégicos
- **Tela cosmos:** `themes` (ThemesScreen)
- **Fonte em disco:** `.design-ref/cosmos-jsx/screen-themes.jsx`
- **Rota alvo:** `app/(authenticated)/portfolio/themes/page.tsx` — **EXISTE (não re-skinnada)** (há também `portfolio/themes/[id]`)
- **Blocos/interações:** PageHeader "Temas Estratégicos" + Badge "Revisão trimestral"; ações `Rebalancear alvos` (sliders) e `Novo tema` (plus); KpiCards "Investimento mapeado" (%), "Épicos sob temas"; alocação real vs. alvo de orçamento por tema estratégico.

### 3. Tag Rules
- **Tela cosmos:** `tags` (TagsScreen)
- **Fonte em disco:** `.design-ref/cosmos-jsx/screen-tags.jsx`
- **Rota alvo:** **NÃO EXISTE — criar** (sugestão `app/(authenticated)/portfolio/tags/page.tsx`)
- **Blocos/interações:** PageHeader "Tag Rules" (automação de rótulos); ações `Testar regras` (play) e `Nova regra` (plus); KpiCards "Regras ativas", "Itens marcados automaticamente", "Tempo poupado"; SectionCard "Regras de automação" com lista de `TagRuleRow` (condição → rótulo aplicado).

### 4. Decision Log
- **Tela cosmos:** `decisions` (DecisionsScreen) — vive dentro de `screen-governance.jsx`
- **Fonte em disco:** `.design-ref/cosmos-jsx/screen-governance.jsx` (função `DecisionsScreen`, linha ~82)
- **Rota alvo:** `app/(authenticated)/portfolio/governance/decision-log/page.tsx` — **EXISTE (não re-skinnada)**
- **Blocos/interações:** PageHeader "Decision Log" (ADRs); Badges "N decisões / aceitas / em debate"; lista de decisões com status (Badge tone), contexto e dono.

### 5. Webhooks
- **Tela cosmos:** `webhooks` (WebhooksScreen) — vive dentro de `screen-integrations.jsx`
- **Fonte em disco:** `.design-ref/cosmos-jsx/screen-integrations.jsx` (função `WebhooksScreen`, ~linha 55)
- **Rota alvo:** `app/(authenticated)/webhooks/page.tsx` — **EXISTE (não re-skinnada)**
- **Blocos/interações:** PageHeader "Webhooks" (endpoints de eventos em tempo real); ações `Docs de eventos` (book) e `Novo endpoint` (plus); lista de endpoints com status de entrega.

### 6. Settings (Workspace / Roles / SSO)
- **Tela cosmos:** `settings` (SettingsScreen)
- **Fonte em disco:** `.design-ref/cosmos-jsx/screen-settings.jsx`
- **Rotas alvo (todas EXISTEM, não re-skinnadas):**
  - `app/(authenticated)/settings/workspace/page.tsx`
  - `app/(authenticated)/settings/roles/page.tsx`
  - `app/(authenticated)/settings/sso/page.tsx`
  - (já feitos no port anterior: `settings/members`, `settings/audit`)
- **Blocos/interações:** tela de settings com sub-nav (workspace, roles, sso, members, audit); `screen-settings.jsx` cobre os painéis de workspace, roles e SSO que ainda faltam.

---

## Resumo
- **6 gaps.** Rotas: 5 já existem vazias/não-re-skinnadas (program-board, portfolio/themes, governance/decision-log, webhooks, settings/{workspace,roles,sso}); **1 precisa ser criada** (tags → `portfolio/tags`).
- **8 arquivos JSX baixados** para `.design-ref/cosmos-jsx/`: 6 screen sources (program, themes, tags, settings, governance, integrations) + `cosmos-app.jsx` + `cosmos-kit.jsx`.
