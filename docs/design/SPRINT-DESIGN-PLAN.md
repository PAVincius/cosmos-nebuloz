# Cosmos Nebuloz — Design Excellence Sprint Plan

**Base:** DESIGN-EXCELLENCE-CHECKLIST.md + avaliação de mercado (Linear, Atlassian, Productboard, SAFe 6.0)  
**Objetivo:** UI pronta para trials pagos com RTEs/LPMs no Brasil/LATAM  
**Stack:** Next.js 15 + shadcn/ui + Tailwind 4 + Motion (Framer)

---

## Sprint D-0 — Fundação de Tokens (antes de qualquer trial)
**Duração estimada:** 3–5 dias  
**Meta:** Cada componente já existente herda tokens; zero hex hardcoded em novos componentes

### Entregáveis

#### D-0.1 — CSS Design Tokens (apps/app/app/globals.css ou packages/ui/tokens.css)
```css
/* Superfícies — zinc-based para reduzir fadiga (Linear-validated) */
--color-bg-base: #09090b;
--color-bg-raised: #0f0f11;
--color-bg-overlay: #111114;
--color-bg-elevated: #16161a;
--color-bg-floating: #1e1e24;

/* Borders */
--color-border-default: #222228;
--color-border-hover: #2a2a30;
--color-border-selected: rgba(124, 106, 247, 0.4);

/* Accent violet — escala */
--color-accent-50:  #f0eeff;
--color-accent-300: #c4b8ff;
--color-accent-500: #7c6af7;
--color-accent-600: #6a58e5;
--color-accent-900: #1a1520;

/* AI signature — EXCLUSIVA, não reutilizar */
--color-ai-fg:     #a89cff;
--color-ai-bg:     #1a1520;
--color-ai-border: #4a3060;

/* Semântica de estado */
--color-success-fg:     #4ade80;
--color-success-bg:     #0f1f0f;
--color-success-border: #2a4a2a;
--color-warning-fg:     #fbbf24;
--color-warning-bg:     #1f1500;
--color-warning-border: #4a3500;
--color-danger-fg:      #f87171;
--color-danger-bg:      #1f0f0f;
--color-danger-border:  #4a2020;

/* Motion */
--ease-out:    cubic-bezier(0.0, 0.0, 0.2, 1);
--ease-in:     cubic-bezier(0.4, 0.0, 1, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-sharp:  cubic-bezier(0.4, 0, 0.6, 1);

--duration-fast:      100ms;
--duration-normal:    150ms;
--duration-slow:      250ms;
--duration-deliberate:350ms;
```

#### D-0.2 — Tipografia (Geist)
- [ ] Instalar `next/font` com `Geist` (sans) + `Geist Mono`
- [ ] Remover `--font-inter`, substituir `--font-geist` e `--font-geist-mono`
- [ ] Definir escala `text-xs(10)` → `text-2xl(28)` no tailwind.config
- [ ] Letter-spacing tokens: `tracking-label` (0.06em), `tracking-tight` (-0.02em)

#### D-0.3 — Radius & Shadow mínimo viável
- [ ] `radius-inner: 4px`, `radius-sm: 6px`, `radius-md: 8px`, `radius-lg: 12px`, `radius-pill: 9999px`
- [ ] `shadow-sm: 0 1px 3px rgba(0,0,0,0.4)`, `shadow-lg: 0 8px 32px rgba(0,0,0,0.6)`
- [ ] Popover/floating: `backdrop-blur(12px)` + `rgba(17,17,20,0.92)` + border 1px white/8%

**Critério de aceite:** `pnpm check` passa; componentes existentes funcionando; 0 hex hardcoded em componentes novos

---

## Sprint D-1 — Estados de Componente (demo-ready)
**Duração estimada:** 5–7 dias  
**Meta:** Kanban cards, botões e drawers com todos os 8 estados

### Entregáveis

#### D-1.1 — Epic/Feature/Story Card (`kanban-card.tsx`)
- [ ] default, hover (border + bg + action-row fade-in), selected (left accent 3px)
- [ ] dragging (opacity 0.8 + shadow-lg + cursor grabbing)
- [ ] blocked (border danger + left-border + pulse @keyframes)
- [ ] loading (skeleton shimmer matching card shape)
- [ ] empty column (dashed border + icon + CTA)

#### D-1.2 — Botões
- [ ] Primary + Ghost + Destructive + AI action — todos os estados
- [ ] Loading state com width travado (sem layout shift)
- [ ] Icon button 36px touch target + tooltip

#### D-1.3 — Drawer com easing spring
- [ ] `translateX(100%)` → `translateX(0)` em `350ms` `--ease-spring`
- [ ] Escape key, click fora, X button
- [ ] Header sticky + scroll interno

#### D-1.4 — Skeleton Screens
- [ ] Portfolio board
- [ ] Team sprint board
- [ ] Story drawer

**Critério de aceite:** Screencast do portfolio kanban mostra hover/drag/blocked sem glitches; Playwright snapshot tests passam

