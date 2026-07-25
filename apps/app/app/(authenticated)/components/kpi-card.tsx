"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

export type KpiTone = "green" | "red" | "amber" | "blue" | "purple" | "accent";

export type KpiCardProps = {
  tone?: KpiTone;
  label: string;
  value: string | number;
  unit?: string;
  badge: string;
  /** SVG <path d="…"> string — passes safely across Server→Client boundary */
  iconPath: string;
};

const TONES: Record<KpiTone, { rgb: string; textVar: string; bg: string }> = {
  green: {
    rgb: "52,211,153",
    textVar: "var(--green-text)",
    bg: "radial-gradient(130% 130% at 0% 0%, rgba(52,211,153,.13), transparent 46%), linear-gradient(180deg, var(--surface-2), var(--surface))",
  },
  red: {
    rgb: "251,113,133",
    textVar: "var(--red-text)",
    bg: "radial-gradient(130% 150% at 100% 25%, rgba(251,113,133,.20), transparent 55%), linear-gradient(180deg, #22121a, #160c12)",
  },
  amber: {
    rgb: "251,191,36",
    textVar: "var(--amber-text)",
    bg: "radial-gradient(130% 130% at 0% 0%, rgba(251,191,36,.12), transparent 48%), linear-gradient(180deg, #1a1610, #120f0a)",
  },
  blue: {
    rgb: "91,141,239",
    textVar: "var(--blue-text)",
    bg: "radial-gradient(130% 130% at 0% 0%, rgba(91,141,239,.13), transparent 46%), linear-gradient(180deg, #0d1526, #0a1020)",
  },
  purple: {
    rgb: "167,139,250",
    textVar: "var(--purple-text)",
    bg: "radial-gradient(130% 130% at 100% 0%, rgba(167,139,250,.13), transparent 48%), linear-gradient(180deg, #130f26, #0e0b1e)",
  },
  accent: {
    rgb: "0,212,255",
    textVar: "var(--accent-text)",
    bg: "radial-gradient(130% 130% at 0% 0%, rgba(0,212,255,.14), transparent 46%), linear-gradient(180deg, #121634, #0c1024)",
  },
};

// ECG waveform path from prototype
const ECG_D =
  "M-30 24H60l6-14 8 28 7-20 5 8H170l6-12 7 20 6-12H430";

