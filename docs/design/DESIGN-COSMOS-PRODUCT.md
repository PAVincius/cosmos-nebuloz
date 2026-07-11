---
version: "1.0"
name: COSMOS Product UI
status: active
created: 2026-06-03
supersedes: DESIGN.md (marketing layer — preserved separately)
---

# COSMOS Product UI — Design System

> **Two-layer identity.** `DESIGN.md` governs the marketing canvas (Linear-inspired, lavender, near-black). This document governs the **product UI** — the authenticated dashboard, analytics surfaces, and data visualization. They share a brand anchor (lavender #5e6ad2 for navigation and primary CTAs) but diverge on canvas, typography, and component expressiveness.

---

## Gap Analysis: DESIGN.md vs Tecno-UI Reference Cards

### Convergências (preservadas em ambas as camadas)

| Dimensão | DESIGN.md | KPI Cards | Decisão |
|---|---|---|---|
| Dark-first | Near-black canvas | Dark navy canvas | ✅ Manter em ambas |
| Surface ladder | 4 níveis por hairline | State-tinted surfaces | ✅ Conceito preservado |
| Lavender âncora | `#5e6ad2` como único acento | — | ✅ Lavender vira âncora de nav/CTA no produto |
| Dados como protagonista | Product screenshots | KPI values + ECG | ✅ Filosofia idêntica, expressão diferente |
| Tracking negativo | -3.0px em display-xl | -0.01em em valores mono | ✅ Consistente |
| Borders como elevação | 1px hairline | 1px state-rgba border | ✅ Princípio compartilhado |

### Divergências (nova identidade para produto)

| Dimensão | DESIGN.md (marketing) | Produto (tecno-UI) | Tensão / Resolução |
|---|---|---|---|
| **Canvas** | `#010102` near-pure black | `#070b14` azul-naval profundo | Produto fica em navy — mais profundidade perceptual para dados |
| **Acento** | Único lavender `#5e6ad2` | Verde/vermelho/âmbar semânticos | RESOLVE: lavender permanece para nav/CTA; verde/vermelho/âmbar são estados de dado — não decoração |
| **Gradientes** | "Sem gradientes atmosféricos" | Radial per-estado por card | RESOLVE: proibição é para marketing; produto tem dados que pedem estados visuais ricos |
| **Tipografia** | Linear Display / Text (SF Pro) | Manrope (labels) + JetBrains Mono (números) | RESOLVE: produto tem duas vozes — UI labels (Manrope) e dados numéricos (JetBrains Mono) |
| **Raio** | 12px cards (`rounded.lg`) | 18px data cards | Produto usa raio maior — cards de dado são mais orgânicos |
| **Efeitos** | Product screenshots dominam | ECG, letterpress, glow, dot texture | Produto expressa vitalidade de dado em vez de screenshots |
| **Semântica de cor** | Só success green (#27a644) | Verde/vermelho/âmbar completos | Produto precisa de sistema semântico de 3 tons para estado de KPI |

---

## Produto — Design Tokens

### Canvas

```css
--kpi-canvas: #070b14;   /* página/grid dos cards de dado */
```

### Tipografia de dado

| Família | Uso | Peso | Variável CSS |
|---|---|---|---|
| JetBrains Mono | Valores numéricos (KPI value, métricas) | 600–800 | `--font-jetbrains-mono` |
| Manrope | Labels de UI, badges, eyebrows de dado | 500–800 | `--font-manrope` |
| Geist Sans | Corpo, nav, sidebars (herdado de DESIGN.md) | 400–600 | `--font-geist-sans` |

**Escala de tipo para dados:**

| Token | Tamanho | Peso | Uso |
|---|---|---|---|
| `kpi-value` | 38px | 700 | Valor principal do card |
| `kpi-unit` | 24px | 600 | Unidade ao lado do valor |
| `kpi-label` | 13.5px | 600 | Label do card |
| `kpi-badge` | 12px | 700 | Badge de estado |

### Tons semânticos (KPI state)

| Tone | Acento | RGB | Uso |
|---|---|---|---|
| `green` | `#34d399` | `52,211,153` | Saudável, sucesso, acima do SLO |
| `red` | `#fb7185` | `251,113,133` | Alerta, falha, abaixo do threshold |
| `amber` | `#fbbf24` | `251,191,36` | Neutro, custo, atenção |

Cada tone define: accent, canvas da superfície, borda, cor do número, badge fundo/texto.

**Regra:** Os tons verde/vermelho/âmbar são **exclusivos de superfícies de dado**. Nunca usados em marketing, navegação ou elementos de UI genéricos. O lavender continua sendo o único acento de marca.

### Backgrounds por tone

```css
/* green */
radial-gradient(130% 130% at 0% 0%, rgba(52,211,153,.12), transparent 46%),
linear-gradient(180deg, #0e1826, #0a111c)

/* red */
radial-gradient(130% 150% at 100% 25%, rgba(244,63,94,.30), transparent 55%),
linear-gradient(180deg, #22121a, #160c12)

/* amber */
radial-gradient(130% 130% at 0% 0%, rgba(245,158,11,.13), transparent 48%),
linear-gradient(180deg, #1a1610, #120f0a)
```

### Anatomia do KpiCard

```
Container: 312×min-152px · radius 18px · padding 20px 22px · border 1px
├── [z-1] Textura de bolinhas (opacity 0→0.45 no hover, concentrada no canto)
├── [z-1] Ícone cravado — letterpress (opacity 1→0.20 no hover)
├── [z-1] Ícone com glow (opacity 0→0.90 no hover)
├── [z-1] Sinal ECG na base (opacity 0.30→1 no hover + glow)
└── [z-3] Conteúdo
    ├── Label (13.5px, Manrope 600, #93a1b3)
    ├── Chip do ícone (34×34, radius 10px, fundo rgba accent 10%, border rgba 22%)
    ├── Valor (38px, JetBrains Mono 700, cor = num do tone)
    │   └── Unidade (24px, 600, opacity 0.8)
    └── Badge (pill, 12px, Manrope 700)
```

### Efeitos técnicos

**Letterpress (ícone cravado):**
```
SVG 208×208, stroke = cor da superfície no canto (--ink do tone),
filter: drop-shadow(0 1.5px 0.5px rgba(255,255,255,0.11))
        drop-shadow(0 -1.4px 1px rgba(0,0,0,0.8))
```

**Hover — glow:**
```
Segunda cópia do SVG, stroke = accent,
filter: drop-shadow(0 0 9px rgba(accent, 0.85))
opacity: 0 → 0.90
```

**Textura de bolinhas:**
```css
background-image: radial-gradient(currentColor 1.1px, transparent 1.5px);
background-size: 11px 11px;
mask-image: radial-gradient(150% 130% at 100% 100%, #000 0%, transparent 58%);
```

**ECG (sinal vivo):**
```
@keyframes ecg-sweep { from { stroke-dashoffset: 760 } to { stroke-dashoffset: 0 } }
stroke-dasharray: 360 360 · duration: 3s linear infinite
Path: M-30 26 H66 l7 -17 l9 32 l8 -24 l6 11 H180 l7 -14 l8 24 l7 -13 H430
```

**Container hover:**
```
translate-y: -3px
border: rgba(accent, 0.55)
shadow: 0 20px 44px -22px rgba(accent, 0.55)
transition: 400ms ease-out
```

---

## Regras de uso

### Do

- Usar `green` para métricas acima do threshold (Taxa de Sucesso ↑, Velocity ↑)
- Usar `red` para alertas e degrades (Latência alta, Error rate ↑)
- Usar `amber` para métricas de custo ou atenção neutra
- Usar JetBrains Mono exclusivamente para valores numéricos em cards de dado
- Usar Manrope exclusivamente para labels, badges e eyebrows de produto
- Manter lavender `#5e6ad2` como acento de navegação, CTA e focus ring
- Gap entre KpiCards: `16px`. Fundo do grid: `#070b14`

### Don't

- Não usar tons verde/vermelho/âmbar fora de superfícies de dado
- Não misturar Manrope/JetBrains com Linear Display/Text no mesmo componente
- Não aplicar o letterpress em ícones menores que 100px (efeito some)
- Não usar gradientes radiais em elementos de navegação ou formulários
- Não animar o ECG com `prefers-reduced-motion` ativo (usar `motion-safe:`)

---

## Implementação no COSMOS

### Arquivos alterados / criados

| Arquivo | Mudança |
|---|---|
| `packages/design-system/lib/fonts.ts` | JetBrains Mono + Manrope via next/font/google |
| `packages/design-system/styles/globals.css` | `--font-display-data`, `--font-ui-label`, `@keyframes ecg-sweep` |
| `apps/app/app/(authenticated)/analytics/components/KpiCard.tsx` | Componente completo (tecno-UI, CSS-only hover) |

### Uso

```tsx
import KpiCard from "@/app/(authenticated)/analytics/components/KpiCard";

<div className="flex gap-4 rounded bg-[#070b14] p-6">
  <KpiCard
    icon="activity"
    tone="green"
    label="Taxa de Sucesso"
    value="100.0%"
    badge="↗ Excelente performance"
  />
  <KpiCard
    icon="clock"
    tone="red"
    label="Latência Média (LLM)"
    value="8923"
    unit="ms"
    badge="— Lentidão detectada"
  />
  <KpiCard
    icon="dollar"
    tone="amber"
    label="Custo no período"
    value="US$ 2,52"
    badge="— Soma das gerações LLM"
  />
</div>
```

### Ícones disponíveis

| `icon` | Ícone | Uso sugerido |
|---|---|---|
| `activity` | Pulso/waveform | Execuções, fluxo, traces |
| `check` | Círculo com check | Taxa de sucesso, SLO |
| `clock` | Relógio | Latência, tempo, lead time |
| `dollar` | Cifrão | Custo, budget, CapEx |

---

## Acessibilidade

- Todas as camadas decorativas (bolinhas, marcas-d'água, ECG) têm `aria-hidden`
- Animação ECG usa `motion-safe:` — pausa com `prefers-reduced-motion: reduce`
- Informação (valor + badge) nunca depende só de cor — o badge traz texto semântico
- Contraste label `#93a1b3` sobre superfície dark: ≥ 4.5:1 em todos os tones
