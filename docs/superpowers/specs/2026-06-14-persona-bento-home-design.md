# Spec: Persona Bento Home

**Data:** 2026-06-14
**Branch:** feat/persona-bento-home
**Status:** Aprovado para implementação

---

## Contexto

O COSMOS não possui uma home page (`/dashboard/page.tsx`) — ao entrar, o usuário cai direto no kanban. Cada persona SAFe (RTE, SM, PM, LPM) tem necessidades radicalmente diferentes de informação. Este spec define uma home page personalizada por persona, baseada em um bento grid com hierarquia cognitiva mapeada.

**Design de referência:** `.superpowers/brainstorm/6933-1781383061/content/cosmos-home-hifi.html`
**Design system:** `DESIGN.md` (Linear — canvas `#010102`, primary `#5e6ad2`)

---

## Decisões Fechadas

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Detecção de persona | `User.persona` (campo novo no DB) | User tem controle; pode trocar no perfil |
| Layout base | 4 colunas balanceadas (Layout A) | Menor carga cognitiva — nenhuma célula domina |
| Personalização V1 | View switcher (3 presets) + cell toggle | Poder sem complexidade de drag-to-resize |
| Personalização V2 | Drag-to-resize (fora de escopo) | — |
| Personas primárias | RTE, SM, PM/PO, LPM | Casos de uso mais frequentes |
| Personas fallback | SPC, Global | Fallback quando persona não definida |
| Notificações | Integração com Knock provider existente | `@repo/notifications` já instalado |
| Persistência de preferências | `User.preferences` JSONB | Extensível sem migrations adicionais |

---

## Personas e Mapa de Células

### Estrutura comum

Todas as homes compartilham:
- **Topnav**: persona pill + botão de notificação (badge unread) + avatar
- **Sidebar**: rotas contextualizadas por persona
- **Page header**: saudação + contexto PI/Sprint + view switcher
- **Bento grid**: 4 colunas, `gap: 10px`

### RTE — Release Train Engineer

**Cockpit:** Flow Efficiency + Riscos ROAM (ação obrigatória hoje)

| Célula | Span | Prioridade | Dados |
|--------|------|-----------|-------|
| Flow Efficiency | 1 | Crítica | % + sparkline 6 pontos + delta vs sprint anterior |
| Riscos ROAM | 1 | Crítica | contagem sem owner + badge vermelho |
| PI Objectives | 1 | Alta | % + progress bar + sprint atual |
| Dependências | 1 | Alta | total + bloqueadas |
| Notificações do ART | 2 | Crítica | tipos: risk, deadline, mention — máx 4 itens |
| Saúde dos Times | 2 | Alta | dot por time + vel + WIP status |
| Riscos Ativos | 2 | Média | lista ROAM com tags |
| Ações Rápidas | 1 | Baixa | Program Board, Flow, I&A, Dependências |
| Próximos Eventos | 1 | Baixa | Sprint Review, sync, PI Planning |

**View presets:** Operacional / Estratégico / Foco PI

**Sidebar específica:** Program Board, Flow Metrics, Riscos ROAM, Dependências, PI Objectives, I&A, Times do ART, Épicos, Copilot

---

### SM — Scrum Master / Team Lead

**Cockpit:** Impedimentos + WIP (ação para o time hoje)

| Célula | Span | Prioridade | Dados |
|--------|------|-----------|-------|
| Impedimentos | 2 | Crítica | lista com status + owner |
| WIP do Time | 1 | Crítica | atual/limite + badge amber se acima |
| Velocidade Sprint | 1 | Alta | pts atual + meta + progress bar + D+N |
| Notificações do Time | 2 | Crítica | tipos: mention, assignment, deadline |
| Membros do Time | 2 | Alta | avatar + nome + tasks abertas |
| Sprint Goals | 2 | Alta | progress bar por goal |
| Ações Rápidas | 1 | Baixa | Board, Impedimentos, Retro, Burndown |
| Agenda do Time | 1 | Baixa | Daily, Sprint Review, Retro |

**View presets:** Time / Sprint / Saúde

**Sidebar específica:** Board do Time, Impedimentos, Velocidade, Retrospectiva, Sprint Goals, Burndown, Program Board, Copilot

---

### PM / PO — Product Manager / Product Owner

**Cockpit:** OKRs + PI Objectives (valor entregue)

