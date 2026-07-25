"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

type DrawLineProps = {
  d: string; // SVG path d attribute
  color?: string;
  strokeWidth?: number;
  duration?: number;
  delay?: number;
  /** Show a traveling dot along the path */
  dot?: boolean;
  dotColor?: string;
};

/**
 * Animates an SVG path drawing itself left-to-right on scroll into view.
 * Use inside an <svg> element.
 */
export function DrawLine({
  d,
  color = "var(--accent)",
  strokeWidth = 2,
  duration = 1.2,
  delay = 0,
  dot = false,
  dotColor,
}: DrawLineProps) {
  return (
    <motion.path
      d={d}
      fill="none"
      initial={{ pathLength: 0, opacity: 0 }}
      stroke={color}
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      transition={{
        pathLength: { duration, delay, ease: [0.25, 0, 0, 1] },
        opacity: { duration: 0.2, delay },
      }}
      viewport={{ once: true, margin: "-60px" }}
      whileInView={{ pathLength: 1, opacity: 1 }}
    />
  );
}

/**
 * Dependency graph node — circle with label that pops in
 */
export function GraphNode({
  cx,
  cy,
  r = 22,
  label,
  color = "var(--accent)",
  delay = 0,
}: {
  cx: number;
  cy: number;
  r?: number;
  label: string;
  color?: string;
  delay?: number;
}) {
  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      style={{ originX: cx, originY: cy, transformOrigin: `${cx}px ${cy}px` }}
      transition={{ duration: 0.35, delay, ease: [0.25, 0, 0, 1] }}
      viewport={{ once: true, margin: "-40px" }}
      whileInView={{ scale: 1, opacity: 1 }}
    >
      <circle
        cx={cx}
        cy={cy}
        fill={`${color}20`}
        r={r}
        stroke={color}
        strokeWidth={1.5}
      />
      <text
        style={{
          fontSize: 9,
          fill: color,
          fontFamily: "monospace",
          fontWeight: 600,
        }}
        textAnchor="middle"
        x={cx}
        y={cy + 4}
      >
        {label}
      </text>
    </motion.g>
  );
}

/**
 * Pulsing dot indicator — for "AI active" status
 */
export function PulseDot({ color = "var(--success)" }: { color?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: false });

  return (
    <span className="relative inline-flex h-2 w-2" ref={ref}>
      <motion.span
        animate={inView ? { scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] } : {}}
        className="absolute inline-flex h-full w-full rounded-full"
        style={{ background: color }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ background: color }}
      />
    </span>
  );
}
