# COSMOS Design System — Spec para Claude Code
> Plataforma SAFe · Next.js + Tailwind CSS · v1.0
> **Regra-mãe:** o dado vem primeiro. Cores via `--var`, nunca hex hardcoded. `flex/grid + gap` sempre.

---

## 1. Tokens CSS

### Temas
```css
/* globals.css — adicione ao @layer base */
[data-theme="light"]  { /* canvas claro, accent #5e6ad2 */ }
[data-theme="dark"]   { /* canvas #070b14, tecno-UI, accent #7c87ff */ }
[data-theme="marketing"] { /* canvas #010102, Linear */ }
```

### Tokens base (theme-independent)
```css
:root {
  --r-xs:6px; --r-sm:8px; --r-md:10px; --r-lg:14px; --r-xl:18px; --r-pill:999px;
  --pad:20px; --gap:16px;
  --ease-spring: cubic-bezier(.2,.7,.3,1);
  --fx: 1; /* intensidade dos efeitos dark: 0–1.6 */
}
```

### Cores light
```css
[data-theme="light"] {
  --canvas:#f4f5f8; --surface:#fff; --surface-2:#f6f7f9; --surface-3:#eef0f4; --sidebar:#fbfbfd;
  --hairline:#e7e9ee; --hairline-strong:#d8dbe2;
  --ink:#11151f; --ink-muted:#586173; --ink-subtle:#8b94a4; --ink-faint:#aeb6c2;
  --chip-bg:#f1f3f7;
  --card-shadow:0 1px 2px rgba(16,22,40,.05),0 4px 14px -8px rgba(16,22,40,.10);
  --accent:#5e6ad2; --accent-rgb:94,106,210; --accent-fg:#fff;
  --accent-soft:rgba(94,106,210,.10); --accent-text:#4b54b8;
  --green:#16a34a; --green-rgb:22,163,74; --green-soft:rgba(22,163,74,.10); --green-text:#15803d;
  --red:#e11d48; --red-rgb:225,29,72; --red-soft:rgba(225,29,72,.10); --red-text:#be123c;
  --amber:#d97706; --amber-rgb:217,119,6; --amber-soft:rgba(217,119,6,.12); --amber-text:#b45309;
  --blue:#2563eb; --blue-rgb:37,99,235; --blue-soft:rgba(37,99,235,.10); --blue-text:#1d4ed8;
  --purple:#7c3aed; --purple-rgb:124,58,237; --purple-soft:rgba(124,58,237,.10); --purple-text:#6d28d9;
}
```

### Cores dark (tecno-UI)
```css
[data-theme="dark"] {
  --canvas:#070b14; --surface:#0e1422; --surface-2:#131b2c; --surface-3:#18223a; --sidebar:#0a0f1b;
  --hairline:rgba(255,255,255,.075); --hairline-strong:rgba(255,255,255,.15);
  --ink:#eef2f8; --ink-muted:#93a1b3; --ink-subtle:#65748b; --ink-faint:#46566d;
  --chip-bg:rgba(255,255,255,.05);
  --card-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 10px 30px -20px rgba(0,0,0,.8);
  --accent:#7c87ff; --accent-rgb:124,135,255; --accent-fg:#fff;
  --accent-soft:rgba(124,135,255,.14); --accent-text:#c7ccff;
  --green:#34d399; --green-rgb:52,211,153; --green-soft:rgba(52,211,153,.12); --green-text:#7ff0bf;
  --red:#fb7185; --red-rgb:251,113,133; --red-soft:rgba(251,113,133,.14); --red-text:#fda4af;
  --amber:#fbbf24; --amber-rgb:251,191,36; --amber-soft:rgba(251,191,36,.13); --amber-text:#fcd34d;
  --blue:#60a5fa; --blue-rgb:96,165,250; --blue-soft:rgba(96,165,250,.14); --blue-text:#bfdbfe;
  --purple:#a78bfa; --purple-rgb:167,139,250; --purple-soft:rgba(167,139,250,.14); --purple-text:#ddd6fe;
}
```

