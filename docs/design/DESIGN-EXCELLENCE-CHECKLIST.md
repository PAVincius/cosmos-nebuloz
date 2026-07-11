# Cosmos Nebuloz — Design Excellence Master Checklist

**Objetivo:** Software como obra de arte. Cada pixel com propósito.  
**Stack:** Next.js 15 + shadcn/ui + Tailwind + Motion (Framer)  
**Personas:** RTE, LPM, PO, SM, DevOps  
**Tema base:** Dark-first. Violet/cyan accent. Linear-inspired density.

---

## 1. DESIGN TOKENS — Fundação

### 1.1 Cor
- [ ] **Palette semântica** via CSS custom properties — não usar hex direto em componentes
- [ ] **Escala de superfícies** (5 níveis): bg-base → bg-raised → bg-overlay → bg-elevated → bg-floating
  - Atual: `#0a0a0d` → `#0f0f11` → `#111114` → `#16161a` → `#1e1e24`
  - ⚡ Linear usa bg-base levemente desaturado/aquecido vs pure black — reduz fadiga visual em 6–8h de uso; considerar `#09090b` (zinc) em vez de `#0a0a0d` pure black
- [ ] **Accent primário** `#7c6af7` com escala 50→900 (via Radix Colors ou custom)
- [ ] **Semântica de estado**: success/warning/destructive/info com variantes de fg/bg/border
- [ ] **AI signature color**: `#a89cff` `#1a1520` `#4a3060` — sempre consistente no produto
- [ ] **Alpha tokens**: overlays, hover states via `rgba` ou Radix alpha scales
- [ ] Testar contraste WCAG AA em todos os text colors sobre superfícies

### 1.2 Tipografia
- [ ] **Substituir Inter** — escolher fonte que transmita precisão + modernidade:
  - Candidatos: `Geist`, `Plus Jakarta Sans`, `DM Sans`, `Syne` (headings), `IBM Plex Sans`
  - Display/heading: algo com personalidade (`Syne`, `Space Grotesk` não — clichê)
  - Body: legibilidade em densidade alta (`DM Sans`, `Geist`)
  - Mono: `Geist Mono`, `JetBrains Mono` — para WSJF scores, IDs, métricas
  - ⚡ Pesquisa valida: fontes display muito expressivas criam ruído em uso enterprise 6h/dia — preferir `Geist` com peso 600–700 nos headings a uma display font separada; trade-off personalidade vs. fadiga
- [ ] **Escala tipográfica** definida (não usar sizes arbitrários):
  - `xs: 10px`, `sm: 11px`, `base: 13px`, `md: 15px`, `lg: 18px`, `xl: 22px`, `2xl: 28px`
- [ ] **Letter-spacing por nível**: labels uppercase `0.06em`, títulos `-0.02em`, body `0`
- [ ] **Line-height por contexto**: dense lists `1.3`, body text `1.6`, headings `1.2`
- [ ] **Fluid type** em telas grandes — RTEs usam monitors 27"+

### 1.3 Espaçamento
- [ ] **Grid de 4px** — toda margem/padding múltiplo de 4
- [ ] **Escala de gap**: 4, 6, 8, 12, 16, 20, 24, 32, 48, 64
- [ ] **Component padding** consistente: card `12px 14px`, panel `16px 20px`, topbar `12px 16px`
- [ ] **Negative space intencional** — enterprise tools tendem a sufocar; respirar nos headers

### 1.4 Borders & Radius
- [ ] **Escala de radius**: pill `999px`, button `6px`, card `8–10px`, modal `12px`, inner elements `4px`
- [ ] **Border sutil**: `#222228` padrão, `#2a2a30` hover, `accent/40` selected
- [ ] **Nunca usar box-shadow pesado** em dark theme — usar border + bg elevation
- [ ] ⚡ Fixar **mínimo viável de variações** — apenas os 5 radius acima + os 3 shadow levels; toda adição nova exige justificativa explícita (evitar proliferação que complica manutenção)

### 1.5 Sombras (Elevation)
- [ ] **Shadow system dark-aware** — sombras quase invisíveis; preferir backdrop-blur + border
- [ ] **3 níveis**: none → `0 1px 3px rgba(0,0,0,0.4)` → `0 8px 32px rgba(0,0,0,0.6)`
- [ ] **Floating elements** (popovers, dropdowns): blur + borda translúcida
  ```css
  backdrop-filter: blur(12px);
  background: rgba(17, 17, 20, 0.92);
  border: 1px solid rgba(255,255,255,0.08);
  ```

---

