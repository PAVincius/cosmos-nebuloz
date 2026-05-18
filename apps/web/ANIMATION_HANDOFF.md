# Animation Handoff — Cosmos Site
## Tier 2 Implementation Brief

**Projeto**: Cosmos by Nebuloz — site marketing (`apps/web`)
**Stack**: Next.js 16 + React 19 + Framer Motion + Lenis (já instalados)
**Design ref**: huly.io / Awwwards-level enterprise SaaS
**Design system**: `DESIGN.md` na raiz do repo — leia antes de qualquer código

---

## Estado atual (Tier 1 — DONE)

### Componentes de animação em `/components/cosmos/`

| Arquivo | O que faz |
|---------|-----------|
| `lenis-provider.tsx` | Smooth scroll global (já no layout) |
| `fade-in.tsx` | `FadeIn`, `FadeInGroup`, `FadeInChild` — scroll reveals |
| `split-text.tsx` | `SplitText` (word-by-word blur→sharp), `RevealBlock` |
| `tilt-card.tsx` | `TiltCard` — 3D perspective tilt + cursor glow |
| `animated-counter.tsx` | `AnimatedCounter` (spring), `AnimatedBar` (fill) |
| `conic-border.tsx` | `ConicBorderCard` — border sweep conic-gradient on hover |
| `draw-line.tsx` | `DrawLine` (SVG pathLength), `GraphNode`, `PulseDot` |

### Animações no hero (já funcionando)
- Split-text blur→sharp com stagger por palavra
- Orb breathing (scale loop, 5s)
- Parallax mockup no scroll via `useScroll` + `useTransform`
- Sidebar + ART lanes stagger sequential
- AI card glow pop final

### Seções com animações
- `stats.tsx`: `AnimatedCounter` + `ConicBorderCard`
- `features.tsx`: `TiltCard` + `FadeInGroup` + mini mockups SVG

---

## Tier 2 — Specs de implementação

### T2.1 — Dependency Lines Draw (SVG pathLength)

**Onde**: `features.tsx` → card `DependencyMockup`
**Objetivo**: linhas SVG se desenham progressivamente ao entrar no viewport

**Spec**:
```tsx
// Substituir as <line> estáticas por DrawLine components
// A linha crítica (ART-1 → ART-2) deve:
//   1. Começar cinza (var(--border))
//   2. pathLength: 0 → 1 em 1.2s
//   3. Após completar: cor muda para var(--accent) via animate
//   4. Um dot viaja pela linha após draw completo

// Dot viajando:
// Usar offsetPath com CSS motion-path ou
// Framer Motion: x/y interpolados ao longo dos pontos da linha

// Timing:
//   - Nodes (GraphNode) aparecem primeiro com stagger 80ms
//   - Linhas neutras desenham em seguida (delay 0.3s, stagger 0.1s)
//   - Linha crítica por último (delay 0.9s) + muda de cor em 1.3s
//   - AI badge aparece em 1.5s

// O DrawLine já existe em /components/cosmos/draw-line.tsx
// GraphNode também — usar ambos
```

**Arquivo a modificar**: `app/[locale]/(home)/components/features.tsx` → função `DependencyMockup`

---

### T2.2 — "Chaos → Order" Scroll Scene

**Onde**: nova seção entre `<Hero />` e `<Cases />` em `page.tsx`
**Arquivo novo**: `app/[locale]/(home)/components/chaos-order.tsx`
**Objetivo**: seção "pinned" que mostra PI Planning saindo do caos em 3 fases via scroll

**Layout**:
```
Seção com height: 300vh (3x viewport)
Conteúdo pinado (position: sticky, top: 0)
Enquanto scroll avança 0→33%→66%→100%:
  Fase 1 (0→33%): "Antes do Cosmos" — cards espalhados, rotações caóticas
  Fase 2 (33→66%): IA "analisando" — linhas aparecem conectando os cards
  Fase 3 (66→100%): "Depois do Cosmos" — tudo snaps em ART lanes organizadas

Headline muda a cada fase (via scrollProgress):
  Fase 1: "Seu PI Planning hoje." (text-muted)
  Fase 2: "IA analisando dependências..." (accent)
  Fase 3: "PI Planning organizado." (text, bold)
```

**Implementação técnica**:
```tsx
"use client";
import { useScroll, useTransform, motion } from "framer-motion";
import { useRef } from "react";

// Container com height: 300vh
// Elemento sticky dentro
// useScroll({ target: containerRef, offset: ["start start", "end end"] })
// scrollYProgress: 0 → 1

// 6-8 "cards de feature" com:
//   - posição inicial: random (x: -200 a 200, y: -150 a 150, rotate: -15 a 15)
//   - fase 1: nessas posições
//   - fase 2: movem em direção ao centro (x: 0±50, y: 0±40, rotate: ±3)
//   - fase 3: snappam em 3 colunas (ART lanes) com posições exatas

// useTransform para interpolar cada propriedade via scrollYProgress
// Linha SVG entre cards: opacity 0→1 no range 0.3→0.6

// Performance: usar will-change: transform
// NÃO usar layout animations aqui — só transform
```

