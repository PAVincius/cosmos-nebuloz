// dark-cards.jsx — Dark KPI card: corner-bleed watermark icon that looks
// ENGRAVED (letterpress) at rest, and on hover reveals a polka-dot texture
// + lights the watermark and the live ECG signal. Matches the product's
// dark theme with green / red / amber states.

// ---- icon path sets (reused across engrave + glow layers) --------------
function iconPaths(icon) {
  switch (icon) {
    case "activity":
      return <path d="M22 12h-4l-3 9L9 3l-3 9H2" />;
    case "check":
      return (<><circle cx="12" cy="12" r="10" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>);
    case "clock":
      return (<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3.2 2" /></>);
    case "dollar":
      return (<><line x1="12" y1="2.4" x2="12" y2="21.6" /><path d="M16.5 6H9.75a3.25 3.25 0 0 0 0 6.5h4.5a3.25 3.25 0 0 1 0 6.5H7" /></>);
    default:
      return null;
  }
}

function Glyph({ icon, size = 22, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round">
      {iconPaths(icon)}
    </svg>
  );
}

// ---- tone palettes (from the product dark theme) -----------------------
const TONES = {
  green: {
    accent: "#34d399", rgb: "52,211,153", ink: "#0a111c",
    bg: "radial-gradient(130% 130% at 0% 0%, rgba(52,211,153,.12), transparent 46%), linear-gradient(180deg,#0e1826,#0a111c)",
    border: "rgba(52,211,153,.20)", num: "#34d399",
    badgeBg: "rgba(52,211,153,.12)", badgeFg: "#7ff0bf",
  },
  red: {
    accent: "#fb7185", rgb: "251,113,133", ink: "#170c12",
    bg: "radial-gradient(130% 150% at 100% 25%, rgba(244,63,94,.30), transparent 55%), linear-gradient(180deg,#22121a,#160c12)",
    border: "rgba(244,63,94,.32)", num: "#fda4af",
    badgeBg: "rgba(244,63,94,.16)", badgeFg: "#fda4af",
  },
  amber: {
    accent: "#fbbf24", rgb: "251,191,36", ink: "#120f0a",
    bg: "radial-gradient(130% 130% at 0% 0%, rgba(245,158,11,.13), transparent 48%), linear-gradient(180deg,#1a1610,#120f0a)",
    border: "rgba(245,158,11,.22)", num: "#fcd34d",
    badgeBg: "rgba(245,158,11,.14)", badgeFg: "#fcd34d",
  },
};

// ---- the card ----------------------------------------------------------
function DarkCard({ icon, tone = "green", label, value, unit, badge, forceHover }) {
  const t = TONES[tone];
  return (
    <div className={"dcard" + (forceHover ? " is-hover" : "")}
      style={{
        "--accent": t.accent, "--rgb": t.rgb, "--ink": t.ink,
        position: "relative", overflow: "hidden", boxSizing: "border-box",
        width: 312, minHeight: 152, padding: "20px 22px",
        borderRadius: 18, background: t.bg, border: `1px solid ${t.border}`,
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        fontFamily: "'Manrope',system-ui,sans-serif",
      }}>

      {/* polka-dot texture — hover only */}
      <div className="dots" aria-hidden="true" />

      {/* engraved watermark (rest state) */}
      <svg className="wm wm-engrave" width="208" height="208" viewBox="0 0 24 24"
           fill="none" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true">
        {iconPaths(icon)}
      </svg>
      {/* glowing watermark (hover state) */}
      <svg className="wm wm-glow" width="208" height="208" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="1.15"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {iconPaths(icon)}
      </svg>

      {/* live ECG signal along the bottom */}
      <svg className="sig" width="100%" height="46" viewBox="0 0 312 46"
           preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={"sigfade_" + tone + "_" + icon} x1="0" y1="0" x2="312" y2="0">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset=".5" stopColor="var(--accent)" stopOpacity=".9" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill="none" stroke={"url(#sigfade_" + tone + "_" + icon + ")"} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          d="M-30 26 H66 l7 -17 l9 32 l8 -24 l6 11 H180 l7 -14 l8 24 l7 -13 H430" />
      </svg>

      {/* header */}
      <div className="drow" style={{
        display: "flex", width: "100%", justifyContent: "space-between",
        alignItems: "flex-start", position: "relative", zIndex: 3,
      }}>
        <span style={{
          fontSize: 13.5, fontWeight: 600, color: "#93a1b3",
          letterSpacing: ".005em", lineHeight: 1.3, maxWidth: "78%",
        }}>{label}</span>
        <span className="chip" style={{
          display: "grid", placeItems: "center", width: 34, height: 34, flexShrink: 0,
          borderRadius: 10, color: t.accent,
          background: `rgba(${t.rgb},.10)`, border: `1px solid rgba(${t.rgb},.22)`,
        }}><Glyph icon={icon} size={17} stroke={2} /></span>
      </div>

      {/* value */}
      <div style={{
        position: "relative", zIndex: 3, margin: "12px 0 14px",
        fontFamily: "'JetBrains Mono','Space Grotesk',monospace",
        fontSize: 38, lineHeight: 1, fontWeight: 700, color: t.num,
        letterSpacing: "-.01em", whiteSpace: "nowrap",
      }}>
        {value}
        {unit && <span style={{ fontSize: 24, fontWeight: 600, opacity: .8, marginLeft: 7 }}>{unit}</span>}
      </div>

      {/* badge */}
      <span style={{
        position: "relative", zIndex: 3,
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 11px", borderRadius: 999, whiteSpace: "nowrap",
        background: t.badgeBg, color: t.badgeFg,
        fontSize: 12, fontWeight: 700, letterSpacing: ".01em",
        border: `1px solid rgba(${t.rgb},.18)`,
      }}>{badge}</span>
    </div>
  );
}

// A full dashboard row of the 4 real metrics
function DarkRow({ forceHover }) {
  return (
    <div style={{
      display: "flex", gap: 16, padding: 26,
      background: "#070b14", borderRadius: 4,
    }}>
      <DarkCard icon="activity" tone="green" forceHover={forceHover}
        label="Total de Execuções (traces)" value="52"
        badge={<>— Fluxos concluídos sem erro</>} />
      <DarkCard icon="check" tone="green" forceHover={forceHover}
        label="Taxa de Sucesso" value="100.0%"
        badge={<>↗ Excelente performance</>} />
      <DarkCard icon="clock" tone="red" forceHover={forceHover}
        label="Latência Média (LLM)" value="8923" unit="ms"
        badge={<>— Lentidão detectada</>} />
      <DarkCard icon="dollar" tone="amber" forceHover={forceHover}
        label="Custo no período" value="US$ 2,5228"
        badge={<>— Soma das gerações LLM · USD</>} />
    </div>
  );
}

Object.assign(window, { DarkCard, DarkRow });