### Cores marketing (Linear canvas)
```css
[data-theme="marketing"] {
  --canvas:#010102; --surface:#0f1011; --surface-2:#141516; --surface-3:#18191a; --sidebar:#0d0e0f;
  --hairline:#23252a; --hairline-strong:#34343a;
  --ink:#f7f8f8; --ink-muted:#d0d6e0; --ink-subtle:#8a8f98; --ink-faint:#62666d;
  --accent:#5e6ad2; --accent-rgb:94,106,210;
  /* … mesmos padrões soft/text por tone */
}
```

---

## 2. Tailwind Config

```js
// tailwind.config.js
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Manrope', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Manrope', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas:   'var(--canvas)',
        surface:  { DEFAULT:'var(--surface)', 2:'var(--surface-2)', 3:'var(--surface-3)' },
        sidebar:  'var(--sidebar)',
        hairline: { DEFAULT:'var(--hairline)', strong:'var(--hairline-strong)' },
        ink:      { DEFAULT:'var(--ink)', muted:'var(--ink-muted)', subtle:'var(--ink-subtle)', faint:'var(--ink-faint)' },
        accent:   { DEFAULT:'var(--accent)', fg:'var(--accent-fg)', soft:'var(--accent-soft)', text:'var(--accent-text)' },
        green:    { DEFAULT:'var(--green)', soft:'var(--green-soft)',   text:'var(--green-text)' },
        red:      { DEFAULT:'var(--red)',   soft:'var(--red-soft)',     text:'var(--red-text)' },
        amber:    { DEFAULT:'var(--amber)', soft:'var(--amber-soft)',   text:'var(--amber-text)' },
        blue:     { DEFAULT:'var(--blue)',  soft:'var(--blue-soft)',    text:'var(--blue-text)' },
        purple:   { DEFAULT:'var(--purple)',soft:'var(--purple-soft)',  text:'var(--purple-text)' },
      },
      borderRadius: {
        xs:'var(--r-xs)', sm:'var(--r-sm)', md:'var(--r-md)',
        lg:'var(--r-lg)', xl:'var(--r-xl)', pill:'var(--r-pill)',
      },
      boxShadow: { card:'var(--card-shadow)', hover:'var(--hover-shadow)' },
      keyframes: {
        fadeIn:   { from:{transform:'translateY(6px)',opacity:'0'}, to:{transform:'none',opacity:'1'} },
        ecgsweep: { from:{strokeDashoffset:'760'}, to:{strokeDashoffset:'0'} },
        shimmer:  { from:{backgroundPosition:'120% 0'}, to:{backgroundPosition:'-120% 0'} },
      },
      animation: {
        'fade-in':'fadeIn .45s ease',
        ecg:'ecgsweep 3s linear infinite',
        shimmer:'shimmer 2.6s linear infinite',
      },
      transitionTimingFunction: { spring:'cubic-bezier(.2,.7,.3,1)' },
    },
  },
};
```

---

## 3. Tipografia

| Papel | Family | Tailwind | Notas |
|---|---|---|---|
| Título de página | Space Grotesk | `font-display text-2xl font-bold tracking-tight` | 26–28px, -0.025em |
| Header de seção / card | Space Grotesk | `font-display text-sm font-semibold tracking-tight` | 14.5px |
| Eyebrow / label de seção | JetBrains Mono | `font-mono text-[10px] font-bold tracking-[.12em] uppercase text-ink-faint` | |
| Body / UI | Manrope | `font-sans text-sm font-medium` | 13–14px |
| Caption / hint | Manrope | `text-xs text-ink-muted` | 11–12px |
| KPI value | JetBrains Mono | `font-mono text-[37px] font-bold leading-none tracking-[-0.02em]` | |
| Qualquer número, %, ms, ID | JetBrains Mono | `font-mono` | obrigatório |

---

## 4. ARTs — Identidade de Trem

| ART | Tone | Tokens |
|---|---|---|
| Payments | `blue` | `--blue`, `--blue-rgb`, `--blue-soft`, `--blue-text` |
| Platform | `purple` | `--purple`, `--purple-rgb`, `--purple-soft`, `--purple-text` |
| Growth | `green` | `--green`, `--green-rgb`, `--green-soft`, `--green-text` |
| Data & AI | `amber` | `--amber`, `--amber-rgb`, `--amber-soft`, `--amber-text` |

