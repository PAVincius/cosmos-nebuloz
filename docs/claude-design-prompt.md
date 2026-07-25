# Prompt para Claude Design (claude.ai)

---

Você é um designer de produto sênior especializado em SaaS enterprise moderno (estilo Linear, Vercel, Notion). Vou te mostrar o design system atual de um produto chamado **Cosmos** — plataforma de gestão de projetos SAFe/Agile — e quero que você proponha melhorias visuais concretas com código React + Tailwind.

---

## Design System Atual

### Tokens

**Light Mode:**
- Canvas: `#f4f5f8` | Surface: `#ffffff` | Surface-2: `#f6f7f9` | Surface-3: `#eef0f4`
- Sidebar: `#fbfbfd`
- Hairline: `#e7e9ee` | Hairline-strong: `#d8dbe2`
- Ink: `#11151f` | Ink-muted: `#586173` | Ink-subtle: `#8b94a4`
- Accent: `#5e6ad2` (índigo) | Accent-soft: `rgba(94,106,210,.10)` | Accent-text: `#4b54b8`
- Verde: `#16a34a` | Vermelho: `#e11d48` | Amber: `#d97706` | Azul: `#2563eb` | Roxo: `#7c3aed`
- Card shadow: `0 1px 2px rgba(16,22,40,.05), 0 4px 14px -8px rgba(16,22,40,.10)`
- Hover shadow: `0 2px 4px rgba(16,22,40,.06), 0 18px 36px -20px rgba(94,106,210,.30)`

**Dark Mode:**
- Canvas: `#070b14` | Surface: `#0e1422` | Surface-2: `#131b2c` | Surface-3: `#18223a`
- Sidebar: `#0a0f1b`
- Ink: `#eef2f8` | Ink-muted: `#93a1b3`
- Accent dark: `#7c87ff`

**Raios:** xs=6px, sm=8px, md=10px, lg=14px, xl=18px, pill=999px

**Tipografia:**
- Página título: 26px bold tracking-[-0.025em]
- Seção título: 14.5px semibold tracking-[-0.01em]
- Valor KPI: 38px bold mono tracking-[-0.02em]
- Badge: 11.5px bold tracking-[0.01em]

---

## Componentes que quero melhorar

### 1. Page Header

**Atual:**
```tsx
<header className="border-b border-border/80 px-6 py-5">
  <h1 className="text-[1.625rem] font-bold tracking-[-0.025em] text-foreground">
    Portfolio Kanban
  </h1>
  <p className="mt-1 text-sm text-muted-foreground">
    Arraste épicos pelas etapas do SAFe.
  </p>
  <div className="mt-2.5 h-[3px] w-10 rounded-full bg-primary" />
</header>
```

**Problema:** accent bar de 40px fraca, header sem personalidade visual. Parece genérico.

**Quero:** header mais expressivo — pode ter gradiente sutil no fundo, accent bar animada, ou tratamento tipográfico mais forte. Manter a altura (~72px). Suporte dark mode.

---

### 2. KPI Card

**Atual:**
```tsx
// min-h-[152px], rounded-[18px], p-[20px_22px]
// Fundo: radial-gradient sutil da cor do tone
// Hover: glow ring colorido
// Valor: 38px bold mono
// Delta: pill badge verde/vermelho
// Tones: accent(#5e6ad2) | green | red | amber | blue | purple
```

Estrutura atual:
```
[label 12.5px muted uppercase]     [ícone tone-colored 16px]
[valor 38px bold mono tone-color]
[unidade 24px semibold opacity-80]
[delta pill ↑/↓ + hint 12px muted]
```

**Problema:** gradiente de fundo muito sutil, sem presença. Delta badge funciona mas sparks/tendência seriam mais informativos. Light/dark inconsistente na cor do valor.

**Quero:** redesenho mantendo mesma estrutura. Gradiente mais presente mas elegante. Delta com sparkline de 5 pontos inline. Melhor tratamento do valor em dark mode. Manter tones e hover glow.

---

### 3. Section Card

**Atual:**
```tsx
<section className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-[card-shadow]">
  <header className="flex items-center gap-3 border-b border-hairline bg-surface-2 px-[18px] py-[13px]">
    {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
    <div>
      <div className="font-semibold text-[14.5px] text-ink tracking-[-0.01em]">{title}</div>
      <div className="text-[12.5px] text-ink-muted truncate">{description}</div>
    </div>
    {action && <div className="ml-auto">{action}</div>}
  </header>
  <div className="p-[18px]">{children}</div>
</section>
```

**Problema:** header bg-surface-2 quase idêntico ao surface — sem distinção clara. Ícone sem destaque. Header parece linha de texto solta.

**Quero:** header com mais definição — pode usar linha de accent no topo (3px), ícone com soft-bg colorido, ou tratamento de background mais distinto. Ainda minimalista, sem ser pesado.

---

### 4. Kanban Card

**Atual:**
```tsx
// rounded-lg border border-hairline bg-card
// Hover: -translate-y-[2px] shadow-hover border-hairline-strong
// Drag: rotate-1 opacity-50

// Estrutura:
// [barra temática opcional h-0.5]
// [InvestScoreBar — progress bar INVEST score]
// [px-3 pt-2.5 pb-2]
//   [título 13px font-medium — clicável]
//   [metadata row: feature count | INVEST badge | WSJF | type | BLOCKED]
//   [WSJF breakdown grid 4col — só no hover]
//   [OKR indicator 9px]
// [footer border-t: links Épico | Features]
```

**Problema:** muito denso, hierarquia confusa. InvestScoreBar é forte visualmente mas sem contexto. Metadata row com 5 elementos diferentes sem separação. Footer links pequenos demais.

**Quero:** redesenho com hierarquia clara: título dominante → metadata compacta → ações no rodapé. INVEST score mais integrado ao visual do card (não como barra separada). Preservar drag, hover state e dark mode.

---

### 5. Sidebar Nav Item (estado ativo)

**Atual:** item ativo apenas muda cor do texto/ícone, sem background highlight explícito no item pai quando expandido.

**Quero:** item ativo com pill background sutil (accent-soft), ícone colorido (accent), label mais bold. Sub-items ativos com indicador à esquerda (2px accent bar). Transição suave ao expandir/colapsar.

---

## Restrições

- Stack: React + Tailwind + shadcn/ui
- Usar CSS variables (`var(--accent-c)`, `var(--surface)`, etc.) — não hardcode hex
- Suportar dark mode via `[data-theme="dark"]`
- Manter acessibilidade (contraste AA mínimo)
- Não adicionar dependências novas além de `framer-motion` (já instalado)
- Estilo: minimalista enterprise, não colorido demais, não gradientes pesados

---

## Output esperado

Para cada componente, entregue:
1. Código TSX completo e funcional
2. Screenshot/mockup ASCII ou descrição visual do resultado
3. O que mudou e por quê
