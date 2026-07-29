"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { TargetIcon } from "lucide-react";
import type { OKRNode as OKRNodeType } from "@/app/actions/strategy-map";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ON_TRACK:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  AT_RISK: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  BEHIND: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  ACHIEVED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
};

const TYPE_LABELS: Record<string, string> = {
  portfolio_theme: "Tema",
  portfolio_epic: "Épico",
  pi_art: "PI/ART",
  team_pi: "Time",
  improvement: "Melhoria",
};

// ─── Component ────────────────────────────────────────────────────────────────

type OKRNodeProps = {
  okr: OKRNodeType;
  compact?: boolean;
};

export function OKRNode({ okr, compact = false }: OKRNodeProps) {
  const statusColor =
    STATUS_COLORS[okr.status] ?? "bg-muted text-muted-foreground";

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded border border-border/60 bg-background px-2 py-1.5 text-xs">
        <TargetIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{okr.title}</span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 font-semibold text-xs tabular-nums ${statusColor}`}
        >
          {okr.progress}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-[var(--card-shadow)]">
      <TargetIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">{okr.title}</span>
          <Badge className="text-xs" variant="secondary">
            {TYPE_LABELS[okr.okrType] ?? okr.okrType}
          </Badge>
        </div>
        {okr.horizon && (
          <p className="mt-0.5 text-muted-foreground text-xs">{okr.horizon}</p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--accent-c)] transition-all duration-500"
              style={{ width: `${okr.progress}%` }}
            />
          </div>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-semibold text-xs tabular-nums ${statusColor}`}
          >
            {okr.progress}%
          </span>
        </div>
      </div>
    </div>
  );
}