export function KpiCard({
  tone = "green",
  label,
  value,
  unit,
  badge,
  iconPath,
}: KpiCardProps) {
  const uid = useId();
  const prefersReducedMotion = useReducedMotion();
  const t = TONES[tone];
  const rgb = t.rgb;
  const toneColor = `rgb(${rgb})`;

  return (
    <motion.div
      animate="rest"
      initial="rest"
      whileHover="hover"
      variants={{
        rest: {
          y: 0,
          borderColor: `rgba(${rgb},.20)`,
          boxShadow:
            "0 1px 0 rgba(255,255,255,.05) inset, 0 14px 30px -22px rgba(0,0,0,.9)",
          transition: { duration: 0.4, ease: [0.2, 0.7, 0.3, 1] },
        },
        hover: {
          y: -3,
          borderColor: `rgba(${rgb},.55)`,
          boxShadow: `0 1px 0 rgba(255,255,255,.07) inset, 0 22px 46px -22px rgba(${rgb},.55)`,
          transition: { duration: 0.4, ease: [0.2, 0.7, 0.3, 1] },
        },
      }}
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: 152,
        padding: "18px 20px",
        borderRadius: 18,
        border: `1px solid rgba(${rgb},.20)`,
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        cursor: "default",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* ── Dot pattern (hover reveal) ─────────────────────────────────── */}
      <motion.div
        aria-hidden
        variants={{
          rest: { opacity: 0 },
          hover: { opacity: 0.4, transition: { duration: 0.55 } },
        }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          color: toneColor,
          backgroundImage:
            "radial-gradient(currentColor 1.1px, transparent 1.5px)",
          backgroundSize: "11px 11px",
          WebkitMaskImage:
            "radial-gradient(150% 130% at 100% 100%, #000 0%, transparent 58%)",
          maskImage:
            "radial-gradient(150% 130% at 100% 100%, #000 0%, transparent 58%)",
        }}
      />

      {/* ── Watermark: etched (fades on hover) ────────────────────────── */}
      <motion.svg
        aria-hidden
        variants={{ rest: { opacity: 0.08 }, hover: { opacity: 0.22 } }}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={1.15}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          right: -34,
          bottom: -46,
          width: 196,
          height: 196,
          zIndex: 1,
          pointerEvents: "none",
          stroke: "var(--ink)",
          filter: "drop-shadow(0 1.5px .5px rgba(255,255,255,.10)) drop-shadow(0 -1.4px 1px rgba(0,0,0,.8))",
        }}
      >
        <path d={iconPath} />
      </motion.svg>

      {/* ── Watermark: glow (appears on hover) ────────────────────────── */}
      <motion.svg
        aria-hidden
        variants={{ rest: { opacity: 0 }, hover: { opacity: 0.9 } }}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={1.15}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          right: -34,
          bottom: -46,
          width: 196,
          height: 196,
          zIndex: 1,
          pointerEvents: "none",
          stroke: toneColor,
          filter: `drop-shadow(0 0 9px rgba(${rgb},.85))`,
        }}
      >
        <path d={iconPath} />
      </motion.svg>

      {/* ── ECG signal (bottom edge) ───────────────────────────────────── */}
      <motion.svg
        aria-hidden
        viewBox="0 0 312 44"
        preserveAspectRatio="none"
        variants={{
          rest: { opacity: 0.3 },
          hover: { opacity: 1, transition: { duration: 0.5 } },
        }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 5,
          width: "100%",
          height: 44,
          zIndex: 1,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        <defs>
          <linearGradient id={`ecg-${uid}`} x1="0" y1="0" x2="312" y2="0">
            <stop offset="0" stopColor={toneColor} stopOpacity={0} />
            <stop offset=".5" stopColor={toneColor} stopOpacity={0.9} />
            <stop offset="1" stopColor={toneColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        {prefersReducedMotion ? (
          <path
            d={ECG_D}
            fill="none"
            stroke={`url(#ecg-${uid})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        ) : (
          <motion.path
            d={ECG_D}
            fill="none"
            stroke={`url(#ecg-${uid})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            strokeDasharray="360 360"
            initial={{ strokeDashoffset: 760 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        )}
      </motion.svg>

      {/* ── Label + chip ───────────────────────────────────────────────── */}
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
            borderRadius: 10,
            color: toneColor,
            background: `rgba(${rgb},.10)`,
            border: `1px solid rgba(${rgb},.22)`,
            boxShadow: "0 1px 0 rgba(255,255,255,.06) inset",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden><path d={iconPath} /></svg>
        </span>
      </div>

      {/* ── Value ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          marginTop: "auto",
          marginBottom: 12,
          paddingTop: 12,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace",
          fontSize: 38,
          lineHeight: 1,
          fontWeight: 700,
          color: t.textVar,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
        }}
      >
        {value}
        {unit && (
          <small
            style={{ fontSize: 22, fontWeight: 600, opacity: 0.8, marginLeft: 6 }}
          >
            {unit}
          </small>
        )}
      </div>

      {/* ── Badge ─────────────────────────────────────────────────────── */}
      <span
        style={{
          position: "relative",
          zIndex: 3,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          background: `rgba(${rgb},.12)`,
          color: t.textVar,
          border: `1px solid rgba(${rgb},.18)`,
        }}
      >
        {badge}
      </span>
    </motion.div>
  );
}

/** 4-column responsive grid wrapping KpiCards */
export function KpiGrid({
  children,
  cols = 4,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${840 / cols}px, 1fr))`,
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}
