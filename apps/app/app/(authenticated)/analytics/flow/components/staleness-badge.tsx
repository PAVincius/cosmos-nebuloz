"use client";

import { cn } from "@repo/design-system/lib/utils";

export type StalenessState = "FRESH" | "AGING" | "STALE" | "CRITICAL";

const CONFIG: Record<
  StalenessState,
  { label: string; className: string; dot: string }
> = {
  FRESH: {
    label: "Atualizado",
    className:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    dot: "bg-green-500",
  },
  AGING: {
    label: "Envelhecendo",
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
  STALE: {
    label: "Snapshot desatualizado",
    className:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    dot: "bg-orange-500",
  },
  CRITICAL: {
    label: "Re-avaliação urgente",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    dot: "bg-red-500",
  },
};

type Props = {
  state: StalenessState;
  onReEvaluate?: () => void;
  className?: string;
};

export function StalenessBadge({ state, onReEvaluate, className }: Props) {
  const cfg = CONFIG[state];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium text-xs",
        cfg.className,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
      {(state === "STALE" || state === "CRITICAL") && onReEvaluate && (
        <button
          className="ml-1 underline underline-offset-2 hover:no-underline"
          onClick={onReEvaluate}
          type="button"
        >
          Re-avaliar
        </button>
      )}
    </div>
  );
}
