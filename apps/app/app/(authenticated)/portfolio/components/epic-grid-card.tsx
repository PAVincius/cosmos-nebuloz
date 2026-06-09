"use client";

import { cn } from "@repo/design-system/lib/utils";
import { ExternalLink, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";

type Props = {
  epic: PortfolioEpic;
  statusLabel: string;
  statusColor: string;
};

function getInvestTokens(score: number) {
  if (score >= 70) {
    return {
      bg: "var(--green-soft)",
      border: "rgba(var(--green-rgb),.18)",
      bar: "var(--green)",
      text: "var(--green-text)",
      label: "✦",
    };
  }
  if (score >= 50) {
    return {
      bg: "var(--amber-soft)",
      border: "rgba(var(--amber-rgb),.18)",
      bar: "var(--amber)",
      text: "var(--amber-text)",
      label: "✦",
    };
  }
  return {
    bg: "var(--red-soft)",
    border: "rgba(var(--red-rgb),.18)",
    bar: "var(--red)",
    text: "var(--red-text)",
    label: "⚠",
  };
}

export const EpicGridCard = memo(function EpicGridCard({
  epic,
  statusLabel,
  statusColor,
}: Props) {
  const invest =
    epic.investScore !== null ? getInvestTokens(epic.investScore) : null;
  const pct =
    epic.investScore !== null
      ? Math.round(Math.min(100, Math.max(0, epic.investScore)))
      : 0;
  const progressPct =
    epic.featureCount > 0
      ? Math.round((epic.completedFeatureCount / epic.featureCount) * 100)
      : 0;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface",
        "shadow-[var(--card-shadow)] transition-all duration-200",
        "hover:-translate-y-[1px] hover:border-hairline-strong hover:shadow-[var(--hover-shadow)]",
        "dark:bg-[var(--surface-2)]"
      )}
    >
      {/* Accent top strip with theme color */}
      <div
        className="h-[3px] w-full"
        style={{ backgroundColor: epic.themeColor ?? statusColor }}
      />

      {/* Header */}
      <div className="border-hairline border-b px-4 pt-3.5 pb-3 dark:border-hairline/60">
        <div className="flex items-start justify-between gap-2">
          <Link
            className="line-clamp-2 font-semibold text-[14px] text-foreground leading-snug tracking-[-0.01em] transition-colors hover:text-primary"
            href={`/epics/${epic.id}`}
            prefetch={false}
          >
            {epic.title}
          </Link>
          <span className="shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground/60 tabular-nums">
            {epic.completedFeatureCount}/{epic.featureCount}
          </span>
        </div>

        {/* Status badge + WSJF */}
        <div className="mt-2 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[10.5px]"
            style={{
              backgroundColor: `${statusColor}18`,
              color: statusColor,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            {statusLabel}
          </span>
          {epic.wsjfScore > 0 && (
            <span className="rounded border border-border/40 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:border-[rgba(251,191,36,.15)] dark:bg-[var(--amber-soft)] dark:text-[var(--amber-text)]">
              WSJF {epic.wsjfScore.toFixed(1)}
            </span>
          )}
          {epic.governanceStatus === "BLOCKED" && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 font-bold text-[9px] text-red-600 dark:bg-red-950/50 dark:text-red-400">
              ⚠ BLOCKED
            </span>
          )}
        </div>

        {/* Feature progress bar */}
        {epic.featureCount > 0 && (
          <div className="mt-2.5">
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* INVEST score */}
      {invest !== null && (
        <div
          className="mx-4 mt-3 rounded-md px-2.5 py-1.5"
          style={{
            background: invest.bg,
            border: `1px solid ${invest.border}`,
          }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span
              className="font-mono font-semibold text-[10px] tracking-[0.4px]"
              style={{ color: invest.bar }}
            >
              {invest.label} INVEST
            </span>
            <span
              className="font-bold font-mono text-[10px]"
              style={{ color: invest.bar }}
            >
              {pct}%
            </span>
          </div>
          <div
            className="h-[3px] overflow-hidden rounded-full"
            style={{ background: "rgba(0,0,0,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background:
                  pct < 50
                    ? "linear-gradient(90deg, var(--amber), var(--red))"
                    : `linear-gradient(90deg, ${invest.bar}, var(--accent-c))`,
                boxShadow: `0 0 6px ${invest.bar}`,
              }}
            />
          </div>
        </div>
      )}

      {/* Top features list */}
      {epic.topFeatures.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1 px-4">
          {epic.topFeatures.map((f, i) => (
            <div
              className="flex items-center gap-2 rounded-md bg-muted/20 px-2 py-1.5 dark:bg-white/[0.03]"
              key={i}
            >
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded font-bold font-mono text-[9px]"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent-text)",
                }}
              >
                {Math.round(f.wsjfScore)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground/80 leading-tight">
                {f.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-hairline/60 border-t bg-muted/10 px-4 py-2 dark:bg-black/10">
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {epic.featureCount} feature{epic.featureCount !== 1 ? "s" : ""}
          {epic.linkedOKRCount > 0 &&
            ` · ${epic.linkedOKRCount} OKR${epic.linkedOKRCount > 1 ? "s" : ""}`}
        </span>
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground/50 transition-colors hover:text-primary"
            href={`/epics/${epic.id}`}
            prefetch={false}
          >
            <ExternalLink aria-hidden className="h-3 w-3" />
            Épico
          </Link>
          <Link
            className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground/50 transition-colors hover:text-primary"
            href={`/epics/${epic.id}/features`}
            prefetch={false}
          >
            <LayoutGrid aria-hidden className="h-3 w-3" />
            Features
          </Link>
        </div>
      </div>
    </div>
  );
});
