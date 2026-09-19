"use client";

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
// kit.tsx — cosmos UI primitives ported from cosmos-kit.jsx.
// Card, SectionCard, KpiCard (the vibe), Badge, Button, Progress, Avatar,
// IconButton, Switch, PageHeader, LivePulse + skeletons.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Contrato que o kit consome, não uma cópia do tipo de ninguém.
 *
 * Antes isto era `import type { Result } from "../../app/actions/_base"` — um
 * kit de UI amarrado ao módulo de server actions de UM app. Era o que impedia
 * o kit de sair de `apps/app`, e a razão de o back-office não conseguir usá-lo.
 *
 * Declarar a forma aqui não duplica nada: `Result` do app e o do back-office
 * já são estruturalmente idênticos, e ambos satisfazem esta assinatura sem
 * conversão. O kit passa a dizer o que precisa em vez de importar de onde não
 * devia — quem tiver a forma serve.
 */
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export type Tone =
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "purple"
  | "accent"
  | "neutral";

// ── Theme + Nav context (screens read these) ──
// Theme is owned by next-themes (data-theme on <html>); default to the app's dark
// until mounted to avoid a hydration flip. Prefer CSS-driven dark styling where
// possible so components need no JS theme read at all.
export const useThemeName = (): "light" | "dark" => {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "light" ? "light" : "dark";
};

// ── Shared fetch-state hook (loading | error | data) for real-data screens ──
export function useAction<T>(
  action: () => Promise<Result<T>>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // `active` is local to this effect run, not shared across re-runs — a
    // shared ref would let a stale response from a superseded run (deps
    // changed mid-flight) overwrite fresher data once it resolves.
    let active = true;
    setLoading(true);
    setError(false);
    action().then((r) => {
      if (!active) {
        return;
      }
      if (r.ok) {
        setData(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps is the caller-supplied dependency array
  }, deps);

  return { data, loading, error };
}

export const NavCtx = createContext<{
  navigate: (id: string, param?: string) => void;
  // True when `id` has no ported screen in the registry yet (see
  // screens/registry.tsx SCREENS) — nav UI uses this to render the entry as
  // "coming soon" instead of a dead-end link.
  isComingSoon: (id: string) => boolean;
}>({ navigate: () => {}, isComingSoon: () => false });
export const useNav = () => useContext(NavCtx);

// tone → dark gradient backgrounds (match the tecno-UI cards)
export const TONES: Record<string, { darkInk: string; darkBg: string }> = {
  green: {
    darkInk: "#0a111c",
    darkBg:
      "radial-gradient(130% 130% at 0% 0%, rgba(52,211,153,.12), transparent 46%), linear-gradient(180deg,#0e1826,#0a111c)",
  },
  red: {
    darkInk: "#160c12",
    darkBg:
      "radial-gradient(130% 150% at 100% 22%, rgba(251,113,133,.20), transparent 55%), linear-gradient(180deg,#22121a,#160c12)",
  },
  amber: {
    darkInk: "#120f0a",
    darkBg:
      "radial-gradient(130% 130% at 0% 0%, rgba(251,191,36,.13), transparent 48%), linear-gradient(180deg,#1a1610,#120f0a)",
  },
  blue: {
    darkInk: "#0a1020",
    darkBg:
      "radial-gradient(130% 130% at 0% 0%, rgba(96,165,250,.13), transparent 46%), linear-gradient(180deg,#0d1526,#0a1020)",
  },
  purple: {
    darkInk: "#120c1f",
    darkBg:
      "radial-gradient(130% 130% at 100% 0%, rgba(167,139,250,.15), transparent 50%), linear-gradient(180deg,#15102a,#120c1f)",
  },
  accent: {
    darkInk: "#0b0f1f",
    darkBg:
      "radial-gradient(130% 130% at 0% 0%, rgba(124,135,255,.14), transparent 48%), linear-gradient(180deg,#10162b,#0b0f1f)",
  },
};

const toneVars = (tone: string): CSSProperties =>
  ({
    "--tone": `var(--${tone})`,
    "--tone-rgb": `var(--${tone}-rgb)`,
    "--tone-text": `var(--${tone}-text)`,
    "--tone-soft": `var(--${tone}-soft)`,
  }) as CSSProperties;

// ── Button ──
type ButtonProps = {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "soft";
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  title?: string;
  /** Atributo real, não só opacidade: o CSS já cobre `.btn:disabled`, e sem o
   *  atributo o teclado continua alcançando um controle inerte. */
  disabled?: boolean;
  type?: "button" | "submit";
};
export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  full,
  onClick,
  style,
  title,
  disabled,
  type = "button",
}: ButtonProps) {
  const pad =
    size === "sm" ? "7px 12px" : size === "lg" ? "11px 18px" : "9px 15px";
  const fs = size === "sm" ? 13 : 14;
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: pad,
    fontSize: fs,
    fontWeight: 600,
    fontFamily: "inherit",
    borderRadius: "var(--r-md)",
    border: "1px solid transparent",
    lineHeight: 1.1,
    width: full ? "100%" : "auto",
    letterSpacing: ".005em",
    whiteSpace: "nowrap",
    cursor: "pointer",
  };
  const variants: Record<string, CSSProperties> = {
    primary: {
      background: "var(--accent)",
      color: "var(--accent-fg)",
      borderColor: "var(--accent)",
      boxShadow:
        "0 1px 2px rgba(var(--accent-rgb),.4), 0 6px 16px -8px rgba(var(--accent-rgb),.6)",
    },
    secondary: {
      background: "var(--surface)",
      color: "var(--ink)",
      borderColor: "var(--hairline-strong)",
    },
    ghost: { background: "transparent", color: "var(--ink-muted)" },
    soft: {
      background: "var(--accent-soft)",
      color: "var(--accent)",
      borderColor: "transparent",
    },
  };
  const isz = size === "sm" ? 15 : 16;
  return (
    <button
      className="btn"
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...variants[variant], ...style }}
      title={title}
      type={type}
    >
      {icon && <Icon name={icon} size={isz} strokeWidth={2.1} />}
      {children}
      {iconRight && <Icon name={iconRight} size={isz} strokeWidth={2.1} />}
    </button>
  );
}

