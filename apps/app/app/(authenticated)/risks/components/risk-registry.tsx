"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { motion, useReducedMotion } from "framer-motion";
import { Trash2Icon, UserIcon } from "lucide-react";
import type { RiskWithPI } from "@/app/actions/risks/schema";
import { RoamStatusSelect } from "./roam-status-select";
import {
  CATEGORY_LABELS,
  CATEGORY_TONE,
  IMPACT_LABELS,
  IMPACT_VALUE,
  PROBABILITY_LABELS,
  PROBABILITY_VALUE,
  type RoamStatus,
  severityTone,
} from "./roam-constants";

const revealVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.0, 0.0, 0.2, 1] as const },
  },
};

type Props = {
  risks: RiskWithPI[];
  movingId: string | null;
  onStatusChange: (id: string, status: RoamStatus) => void;
  onDelete: (id: string) => void;
};

// screen-risks.jsx (RiskRow) — grid 52px severidade | 1fr texto | 96px P/I |
// 110px ROAM | 132px responsável, ordenado por severidade desc.
export function RiskRegistryList({
  risks,
  movingId,
  onStatusChange,
  onDelete,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const sorted = [...risks].sort((a, b) => {
    const scoreA = PROBABILITY_VALUE[a.probability] * IMPACT_VALUE[a.impact];
    const scoreB = PROBABILITY_VALUE[b.probability] * IMPACT_VALUE[b.impact];
    return scoreB - scoreA;
  });

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((risk) => {
        const score =
          PROBABILITY_VALUE[risk.probability] * IMPACT_VALUE[risk.impact];
        const tone = severityTone(score);
        const isMoving = movingId === risk.id;

        return (
          <motion.div
            animate="visible"
            className="group relative grid items-center gap-3.5 rounded-cosmos-md border border-hairline bg-surface p-3.5 transition-colors hover:border-hairline-strong"
            initial={prefersReducedMotion ? "visible" : "hidden"}
            key={risk.id}
            style={{
              gridTemplateColumns: "44px minmax(0,1fr) 92px auto 128px",
              opacity: isMoving ? 0.5 : 1,
            }}
            variants={revealVariants}
          >
            <div
              className="grid h-9 w-9 place-items-center rounded-cosmos-sm font-bold font-mono text-[14px] text-white"
              style={{
                background: `var(--${tone})`,
                boxShadow: `0 4px 12px -3px rgba(var(--${tone}-rgb),.6)`,
              }}
              title="Severidade (probabilidade × impacto)"
            >
              {score}
            </div>

            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="font-semibold font-mono text-[11px] text-ink-subtle">
                  #{risk.id.slice(0, 6)}
                </span>
                {risk.category && (
                  <Badge dot tone={CATEGORY_TONE[risk.category] ?? "neutral"}>
                    {CATEGORY_LABELS[risk.category] ?? risk.category}
                  </Badge>
                )}
                {risk.piPlan && <Badge tone="accent">{risk.piPlan.name}</Badge>}
              </div>
              <div className="font-semibold text-[13.5px] text-ink leading-[1.35]">
                {risk.title}
              </div>
            </div>

            <div className="text-center">
              <div className="mb-1 flex justify-center gap-[3px]">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    className="h-3 w-1.5 rounded-[2px]"
                    key={n}
                    style={{
                      background:
                        n <= PROBABILITY_VALUE[risk.probability]
                          ? `var(--${tone})`
                          : "var(--surface-3)",
                    }}
                  />
                ))}
              </div>
              <span className="font-bold text-[10px] text-ink-muted tracking-[.04em]">
                {PROBABILITY_LABELS[risk.probability]} ·{" "}
                {IMPACT_LABELS[risk.impact]}
              </span>
            </div>

            <RoamStatusSelect
              onChange={(status) => onStatusChange(risk.id, status)}
              status={risk.status}
            />

            <div className="flex items-center justify-end gap-2">
              {risk.ownerUserId ? (
                <span
                  className="flex min-w-0 items-center gap-1.5 font-medium text-[12px] text-ink-muted"
                  title={risk.ownerUserId}
                >
                  <UserIcon aria-hidden className="h-3 w-3 shrink-0" />
                  <span className="truncate font-mono">
                    {risk.ownerUserId.slice(0, 8)}
                  </span>
                </span>
              ) : (
                <span className="text-[11.5px] text-ink-muted">
                  Sem responsável
                </span>
              )}
              <button
                aria-label={`Excluir risco ${risk.title}`}
                className="shrink-0 rounded-cosmos-sm p-1 text-ink-muted opacity-0 transition-all hover:bg-red-soft hover:text-red-text group-hover:opacity-100"
                onClick={() => onDelete(risk.id)}
                type="button"
              >
                <Trash2Icon aria-hidden className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