## 2. SISTEMA DE MOTION

### 2.1 Princípios
- [ ] Motion é **funcional primeiro** — indica mudança de estado, não decora
- [ ] Power users (RTE, LPM) odeiam esperar — `duration < 200ms` para micro-interações
- [ ] `prefers-reduced-motion` respeitado em todos os componentes

### 2.2 Curvas de Easing (definir como tokens)
```css
--ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);     /* elementos entrando */
--ease-in: cubic-bezier(0.4, 0.0, 1, 1);          /* elementos saindo */
--ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1);   /* mudanças de estado */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* drag & drop, modals */
--ease-sharp: cubic-bezier(0.4, 0, 0.6, 1);       /* hover rápido */
```

### 2.3 Durations
- [ ] `instant: 0ms` — toggles, checkboxes
- [ ] `fast: 100ms` — hover bg, border color
- [ ] `normal: 150ms` — tooltips, dropdowns aparecem
- [ ] `slow: 250ms` — cards expandem, painéis deslizam
- [ ] `deliberate: 350ms` — modals, drawer entry
- [ ] `page: 400ms` — page transitions

### 2.4 Micro-interações Prioritárias
- [ ] **Card hover**: border-color elevate + subtle bg shift + reveal actions (opacity 0→1)
  - NÃO usar scale (parece childish para enterprise)
  - SIM usar border brighten + action row fade-in
- [ ] **Kanban drag**: ghost card com `opacity: 0.5`, destination highlight, drop snap `--ease-spring`
- [ ] **Button press**: `scale(0.97)` com `100ms` — satisfying feedback; ⚡ scale muito sutil — não acionar em ações destrutivas (confunde affordance)
- [ ] **AI chip expand** (já implementado): `width: 36px → auto` com `cubic-bezier(0.4, 0, 0.2, 1)`
- [ ] **Status badge pulse**: subtle `@keyframes pulse` em itens blocked/at-risk
- [ ] **Drawer open**: `translateX(100%)` → `translateX(0)` com `--ease-spring` `350ms`
- [ ] **Toast notifications**: slide-in from bottom-right, auto-dismiss com progress bar
- [ ] **Loading skeleton**: shimmer animado matching real content shape
- [ ] **Number counters**: animação ao carregar métricas (WSJF score, velocity)
- [ ] **Breadcrumb transition**: ao navegar ART → PI → Team
- [ ] **Progress bar fill**: suave ao atualizar % de completion

### 2.5 Matriz Frequência × Expressividade ⚡
- [ ] Documentar regra: interações diárias >10x → `fast (100ms)`, raramente →  `deliberate (350ms)`
  ```
  Alta frequência: hover card, click status, drag kanban → max 150ms, zero scale
  Média frequência: abrir drawer, mudar sprint, criar card → 250-350ms, spring OK
  Baixa frequência: onboarding, PI transition, import → 400ms+, motion narrativo
  ```

---

## 3. ESTADOS DE COMPONENTE — TODOS os 8

Para cada componente interativo, definir:

```
default → hover → focus → active → loading → disabled → error → empty
```

### 3.1 Cards (Epic, Feature, Story, Task)
- [ ] **default**: border `#222228`, bg `#111114`
- [ ] **hover**: border `#3a3a4a`, bg `#14141a`, actions row visível, cursor `pointer`
- [ ] **selected/active**: border `#7c6af7`, bg `#1a1520`, left border accent 3px
- [ ] **dragging**: `opacity: 0.8`, `box-shadow: 0 8px 32px rgba(0,0,0,0.6)`, `cursor: grabbing`
- [ ] **loading**: skeleton shimmer no lugar do content
- [ ] **blocked**: border `#ef4444/40`, left-border `#ef4444`, pulse animation
- [ ] **empty column**: dashed border, centered icon + CTA text

### 3.2 Botões
- [ ] **Primary**: bg `#7c6af7`, hover `#9080ff`, active `scale(0.97)`, focus ring visível
- [ ] **Ghost**: border transparente, hover border `#2a2a30` + bg sutil
- [ ] **Destructive**: uso comedido, nunca em posição primária no layout
- [ ] **AI action**: gradiente característico (Claude orange, Perplexity etc.)
- [ ] **Loading state**: spinner substituindo label, width travado (sem layout shift)
- [ ] **Icon button**: `36px` touch target mínimo, tooltip obrigatório

