// cosmos-kit.jsx — UI primitives. Card, SectionCard, KpiCard (the vibe),
// Badge, Button, Progress, Avatar, Chip, IconButton, Stat.

const { createContext, useContext } = React;
const ThemeCtx = createContext("light");
const useThemeName = () => useContext(ThemeCtx);

// tone → css var names + dark gradient backgrounds (match the tecno-UI cards)
const TONES = {
  green:  { darkInk: "#0a111c", darkBg: "radial-gradient(130% 130% at 0% 0%, rgba(52,211,153,.12), transparent 46%), linear-gradient(180deg,#0e1826,#0a111c)" },
  red:    { darkInk: "#160c12", darkBg: "radial-gradient(130% 150% at 100% 22%, rgba(251,113,133,.20), transparent 55%), linear-gradient(180deg,#22121a,#160c12)" },
  amber:  { darkInk: "#120f0a", darkBg: "radial-gradient(130% 130% at 0% 0%, rgba(251,191,36,.13), transparent 48%), linear-gradient(180deg,#1a1610,#120f0a)" },
  blue:   { darkInk: "#0a1020", darkBg: "radial-gradient(130% 130% at 0% 0%, rgba(96,165,250,.13), transparent 46%), linear-gradient(180deg,#0d1526,#0a1020)" },
  purple: { darkInk: "#120c1f", darkBg: "radial-gradient(130% 130% at 100% 0%, rgba(167,139,250,.15), transparent 50%), linear-gradient(180deg,#15102a,#120c1f)" },
  accent: { darkInk: "#0b0f1f", darkBg: "radial-gradient(130% 130% at 0% 0%, rgba(124,135,255,.14), transparent 48%), linear-gradient(180deg,#10162b,#0b0f1f)" },
};
const toneVars = (tone) => ({
  "--tone": `var(--${tone})`,
  "--tone-rgb": `var(--${tone}-rgb)`,
  "--tone-text": `var(--${tone}-text)`,
  "--tone-soft": `var(--${tone}-soft)`,
});

// ---------- Button ----------
function Button({ children, variant = "primary", size = "md", icon, iconRight, full, onClick, style, title }) {
  const pad = size === "sm" ? "7px 12px" : size === "lg" ? "11px 18px" : "9px 15px";
  const fs = size === "sm" ? 13 : 14;
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: pad, fontSize: fs, fontWeight: 600, fontFamily: "inherit",
    borderRadius: "var(--r-md)", border: "1px solid transparent", lineHeight: 1.1,
    width: full ? "100%" : "auto", letterSpacing: ".005em", whiteSpace: "nowrap", cursor: "pointer",
  };
  const variants = {
    primary: { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "var(--accent)", boxShadow: "0 1px 2px rgba(var(--accent-rgb),.4), 0 6px 16px -8px rgba(var(--accent-rgb),.6)" },
    secondary: { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline-strong)" },
    ghost: { background: "transparent", color: "var(--ink-muted)" },
    soft: { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "transparent" },
  };
  return (
    <button className="btn" onClick={onClick} title={title} style={{ ...base, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 16} strokeWidth={2.1} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 16} strokeWidth={2.1} />}
    </button>
  );
}

function IconButton({ name, onClick, title, size = 34, active, style }) {
  return (
    <button className="btn navitem" onClick={onClick} title={title} style={{
      display: "grid", placeItems: "center", width: size, height: size,
      borderRadius: "var(--r-md)", border: "1px solid var(--hairline)",
      background: active ? "var(--surface-2)" : "transparent", color: "var(--ink-muted)", ...style,
    }}>
      <Icon name={name} size={17} strokeWidth={1.9} />
    </button>
  );
}