// ── NavButton (Button wired to app navigation via useNav) ──
// Lets server-rendered screens trigger client-side navigation without
// passing a function prop across the server/client boundary.
export function NavButton({
  to,
  param,
  ...buttonProps
}: Omit<ButtonProps, "onClick"> & { to: string; param?: string }) {
  const { navigate } = useNav();
  return <Button {...buttonProps} onClick={() => navigate(to, param)} />;
}

export function IconButton({
  name,
  onClick,
  title,
  size = 34,
  active,
  style,
}: {
  name: IconName;
  onClick?: () => void;
  /** Required: this button renders an icon and nothing else, so without a
   *  label it reaches screen readers unnamed (axe button-name, critical). */
  title: string;
  size?: number;
  active?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      aria-label={title}
      className="btn navitem"
      onClick={onClick}
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: active ? "var(--surface-2)" : "transparent",
        color: "var(--ink-muted)",
        ...style,
      }}
      title={title}
      type="button"
    >
      <Icon aria-hidden name={name} size={17} strokeWidth={2} />
    </button>
  );
}

// ── Live/operational status dot ──
export function LivePulse({
  tone = "green",
  size = 7,
}: {
  tone?: Tone;
  size?: number;
}) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <span
        className="pulse-dot"
        style={
          {
            "--pulse-rgb": `var(--${tone}-rgb)`,
            position: "absolute",
            inset: 0,
            borderRadius: 99,
            background: `var(--${tone})`,
          } as CSSProperties
        }
      />
      <span
        style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: 99,
          background: `var(--${tone})`,
        }}
      />
    </span>
  );
}

