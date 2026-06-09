"use client";

import { cn } from "@repo/design-system/lib/utils";

type Props = { score: number | null; className?: string };

function getScoreTokens(pct: number) {
  if (pct >= 70) {
    return {
      bg: "var(--green-soft)",
      border: "rgba(var(--green-rgb),.2)",
      bar: "var(--green)",
      text: "var(--green-text)",
      label: "✦ INVEST",
    };
  }
  if (pct >= 50) {
    return {
      bg: "var(--amber-soft)",
      border: "rgba(var(--amber-rgb),.2)",
      bar: "var(--amber)",
      text: "var(--amber-text)",
      label: "✦ INVEST",
    };
  }
  return {
    bg: "var(--red-soft)",
    border: "rgba(var(--red-rgb),.2)",
    bar: "var(--red)",
    text: "var(--red-text)",
    label: "⚠ INVEST",
  };
}

export function InvestScoreBar({ score, className }: Props) {
  if (score === null) {
    return null;
  }

  const pct = Math.round(Math.min(100, Math.max(0, score)));
  const tk = getScoreTokens(pct);

  return (
    <div
      aria-label={`INVEST ${pct}`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={pct}
      className={cn("rounded-md px-2 py-1.5", className)}
      role="progressbar"
      style={{ background: tk.bg, border: `1px solid ${tk.border}` }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className="font-mono font-semibold text-[10px] tracking-[0.5px]"
          style={{ color: tk.bar }}
        >
          {tk.label}
        </span>
        <span
          className="font-bold font-mono text-[10px]"
          style={{ color: tk.bar }}
        >
          {pct}%
        </span>
      </div>
      <div
        className="h-[3px] overflow-hidden rounded-full"
        style={{ background: "rgba(0,0,0,0.08)" }}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
          data-testid="invest-bar-fill"
          style={{
            width: `${pct}%`,
            background:
              pct < 50
                ? "linear-gradient(90deg, var(--amber), var(--red))"
                : `linear-gradient(90deg, ${tk.bar}, var(--accent-c))`,
            boxShadow: `0 0 6px ${tk.bar}`,
          }}
        />
      </div>
    </div>
  );
}