| Célula | Span | Prioridade | Dados |
|--------|------|-----------|-------|
| OKRs Q3 | 2 | Crítica | progress bar por KR + % individual |
| PI Objectives | 1 | Crítica | X/Y on track + progress bar |
| Features em Risco | 1 | Alta | count + badge amber |
| Notificações | 2 | Crítica | tipos: deadline, mention, risk |
| WSJF Top 5 | 2 | Alta | lista com score |
| Backlog Health | 2 | Média | contadores: Ready / Refinando / Bruto |
| Ações Rápidas | 1 | Baixa | Kanban, OKRs, WSJF, Backlog |
| Agenda | 1 | Baixa | PI Review, Demo, Refinamento |

**View presets:** Produto / Backlog / OKRs

**Sidebar específica:** Portfolio Kanban, OKRs, WSJF, Backlog, PI Objectives, Features em Risco, Flow Metrics, Copilot

---

### LPM — Lean Portfolio Manager

**Cockpit:** Lean Budget + Épicos aguardando aprovação (decisões executivas)

| Célula | Span | Prioridade | Dados |
|--------|------|-----------|-------|
| Lean Budget Guardrails | 2 | Crítica | total alocado + barras por tema estratégico |
| Épicos Pendentes | 1 | Crítica | count + botões Aprovar/Revisar |
| OKRs Portfolio | 1 | Alta | X/Y KRs on track |
| Notificações Executivas | 2 | Crítica | tipos: risk, system — sem ruído operacional |
| Épicos pra Aprovar | 2 | Alta | lista com ID + nome + botão de ação |
| WSJF Portfolio | 2 | Alta | top épicos por score |
| ARTs Overview | 2 | Média | dot por ART + flow % |
| Ações Rápidas | 1 | Baixa | Budget, Épicos, WSJF, OKRs |
| Agenda Executiva | 1 | Baixa | Portfolio Sync, Budget Review, Board |

**View presets:** Portfolio / Financeiro / Estratégico

**Sidebar específica:** Lean Budget, Épicos, WSJF Portfolio, OKRs Portfolio, ART Phoenix, ART Horizon, Riscos, Copilot

---

### SPC / Global (Fallback)

Quando `User.persona` não definido ou valor `spc`/`global`: mostra grid com overview de ARTs, métricas gerais, notificações sem filtro. Não requer spec dedicada — reutiliza células existentes com configuração `global`.

---

## Arquitetura

### Schema — campo `persona`

```prisma
// packages/database/prisma/schema.prisma
enum UserPersona {
  rte
  lpm
  pm
  team
  spc
  global
}

model User {
  // campos existentes...
  persona          UserPersona  @default(global)
  bentoPreferences Json?        // { hiddenCells: string[], activeView: string }
}
```

### Estrutura de arquivos

```
apps/app/app/(authenticated)/dashboard/
├── page.tsx                          # ← NOVO: home route
├── loading.tsx                       # existente (skeleton)
├── components/
│   ├── persona-bento.tsx             # ← NOVO: switch por persona
│   ├── bento-shell.tsx               # ← NOVO: layout + topnav + sidebar
│   ├── view-switcher.tsx             # ← NOVO: preset switcher
│   ├── personas/
│   │   ├── rte-home.tsx              # ← NOVO
│   │   ├── sm-home.tsx               # ← NOVO
│   │   ├── pm-home.tsx               # ← NOVO
│   │   ├── lpm-home.tsx              # ← NOVO
│   │   └── global-home.tsx           # ← NOVO (fallback)
│   └── cells/
│       ├── flow-efficiency-cell.tsx  # ← NOVO
│       ├── notifications-cell.tsx    # ← NOVO
│       ├── team-health-cell.tsx      # ← NOVO
│       ├── okr-progress-cell.tsx     # ← NOVO
│       ├── quick-actions-cell.tsx    # ← NOVO
│       └── ... (1 arquivo por tipo de célula)
```

### Fluxo de dados

```
page.tsx (Server Component)
  └── requireTenantSession()          # auth
  └── getUserPersona(userId)          # lê User.persona do DB
  └── <PersonaBento persona={...} />  # passa persona para client

PersonaBento (Client Component)
  └── switch(persona) → RteHome | SmHome | PmHome | LpmHome | GlobalHome

RteHome (Server Component)
  └── Promise.all([
        getFlowMetrics(artId),        # action existente
        listRisks({ unowned: true }), # action existente
        getPiObjectives(artId),       # action existente  
        listNotifications({ type: ['risk','deadline','mention'] }),
        getTeamHealth(artId),
      ])
  └── passa dados para células (client components apenas onde necessário)
```

### Integração com Notificações