**Tokens para os cards de fase:**
```tsx
const CARD_POSITIONS = {
  chaos: [
    { x: -180, y: -80, r: -12 },
    { x: 60, y: -140, r: 8 },
    { x: 200, y: -20, r: -5 },
    { x: -100, y: 60, r: 15 },
    { x: 140, y: 90, r: -10 },
    { x: -40, y: 120, r: 6 },
  ],
  ordered: [
    { x: -240, y: -50, r: 0 }, // ART-1 lane
    { x: -240, y: 20, r: 0 },
    { x: 0, y: -50, r: 0 },    // ART-2 lane
    { x: 0, y: 20, r: 0 },
    { x: 240, y: -50, r: 0 },  // ART-3 lane
    { x: 240, y: 20, r: 0 },
  ],
};
```

---

### T2.3 — Gradient Text Shimmer

**Onde**: `hero.tsx` → "sem caos." e "visibilidade real."
**Objetivo**: sweep de luz da esquerda para direita, loop infinito

**Implementação**:
```css
/* Em styles.css — adicionar: */
@keyframes text-shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

.text-shimmer {
  background: linear-gradient(
    90deg,
    var(--accent) 0%,
    rgba(255,255,255,0.9) 40%,
    var(--accent) 50%,
    rgba(0,212,255,0.7) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: text-shimmer 4s linear infinite;
}
```

**Em hero.tsx**: substituir o `style={{ color: "var(--accent)", textShadow: ... }}` nas SplitText com `className="text-shimmer"`.

---

### T2.4 — Scroll Progress Bar

**Onde**: `layout.tsx` (global)
**Arquivo novo**: `components/cosmos/scroll-progress.tsx`

```tsx
"use client";
import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  return (
    <motion.div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: "var(--accent)",
        transformOrigin: "0%",
        scaleX,
        zIndex: 9999,
        boxShadow: "0 0 8px var(--accent-glow)",
      }}
    />
  );
}
```

Adicionar no `layout.tsx` junto ao `LenisProvider`.

---

### T2.5 — Number Morph no Hero Badge

**Onde**: hero.tsx → badge flutuante "21 dias → 2 dias"
**Objetivo**: "21" conta down até "2" com spring physics ao entrar no viewport

**Componente a criar**: `components/cosmos/morph-number.tsx`
```tsx
// AnimatedCounter invertido: começa em 21, vai até 2
// Spring: stiffness 40, damping 15 (desacelera agressivamente nos últimos 5)
// Cor muda: starts var(--warning) at 21, transitions to var(--success) at 2
// Trigger: useInView com once: true
```

---

## Dependências a instalar (Tier 2)

```bash
# Nenhuma dependência nova necessária para T2.1, T2.3, T2.4, T2.5
# Para T2.2 se usar GSAP:
pnpm add gsap @gsap/react --filter web

# Para Tier 3 (não é Tier 2):
pnpm add three @react-three-fiber @react-three/drei --filter web
```

---

## Ordem de implementação recomendada

```
Dia 1: T2.4 (scroll progress — 30min) + T2.3 (shimmer — 30min)
Dia 2: T2.1 (draw lines — 2h)
Dia 3: T2.5 (morph number — 1h)
Dia 4-5: T2.2 (chaos→order — 1 dia inteiro)
```

---

## Contexto de arquitetura atual

```
apps/web/
├── app/[locale]/
│   ├── layout.tsx              ← LenisProvider já aqui
│   ├── styles.css              ← design tokens v2 (DESIGN.md)
│   └── (home)/
│       ├── page.tsx            ← ordem: Hero Cases Features Stats Testimonials FAQ CTA
│       └── components/
│           ├── hero.tsx        ← SplitText + orb + parallax mockup
│           ├── features.tsx    ← TiltCard 2x2 grid
│           ├── stats.tsx       ← AnimatedCounter + ConicBorderCard
│           ├── cases.tsx       ← comparison table
│           ├── testimonials.tsx
│           ├── faq.tsx         ← pricing section (nome antigo, não mudar)
│           └── cta.tsx
└── components/cosmos/          ← todos os primitivos de animação
    ├── lenis-provider.tsx
    ├── fade-in.tsx
    ├── split-text.tsx
    ├── tilt-card.tsx
    ├── animated-counter.tsx
    ├── conic-border.tsx
    └── draw-line.tsx           ← DrawLine, GraphNode, PulseDot prontos
```

---

## Regras de qualidade

1. **Lenis + Framer Motion**: não misturar com `window.scrollTo` — usar `lenis.scrollTo()`
2. **Performance**: toda animação com `will-change: transform` onde necessário; `layout` animations apenas quando indispensável
3. **`prefers-reduced-motion`**: `useReducedMotion()` do Framer Motion — desabilitar tudo exceto fade simples
4. **Não inventar tokens**: usar APENAS `var(--token)` do DESIGN.md, sem hex hardcoded
5. **Server components**: qualquer arquivo com Framer Motion precisa de `"use client"`
6. **Typecheck**: `pnpm --filter web typecheck` deve passar (exceto o bug pré-existente em proxy.ts)

---

## Design reference

- Huly.io screenshot: `/Users/azos/Documents/Github/web-backoffice/my/screencapture-huly-io-2026-05-13-21_38_17.pdf`
- DESIGN.md: `/Users/azos/Documents/Github/web-backoffice/my/DESIGN.md`
- SITE_BRIEF.md: `/Users/azos/Documents/Github/web-backoffice/my/SITE_BRIEF.md`
- Dev server: `http://localhost:3001/pt`

*Gerado em: 2026-05-14*
