"use client";

import { cn } from "@repo/design-system/lib/utils";

type Props = { score: number | null; className?: string };

export function InvestScoreBar({ score, className }: Props) {
  if (score === null) {
    return null;
  }

  const pct = Math.round(Math.min(100, Math.max(0, score)));
  let fill = "bg-red-500";
  if (pct >= 70) {
    fill = "bg-green-500";
  } else if (pct >= 50) {
    fill = "bg-yellow-500";
  }

  return (
    <div
      aria-label={`INVEST ${pct}`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={pct}
      className={cn("h-1 w-full rounded-full bg-muted", className)}
      role="progressbar"
    >
      <div
        className={cn("h-1 rounded-full transition-all duration-500", fill)}
        data-testid="invest-bar-fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