// ---------- Badge / Chip ----------
function Badge({ children, tone = "neutral", soft = true, dot, icon }) {
  const map = {
    neutral: { bg: "var(--chip-bg)", fg: "var(--ink-muted)", bd: "var(--hairline)" },
    green: { bg: "var(--green-soft)", fg: "var(--green-text)", bd: "rgba(var(--green-rgb),.25)" },
    red: { bg: "var(--red-soft)", fg: "var(--red-text)", bd: "rgba(var(--red-rgb),.25)" },
    amber: { bg: "var(--amber-soft)", fg: "var(--amber-text)", bd: "rgba(var(--amber-rgb),.25)" },
    blue: { bg: "var(--blue-soft)", fg: "var(--blue-text)", bd: "rgba(var(--blue-rgb),.25)" },
    purple: { bg: "var(--purple-soft)", fg: "var(--purple-text)", bd: "rgba(var(--purple-rgb),.25)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)", bd: "rgba(var(--accent-rgb),.25)" },
  };
  const c = map[tone] || map.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px",
      borderRadius: "var(--r-pill)", fontSize: 11.5, fontWeight: 700, letterSpacing: ".02em",
      whiteSpace: "nowrap", background: soft ? c.bg : "transparent", color: c.fg,
      border: `1px solid ${soft ? c.bd : "transparent"}`,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: c.fg }} />}
      {icon && <Icon name={icon} size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

// ---------- Card / SectionCard ----------
function Card({ children, style, className = "", pad = true, onClick }) {
  return (
    <div onClick={onClick} className={className} style={{
      background: "var(--surface)", border: "1px solid var(--hairline)",
      borderRadius: "var(--r-lg)", boxShadow: "var(--card-shadow)",
      padding: pad ? "var(--pad)" : 0, ...style,
    }}>{children}</div>
  );
}

function SectionCard({ title, subtitle, icon, action, children, bodyStyle, headStyle }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)", boxShadow: "var(--card-shadow)", overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "13px 18px",
        borderBottom: "1px solid var(--hairline)", background: "var(--surface-2)", ...headStyle,
      }}>
        {icon && <span style={{ color: "var(--ink-muted)" }}><Icon name={icon} size={16} strokeWidth={2} /></span>}
        <div style={{ minWidth: 0 }}>
          <div className="display" style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-.01em", color: "var(--ink)" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 1 }}>{subtitle}</div>}
        </div>
        {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
      </div>
      <div style={{ padding: "18px", ...bodyStyle }}>{children}</div>
    </div>
  );
}

// ---------- Progress ----------
function Progress({ value, tone = "accent", height = 7, track }) {
  return (
    <div style={{ width: "100%", height, borderRadius: 99, background: track || "var(--surface-3)", overflow: "hidden" }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", borderRadius: 99,
        background: `var(--${tone})`, boxShadow: `0 0 10px rgba(var(--${tone}-rgb),.5)`,
        transition: "width .6s cubic-bezier(.2,.7,.3,1)",
      }} />
    </div>
  );
}

// ---------- Avatar ----------
function Avatar({ name, size = 30, tone = "accent", src }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 99, flexShrink: 0,
      display: "grid", placeItems: "center", fontSize: size * .36, fontWeight: 700,
      color: `var(--${tone}-text)`, background: `var(--${tone}-soft)`,
      border: `1px solid rgba(var(--${tone}-rgb),.25)`, letterSpacing: ".02em",
      backgroundImage: src ? `url(${src})` : undefined, backgroundSize: "cover",
    }}>{!src && initials}</div>
  );
}