// ── Badge / Chip ──
export function Badge({
  children,
  tone = "neutral",
  soft = true,
  dot,
  pulse,
  icon,
}: {
  children?: ReactNode;
  tone?: Tone;
  soft?: boolean;
  dot?: boolean;
  pulse?: boolean;
  icon?: IconName;
}) {
  const prevTone = useRef(tone);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prevTone.current !== tone) {
      setFlash(true);
      prevTone.current = tone;
      const t = setTimeout(() => setFlash(false), 400);
      return () => clearTimeout(t);
    }
  }, [tone]);
  const map: Record<string, { bg: string; fg: string; bd: string }> = {
    neutral: {
      bg: "var(--chip-bg)",
      fg: "var(--ink-muted)",
      bd: "var(--hairline)",
    },
    green: {
      bg: "var(--green-soft)",
      fg: "var(--green-text)",
      bd: "rgba(var(--green-rgb),.25)",
    },
    red: {
      bg: "var(--red-soft)",
      fg: "var(--red-text)",
      bd: "rgba(var(--red-rgb),.25)",
    },
    amber: {
      bg: "var(--amber-soft)",
      fg: "var(--amber-text)",
      bd: "rgba(var(--amber-rgb),.25)",
    },
    blue: {
      bg: "var(--blue-soft)",
      fg: "var(--blue-text)",
      bd: "rgba(var(--blue-rgb),.25)",
    },
    purple: {
      bg: "var(--purple-soft)",
      fg: "var(--purple-text)",
      bd: "rgba(var(--purple-rgb),.25)",
    },
    accent: {
      bg: "var(--accent-soft)",
      fg: "var(--accent)",
      bd: "rgba(var(--accent-rgb),.25)",
    },
  };
  const c = map[tone] || map.neutral;
  const dotTone = tone === "neutral" ? "green" : tone;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: "var(--r-pill)",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
        background: soft ? c.bg : "transparent",
        color: c.fg,
        border: `1px solid ${soft ? c.bd : "transparent"}`,
        animation: flash ? "cosmos-badgeFlash .35s ease" : "none",
        transition:
          "background .2s ease, color .2s ease, border-color .2s ease",
      }}
    >
      {dot &&
        (pulse ? (
          <span
            style={{
              position: "relative",
              display: "inline-flex",
              width: 6,
              height: 6,
            }}
          >
            <span
              className="pulse-dot"
              style={
                {
                  "--pulse-rgb": `var(--${dotTone}-rgb)`,
                  position: "absolute",
                  inset: 0,
                  borderRadius: 99,
                  background: c.fg,
                } as CSSProperties
              }
            />
            <span
              style={{
                position: "relative",
                width: 6,
                height: 6,
                borderRadius: 99,
                background: c.fg,
              }}
            />
          </span>
        ) : (
          <span
            style={{ width: 6, height: 6, borderRadius: 99, background: c.fg }}
          />
        ))}
      {icon && <Icon name={icon} size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

// ── Card / SectionCard ──
export function Card({
  children,
  style,
  className = "",
  pad = true,
  onClick,
}: {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  pad?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--card-shadow)",
        padding: pad ? "var(--pad)" : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  bodyStyle,
  headStyle,
  tone,
  onActivate,
  as: Titulo = "div",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  children?: ReactNode;
  bodyStyle?: CSSProperties;
  headStyle?: CSSProperties;
  tone?: Tone;
  /** Card-Header-Glow: makes the header clickable + adds the one-shot mouse-enter pulse. */
  onActivate?: () => void;
  /** Element for the title. Default `div` keeps the card out of the heading
   *  outline (Cosmos/Charter unchanged); `h2`/`h3` lets a screen reader jump
   *  section to section. Same class and style either way. */
  as?: "div" | "h2" | "h3";
}) {
  const dark = useThemeName() === "dark";
  const reduceMotion = useReducedMotion();
  const [pulse, setPulse] = useState<{
    x: number;
    y: number;
    key: number;
  } | null>(null);

  function handleHeadEnter(e: React.MouseEvent<HTMLDivElement>) {
    if (reduceMotion) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setPulse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      key: Date.now(),
    });
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${tone ? `rgba(var(--${tone}-rgb),.22)` : "var(--hairline)"}`,
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--card-shadow)",
        overflow: "hidden",
      }}
    >
      <div
        onClick={onActivate}
        onKeyDown={(e) => {
          if (onActivate && e.key === "Enter") {
            onActivate();
          }
        }}
        onMouseEnter={handleHeadEnter}
        role={onActivate ? "button" : undefined}
        style={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "13px 18px",
          borderBottom: "1px solid var(--hairline)",
          background: dark ? "var(--surface-2)" : "var(--surface)",
          cursor: onActivate ? "pointer" : undefined,
          ...headStyle,
        }}
        tabIndex={onActivate ? 0 : undefined}
      >
        {tone && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              background: `var(--${tone})`,
              boxShadow: `0 0 10px 2px rgba(var(--${tone}-rgb),.7), 0 0 22px 4px rgba(var(--${tone}-rgb),.3)`,
            }}
          />
        )}
        {/* single radial pulse, born at cursor, one-shot per mouseenter — always on */}
        <AnimatePresence>
          {pulse && (
            <motion.span
              animate={{ opacity: 0, scale: 16 }}
              initial={{ opacity: 0.5, scale: 0 }}
              key={pulse.key}
              onAnimationComplete={() => setPulse(null)}
              style={{
                position: "absolute",
                left: pulse.x,
                top: pulse.y,
                width: 12,
                height: 12,
                marginLeft: -6,
                marginTop: -6,
                borderRadius: "50%",
                background: tone
                  ? `radial-gradient(circle, rgba(var(--${tone}-rgb),.5) 0%, transparent 70%)`
                  : "radial-gradient(circle, rgba(255,255,255,.25) 0%, transparent 70%)",
                pointerEvents: "none",
                zIndex: 2,
              }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </AnimatePresence>
        {tone && dark && (
          <div
            className="cosmos-dot-texture"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.5,
              color: `rgba(var(--${tone}-rgb),.24)`,
              WebkitMaskImage:
                "radial-gradient(160% 140% at 100% 100%, #000 0%, transparent 55%)",
              maskImage:
                "radial-gradient(160% 140% at 100% 100%, #000 0%, transparent 55%)",
            }}
          />
        )}
        {tone && dark && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `radial-gradient(80% 120% at 0% 50%, rgba(var(--${tone}-rgb),.1) 0%, transparent 70%)`,
            }}
          />
        )}
        {dark && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              pointerEvents: "none",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.1) 30%, rgba(255,255,255,.06) 70%, transparent 100%)",
            }}
          />
        )}
        {icon && (
          <span
            style={{
              position: "relative",
              zIndex: 1,
              color: tone ? `var(--${tone}-text)` : "var(--ink-muted)",
              background: tone ? `rgba(var(--${tone}-rgb),.12)` : "transparent",
              border: tone ? `1px solid rgba(var(--${tone}-rgb),.25)` : "none",
              borderRadius: 8,
              padding: tone ? "5px" : 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name={icon} size={16} strokeWidth={2} />
          </span>
        )}
        <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
          <Titulo
            className="display"
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 700,
              letterSpacing: "-.015em",
              color: "var(--ink)",
            }}
          >
            {title}
          </Titulo>
          {subtitle && (
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-subtle)",
                marginTop: 1,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {action && (
          <div style={{ marginLeft: "auto", position: "relative", zIndex: 1 }}>
            {action}
          </div>
        )}
      </div>
      <div style={{ padding: "18px", ...bodyStyle }}>{children}</div>
    </div>
  );
}

// ── Progress ──
export function Progress({
  value,
  tone = "accent",
  height = 7,
  track,
}: {
  value: number;
  tone?: Tone;
  height?: number;
  track?: string;
}) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDisplayed(value), 60);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 99,
        background: track || "var(--surface-3)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 99,
          background: `var(--${tone})`,
          boxShadow: `0 0 10px rgba(var(--${tone}-rgb),.5)`,
          transform: `scaleX(${Math.max(0, Math.min(100, displayed)) / 100})`,
          transformOrigin: "left",
          transition: "transform .75s cubic-bezier(.2,.8,.3,1)",
        }}
      />
    </div>
  );
}

// ── Avatar ──
export function Avatar({
  name,
  size = 30,
  tone = "accent",
  src,
}: {
  name?: string;
  size?: number;
  tone?: Tone;
  src?: string;
}) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: `var(--${tone}-text)`,
        background: `var(--${tone}-soft)`,
        border: `1px solid rgba(var(--${tone}-rgb),.25)`,
        letterSpacing: ".02em",
        backgroundImage: src ? `url(${src})` : undefined,
        backgroundSize: "cover",
      }}
    >
      {!src && initials}
    </div>
  );
}

// 8-way compass unit vectors (E, SE, S, SW, W, NW, N, NE) — the echo wave's
// origin snaps to one of these, so it only ever travels vertically,
// horizontally, or diagonally, never from an arbitrary point.
const KPI_ECHO_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--hairline)",
        marginBottom: 16,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            background: "transparent",
            border: "none",
            borderBottom:
              active === t.id
                ? "2px solid var(--accent)"
                : "2px solid transparent",
            color: active === t.id ? "var(--ink)" : "var(--ink-muted)",
            cursor: "pointer",
          }}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── KPI Card — the vibe ──
export function KpiCard({
  icon,
  tone = "green",
  label,
  value,
  unit,
  delta,
  deltaTone,
  hint,
  big,
}: {
  icon: IconName;
  tone?: Tone;
  label: ReactNode;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaTone?: Tone;
  hint?: string;
  big?: boolean;
}) {
  const dark = useThemeName() === "dark";
  // Mesmo hook e mesmo contrato que SectionCard.handleHeadEnter usa logo
  // acima neste arquivo para o próprio pulso de mouse-enter — este era o
  // único disparo de animação por gesto no kit sem essa guarda.
  const reduceMotion = useReducedMotion();

  // Light-mode-only echo: wave snapped to the edge/corner matching the
  // direction the cursor entered from (vertical / horizontal / diagonal
  // only), not the raw cursor point. Dark theme already has its own "sinal
  // vivo" via the dots/watermark/ECG sig below, so this stays scoped to
  // light.
  function handleKpiEnter(e: React.MouseEvent<HTMLDivElement>) {
    if (dark || reduceMotion) {
      return;
    }
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x / rect.width - 0.5;
    const dy = y / rect.height - 0.5;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const dirIndex = Math.round(((angleDeg + 360) % 360) / 45) % 8;
    const [ux, uy] = KPI_ECHO_DIRECTIONS[dirIndex];

    const originX = ux === 0 ? rect.width / 2 : ux > 0 ? rect.width : 0;
    const originY = uy === 0 ? rect.height / 2 : uy > 0 ? rect.height : 0;

    el.style.setProperty("--mx", `${originX}px`);
    el.style.setProperty("--my", `${originY}px`);
    el.classList.remove("echo-ping");
    // force reflow so rapid re-entries restart the animation
    const _reflow = el.offsetWidth;
    el.classList.add("echo-ping");
  }

  const T = TONES[tone] || TONES.green;

  const rawNum = Number.parseFloat(String(value).replace(",", "."));
  const isNum =
    !Number.isNaN(rawNum) &&
    !!String(value)
      .trim()
      .match(/^[\d.,]+$/);
  const [countVal, setCountVal] = useState(0);
  useEffect(() => {
    if (!isNum) {
      return;
    }
    // A contagem de 0 até o valor é decoração de entrada, não a informação
    // em si — o valor final já é conhecido no primeiro render. Sob reduced
    // motion o número aparece direto, sem perder nenhum estado.
    if (reduceMotion) {
      setCountVal(rawNum);
      return;
    }
    let start: number | null = null;
    const dur = 900;
    let raf = 0;
    function step(ts: number) {
      if (!start) {
        start = ts;
      }
      const p = Math.min((ts - start) / dur, 1);
      const ease = 1 - (1 - p) ** 3;
      setCountVal(ease * rawNum);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      }
    }
    raf = requestAnimationFrame(step);
    const fallback = setTimeout(() => setCountVal(rawNum), dur + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNum, rawNum, reduceMotion]);

  function formatCount(n: number, orig: string | number) {
    const origStr = String(orig);
    const hasDecimalComma = origStr.includes(",");
    const decimals = hasDecimalComma ? origStr.split(",")[1]?.length || 1 : 0;
    if (decimals > 0) {
      return n.toFixed(decimals).replace(".", ",");
    }
    return Math.round(n).toString();
  }

  const len = String(value).length;
  const bigFs = isNum
    ? big
      ? 42
      : 37
    : len > 10
      ? big
        ? 24
        : 21
      : len > 6
        ? big
          ? 32
          : 28
        : big
          ? 42
          : 37;
  const sigId = `cosmos_sig_${tone}_${icon}`;

  return (
    <div
      className="kpi"
      onAnimationEnd={(e) => e.currentTarget.classList.remove("echo-ping")}
      onMouseEnter={handleKpiEnter}
      style={
        {
          ...toneVars(tone),
          "--tone-ink": T.darkInk,
          boxSizing: "border-box",
          minHeight: big ? 168 : 150,
          height: "auto",
          padding: "18px 20px",
          borderRadius: "var(--r-xl)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          background: dark ? T.darkBg : "var(--surface)",
          border: dark
            ? "1px solid rgba(var(--tone-rgb),.20)"
            : "1px solid var(--hairline)",
          boxShadow: "var(--card-shadow)",
        } as CSSProperties
      }
    >
      <div className="kpi-clip">
        <span aria-hidden className="kpi-echo-edge" />
        <div className="dots" />
        <Icon
          className="wm wm-engrave"
          name={icon}
          size={200}
          strokeWidth={1.15}
          style={{ stroke: "var(--tone-ink)" }}
        />
        <Icon
          className="wm wm-glow"
          name={icon}
          size={200}
          strokeWidth={1.15}
        />
        <svg
          className="sig"
          height="44"
          preserveAspectRatio="none"
          viewBox="0 0 312 44"
          width="100%"
        >
          <defs>
            <linearGradient id={sigId} x1="0" x2="312" y1="0" y2="0">
              <stop offset="0" stopColor="var(--tone)" stopOpacity="0" />
              <stop offset=".5" stopColor="var(--tone)" stopOpacity=".9" />
              <stop offset="1" stopColor="var(--tone)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M-30 24 H66 l7 -16 l9 30 l8 -22 l6 10 H180 l7 -13 l8 22 l7 -12 H430"
            fill="none"
            stroke={`url(#${sigId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "flex-start",
          position: "relative",
          zIndex: 3,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink-muted)",
            lineHeight: 1.3,
            maxWidth: "74%",
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: "var(--r-md)",
            color: "var(--tone)",
            background: "var(--tone-soft)",
            border: "1px solid rgba(var(--tone-rgb),.22)",
          }}
        >
          <Icon name={icon} size={18} strokeWidth={2} />
        </span>
      </div>

      <div
        className="mono"
        style={{
          position: "relative",
          zIndex: 3,
          margin: "auto 0 12px",
          paddingTop: 14,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          columnGap: 6,
          rowGap: 2,
          maxWidth: "100%",
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: "-.02em",
          color: dark ? "var(--tone-text)" : "var(--ink)",
        }}
      >
        <span
          style={{
            fontSize: bigFs,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {isNum ? formatCount(countVal, value) : value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: big ? 24 : 21,
              fontWeight: 600,
              opacity: 0.75,
              whiteSpace: "nowrap",
            }}
          >
            {unit}
          </span>
        )}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {delta && (
          <Badge
            icon={deltaTone === "red" ? "trendingDown" : "trendingUp"}
            tone={deltaTone || "green"}
          >
            {delta}
          </Badge>
        )}
        {hint && (
          <span
            style={{
              fontSize: 12,
              color: "var(--ink-subtle)",
              fontWeight: 500,
            }}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Switch ──
export function Switch({
  on,
  tone = "accent",
  onClick,
}: {
  on?: boolean;
  tone?: Tone;
  onClick?: () => void;
}) {
  const trackStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    width: 38,
    height: 22,
    borderRadius: 99,
    padding: 2,
    background: on ? `var(--${tone})` : "var(--surface-3)",
    border: `1px solid ${on ? "transparent" : "var(--hairline-strong)"}`,
    boxShadow: on ? `0 0 12px rgba(var(--${tone}-rgb),.45)` : "none",
    transition: "background .2s ease",
    justifyContent: on ? "flex-end" : "flex-start",
    flexShrink: 0,
    cursor: "pointer",
  };
  const thumb = (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 99,
        background: on ? "#fff" : "var(--ink-faint)",
        boxShadow: "0 1px 2px rgba(0,0,0,.3)",
      }}
    />
  );

  if (onClick) {
    return (
      <span
        aria-checked={on}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        role="switch"
        style={trackStyle}
        tabIndex={0}
      >
        {thumb}
      </span>
    );
  }

  return <span style={trackStyle}>{thumb}</span>;
}

