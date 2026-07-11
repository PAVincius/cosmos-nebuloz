# KPI Cards — Regras de Hierarquia (tecno-UI · tema escuro)

> **Regra-mãe:** o dado vem primeiro. Os efeitos (cravado, bolinhas, ECG) nunca competem com o conteúdo.

---

## 01 · Anatomia & ordem de leitura

O card tem **4 níveis de hierarquia**, lidos de cima para baixo:

| # | Camada | Papel |
|---|--------|-------|
| **1** | **Valor** (número) | Pico absoluto — o que o usuário busca |
| **2** | **Label + Chip** | Contexto — o quê e de qual domínio |
| **3** | **Badge** | Qualificador — fecha a leitura, não inicia |
| **0** | **Decoração** | Hierarquia zero — textura, nunca informação |

### Nível 1 — Valor (primário)
- Fonte: **JetBrains Mono, 38px, weight 700**, na cor do estado
- É o **maior e mais brilhante** elemento do card — nada pode superar
- Unidade (%, ms, US$): **24px, weight 600, opacity 0.8** — sempre menor que o número
- `white-space: nowrap` — nunca quebra linha

### Nível 2 — Label + Chip (secundário)
- Sempre **mesma linha, topo do card** (`justify-content: space-between`)
- **Label** (esquerda): 13.5px, weight 600, `#93a1b3`, `max-width: 78%`, até 2 linhas
- **Chip** (direita): 34×34px, `border-radius: 10px`, cor do estado com fundo translúcido (`rgba(accent, .10)`) + borda (`rgba(accent, .22)`)
- Um chip por card — nunca dois

### Nível 3 — Badge (terciário)
- Pílula na **base do card**
- **Sempre carrega texto** — cor é reforço, não a mensagem
- 12px, weight 700, `letter-spacing: 0.01em`
- `border-radius: 999px`, `padding: 4px 11px`

### Nível 0 — Decoração (hierarquia zero)
- Marca-d'água cravada, textura de bolinhas, sinal ECG
- Todos com `aria-hidden="true"` — invisíveis para leitores de tela
- Todos em **z-index: 1** — nunca sobem acima do conteúdo
- Silenciosos em repouso; **acendem apenas no hover**

---

## 02 · Pilha de camadas (z-index)

> Conteúdo em **z-3** · decoração em **z-1** · sempre nessa ordem

```
┌─────────────────────────────────────────────────────┐
│  z-3  CONTEÚDO — label · chip · valor · badge       │  opacity: 1 · sempre legível
├─────────────────────────────────────────────────────┤
│  z-1  Sinal ECG ("sinal vivo")                      │  0.32 → 1.0 no hover
│  z-1  Marca-d'água — glow (2ª cópia, acende)        │  0   → 0.90 no hover
│  z-1  Marca-d'água — cravada (letterpress repouso)  │  1.0 → 0.20 no hover
│  z-1  Textura de bolinhas (canto inferior-direito)  │  0   → 0.45 no hover
├─────────────────────────────────────────────────────┤
│  z-0  Fundo — gradiente radial do estado            │  estático
└─────────────────────────────────────────────────────┘
```

**Regra:** nenhuma camada decorativa pode subir acima de `z-index: 1`.  
O card usa `overflow: hidden` — a sangria do ícone é cortada pela borda, nunca vaza.

---

## 03 · Estados & tokens de cor

Três tons fixos — mesma anatomia, apenas as cores trocam.

| Token | Verde · saudável | Vermelho · alerta | Âmbar · neutro |
|-------|-----------------|-------------------|----------------|
| `--accent` (chip + glow) | `#34d399` | `#fb7185` | `#fbbf24` |
| valor (número) | `#34d399` | `#fda4af` | `#fcd34d` |
| `--ink-corner` (cravado) | `#0a111c` | `#170c12` | `#120f0a` |
| badge texto | `#7ff0bf` | `#fda4af` | `#fcd34d` |
| gradiente fundo (inicio) | `#0e1826` | `#22121a` | `#1a1610` |
| gradiente fundo (fim) | `#0a111c` | `#160c12` | `#120f0a` |

> **`--ink-corner` é crítico:** deve ser igual à cor predominante do canto onde o ícone sangra.  
> Se estiver errado, o `stroke` do SVG fica visível — o efeito cravado vira linha comum.

### Gradiente radial do fundo por estado

```css
/* Verde */
background: radial-gradient(130% 130% at 0% 0%, rgba(52,211,153,.12), transparent 46%),
            linear-gradient(180deg, #0e1826, #0a111c);

/* Vermelho */
background: radial-gradient(130% 150% at 100% 25%, rgba(244,63,94,.30), transparent 55%),
            linear-gradient(180deg, #22121a, #160c12);

/* Âmbar */
background: radial-gradient(130% 130% at 0% 0%, rgba(245,158,11,.13), transparent 48%),
            linear-gradient(180deg, #1a1610, #120f0a);
```