### 3.3 Inputs & Forms
- [ ] **default**: border `#2a2a30`, bg `#0f0f12`
- [ ] **focus**: border `#7c6af7`, ring `rgba(124,106,247,0.2)` 2px offset
- [ ] **error**: border `#ef4444`, ring vermelho, mensagem de erro abaixo
- [ ] **success**: border `#4ade80` sutil após validação
- [ ] **disabled**: `opacity: 0.5`, `cursor: not-allowed`
- [ ] **AI caret**: `caret-color: #7c6af7` — detalhe que impressiona

### 3.4 Tabelas & Listas Densas (LPM, RTE)
- [ ] Zebra striping sutil (`#111114` / `#0f0f11`)
- [ ] Row hover: bg raise + action buttons aparecem (opacity)
- [ ] Selected row: border-left accent
- [ ] Sortable columns: indicator discreto, cursor `pointer`, active column destaque
- [ ] Sticky header com backdrop-blur ao scroll

### 3.5 Badges & Status Pills
- [ ] Sistema de cores semântico: funnel, blocked, done, at-risk, analysis, in-flight
- [ ] Size variants: `sm` (10px, 2px 7px), `md` (11px, 3px 10px)
- [ ] AI badges: sempre com `✦` símbolo, cor `#a89cff`
- [ ] Nunca usar só cor — sempre color + texto (acessibilidade)

---

## 4. LAYOUT & COMPOSIÇÃO

### 4.1 Shell do App
- [ ] **Sidebar**: largura `56px` collapsed / `220px` expanded — transição suave
  - Collapsed: icons only com tooltip
  - Expanded: icon + label
  - Hover na collapsed: tooltip imediato (0ms delay)
- [ ] **Header contextual**: muda por área (Portfolio → PI → Team → Story)
  - Breadcrumb hierárquico clicável
  - Actions contextuais à direita
- [ ] **Content area**: max-width 1440px, padding `24px`, fluid
- [ ] **Multi-panel layout** para RTE/LPM: suportar split view (board + detalhe)
- [ ] ⚡ **Breakpoints responsivos** definidos: `sm: 768px`, `md: 1024px`, `lg: 1280px`, `xl: 1440px`, `2xl: 1920px` — shell colapsa sidebar automaticamente em `< lg`

### 4.2 Kanban Board
- [ ] **Colunas**: width `280–320px`, scroll horizontal suave, sticky column headers
- [ ] **Column header**: título + count badge + overflow actions
- [ ] **Add card**: sempre visível no footer da coluna, não só hover
- [ ] **WIP limit visual**: color indicator quando limite atingido
- [ ] **Empty state** por coluna: dashed border + ícone + texto ação
- [ ] **Horizontal scroll**: indicator de que existe mais (fade na borda)

### 4.3 Drawers & Painéis Laterais
- [ ] **Story drawer**: 480–560px largura, overlay parcial (conteúdo ainda visível)
- [ ] **Close**: Escape key, click fora, X button — todos funcionando
- [ ] **Scroll interno**: header sticky dentro do drawer
- [ ] **AI panel**: section colapsável dentro do drawer, não modal separado

### 4.4 Modais
- [ ] Usar modal só quando requer decisão crítica — preferir drawer para edição
- [ ] Overlay `rgba(0,0,0,0.7)` com blur no conteúdo abaixo
- [ ] Foco trap + Escape key obrigatório
- [ ] Tamanho adequado ao conteúdo — evitar modais gigantes

---

## 5. UX POR PERSONA

### 5.1 RTE (Release Train Engineer) — "Visão sistêmica, velocidade de reação"
**Jobs-to-be-done**: Gerenciar dependências, monitorar teams, conduzir PI Planning, reagir a riscos
- [ ] **Program Board**: setas de dependência visíveis, color-coded por equipe
- [ ] **ART Health indicator**: sempre visível no header quando em contexto ART
- [ ] **PI Planning view**: timeline horizontal com sprints como colunas
- [ ] **Risk ROAM board**: quick-access, não enterrado em menus
- [ ] **Cross-team metrics**: velocity, predictability, impediments — dashboard consolidado
- [ ] **Quick filters**: por team, por risco, por status — keyboard shortcut
- [ ] **Inline resolve**: resolver impedimento diretamente na lista sem abrir drawer
- [ ] ⚡ **Keyboard navigation per persona** (Linear-style, `g` + key): `g a` → ART view, `g p` → PI Planning, `g r` → ROAM board, `g d` → Dependencies — documentar e expor via help modal `?`

