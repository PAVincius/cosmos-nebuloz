"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { PillarNode } from "@/app/actions/strategy-map";

// ─── Tone tokens ────────────────────────────────────────────────────────────
// Local to this route — mirrors the Cosmos tone vars (--green/--red/--amber/
// --blue/--purple/--accent), same pattern as arts/[artId]/pi-planning/pi-tone.tsx.
// `StrategyPillar.tone` is a free-form string; unknown values fall back to
// "accent".

const TONE_VAR: Record<string, string> = {
  accent: "var(--accent)",
  green: "var(--green)",
  red: "var(--red)",
  amber: "var(--amber)",
  blue: "var(--blue)",
  purple: "var(--purple)",
};

const TONE_TEXT_VAR: Record<string, string> = {
  accent: "var(--accent-text)",
  green: "var(--green-text)",
  red: "var(--red-text)",
  amber: "var(--amber-text)",
  blue: "var(--blue-text)",
  purple: "var(--purple-text)",
};

const TONE_SOFT_VAR: Record<string, string> = {
  accent: "var(--accent-soft)",
  green: "var(--green-soft)",
  red: "var(--red-soft)",
  amber: "var(--amber-soft)",
  blue: "var(--blue-soft)",
  purple: "var(--purple-soft)",
};

function resolveTone(tone: string): string {
  return tone in TONE_VAR ? tone : "accent";
}

// ─── PillarsOverview (public export) ────────────────────────────────────────
// Re-skin of prototype's pillar grid (screen-strategy.jsx). Each theme chip
// anchors (`#theme-{id}`) to its always-expanded ThemeCard in the tree below
// (see strategy-tree.tsx) — the click-through that makes this an expandable
// Pillars → Themes → OKRs → Épicos view rather than a static summary.

type PillarsOverviewProps = {
  pillars: PillarNode[];
};

export function PillarsOverview({ pillars }: PillarsOverviewProps) {
  const reduceMotion = useReducedMotion();

  if (pillars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center text-muted-foreground text-sm">
        Nenhum Pilar Estratégico configurado.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {pillars.map((pillar, index) => {
        const tone = resolveTone(pillar.tone);
        return (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-[var(--card-shadow)]"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            key={pillar.id}
            transition={{
              delay: reduceMotion ? 0 : index * 0.05,
              duration: 0.3,
              ease: [0.2, 0.7, 0.3, 1],
            }}
          >
            {/* Header */}
            <div
              className="border-border/60 border-b px-4 pt-4 pb-3.5"
              style={{
                background: `linear-gradient(180deg, ${TONE_SOFT_VAR[tone]}, transparent)`,
                borderTop: `3px solid ${TONE_VAR[tone]}`,
              }}
            >
              <span
                className="font-mono font-semibold text-[11px]"
                style={{ color: TONE_TEXT_VAR[tone] }}
              >
                {pillar.code}
              </span>
              <div className="mt-2 min-h-[38px] font-semibold text-[15px] leading-snug">
                {pillar.name}
              </div>
            </div>

            {/* Themes */}
            <div className="flex flex-1 flex-col gap-2 p-3.5">
              <span className="font-mono font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
                Temas
              </span>
              {pillar.themes.length === 0 ? (
                <p className="py-2 text-center text-muted-foreground text-xs italic">
                  Nenhum tema neste pilar.
                </p>
              ) : (
                pillar.themes.map((theme) => (
                  <a
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 font-medium text-xs transition-colors hover:border-[rgba(var(--accent-rgb),.5)] hover:bg-[rgba(var(--accent-rgb),.08)]"
                    href={`#theme-${theme.id}`}
                    key={theme.id}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: TONE_VAR[tone] }}
                    />
                    <span className="truncate">{theme.title}</span>
                  </a>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-border/60 border-t bg-muted/20 px-3.5 py-3">
              <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                <span className="font-medium text-muted-foreground">
                  {pillar.totalEpics} épico{pillar.totalEpics !== 1 ? "s" : ""}
                </span>
                <span
                  className="font-mono font-semibold tabular-nums"
                  style={{ color: TONE_TEXT_VAR[tone] }}
                >
                  {pillar.progress}%
                </span>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    background: TONE_VAR[tone],
                    width: `${pillar.progress}%`,
                  }}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
