"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface DrawLineProps {
  d: string;           // SVG path d attribute
  color?: string;
  strokeWidth?: number;
  duration?: number;
  delay?: number;
  /** Show a traveling dot along the path */
  dot?: boolean;
  dotColor?: string;
}

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
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        pathLength: { duration, delay, ease: [0.25, 0, 0, 1] },
        opacity: { duration: 0.2, delay },
      }}
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
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay, ease: [0.25, 0, 0, 1] }}
      style={{ originX: cx, originY: cy, transformOrigin: `${cx}px ${cy}px` }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={`${color}20`}
        stroke={color}
        strokeWidth={1.5}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        style={{
          fontSize: 9,
          fill: color,
          fontFamily: "monospace",
          fontWeight: 600,
        }}
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
    <span ref={ref} className="relative inline-flex h-2 w-2">
      <motion.span
        className="absolute inline-flex h-full w-full rounded-full"
        style={{ background: color }}
        animate={inView ? { scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ background: color }}
      />
    </span>
  );
}
