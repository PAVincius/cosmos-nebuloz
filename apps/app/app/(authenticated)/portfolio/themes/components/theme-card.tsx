"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { motion, useReducedMotion } from "framer-motion";
import { CompassIcon, LayersIcon } from "lucide-react";
import type { ThemeListItem } from "@/app/actions/strategic-themes/schema";
import { ProgressBar } from "./progress-bar";
import { resolveAccentTone, toneRgbVar, toneSoftVar, toneSolidVar, toneTextVar } from "./theme-tone";

export type ThemeListItemWithAlloc = ThemeListItem & { allocPct: number };

// Health status → Badge tone (mirrors screen-themes.jsx's HEALTH_THEME).
const HEALTH_THEME: Record<string, { tone: "green" | "amber" | "red"; label: string }> = {
  on: { tone: "green", label: "No alvo" },
  watch: { tone: "amber", label: "Atenção" },
  behind: { tone: "red", label: "Atrasado" },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.2, 0.7, 0.3, 1] as const, delay: i * 0.04 },
  }),
};

export function ThemeCard({ theme, index }: { theme: ThemeListItemWithAlloc; index: number }) {
  const reduceMotion = useReducedMotion();
  const tone = resolveAccentTone(theme.color);
  const health = HEALTH_THEME[theme.healthStatus] ?? HEALTH_THEME.on;
  const alloc = theme.allocPct;
  const hasTarget = theme.targetAllocationPct != null;
  const drift = hasTarget ? Math.round(alloc - (theme.targetAllocationPct ?? 0)) : 0;
  const code = theme.code ?? theme.id.slice(0, 8).toUpperCase();

  return (
    <motion.div
      animate="visible"
      custom={index}
      initial={reduceMotion ? "visible" : "hidden"}
      variants={cardVariants}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--cosmos-r-lg)",
        boxShadow: "var(--card-shadow)",
        padding: 20,
        borderTop: `3px solid ${toneSolidVar(tone)}`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 38,
            height: 38,
            borderRadius: "var(--cosmos-r-md)",
            flexShrink: 0,
            color: toneTextVar(tone),
            background: toneSoftVar(tone),
            border: `1px solid rgba(${toneRgbVar(tone)},.22)`,
          }}
        >
          <CompassIcon size={19} strokeWidth={2} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>
              {code}
            </span>
            <Badge dot tone={health.tone}>
              {health.label}
            </Badge>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em", color: "var(--ink)", marginTop: 3 }}>
            {theme.title}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-subtle)" }}>
        {theme.description ?? "Sem descrição."}
      </p>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Alocação de investimento
          </span>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
            <span
              className="font-mono"
              style={{ fontSize: 19, fontWeight: 800, color: toneTextVar(tone), letterSpacing: "-.02em" }}
            >
              {Math.round(alloc)}%
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: !hasTarget
                  ? "var(--ink-faint)"
                  : drift === 0
                    ? "var(--ink-faint)"
                    : drift > 0
                      ? "var(--amber-text)"
                      : "var(--blue-text)",
                fontWeight: 700,
              }}
            >
              {hasTarget ? `${drift > 0 ? "+" : ""}${drift} vs alvo` : "sem alvo definido"}
            </span>
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <ProgressBar height={8} tone={tone} value={alloc} />
          {hasTarget ? (
            <span
              style={{
                position: "absolute",
                top: -3,
                bottom: -3,
                left: `${theme.targetAllocationPct}%`,
                width: 2,
                background: "var(--ink-faint)",
                borderRadius: 2,
              }}
              title={`Alvo ${theme.targetAllocationPct}%`}
            />
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>
          <LayersIcon size={14} style={{ color: "var(--ink-subtle)" }} />
          {theme.epicCount} épicos
        </span>
        <span className="font-mono" style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
          {theme.horizon ?? "—"}
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-muted)" }}>
            {theme.progress}%
          </span>
          <span style={{ width: 64 }}>
            <ProgressBar height={5} tone={tone} value={theme.progress} />
          </span>
        </span>
      </div>
    </motion.div>
  );
}