// ── Page header — depth treatment ──
export function PageHeader({
  title,
  subtitle,
  children,
  meta,
  eyebrow,
  tone = "accent",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  meta?: ReactNode;
  eyebrow?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        marginBottom: 22,
        flexShrink: 0,
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--hairline)",
        boxShadow: "var(--card-shadow)",
        background:
          "linear-gradient(180deg, var(--surface-3), var(--surface-2) 60%, var(--surface))",
        padding: "22px 26px 24px",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(90% 100% at 14% 0%, rgba(var(--${tone}-rgb),.14), transparent 62%)`,
        }}
      />
      <div style={{ position: "relative", zIndex: 2 }}>
        {eyebrow && (
          <div
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: `var(--${tone}-text)`,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {eyebrow}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              className="display"
              style={{
                margin: 0,
                fontSize: 27,
                fontWeight: 700,
                letterSpacing: "-.025em",
                color: "var(--ink)",
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 14.5,
                  color: "var(--ink-subtle)",
                  maxWidth: 760,
                  lineHeight: 1.45,
                }}
              >
                {subtitle}
              </p>
            )}
            {meta && (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {meta}
              </div>
            )}
          </div>
          {children && (
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeletons ──
export function Skel({
  w = "100%",
  h = 14,
  r = 8,
  style,
}: {
  w?: number | string;
  h?: number;
  r?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }}
    />
  );
}

export function SkeletonKpi() {
  return (
    <div
      style={{
        minHeight: 150,
        padding: "18px 20px",
        borderRadius: "var(--r-xl)",
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Skel h={13} w={90} />
        <Skel h={34} r={10} w={34} />
      </div>
      <Skel h={34} style={{ marginTop: 8 }} w={120} />
      <Skel h={12} w={70} />
      <div style={{ marginTop: "auto" }}>
        <Skel h={20} r={99} w={80} />
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 16px",
        borderRadius: "var(--r-md)",
        border: "1px solid rgba(var(--red-rgb),.28)",
        background: "rgba(var(--red-rgb),.08)",
        color: "var(--red-text)",
        fontSize: 13,
      }}
    >
      <Icon name="alert" size={16} strokeWidth={2} />
      <span>{message ?? "Não foi possível carregar os dados."}</span>
    </div>
  );
}

// ── CopyId — click a mono ID to copy it ──
export function CopyId({
  children,
  value,
}: {
  children: ReactNode;
  value?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(value || String(children)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span
      className="chart-hit"
      onClick={copy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        borderRadius: 4,
        padding: "1px 4px",
        transition: "background .15s ease",
        background: copied ? "rgba(var(--green-rgb),.18)" : "transparent",
      }}
      title={`Copiar ${value || children}`}
    >
      {copied ? (
        <>
          <Icon
            name="check"
            size={11}
            strokeWidth={2.5}
            style={{ color: "var(--green-text)" }}
          />
          <span style={{ color: "var(--green-text)" }}>Copiado</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}

// ── ChartTip — absolutely positioned tooltip inside a position:relative chart wrapper ──
export function ChartTip({
  left,
  top = 0,
  px,
  children,
}: {
  left: number;
  top?: number;
  px?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="chart-tip"
      style={{ left: px ? left : `${left}%`, top: px ? top : `${top}%` }}
    >
      {children}
    </div>
  );
}

// ── GlossaryTip — hover a SAFe term to see its definition ──
export const SAFe_GLOSSARY: Record<string, { title: string; def: string }> = {
  WSJF: {
    title: "Weighted Shortest Job First",
    def: "Método de priorização SAFe: Cost of Delay ÷ Job Size. Maximiza o valor entregue por unidade de tempo. Calcula-se como (BV + TC + RR/OE) ÷ Size.",
  },
  INVEST: {
    title: "INVEST Score",
    def: "Framework de qualidade de épico: Independent, Negotiable, Valuable, Estimable, Small, Testable. Score 0–100; ≥70 = pronto para Implementing.",
  },
  PPM: {
    title: "Program Predictability Measure",
    def: "% de business value comprometido realmente entregue no PI. Meta SAFe: ≥80%. Calculado por time e agregado no ART.",
  },
  ROAM: {
    title: "ROAM (Risk Board)",
    def: "Framework de gestão de riscos SAFe: Resolved (eliminado), Owned (assumido com plano), Accepted (assumido sem plano), Mitigated (impacto reduzido).",
  },
  ART: {
    title: "Agile Release Train",
    def: "Time de times SAFe (50–125 pessoas) que planeja, compromete e entrega valor em cadência de PI (tipicamente 10 semanas). Liderado pelo RTE.",
  },
  PI: {
    title: "Program Increment",
    def: "Cadência de planejamento e entrega SAFe (tipicamente 8–12 semanas). Inclui PI Planning, 4–5 Sprints e uma Sprint IP (Inspect & Plan).",
  },
  RTE: {
    title: "Release Train Engineer",
    def: "Servant leader e coach do ART. Facilita o PI Planning, remove impedimentos sistêmicos e garante a execução do programa.",
  },
  LPM: {
    title: "Lean Portfolio Management",
    def: "Capacidade SAFe para alinhar estratégia ao portfólio via WSJF, OKRs e guardrails de budget. Opera no nível de portfólio acima dos ARTs.",
  },
  CoD: {
    title: "Cost of Delay",
    def: "Valor econômico perdido por não entregar uma feature a tempo. CoD = BV + TC + RR/OE. Numerador do WSJF.",
  },
  BV: {
    title: "Business Value",
    def: "Valor de negócio relativo da feature/épico. Pontuado de 1–20 pelos Business Owners durante o PI Planning Confidence Vote.",
  },
  OKR: {
    title: "Objectives & Key Results",
    def: "Framework de definição de metas: Objective qualitativo + Key Results quantitativos e mensuráveis. Conecta estratégia de portfólio à execução dos ARTs.",
  },
};

export function GlossaryTip({
  term,
  children,
}: {
  term: string;
  children?: ReactNode;
}) {
  const entry = SAFe_GLOSSARY[term];
  const [show, setShow] = useState(false);
  if (!entry) {
    return <>{children}</>;
  }
  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: "relative", display: "inline" }}
    >
      <span className="glossary-term">{children || term}</span>
      {show && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            minWidth: 260,
            maxWidth: 320,
            background: "var(--surface-3)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--r-md)",
            boxShadow: "0 12px 28px -10px rgba(0,0,0,.5)",
            padding: "11px 14px",
            display: "block",
            pointerEvents: "none",
            animation: "cosmos-tipIn .12s ease",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--accent-text)",
              marginBottom: 5,
            }}
          >
            {term} · {entry.title}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 12,
              color: "var(--ink-muted)",
              lineHeight: 1.5,
            }}
          >
            {entry.def}
          </span>
        </span>
      )}
    </span>
  );
}

// ── CopilotInsightBar — the ORBIT AI hint strip ──
export function CopilotInsightBar({
  children,
  action = "Revisar",
  onAction,
}: {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="ai-shimmer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 16px",
        marginBottom: 18,
        borderRadius: "var(--r-lg)",
        border: "1px solid rgba(var(--accent-rgb),.25)",
        background: "var(--accent-soft)",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "rgba(var(--accent-rgb),.16)",
          border: "1px solid rgba(var(--accent-rgb),.28)",
          color: "var(--accent-text)",
          flexShrink: 0,
        }}
      >
        <Icon name="sparkles" size={16} />
      </span>
      <span
        style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.45 }}
      >
        {children}
      </span>
      <Button
        iconRight="arrowRight"
        onClick={onAction}
        size="sm"
        style={{ marginLeft: "auto", color: "var(--accent-text)" }}
        variant="ghost"
      >
        {action}
      </Button>
    </div>
  );
}
