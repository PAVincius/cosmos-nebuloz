"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import type { AnomalyRow as AnomalyRowData } from "@/app/actions/flow-intelligence/list-anomalies";

/**
 * Re-skin of the cosmos.html prototype's `AnomalyRow`
 * (design/components/screen-anomalies.jsx) as a dense grid row, wired to the
 * real Flow Anomaly data model instead of the prototype's mock cost fields.
 */

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const SEV_TONE: Record<
  Severity,
  { tone: "red" | "amber" | "blue" | "purple"; rgb: string; label: string }
> = {
  CRITICAL: { tone: "red", rgb: "var(--red-rgb)", label: "Crítica" },
  HIGH: { tone: "amber", rgb: "var(--amber-rgb)", label: "Alta" },
  MEDIUM: { tone: "blue", rgb: "var(--blue-rgb)", label: "Média" },
  LOW: { tone: "purple", rgb: "var(--purple-rgb)", label: "Baixa" },
};

function isSeverity(value: string): value is Severity {
  return value in SEV_TONE;
}

/** The DB row already returns `status` (CostAnomaly-style lifecycle on the
 * generic Anomaly model); the hand-authored `AnomalyRow` type upstream just
 * doesn't declare it yet. Widen locally instead of touching the shared action. */
type StatusValue = "OPEN" | "SUPPRESSED" | "RESOLVED";
type AnomalyWithStatus = AnomalyRowData & { status?: string };

const STATUS_META: Record<StatusValue, { tone: "red" | "blue" | "green"; label: string }> = {
  OPEN: { tone: "red", label: "Aberta" },
  SUPPRESSED: { tone: "blue", label: "Suprimida" },
  RESOLVED: { tone: "green", label: "Resolvida" },
};

function isStatus(value: string): value is StatusValue {
  return value in STATUS_META;
}

const SCOPE_LABEL: Record<string, string> = {
  team: "TEAM",
  art: "ART",
};

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "agora";
  }
  if (minutes < 60) {
    return `há ${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `há ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

type Props = {
  anomaly: AnomalyRowData;
  ruleLabel: string;
  governanceHref: string;
  onSnooze: () => void;
};

export function AnomalyRow({
  anomaly,
  ruleLabel,
  governanceHref,
  onSnooze,
}: Props) {
  const sev: Severity = isSeverity(anomaly.severity) ? anomaly.severity : "LOW";
  const sevMeta = SEV_TONE[sev];
  const raw = anomaly as AnomalyWithStatus;
  const statusValue: StatusValue =
    typeof raw.status === "string" && isStatus(raw.status) ? raw.status : "OPEN";
  const status = STATUS_META[statusValue];
  const resolved = statusValue === "RESOLVED";
  const narrative = anomaly.metadata?.narrative;
  const scopeLabel = SCOPE_LABEL[anomaly.run.scope] ?? anomaly.run.scope.toUpperCase();

  return (
    <div
      className="lift grid items-center gap-4 rounded-lg border p-3.5"
      style={{
        gridTemplateColumns: "9px minmax(0,1.6fr) 92px minmax(90px,140px) 108px 56px",
        borderColor: "var(--hairline)",
        borderLeft: `3px solid rgba(${sevMeta.rgb},1)`,
        background: resolved ? "var(--surface-2)" : "var(--surface)",
        opacity: resolved ? 0.82 : 1,
      }}
    >
      <span
        aria-hidden
        className="h-[7px] w-[7px] shrink-0 justify-self-center rounded-full"
        style={{
          background: `rgba(${sevMeta.rgb},1)`,
          boxShadow: resolved ? "none" : `0 0 8px rgba(${sevMeta.rgb},.7)`,
        }}
      />

      <div className="min-w-0">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-ink-muted">
            {anomaly.id.slice(-6)}
          </span>
          <span className="truncate font-bold text-[13.5px] text-ink tracking-[-.01em]">
            {ruleLabel}
          </span>
          <Badge dot tone={sevMeta.tone}>
            {sevMeta.label}
          </Badge>
        </div>
        {narrative && (
          <div className="text-[12.5px] text-ink-subtle leading-[1.45]">
            {narrative}
          </div>
        )}
      </div>

      <div className="text-center">
        <div
          className="font-mono font-extrabold text-[17px] tracking-[-.02em]"
          style={{ color: `rgba(${sevMeta.rgb},1)` }}
        >
          {anomaly.delta > 0 ? "+" : ""}
          {anomaly.delta.toFixed(2)}
        </div>
        <div className="font-bold text-[10px] text-ink-muted tracking-[.05em] uppercase">
          {anomaly.metric.replace(/_/g, " ")}
        </div>
      </div>

      <div className="min-w-0 text-right">
        <div className="truncate font-mono font-bold text-[13px] text-ink uppercase">
          {scopeLabel} · {anomaly.run.scopeId.slice(-6)}
        </div>
        <div className="font-mono text-[10.5px] text-ink-muted uppercase">
          {anomaly.run.trigger}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <Badge dot tone={status.tone}>
          {status.label}
        </Badge>
        <span className="text-[11px] text-ink-subtle">
          {formatRelative(new Date(anomaly.createdAt))}
        </span>
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          aria-label="Ignorar por 7 dias"
          className="grid h-6 w-6 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          onClick={onSnooze}
          title="Ignorar 7d"
          type="button"
        >
          <Clock aria-hidden size={13} strokeWidth={2.2} />
        </button>
        <Link
          aria-label="Escalar para governança"
          className="grid h-6 w-6 place-items-center rounded-md transition-colors hover:brightness-110"
          href={governanceHref}
          style={{ color: `rgba(${sevMeta.rgb},1)` }}
          title="Escalar"
        >
          <ArrowUpRight aria-hidden size={14} strokeWidth={2.4} />
        </Link>
      </div>
    </div>
  );
}