**Padrão dinâmico:** um único componente renderiza qualquer ART:
```tsx
// tone vem como prop: "blue" | "purple" | "green" | "amber"
<div style={{ background: `var(--${tone}-soft)`, color: `var(--${tone}-text)` }}>
  {artName}
</div>
```

---

## 5. Componentes — Receitas TSX

### Button
```tsx
// Variantes: primary | secondary | ghost | soft | danger
// Tamanhos: sm | md (default) | lg

const buttonVariants = {
  primary:   'bg-accent text-accent-fg border-accent shadow-[0_1px_2px_rgba(var(--accent-rgb),.4),0_4px_12px_-6px_rgba(var(--accent-rgb),.5)] hover:bg-[rgba(var(--accent-rgb),.85)]',
  secondary: 'bg-surface text-ink border-hairline-strong hover:bg-surface-2',
  ghost:     'bg-transparent text-ink-muted border-transparent hover:bg-surface-2 hover:text-ink',
  soft:      'bg-accent-soft text-accent-text border-[rgba(var(--accent-rgb),.2)] hover:bg-[rgba(var(--accent-rgb),.2)]',
  danger:    'bg-red-soft text-red-text border-[rgba(var(--red-rgb),.2)]',
};

const buttonSizes = {
  sm: 'px-3 py-[5px] text-[12.5px] rounded-sm',
  md: 'px-[14px] py-2 text-sm rounded-md',
  lg: 'px-[18px] py-[11px] text-[14.5px] rounded-md',
};

<button className={`inline-flex items-center justify-center gap-1.5 font-semibold border transition-all duration-200 ${buttonVariants[variant]} ${buttonSizes[size]}`}>
  {children}
</button>
```

### IconButton
```tsx
<button className="grid h-[34px] w-[34px] place-items-center rounded-sm border border-hairline bg-transparent text-ink-muted transition hover:bg-surface-2 hover:text-ink">
  <Icon size={16} strokeWidth={1.9} />
</button>
```

### Badge
```tsx
// tone: "green" | "red" | "amber" | "blue" | "purple" | "accent" | "neutral"
// dot: boolean — dot de status ao vivo

const badgeStyles = {
  green:   'bg-green-soft text-green-text border-[rgba(var(--green-rgb),.22)]',
  red:     'bg-red-soft text-red-text border-[rgba(var(--red-rgb),.22)]',
  amber:   'bg-amber-soft text-amber-text border-[rgba(var(--amber-rgb),.22)]',
  blue:    'bg-blue-soft text-blue-text border-[rgba(var(--blue-rgb),.22)]',
  purple:  'bg-purple-soft text-purple-text border-[rgba(var(--purple-rgb),.22)]',
  accent:  'bg-accent-soft text-accent-text border-[rgba(var(--accent-rgb),.22)]',
  neutral: 'bg-chip text-ink-muted border-hairline',
};

<span className={`inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] text-[11.5px] font-bold tracking-[.01em] border ${badgeStyles[tone]}`}>
  {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
  {children}
</span>
```

### Avatar
```tsx
// tone: ART tone ("blue" | "purple" | "green" | "amber")
<div
  className="grid place-items-center rounded-full font-mono font-bold tracking-wide text-[11px]"
  style={{
    width, height,
    background: `var(--${tone}-soft)`,
    color: `var(--${tone}-text)`,
    border: `1px solid rgba(var(--${tone}-rgb),.25)`,
  }}
>
  {initials}
</div>
```

### Card
```tsx
<div className="rounded-lg border border-hairline bg-surface p-pad shadow-card">
  {children}
</div>
```

