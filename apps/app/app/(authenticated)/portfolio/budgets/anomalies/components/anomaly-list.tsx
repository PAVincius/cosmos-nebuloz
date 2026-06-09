"use client";

import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnomalyCard } from "@/app/(authenticated)/analytics/flow/components/anomaly-card";
import type {
  AnomalyRow,
  AnomalyStats,
} from "@/app/actions/flow-intelligence/list-anomalies";

const SNOOZE_DAYS = 7;
const SNOOZE_PREFIX = "cosmos_anomaly_snooze_";

function getSnoozed(): Set<string> {
  try {
    const raw = localStorage.getItem("cosmos_anomaly_snoozed");
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    return new Set(
      Object.entries(parsed)
        .filter(([, exp]) => exp > now)
        .map(([id]) => id)
    );
  } catch {
    return new Set();
  }
}

function snoozeAnomaly(id: string) {
  try {
    const raw = localStorage.getItem("cosmos_anomaly_snoozed");
    const parsed: Record<string, number> = raw ? JSON.parse(raw) : {};
    parsed[id] = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem("cosmos_anomaly_snoozed", JSON.stringify(parsed));
  } catch {}
}

function buildGovernanceUrl(a: AnomalyRow, ruleLabel: string): string {
  const title = encodeURIComponent(`Anomalia: ${ruleLabel}`);
  const desc = encodeURIComponent(
    `Métrica: ${a.metric} · Delta: ${a.delta > 0 ? "+" : ""}${a.delta.toFixed(2)} · Escopo: ${a.run.scope}`
  );
  return `/portfolio/governance?title=${title}&description=${desc}&severity=${a.severity}`;
}

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type Severity = (typeof SEV_ORDER)[number] | "ALL";

const SEV_LABELS: Record<string, string> = {
  ALL: "Todas",
  CRITICAL: "Crítico",
  HIGH: "Alto",
  MEDIUM: "Médio",
  LOW: "Baixo",
};

const SEV_DOT: Record<string, string> = {
  CRITICAL: "bg-rose-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-slate-400",
};

const RULE_LABELS: Record<string, string> = {
  VelocityCliff: "Queda de Velocity",
  WIPOverload: "WIP Excessivo",
  PredictabilityCollapse: "Colapso de Predictability",
  CycleTimeDegradation: "Aumento de Cycle Time",
  EfficiencyNosedive: "Queda de Eficiência",
  WorkTypeImbalance: "Desequilíbrio de Work Types",
  StaleCompetencyAssessment: "Assessment Desatualizado",
  ImprovementActionOverdue: "Ações em Atraso",
};

type Props = {
  anomalies: AnomalyRow[];
  stats: AnomalyStats;
};

export function AnomalyList({ anomalies, stats }: Props) {
  const [filter, setFilter] = useState<Severity>("ALL");
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSnoozed(getSnoozed());
  }, []);

  function handleSnooze(id: string) {
    snoozeAnomaly(id);
    setSnoozed((prev) => new Set([...prev, id]));
  }

  const base =
    filter === "ALL"
      ? anomalies
      : anomalies.filter((a) => a.severity === filter);
  const visible = base.filter((a) => !snoozed.has(a.id));

  const activeSeverities = SEV_ORDER.filter(
    (s) => (stats.bySeverity[s] ?? 0) > 0
  );

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SEV_ORDER.map((sev) => {
          const count = stats.bySeverity[sev] ?? 0;
          return (
            <div className="rounded-lg border bg-card px-4 py-3" key={sev}>
              <div className="flex items-center gap-2">
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", SEV_DOT[sev])}
                />
                <span className="text-muted-foreground text-xs">
                  {SEV_LABELS[sev]}
                </span>
              </div>
              <p className="mt-1 font-bold text-2xl tabular-nums">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      {activeSeverities.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(["ALL", ...activeSeverities] as Severity[]).map((sev) => (
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                filter === sev
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              )}
              key={sev}
              onClick={() => setFilter(sev)}
              type="button"
            >
              {sev !== "ALL" ? (
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", SEV_DOT[sev])}
                />
              ) : null}
              {SEV_LABELS[sev]}
              {sev !== "ALL" ? (
                <span className="opacity-60">{stats.bySeverity[sev] ?? 0}</span>
              ) : (
                <span className="opacity-60">{stats.total}</span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      {/* List */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-3 h-3 w-3 rounded-full bg-green-500" />
          <p className="font-medium text-sm">Nenhuma anomalia detectada</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Flow saudável para o filtro selecionado.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => {
            const ruleLabel = RULE_LABELS[a.rule] ?? a.rule;
            return (
              <div className="space-y-1" key={a.id}>
                <AnomalyCard
                  anomaly={{
                    id: a.id,
                    rule: ruleLabel,
                    severity: a.severity,
                    metadata: a.metadata,
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>
                      {a.metric} · delta: {a.delta > 0 ? "+" : ""}
                      {a.delta.toFixed(2)}
                    </span>
                    <span>·</span>
                    <span className="uppercase">
                      {a.run.scope} — {a.run.trigger}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(a.run.ranAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link href={buildGovernanceUrl(a, ruleLabel)}>
                      <button
                        className="rounded px-2 py-0.5 font-medium text-[#5e6ad2] text-[11px] transition-colors hover:bg-[#5e6ad2]/10"
                        type="button"
                      >
                        Escalar
                      </button>
                    </Link>
                    <button
                      className="rounded px-2 py-0.5 font-medium text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => handleSnooze(a.id)}
                      type="button"
                    >
                      Ignorar 7d
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
