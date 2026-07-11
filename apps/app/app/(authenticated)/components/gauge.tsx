"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

export type GaugeTone = "green" | "red" | "amber" | "blue" | "purple" | "accent";

export type GaugeProps = {
  /** Current value. */
  value: number;
  /** Value representing 100%. Defaults to 100. */
  max?: number;
  /** Pixel size of the ring (viewBox is fixed at 56, scales via width/height). */
  size?: number;
  tone?: GaugeTone;
  label?: string;
  sublabel?: string;
};

// Fixed geometry from the prototype's `arcDonut` helper — the SVG viewBox
// stays 0 0 56 56 and only width/height scale, so radius/stroke stay in sync.
const VIEWBOX_SIZE = 56;
const CENTER = 28;
const RADIUS = 22;
const STROKE_WIDTH = 5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Gauge({
  value,
  max = 100,
  size = 56,
  tone = "accent",
  label,
  sublabel,
}: GaugeProps) {
  const uid = useId();
  const prefersReducedMotion = useReducedMotion();
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const dash = (pct / 100) * CIRCUMFERENCE;
  const toneRgbVar = `var(--${tone}-rgb)`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        role="img"
        aria-labelledby={label ? `${uid}-label` : undefined}
      >
        {label ? <title id={`${uid}-label`}>{label}</title> : null}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={STROKE_WIDTH}
        />
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE.toFixed(1)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          style={{
            stroke: `rgb(${toneRgbVar})`,
            filter: `drop-shadow(0 0 5px rgba(${toneRgbVar}, .55))`,
          }}
          initial={false}
          animate={{ strokeDashoffset: CIRCUMFERENCE - dash }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.6, ease: [0, 0, 0.2, 1] }
          }
        />
        <text
          x={CENTER}
          y={CENTER + 5}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono, monospace)"
          fontSize={12}
          fontWeight={700}
          fill="var(--ink)"
        >
          {Math.round(pct)}
        </text>
      </svg>
      {label ? (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
      ) : null}
      {sublabel ? (
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-subtle)",
            textAlign: "center",
          }}
        >
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}
