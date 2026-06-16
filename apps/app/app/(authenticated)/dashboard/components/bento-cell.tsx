"use client";

import { cn } from "@repo/design-system/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const tok = {
  canvas: "#010102",
  surface1: "#0f1011",
  surface2: "#141516",
  surface3: "#18191a",
  hairline: "#23252a",
  hairlineStrong: "#34343a",
  ink: "#f7f8f8",
  inkMuted: "#d0d6e0",
  inkSubtle: "#8a8f98",
  inkTertiary: "#62666d",
  primary: "#5e6ad2",
  success: "#27a644",
  risk: "#e54d4d",
  warn: "#d97706",
  info: "#3b82f6",
  purple: "#8b5cf6",
  amber: "#f59e0b",
} as const;

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
  const accent = accentColor ?? tok.risk;

  const criticalStyles = isCritical
    ? {
        boxShadow: `inset 0 1px 0 0 ${accent}33, 0 0 0 1px ${accent}22`,
        backgroundImage: `linear-gradient(to right, ${accent}11 0%, transparent 60%)`,
      }
    : {};

  return (
    <motion.div
      className={cn("bento-cell", className)}
      style={{
        gridColumn: `span ${span}`,
        background: tok.surface1,
        borderRadius: "12px",
        padding: "16px",
        position: "relative",
        overflow: "hidden",
        ...criticalStyles,
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
            background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
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
          color: color ?? tok.inkTertiary,
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
        color: tok.inkTertiary,
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
  green: { bg: "#27a6441a", border: "#27a64433", text: "#27a644" },
  red: { bg: "#e54d4d1a", border: "#e54d4d33", text: "#e54d4d" },
  amber: { bg: "#f59e0b1a", border: "#f59e0b33", text: "#f59e0b" },
  blue: { bg: "#3b82f61a", border: "#3b82f633", text: "#3b82f6" },
  purple: { bg: "#8b5cf61a", border: "#8b5cf633", text: "#8b5cf6" },
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