### SectionCard
```tsx
<section className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
  <header className="flex items-center gap-3 border-b border-hairline bg-surface-2 px-[18px] py-[13px]">
    {/* icon chip */}
    <div className="grid h-8 w-8 place-items-center rounded-sm bg-accent-soft text-accent border border-[rgba(var(--accent-rgb),.2)]">
      <Icon size={15} />
    </div>
    <div>
      <div className="font-display text-sm font-bold tracking-tight">{title}</div>
      <div className="mt-px text-[11.5px] text-ink-muted">{subtitle}</div>
    </div>
    <div className="ml-auto">{/* actions / badge */}</div>
  </header>
  <div className="p-[18px]">{children}</div>
</section>
```

### KpiCard (assinatura tecno-UI)
```tsx
// tone: "green" | "red" | "amber" | "blue" | "purple"
// Fundo dark, ícone sangrado, ECG, bolinhas

const kpiBg: Record<string, string> = {
  green:  'radial-gradient(130% 130% at 0% 0%, rgba(52,211,153,.12), transparent 46%), linear-gradient(180deg,#0e1826,#0a111c)',
  red:    'radial-gradient(130% 150% at 100% 25%, rgba(251,113,133,.22), transparent 55%), linear-gradient(180deg,#22121a,#160c12)',
  amber:  'radial-gradient(130% 130% at 0% 0%, rgba(251,191,36,.12), transparent 48%), linear-gradient(180deg,#1a1610,#120f0a)',
  blue:   'radial-gradient(130% 130% at 0% 0%, rgba(96,165,250,.13), transparent 46%), linear-gradient(180deg,#0d1526,#0a1020)',
  purple: 'radial-gradient(130% 130% at 100% 0%, rgba(167,139,250,.13), transparent 48%), linear-gradient(180deg,#130f26,#0e0b1e)',
};
const inkCorner: Record<string, string> = {
  green:'#0a111c', red:'#160c12', amber:'#120f0a', blue:'#0a1020', purple:'#0e0b1e',
};

<div
  className="group relative flex min-h-[148px] flex-col items-start overflow-hidden rounded-xl border p-[18px_20px] transition-[transform,border-color,box-shadow] duration-300 ease-spring hover:-translate-y-[3px]"
  style={{
    background: kpiBg[tone],
    borderColor: `rgba(var(--${tone}-rgb),.20)`,
    '--tone': `var(--${tone})`,
    '--tone-rgb': `var(--${tone}-rgb)`,
    '--tone-text': `var(--${tone}-text)`,
    '--ink-corner': inkCorner[tone],
  } as React.CSSProperties}
>
  {/* Bolinhas — z-1 */}
  <div className="dots pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-[550ms] group-hover:opacity-[.45]"
    style={{
      color: `var(--${tone})`,
      backgroundImage: 'radial-gradient(currentColor 1.1px, transparent 1.5px)',
      backgroundSize: '11px 11px',
      WebkitMaskImage: 'radial-gradient(150% 130% at 100% 100%,#000 0%,transparent 58%)',
      maskImage: 'radial-gradient(150% 130% at 100% 100%,#000 0%,transparent 58%)',
    }}
  />

  {/* Ícone sangrado — 2 cópias (cravada + glow) — z-1 */}
  <svg className="wm-engrave pointer-events-none absolute -right-9 -bottom-12 z-[1] opacity-100 transition-opacity duration-500 group-hover:opacity-[.20]"
    width={200} height={200} viewBox="0 0 24 24" fill="none"
    stroke="var(--ink-corner)" strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round"
    style={{ filter: 'drop-shadow(0 1.5px .5px rgba(255,255,255,.11)) drop-shadow(0 -1.4px 1px rgba(0,0,0,.8))' }}
    aria-hidden
  >
    {iconPath}
  </svg>
  <svg className="wm-glow pointer-events-none absolute -right-9 -bottom-12 z-[1] opacity-0 transition-opacity duration-500 group-hover:opacity-90"
    width={200} height={200} viewBox="0 0 24 24" fill="none"
    stroke={`var(--${tone})`} strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round"
    style={{ filter: `drop-shadow(0 0 9px rgba(var(--${tone}-rgb),.85))` }}
    aria-hidden
  >
    {iconPath}
  </svg>

  {/* ECG — z-1 */}
  <svg className="pointer-events-none absolute inset-x-0 bottom-[5px] z-[1] opacity-[.32] transition-[opacity,filter] duration-500 group-hover:opacity-100"
    style={{ filter: `drop-shadow(0 0 0px transparent)` }}
    width="100%" height={44} viewBox="0 0 312 44" preserveAspectRatio="none" aria-hidden
  >
    <defs>
      <linearGradient id={`sg-${tone}`} x1="0" y1="0" x2="312" y2="0">
        <stop offset="0" stopColor={`var(--${tone})`} stopOpacity={0} />
        <stop offset=".5" stopColor={`var(--${tone})`} stopOpacity={.9} />
        <stop offset="1" stopColor={`var(--${tone})`} stopOpacity={0} />
      </linearGradient>
    </defs>
    <path fill="none" stroke={`url(#sg-${tone})`} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray="360 360"
      className="animate-ecg"
      d="M-30 24H60l6-14 8 28 7-20 5 8H170l6-12 7 20 6-12H430"
    />
  </svg>

  {/* Conteúdo — z-3 */}
  <div className="relative z-[3] flex w-full items-start justify-between">
    <span className="max-w-[76%] text-[13px] font-semibold leading-tight text-ink-muted">{label}</span>
    <span className="grid h-[34px] w-[34px] place-items-center rounded-md border"
      style={{ color:`var(--${tone})`, background:`rgba(var(--${tone}-rgb),.10)`, borderColor:`rgba(var(--${tone}-rgb),.22)` }}>
      <Icon size={16} />
    </span>
  </div>
  <div className="relative z-[3] mt-auto mb-3 pt-3 font-mono text-[37px] font-bold leading-none tracking-[-0.02em]"
    style={{ color: `var(--${tone}-text)` }}>
    {value}{unit && <span className="ml-1.5 text-[22px] font-semibold opacity-80">{unit}</span>}
  </div>
  <div className="relative z-[3] inline-flex items-center gap-1.5 rounded-full px-[10px] py-[3px] text-[11.5px] font-bold tracking-[.01em] border"
    style={{ background:`rgba(var(--${tone}-rgb),.12)`, color:`var(--${tone}-text)`, borderColor:`rgba(var(--${tone}-rgb),.18)` }}>
    {badge}
  </div>
</div>
```

### CSS do KPI (fora do Tailwind)
```css
/* globals.css */
.animate-ecg { stroke-dasharray: 360 360; animation: ecgsweep 3s linear infinite; }
.group:hover .wm-glow { filter: drop-shadow(0 0 9px rgba(var(--tone-rgb),.85)); }
.group:hover svg.opacity-\\[.32\\] { filter: drop-shadow(0 0 5px rgba(var(--tone-rgb),.6)); }
@media (prefers-reduced-motion: reduce) { .animate-ecg { animation: none; } }
```

### Progress
```tsx
<div className="h-[7px] w-full overflow-hidden rounded-pill bg-surface-3">
  <div
    className="h-full rounded-pill transition-[width] duration-700 ease-spring"
    style={{
      width: `${pct}%`,
      background: `var(--${tone})`,
      boxShadow: tone === 'green' ? '0 0 10px rgba(var(--green-rgb),.5)' : 'none',
    }}
  />
</div>
```

### Switch
```tsx
<button
  role="switch" aria-checked={checked}
  onClick={() => setChecked(!checked)}
  className={`inline-flex h-[22px] w-[40px] items-center rounded-pill p-0.5 transition-all duration-200 ${
    checked
      ? 'bg-accent justify-end shadow-[0_0_12px_rgba(var(--accent-rgb),.45)]'
      : 'bg-surface-3 justify-start border border-hairline-strong'
  }`}
>
  <span className="h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.3)]" />
</button>
```

### Nav Item
```tsx
<button
  aria-current={active ? 'page' : undefined}
  className={`navitem relative flex w-full items-center gap-2.5 rounded-sm border px-2.5 py-[6px] text-left text-[13px] font-medium transition-all duration-150 ${
    active
      ? 'bg-accent-soft text-accent-text border-[rgba(var(--accent-rgb),.18)] font-semibold'
      : 'border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink'
  }`}
>
  {active && <span className="absolute -left-[10px] inset-y-2 w-[3px] rounded-full bg-accent" />}
  <Icon size={15} strokeWidth={2} />
  <span className="flex-1 truncate">{label}</span>
  {count != null && (
    <span className={`font-mono text-[11px] font-bold rounded-full px-1.5 py-px ${
      active ? 'bg-[rgba(var(--accent-rgb),.25)] text-accent-text' : 'bg-accent-soft text-accent-text'
    }`}>{count}</span>
  )}
</button>
```

### Input
```tsx
<input
  className="w-full rounded-md border border-hairline-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(var(--accent-rgb),.15)]"
/>
```

### Empty State
```tsx
<div className="flex flex-col items-center text-center py-12 px-6">
  <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-surface-2 border border-hairline text-ink-faint">
    <Icon size={22} strokeWidth={1.8} />
  </div>
  <h3 className="font-display text-base font-bold mb-1.5">{title}</h3>
  <p className="text-sm text-ink-muted max-w-[280px] text-wrap-pretty mb-4">{description}</p>
  <Button variant="primary" size="sm">{cta}</Button>
</div>
```

### Skeleton
```tsx
<div
  className="rounded-md"
  style={{
    background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 2s linear infinite',
  }}
/>
```

---

## 6. Layout do App Shell

```tsx
// app/layout.tsx
<html data-theme="dark"> {/* ou light */}
  <body className="grid h-screen overflow-hidden"
    style={{ gridTemplate: '"bar bar" 56px "side main" 1fr / 256px 1fr' }}>

    {/* Topbar */}
    <header style={{ gridArea: 'bar' }}
      className="flex items-center gap-3 border-b border-hairline bg-sidebar px-5 z-20">
      <Logo />
      <Separator />
      <Breadcrumb />
      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
        <UserAvatar />
      </div>
    </header>

    {/* Sidebar */}
    <nav style={{ gridArea: 'side' }}
      className="overflow-y-auto border-r border-hairline bg-sidebar px-2.5 py-3.5 flex flex-col gap-4">
      <NavSection label="Portfolio">
        <NavItem href="/portfolio" icon={LayoutGrid} label="Visão Geral" />
        <NavItem href="/portfolio/kanban" icon={Kanban} label="Kanban" />
        <NavItem href="/portfolio/wsjf" icon={TrendingUp} label="WSJF" />
      </NavSection>
      <NavSection label="Planning">
        <NavItem href="/planning/pi" icon={Calendar} label="PI Planning" />
        <NavItem href="/planning/roadmap" icon={Map} label="Roadmap" />
      </NavSection>
    </nav>

    {/* Main */}
    <main style={{ gridArea: 'main' }}
      className="overflow-y-auto p-[24px_28px_40px] animate-fade-in">
      {children}
    </main>

  </body>
</html>
```

---

## 7. Padrão de Tela — Dashboard de Métricas

```tsx
export default function PortfolioPage() {
  return (
    <>
      {/* Page header */}
      <div className="mb-8">
        <p className="font-mono text-[10px] font-bold tracking-[.12em] uppercase text-ink-faint mb-1.5">
          PI 2026-Q2 · 4 ARTs
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1.5">Visão Geral do Portfolio</h1>
        <p className="text-sm text-ink-muted">42 épicos ativos · última atualização 2 min atrás</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-gap mb-6">
        <KpiCard tone="green" label="Throughput médio" value="162" unit="SP" badge="↗ +14% vs PI anterior" icon={Activity} />
        <KpiCard tone="red"   label="Latência média LLM" value="8923" unit="ms" badge="— Lentidão detectada" icon={Clock} />
        <KpiCard tone="amber" label="Custo geração LLM" value="US$ 2,52" badge="— Soma do período" icon={DollarSign} />
        <KpiCard tone="blue"  label="Taxa de sucesso" value="100" unit="%" badge="↗ Excelente" icon={CheckCircle} />
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-[1.55fr_1fr] gap-gap">
        <SectionCard title="Épicos por ART" subtitle="Portfolio ativo · 2026-Q2">
          {/* table or chart */}
        </SectionCard>
        <SectionCard title="Throughput por Sprint" subtitle="Story points concluídos">
          {/* progress bars */}
        </SectionCard>
      </div>
    </>
  );
}
```

---

## 8. WSJF — Cálculo e Display

```tsx
// WSJF = (Valor de Negócio + Urgência + Redução de Risco) / Tamanho do Job
// Faixas: ≥70 → green (Alto), 40–69 → amber (Médio), <40 → neutral (Baixo)

function wsjfTone(score: number) {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'neutral';
}

<td>
  <span className={`font-mono text-sm font-bold text-${wsjfTone(score)}-text`}>
    {score}
  </span>
</td>
<td>
  <Badge tone={wsjfTone(score)}>
    {score >= 70 ? 'Alto' : score >= 40 ? 'Médio' : 'Baixo'}
  </Badge>
</td>
```

---

## 9. Motion — Regras

| Animação | Spec | Gate |
|---|---|---|
| Screen enter | `translateY(6px) + opacity · 450ms ease` | `[data-deck-active]` ou page mount |
| Card lift (hover) | `translateY(-3px) · 300ms ease-spring` | `:hover` |
| ECG sweep | `stroke-dasharray:360 · 3s linear infinite` | `[data-theme="dark"]` only |
| Progress fill | `width transition · 700ms ease-spring` | sempre |
| AI shimmer | `220% gradient · 2.6s linear infinite` | loading / AI states |
| Skeleton | `shimmer · 2s linear infinite` | loading state |

```css
/* Sempre gate o ECG em reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .animate-ecg { animation: none; }
}
```

---

## 10. Regras Globais — Não Quebrar

### ✅ Fazer
- **`font-mono` em todo número**, %, ms, US$, ID, timestamp — sem exceção
- **`flex/grid + gap`** para qualquer agrupamento de elementos — nunca `inline-block` ou margin entre irmãos
- **Estado = cor + texto** — badge sempre tem palavra; cor é reforço, nunca a mensagem sozinha
- **Cores via `var(--*)`** — nunca hex hardcoded dentro de componente
- **`data-theme` na raiz** — temas trocam globalmente, um único ponto de controle
- **`prefers-reduced-motion`** — sempre gate animações decorativas
- **Ícones Lucide**, 15–17px, `strokeWidth={1.9}` a `2.1`

### ❌ Nunca
- Gradiente de fundo no canvas, emoji, bloco "+ barra lateral colorida"
- Inventar cor fora da escala (derive em `oklch` se realmente necessário)
- `canvas` marketing `#010102` em páginas operacionais (`/app/*`)
- Accordion para configuração sempre visível — use seção fixa com header
- Dois números destaque no mesmo card — um card, uma métrica
- Decoração (ECG, bolinhas, watermark) em `z-index` acima do conteúdo
- Hardcode de Room IDs Liveblocks — use `tenantId/orgId`

---

## 11. Densidade

| Modo | `--pad` | `--gap` | Contexto |
|---|---|---|---|
| Compact | 16px | 12px | Tabelas densas, kanban cheio |
| Regular (default) | 20px | 16px | Dashboard, formulários |
| Comfy | 24px | 20px | Onboarding, telas de configuração |

```tsx
// Aplicar no root da página ou no shell
<div style={{ '--pad': '16px', '--gap': '12px' } as React.CSSProperties}>
  {/* compact view */}
</div>
```

---

## 12. Semântica SAFe — Classes utilitárias

```css
/* Estado de épico */
.epic-status-backlog    { /* bdg neutral */ }
.epic-status-progress   { /* bdg blue + dot */ }
.epic-status-risk       { /* bdg amber + dot */ }
.epic-status-blocked    { /* bdg red + dot */ }
.epic-status-done       { /* bdg green */ }

/* WSJF faixas */
.wsjf-high   { color: var(--green-text); }
.wsjf-medium { color: var(--amber-text); }
.wsjf-low    { color: var(--ink-muted); }
```