### 5.2 LPM (Lean Portfolio Manager) — "Decisão financeira, priorização estratégica"
**Jobs-to-be-done**: Priorizar epics via WSJF, alocar lean budgets, alinhar com OKRs
- [ ] **Portfolio Kanban**: densidade alta tolerável — mais info por card que time kanban
- [ ] **WSJF Calculator**: inline no card (hover/expand), não em modal separado
- [ ] **Budget allocation**: visual de pie/bar sempre visível na página de portfolio
- [ ] **Strategic themes**: color-coding dos epics por tema estratégico
- [ ] **Epic aging**: indicador visual de epics sem movimento
- [ ] **OKR alignment**: badge de OKRs linkados visível no card
- [ ] **Export / report**: PDF/CSV de portfolio state — acessível sem n cliques
- [ ] ⚡ **Keyboard nav LPM**: `g k` → Portfolio Kanban, `g b` → Lean Budget, `g w` → WSJF view

### 5.3 PO (Product Owner) — "Clareza do backlog, alinhamento de valor"
**Jobs-to-be-done**: Priorizar features, refinar stories, aceitar entregáveis
- [ ] **Feature backlog**: lista densa com quick-edit inline para pontos e prioridade
- [ ] **Story map**: view horizontal (user activities como colunas)
- [ ] **Acceptance criteria**: editor rápido, templates sugeridos pelo AI
- [ ] **Sprint overview**: quais stories estão em qual sprint, drag para reordenar
- [ ] **Dependency view**: features que bloqueiam outras equipes destacadas
- [ ] **AI INVEST check**: visible passivamente, não intrusivo

### 5.4 SM (Scrum Master) — "Cadência, impedimentos, melhoria contínua"
**Jobs-to-be-done**: Conduzir cerimônias, remover impedimentos, rastrear velocidade
- [ ] **Team sprint board**: swimlanes por pessoa, colunas TODO/In Progress/Done/Review
- [ ] **Impediment log**: acessível 1 clique do board, urgência visual
- [ ] **Daily standup mode**: modo limpo mostrando só o essencial (yesterday/today/blockers)
- [ ] **Velocity chart**: histórico dos últimos 6 sprints sempre acessível
- [ ] **Sprint health**: burn-down e burn-up, real-time
- [ ] **Retro board**: modo fechado até hora certa, anon mode

### 5.5 DevOps — "Visibilidade de pipeline, detecção rápida de problemas"
**Jobs-to-be-done**: Monitorar deployments, rastrear environments, correlacionar com features
- [ ] **Pipeline status**: verde/amarelo/vermelho por environment, no dashboard
- [ ] **Story → Deploy linkage**: story card mostra qual build deployou
- [ ] **Environment health**: overview grid de todos os environments
- [ ] **One-click rollback trigger**: com confirmation, acessível sem 5 menus
- [ ] **Build time metrics**: trend de duração dos builds
- [ ] ⚡ **Integration plan** — definir quais providers são suportados first (GitHub Actions, GitLab CI, Argo CD) e onde o status aparece (story card + pipeline page); sem isso o DevOps dashboard vira "generic" sem profundidade

---

## 6. AI UX — PADRÕES ESPECÍFICOS

### 6.1 AI sempre passiva primeiro
- [ ] Insights AI ficam **colapsados** por padrão, expandem on demand
- [ ] Nunca bloquear o fluxo com AI — suggestions são sugestões, não obrigações
- [ ] Loading states de AI: skeleton específico (não spinner genérico)
  ```
  ✦ Analisando contexto... [shimmer bar]
  ```
- [ ] AI confidence indicator — não mostrar resultados com baixa confiança sem flag
- [ ] ⚡ **Explainability standard**: toda insight AI mostra fonte — "baseado em 3 Epics, 12 Features, PI-4" — LPM/RTE precisam justificar decisões para stakeholders; black box inaceitável
- [ ] ⚡ **Confidence como texto**: não só barra de cor — usar `low / medium / high` com descrição curta do motivo

### 6.2 AI Visual Identity
- [ ] `✦` símbolo sempre precede qualquer elemento AI
- [ ] Cor `#a89cff` exclusiva para AI — nunca usar em outros contextos
- [ ] AI container: `bg #1a1520`, `border #4a3060` — distinguível sem ser intrusivo
- [ ] AI buttons: gradientes únicos por provider (Claude orange, etc.)

### 6.3 AI Actions (expandable pill pattern — já implementado)
- [ ] Manter o padrão `width: 36px → auto` no hover
- [ ] Adicionar `haptic feedback` visual (scale micro-pulse) ao clicar
- [ ] Grouped actions por categoria (Analyze / Write / Score)

---

## 7. ACESSIBILIDADE

