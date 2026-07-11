"use client";

import { cn } from "@repo/design-system/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// ─── Design tokens via CSS vars — works in light + dark mode ──────────────────
const tok = {
  canvas: "var(--canvas)",
  surface1: "var(--surface)",
  surface2: "var(--surface-2)",
  surface3: "var(--surface-3)",
  hairline: "var(--hairline)",
  hairlineStrong: "var(--hairline-strong)",
  ink: "var(--ink)",
  inkMuted: "var(--ink-muted)",
  inkSubtle: "var(--ink-subtle)",
  inkTertiary: "var(--ink-faint)",
  primary: "var(--accent-c)",
  success: "var(--green)",
  risk: "var(--red)",
  warn: "var(--amber)",
  info: "var(--blue)",
  purple: "var(--purple)",
  amber: "var(--amber)",
} as const;

// Fallback hex for alpha-channel concatenation (critical border/glow only)
const RISK_HEX = "#e54d4d";

// ─── BentoGrid ────────────────────────────────────────────────────────────────
export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      animate="show"
      className={cn(className)}
      initial="hidden"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "10px",
      }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: prefersReducedMotion ? 0 : 0.055,
            delayChildren: prefersReducedMotion ? 0 : 0.04,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── BentoCell ────────────────────────────────────────────────────────────────
type Priority = "critical" | "high" | "medium" | "low";

export type BentoCellProps = {
  span?: 1 | 2 | 3 | 4;
  priority?: Priority;
  accentColor?: string;
  eyebrow?: string;
  eyebrowAction?: { label: string; href: string };
  className?: string;
  children: ReactNode;
};

export function BentoCell({
  span = 1,
  priority,
  accentColor,
  eyebrow,
  eyebrowAction,
  className,
  children,
}: BentoCellProps) {
  const prefersReducedMotion = useReducedMotion();
  const isCritical = priority === "critical";
  // accentColor is always a hex from callers — needed for hex+alpha concatenation
  const accentHex = accentColor ?? RISK_HEX;

  // Merge accent ring + card elevation shadow so both themes look premium
  const boxShadow = isCritical
    ? `inset 0 1px 0 0 ${accentHex}33, 0 0 0 1px ${accentHex}22, var(--card-shadow)`
    : "var(--card-shadow)";

  const criticalBg = isCritical
    ? { backgroundImage: `linear-gradient(to right, ${accentHex}11 0%, transparent 60%)` }
    : {};

  return (
    <motion.div
      className={cn("bento-cell", className)}
      style={{
        gridColumn: `span ${span}`,
        background: tok.surface1,
        border: "1px solid var(--hairline)",
        borderRadius: "12px",
        padding: "16px",
        position: "relative",
        overflow: "hidden",
        boxShadow,
        ...criticalBg,
      }}
      variants={{
        hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
        show: {
          opacity: 1,
          y: 0,
          transition: prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 340, damping: 26, mass: 0.8 },
        },
      }}
    >
      {isCritical && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: `linear-gradient(to right, transparent, ${accentHex}, transparent)`,
          }}
        />
      )}
      {(eyebrow || eyebrowAction) && (
        <CellEyebrow action={eyebrowAction} label={eyebrow ?? ""} />
      )}
      {children}
    </motion.div>
  );
}

// ─── CellEyebrow ──────────────────────────────────────────────────────────────
export function CellEyebrow({
  label,
  action,
  color,
}: {
  label: string;
  action?: { label: string; href: string };
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.4px",
          color: color ?? tok.inkMuted,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      {action && (
        <a
          href={action.href}
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            color: tok.primary,
            textDecoration: "none",
          }}
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

// ─── CellValue ────────────────────────────────────────────────────────────────
export function CellValue({
  value,
  suffix,
  color,
}: {
  value: string | number;
  suffix?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "4px",
        color: color ?? tok.ink,
      }}
    >
      <span
        style={{
          fontSize: "32px",
          fontWeight: 600,
          letterSpacing: "-1px",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {suffix && (
        <span
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: tok.inkSubtle,
            letterSpacing: "-0.3px",
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

// ─── CellLabel ────────────────────────────────────────────────────────────────
export function CellLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: "13px",
        color: tok.inkMuted,
        marginTop: "4px",
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

// ─── CellSub ──────────────────────────────────────────────────────────────────
export function CellSub({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: "12px",
        color: tok.inkMuted,
        marginTop: "4px",
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const badgeVariants = {
  green:  { bg: "rgba(var(--green-rgb), 0.1)",  border: "rgba(var(--green-rgb), 0.2)",  text: "var(--green)" },
  red:    { bg: "rgba(var(--red-rgb), 0.1)",    border: "rgba(var(--red-rgb), 0.2)",    text: "var(--red)" },
  amber:  { bg: "rgba(var(--amber-rgb), 0.1)",  border: "rgba(var(--amber-rgb), 0.2)",  text: "var(--amber)" },
  blue:   { bg: "rgba(var(--blue-rgb), 0.1)",   border: "rgba(var(--blue-rgb), 0.2)",   text: "var(--blue)" },
  purple: { bg: "rgba(var(--purple-rgb), 0.1)", border: "rgba(var(--purple-rgb), 0.2)", text: "var(--purple)" },
} as const;

export function StatusBadge({
  variant,
  children,
}: {
  variant: keyof typeof badgeVariants;
  children: ReactNode;
}) {
  const v = badgeVariants[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 500,
        lineHeight: 1.6,
        background: v.bg,
        border: `1px solid ${v.border}`,
        color: v.text,
      }}
    >
      {children}
    </span>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────
const progressColors = {
  primary: tok.primary,
  green: tok.success,
  amber: tok.amber,
} as const;

export function ProgressBar({
  value,
  max = 100,
  color = "primary",
}: {
  value: number;
  max?: number;
  color?: keyof typeof progressColors;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      style={{
        height: "3px",
        borderRadius: "999px",
        background: tok.hairlineStrong,
        overflow: "hidden",
        marginTop: "8px",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: "999px",
          background: progressColors[color],
          transition: "width 300ms ease",
        }}
      />
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
const sparkColors = {
  primary: tok.primary,
  green: tok.success,
  amber: tok.amber,
} as const;

export function Sparkline({
  data,
  color = "primary",
}: {
  data: number[];
  color?: keyof typeof sparkColors;
}) {
  if (!data.length) {
    return null;
  }
  const max = Math.max(...data, 1);
  const barColor = sparkColors[color];
  const totalHeight = 28;
  const gap = 2;
  const barCount = data.length;
  const barWidth = `calc((100% - ${gap * (barCount - 1)}px) / ${barCount})`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        gap: `${gap}px`,
        height: `${totalHeight}px`,
        marginTop: "8px",
      }}
    >
      {data.map((v, i) => {
        const heightPct = (v / max) * 100;
        return (
          <div
            key={i}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              height: `${Math.max(2, heightPct)}%`,
              background: barColor,
              borderRadius: "2px 2px 0 0",
              opacity: 0.7 + 0.3 * (v / max),
            }}
          />
        );
      })}
    </div>
  );
}