O `NotificationsProvider` (Knock) já existe em `components/notifications-provider.tsx`. Cada `notifications-cell.tsx` por persona:

- Chama `listNotifications({ type: [...tiposRelevantes...], limit: 4 })`
- Filtra por relevância da persona:
  - RTE: `['risk', 'deadline', 'mention']`
  - SM: `['mention', 'assignment', 'deadline']`
  - PM: `['deadline', 'mention', 'risk']`
  - LPM: `['risk', 'system']` — sem `mention`/`assignment` (menos ruído)
- Badge de unread no topnav vem do provider Knock (já implementado)

### Preferências do usuário (Cell Toggle)

```typescript
// Salvo em User.bentoPreferences (JSONB)
type BentoPreferences = {
  hiddenCells: string[];   // ex: ['events', 'quick-actions']
  activeView: string;      // ex: 'operational'
}
```

Server action `updateBentoPreferences(prefs)` — chama `database.user.update({ where: { id }, data: { bentoPreferences: prefs } })`.

O settings panel (ícone ⚙ no page header) renderiza checkboxes por célula. Toggle imediato via optimistic update.

---

## Componentes de UI

### `BentoCell` — base

```typescript
type BentoCellProps = {
  span?: 1 | 2 | 3 | 4;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  accentColor?: string;  // CSS custom property
  eyebrow: string;
  href?: string;         // link "ver detalhes →"
  children: ReactNode;
}
```

`priority === 'critical'` → aplica `cell-accent` + `cell-glow` (conforme DESIGN.md).

### `ViewSwitcher`

Props: `views: string[]`, `active: string`, `onChange: (v: string) => void`.
Estado em `useState` local — não persiste (preset muda o que é visível, não o layout).

### Sidebar por persona

Cada home exporta `export const SIDEBAR_ITEMS: NavItem[]`. O `BentoShell` consome e renderiza. Items com badge: `{ label, href, icon, badge?: { count, variant: 'hot' | 'default' } }`.

---

## Persona Selection — Onboarding

No primeiro acesso (`User.persona === 'global'` e `User.createdAt < 24h`), exibir modal de seleção de persona antes do bento. Salva via `updateUserPersona(persona)`. Pode ser alterado em `/profile` → aba "Workspace".

---

## Dados fictícios / Server Actions existentes

Células que consomem dados reais vs. mock:

| Célula | Dados | Action existente? |
|--------|-------|------------------|
| Flow Efficiency | real | ✅ `getFlowMetrics` |
| Notificações | real | ✅ `listNotifications` |
| PI Objectives | real | ✅ (via pi-planning) |
| Riscos ROAM | real | ✅ `listRisks` |
| Dependências | real | ✅ `listDependencies` |
| Team Health | calculado | ⚠ Novo: agregar vel + WIP por time |
| OKRs progress | real | ✅ (via okrs actions) |
| Lean Budget | real | ✅ (via finops spec) |
| WSJF top 5 | real | ✅ `listEpics` com sort |
| Épicos pending | real | ✅ `listEpics({ status: 'PENDING_APPROVAL' })` |
| Membros do Time | real | ✅ via `getTeam` |
| Sprint Goals | real | ⚠ Novo: agregar goals por sprint |
| Eventos / Agenda | — | ❌ Novo: calendar integration (V2) → placeholder estático |

---

## Testes

- **Unit:** `bento-cell.test.tsx` — render com todas as variações de `priority` e `span`
- **Unit:** `view-switcher.test.tsx` — toggle de views
- **Unit:** `notifications-cell.test.tsx` — filtragem por persona
- **Integration:** `persona-bento.test.tsx` — mock de `getUserPersona`, verifica que cada persona renderiza o componente correto
- **E2E:** `persona-home.spec.ts` — smoke test: login → home → verifica que bento renderiza sem erro para RTE e SM

---

## Fora de escopo (V2)

- Drag-to-resize do bento
- Criação de células customizadas pelo usuário
- Integração com Google Calendar (eventos reais)
- Persona automática via role do DB (requer admin setup)
- Bento para SPC dedicado (usa Global)

---

## Referências

- Design visual: `.superpowers/brainstorm/6933-1781383061/content/cosmos-home-hifi.html`
- Design system: `DESIGN.md`
- Notificações: `apps/app/app/actions/notifications/`
- Personas copilot (referência): `apps/app/app/actions/safe-copilot/prompts/index.ts` → `MODE_PERSONAS`
- Spec relacionada: `2026-05-25-kanban-portfolio-ai-design.md`
- Spec relacionada: `2026-05-25-finops-lean-budget-design.md`