// ---------- KPI Card — the vibe ----------
function KpiCard({ icon, tone = "green", label, value, unit, delta, deltaTone, hint, big }) {
  const theme = useThemeName();
  const dark = theme === "dark";
  const T = TONES[tone] || TONES.green;
  return (
    <div className="kpi" style={{
      ...toneVars(tone), "--tone-ink": T.darkInk,
      boxSizing: "border-box", minHeight: big ? 168 : 150, padding: "18px 20px",
      borderRadius: "var(--r-xl)", display: "flex", flexDirection: "column", alignItems: "flex-start",
      background: dark ? T.darkBg : "var(--surface)",
      border: dark ? "1px solid rgba(var(--tone-rgb),.20)" : "1px solid var(--hairline)",
      boxShadow: "var(--card-shadow)",
    }}>
      <div className="dots" />
      <svg className="wm wm-engrave" width="200" height="200" viewBox="0 0 24 24" fill="none" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">{ICON_PATHS[icon]}</svg>
      <svg className="wm wm-glow" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">{ICON_PATHS[icon]}</svg>
      <svg className="sig" width="100%" height="44" viewBox="0 0 312 44" preserveAspectRatio="none">
        <defs>
          <linearGradient id={"sig_" + tone + "_" + icon} x1="0" y1="0" x2="312" y2="0">
            <stop offset="0" stopColor="var(--tone)" stopOpacity="0" />
            <stop offset=".5" stopColor="var(--tone)" stopOpacity=".9" />
            <stop offset="1" stopColor="var(--tone)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill="none" stroke={"url(#sig_" + tone + "_" + icon + ")"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M-30 24 H66 l7 -16 l9 30 l8 -22 l6 10 H180 l7 -13 l8 22 l7 -12 H430" />
      </svg>

      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", lineHeight: 1.3, maxWidth: "74%" }}>{label}</span>
        <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, flexShrink: 0, borderRadius: "var(--r-md)", color: "var(--tone)", background: "var(--tone-soft)", border: "1px solid rgba(var(--tone-rgb),.22)" }}>
          <Icon name={icon} size={17} strokeWidth={2} />
        </span>
      </div>

      <div className="mono" style={{ position: "relative", zIndex: 3, margin: "auto 0 12px", paddingTop: 14,
        fontSize: big ? 42 : 37, lineHeight: 1, fontWeight: 700, letterSpacing: "-.02em", whiteSpace: "nowrap",
        color: dark ? "var(--tone-text)" : "var(--ink)" }}>
        {value}{unit && <span style={{ fontSize: big ? 24 : 21, fontWeight: 600, opacity: .75, marginLeft: 6 }}>{unit}</span>}
      </div>

      <div style={{ position: "relative", zIndex: 3, display: "flex", alignItems: "center", gap: 8 }}>
        {delta && <Badge tone={deltaTone || tone} icon={deltaTone === "red" ? "trendingDown" : "trendingUp"}>{delta}</Badge>}
        {hint && <span style={{ fontSize: 12, color: "var(--ink-subtle)", fontWeight: 500 }}>{hint}</span>}
      </div>
    </div>
  );
}

// ---------- Switch ----------
function Switch({ on, tone = "accent" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", width: 38, height: 22, borderRadius: 99, padding: 2,
      background: on ? `var(--${tone})` : "var(--surface-3)", border: "1px solid " + (on ? "transparent" : "var(--hairline-strong)"),
      boxShadow: on ? `0 0 12px rgba(var(--${tone}-rgb),.45)` : "none", transition: "background .2s ease",
      justifyContent: on ? "flex-end" : "flex-start", flexShrink: 0, cursor: "pointer",
    }}>
      <span style={{ width: 16, height: 16, borderRadius: 99, background: on ? "#fff" : "var(--ink-faint)", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }} />
    </span>
  );
}

// ---------- Page header ----------
function PageHeader({ title, subtitle, children, meta }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
      <div style={{ minWidth: 0 }}>
        <h1 className="display" style={{ margin: 0, fontSize: 27, fontWeight: 700, letterSpacing: "-.025em", color: "var(--ink)" }}>{title}</h1>
        {subtitle && <p style={{ margin: "6px 0 0", fontSize: 14.5, color: "var(--ink-subtle)", maxWidth: 760, lineHeight: 1.45 }}>{subtitle}</p>}
        {meta && <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>{meta}</div>}
      </div>
      {children && <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}

Object.assign(window, {
  ThemeCtx, useThemeName, Button, IconButton, Badge, Card, SectionCard,
  Progress, Avatar, KpiCard, PageHeader, TONES, Switch,
});