---

## Sprint D-2 — AI UX + Keyboard Power
**Duração estimada:** 4–5 dias  
**Meta:** IA tem identidade visual coesa; RTE/LPM têm atalhos de teclado

### Entregáveis

#### D-2.1 — AI Visual Identity aplicada em todo produto
- [ ] Todos `✦` badges usando `--color-ai-fg` `--color-ai-bg` `--color-ai-border`
- [ ] Loading state de AI: `✦ Analisando contexto... [shimmer]`
- [ ] Confidence badge: `low / medium / high` + texto descritivo (não só cor)
- [ ] Explainability: cada insight mostra fonte (ex: "baseado em 4 Epics, PI-3")

#### D-2.2 — Keyboard Navigation Map
- [ ] Global hotkeys: `?` abre help modal com todos os atalhos
- [ ] RTE: `g a` ART, `g p` PI Planning, `g r` ROAM, `g d` Dependencies
- [ ] LPM: `g k` Portfolio Kanban, `g b` Lean Budget, `g w` WSJF
- [ ] Universal: `c` cria novo item (contextual), `Esc` fecha overlay/drawer

#### D-2.3 — Optimistic UI
- [ ] Drag & drop atualiza estado local antes da API
- [ ] Rollback com toast se API falhar
- [ ] Status toggle (change card status) otimista

**Critério de aceite:** RTE completa fluxo ART → PI → Risk ROAM sem mouse; AI badge usa cores corretas em toda a app

---

## Sprint D-3 — Performance + Accessibility Baseline
**Duração estimada:** 3–4 dias  
**Meta:** Métricas de performance explícitas; a11y automatizada no pipeline

### Entregáveis

#### D-3.1 — Performance
- [ ] Virtual list (`@tanstack/virtual`) em backlogs com 50+ items
- [ ] Lighthouse CI: TTI < 2s, FCP < 1s no CI pipeline
- [ ] FPS benchmark: PI Board com 100 cards drag ≥ 45 FPS (Chrome Profiler)
- [ ] Lazy load de avatares + fallback gracioso (initials)

#### D-3.2 — Acessibilidade Baseline
- [ ] `eslint-plugin-jsx-a11y` instalado e rodando no lint
- [ ] `@axe-core/playwright` adicionado em `e2e/a11y.spec.ts` — scan nas 3 views principais
- [ ] Focus visible em todos os interativos (sem `outline: none` nu)
- [ ] ARIA labels em icon-only buttons + badges de status

**Critério de aceite:** Lighthouse a11y score ≥ 90; `pnpm test` e Playwright axe scan passam sem critical issues

---

## Sprint D-4 — Polimento v1.0 (pré-launch público)
**Duração estimada:** 5–7 dias

#### D-4.1 — Light Mode real
- [ ] Tokens separados para light: `#fafafa` → `#f4f4f5` → `#e4e4e7`
- [ ] Testar kanban e portfolio board em light — foco em executivos (CTO, VP)
- [ ] `transition: background-color 200ms, color 200ms` no `:root`

#### D-4.2 — SAFe Microcopy Glossary
- [ ] `docs/design/MICROCOPY-GLOSSARY.md` com todos os termos SAFe 6.0
- [ ] Pass em todo o produto garantindo terminologia correta
- [ ] Copy review nas empty states, tooltips, help texts

#### D-4.3 — DevOps Integration Design
- [ ] Definir MVP de integração: GitHub Actions first
- [ ] Story card mostra último deploy (build status + link)
- [ ] Pipeline page com environment grid (3 ambientes: dev/staging/prod)

#### D-4.4 — Accessibility Audit Estruturado
- [ ] axe-core full scan via script
- [ ] Fix todas as issues críticas (WCAG AA)
- [ ] Contraste verificado em dark e light mode

---

## Mapa de Implementação

```
D-0: Tokens          → D-1: Component States → D-2: AI + Keyboard
     [3-5 dias]           [5-7 dias]               [4-5 dias]
         ↓                     ↓                        ↓
                    D-3: Perf + A11y baseline → D-4: Polish v1.0
                         [3-4 dias]                [5-7 dias]
```

**Total estimado:** ~20–28 dias de implementação paralela com feature dev

---

## Referências Validadas pela Pesquisa

| Decisão | Validado por |
|---------|-------------|
| Tokens semânticos de cor | Atlassian DS, Linear |
| bg-base zinc (desaturado) | Linear análise de fadiga visual |
| Geist como fonte body | Linear, Vercel, Resend |
| 4px grid para densidade | Linear, Easy Agile |
| Motion funcional < 200ms | Atlassian Motion Guidelines |
| AI passiva first | Productboard AI, Aha! |
| Keyboard shortcuts `g+key` | Linear (power user pattern) |
| axe-core em CI | Atlassian a11y integration case |
| Optimistic UI | Linear, Figma |
| Virtual list em backlogs | Linear, Productboard |
