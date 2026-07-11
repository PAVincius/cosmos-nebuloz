"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

export type FunnelStepState = "done" | "current" | "todo";

export interface FunnelStep {
  label: string;
  state: FunnelStepState;
  count?: number;
}

export interface FunnelStepperProps {
  steps: FunnelStep[];
}

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const stepVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.0, 0.0, 0.2, 1] },
  },
};

// Chevron/arrow shape from the prototype's `.funnel-step` clip-path — every
// step keeps the pointed right edge so steps chain into a continuous funnel;
// only the first step is squared off on the left.
const STEP_CLIP =
  "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)";
const FIRST_STEP_CLIP =
  "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)";

/** Horizontal lifecycle funnel (e.g. Epic: Funnel → Analyzing → Portfolio Backlog → Implementing → Done). */
export function FunnelStepper({ steps }: FunnelStepperProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      style={{ display: "flex", alignItems: "stretch", gap: 4 }}
      variants={containerVariants}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
    >
      {steps.map((step, idx) => {
        const isFirst = idx === 0;
        const isCurrent = step.state === "current";
        const isDone = step.state === "done";

        return (
          <motion.div
            key={`${step.label}-${idx}`}
            variants={prefersReducedMotion ? undefined : stepVariants}
            style={{
              flex: 1,
              position: "relative",
              padding: isFirst ? "13px 10px 13px 14px" : "13px 10px 13px 22px",
              background: isCurrent
                ? "linear-gradient(180deg, rgba(var(--accent-rgb), .28), rgba(var(--accent-rgb), .14))"
                : "var(--surface-2)",
              border: `1px solid ${
                isCurrent ? "rgba(var(--accent-rgb), .4)" : "var(--hairline)"
              }`,
              borderRadius: isFirst
                ? "var(--cosmos-r-sm) 0 0 var(--cosmos-r-sm)"
                : undefined,
              clipPath: isFirst ? FIRST_STEP_CLIP : STEP_CLIP,
              boxShadow: isCurrent
                ? "0 1px 0 rgba(255,255,255,.08) inset, 0 6px 16px -8px rgba(var(--accent-rgb), .6)"
                : undefined,
              fontSize: 11,
              fontWeight: 600,
              color: isCurrent
                ? "var(--accent-text)"
                : isDone
                  ? "var(--ink-faint)"
                  : "var(--ink-subtle)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono, monospace)",
                fontSize: 8.5,
                letterSpacing: "0.1em",
                display: "block",
                opacity: 0.7,
                marginBottom: 2,
              }}
            >
              {idx + 1}
            </span>
            {step.label}
            {typeof step.count === "number" ? (
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono, monospace)",
                  fontSize: 10,
                  fontWeight: 700,
                  marginLeft: 6,
                  opacity: 0.75,
                }}
              >
                {step.count}
              </span>
            ) : null}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