- [ ] **Focus visible** em todos os elementos interativos — nunca `outline: none` sem alternativa
- [ ] **ARIA labels** em icon-only buttons, badges de status, progress bars
- [ ] **Keyboard navigation**: Tab order lógico, Escape fecha overlays
- [ ] **Color não é único portador de informação** — sempre icon ou texto também
- [ ] **Touch targets**: mínimo 44×44px em mobile (some personas usam tablet em PI)
- [ ] **Screen reader**: kanban cards com summary legível por AT
- [ ] ⚡ **Automated a11y pipeline**: `axe-core` via `@axe-core/playwright` nos E2E tests + `eslint-plugin-jsx-a11y` no lint — Atlassian integrou a11y check ao design system e corrigiu >1000 issues de uma vez; fazer isso desde o início é 10x mais barato

---

## 8. PERFORMANCE PERCEBIDA

- [ ] **Skeleton screens** > spinners globais — mostrar estrutura enquanto carrega
- [ ] **Optimistic UI** em drag & drop, mudanças de status, toggle
  - Atualiza UI imediatamente, reverte se API falhar com toast
- [ ] **Pagination virtual** em listas longas (backlog com 100+ items)
- [ ] **Image**: avatares com fallback gracioso (initials), lazy load
- [ ] **Debounce** em search/filter inputs — `300ms`
- [ ] ⚡ **Performance targets explícitos**: TTI < 2s, FCP < 1s, FPS ≥ 60 durante drag de kanban (medir com Chrome Profiler); PI Board com 100 cards não pode cair abaixo de 45 FPS

---

## 9. CONSISTÊNCIA DE LINGUAGEM VISUAL

### Ícones
- [ ] **Lucide** (já na stack) — manter 100% consistente, nunca misturar com outros
- [ ] SAFe domain icons: criar set específico (PI, ART, Epic, Feature, Story, Spike)
- [ ] Icon size: `16px` inline, `20px` button, `24px` header actions
- [ ] **Stroke width** consistente: `1.5px` para ícones normais, `2px` para enfático

### Linguagem de Dados
- [ ] Datas: sempre formato relativo quando < 7 dias ("há 2 dias"), ISO quando mais
- [ ] Números: abreviar acima de 1000 ("1.2k"), pontos decimais só quando relevante
- [ ] Percentuais: sempre acompanhados de barra de progresso visual
- [ ] IDs: monospace, cor `#666`, menor que o conteúdo principal
- [ ] ⚡ **SAFe 6.0 Editorial Style Guide**: criar `docs/design/MICROCOPY-GLOSSARY.md` com termos canônicos — "PI Planning" não "Sprint Planning", "ART" não "Train", "Epic" com E maiúsculo quando se refere ao artefato SAFe; alinha com materiais oficiais Scaled Agile

---

## 10. DARK/LIGHT MODE

- [ ] Light mode NÃO é inversão — design separado com variáveis próprias
- [ ] Light: superfícies `#fafafa` → `#f4f4f5` → `#e4e4e7`, texto `#09090b`
- [ ] Accent violet funciona bem em ambos — verificar contraste
- [ ] Transição de tema: `transition: background-color 200ms, color 200ms` no `:root`
- [ ] Imagens/screenshots de code: usar fundo `#0f0f11` mesmo em light mode (convention)
- [ ] ⚡ **Definir persona primária do light mode**: executivos (CTO, VP Strategy) em MacBook em reuniões — priorizar contraste de texto denso; boards de kanban em light ficam mais pesados, testar antes de publicar

---

## PRIORIZAÇÃO DE IMPLEMENTAÇÃO

### Impacto imediato (fazer antes de demo/trial)
1. Token de cor semântico + escala de superfícies consistente
2. Tipografia: trocar Inter por Geist ou similar
3. Todos estados de hover/active nos cards do kanban
4. Skeleton screens nos boards
5. Drawer animation com easing spring

### Impacto médio (sprint seguinte)
6. AI UX consistency (✦ + cores)
7. Personas shortcuts (quick filter do RTE, budget view do LPM)
8. Optimistic UI no drag & drop
9. Focus visible em todos os interativos

### Polimento (para v1.0 público)
10. Light mode próprio (prioridade: executivos em MacBook)
11. Animações de número/counter
12. Standup mode do SM
13. ⚡ **Accessibility audit estruturado** — axe scan completo + fix das issues críticas antes do launch público
14. ⚡ **SAFe Microcopy Glossary** publicado e aplicado em todo o produto

---

> ⚡ = item adicionado ou atualizado com base na avaliação de mercado (Linear, Atlassian, Productboard, SAFe 6.0)