---

## 04 · Medidas fixas

```
Card
  width:          312px
  min-height:     152px
  border-radius:  18px
  padding:        20px 22px

Chip (ícone)
  size:           34 × 34px
  border-radius:  10px

Marca-d'água (SVG ícone sangrado)
  size:           208 × 208px
  position:       bottom: -48px · right: -36px
  stroke-width:   1.15
  z-index:        1

Tipografia
  valor:          JetBrains Mono · 38px · weight 700
  unidade:        JetBrains Mono · 24px · weight 600 · opacity 0.8
  label:          13.5px · weight 600
  badge:          12px · weight 700

Transições (card → hover)
  card (transform + border + shadow):   400ms ease
  bolinhas (opacity):                   550ms ease
  ícone glow / ECG:                     500ms ease
```

---

## 05 · Efeito "cravado" (letterpress) — como funciona

O ícone usa **duas cópias SVG sobrepostas** no mesmo `position: absolute`:

```html
<!-- Cópia 1: cravada — visível no repouso, some no hover -->
<svg class="wm wm-engrave"
     stroke="var(--ink-corner)"
     filter="drop-shadow(0 1.5px .5px rgba(255,255,255,.11))
             drop-shadow(0 -1.4px 1px rgba(0,0,0,.8))"
     style="opacity: 1">
  <!-- mesmo path do ícone -->
</svg>

<!-- Cópia 2: glow — invisível no repouso, acende no hover -->
<svg class="wm wm-glow"
     stroke="var(--accent)"
     filter="drop-shadow(0 0 9px rgba(var(--rgb), .85))"
     style="opacity: 0; color: var(--accent)">
  <!-- mesmo path do ícone -->
</svg>
```

**Opacidades no hover:**

```css
.card:hover .wm-engrave { opacity: 0.20; }
.card:hover .wm-glow    { opacity: 0.90; }
```

---

## 06 · Sinal ECG — como funciona

SVG com `stroke-dasharray` animado por `@keyframes`:

```css
@keyframes ecg-sweep {
  from { stroke-dashoffset: 760; }
  to   { stroke-dashoffset: 0;   }
}

.sig path {
  stroke-dasharray: 360 360;
  animation: ecg-sweep 3s linear infinite;
}

/* Repouso → hover */
.sig              { opacity: 0.32; }
.card:hover .sig  { opacity: 1.00; filter: drop-shadow(0 0 5px rgba(var(--rgb), .6)); }

/* Acessibilidade */
@media (prefers-reduced-motion: reduce) {
  .sig path { animation: none; }
}
```

O gradiente do traço usa `<linearGradient>` com `stop-opacity: 0` nas pontas — fade nas bordas.

---

## 07 · Textura de bolinhas — como funciona

```css
.dots {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  color: var(--accent);
  opacity: 0; /* → 0.45 no hover */
  transition: opacity 550ms ease;

  background-image: radial-gradient(currentColor 1.1px, transparent 1.5px);
  background-size: 11px 11px;

  /* Fade concentrado no canto inferior-direito */
  -webkit-mask-image: radial-gradient(150% 130% at 100% 100%, #000 0%, transparent 58%);
          mask-image: radial-gradient(150% 130% at 100% 100%, #000 0%, transparent 58%);
}
```

---

## 08 · Regras inquebráveis

### ✅ Fazer

- **Mono em todo número**, %, ms, US$ e ID. Sempre o maior elemento do card.
- **Estado = cor + texto.** O badge sempre traz palavra; cor é reforço, não a mensagem.
- **Um chip por card**, na cor do estado — par `soft` + `text` (fundo translúcido + ícone vivo).
- **Mesma ordem vertical** sempre: `cabeçalho → valor → badge`. Nunca reordenar.
- **Decoração atrás e silenciosa:** baixa opacidade em repouso, acende só no hover.
- **`--ink-corner` = cor dominante do fundo no canto do ícone** — caso contrário o cravado falha.
- **Respeitar `prefers-reduced-motion`:** ECG congela; card permanece legível.

### ❌ Não fazer

- Deixar marca-d'água, bolinhas ou ECG **acima de z-1** (por cima do conteúdo).
- Usar a **unidade maior que o número**, ou duplicar valores em destaque.
- **Inventar cor** fora dos 3 estados (verde · vermelho · âmbar).
- Colocar **mais de um número-destaque** — um card, uma métrica.
- Ligar os efeitos **em repouso** ou deixar o glow sempre visível.
- Usar gradiente agressivo na página, emoji, ou bloco com barra lateral colorida.
- Deixar o ícone num círculo solto no canto — ele **sangra** (bleed), não flutua.
