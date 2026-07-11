"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { cn } from "@repo/design-system/lib/utils";
import { Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import type {
  AnomalyRow as AnomalyRowData,
  AnomalyStats,
} from "@/app/actions/flow-intelligence/list-anomalies";
import { AnomalyRow } from "./anomaly-row";

const SNOOZE_DAYS = 7;

const ICON_ALERT =
  "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01";
const ICON_LAYERS =
  "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";
const ICON_CLOCK = "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2";

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
  } catch {
    // localStorage unavailable — snooze degrades to a no-op for this session.
  }
}

function buildGovernanceUrl(a: AnomalyRowData, ruleLabel: string): string {
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
  anomalies: AnomalyRowData[];
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

  const criticalHigh =
    (stats.bySeverity.CRITICAL ?? 0) + (stats.bySeverity.HIGH ?? 0);
  const scopesAffected = useMemo(
    () => new Set(anomalies.map((a) => a.run.scopeId)).size,
    [anomalies]
  );

  return (
    <div className="animate-fade-in space-y-6">
      {/* KPI row — re-skin of prototype's 4-card grid (screen-anomalies.jsx) */}
      <KpiGrid cols={4}>
        <KpiCard
          badge="— Requerem ação"
          iconPath={ICON_ALERT}
          label="Anomalias abertas"
          tone="red"
          value={stats.total}
        />
        <KpiCard
          badge="— Severidade elevada"
          iconPath={ICON_ALERT}
          label="Críticas + altas"
          tone="amber"
          value={criticalHigh}
        />
        <KpiCard
          badge="— ARTs / times monitorados"
          iconPath={ICON_LAYERS}
          label="Escopos afetados"
          tone="blue"
          value={scopesAffected}
        />
        <KpiCard
          badge="— Adiadas pelo time"
          iconPath={ICON_CLOCK}
          label="Ignoradas (7d)"
          tone="purple"
          value={snoozed.size}
        />
      </KpiGrid>

      {/* Filter tabs */}
      {activeSeverities.length > 0 && (
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
              {sev !== "ALL" && (
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", SEV_DOT[sev])}
                />
              )}
              {SEV_LABELS[sev]}
              {sev !== "ALL" ? (
                <span className="opacity-60">{stats.bySeverity[sev] ?? 0}</span>
              ) : (
                <span className="opacity-60">{stats.total}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* List — re-skin of the prototype's SectionCard + AnomalyRow list */}
      <SectionCard
        accentRgb="251,113,133"
        actions={
          <Badge dot tone="green">
            monitorando {scopesAffected} escopos
          </Badge>
        }
        icon={Activity}
        subtitle="Ordenadas por severidade e recência"
        title="Anomalias detectadas"
      >
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <div className="mb-3 h-3 w-3 rounded-full bg-green-500" />
            <p className="font-medium text-sm">Nenhuma anomalia detectada</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Flow saudável para o filtro selecionado.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((a) => {
              const ruleLabel = RULE_LABELS[a.rule] ?? a.rule;
              return (
                <AnomalyRow
                  anomaly={a}
                  governanceHref={buildGovernanceUrl(a, ruleLabel)}
                  key={a.id}
                  onSnooze={() => handleSnooze(a.id)}
                  ruleLabel={ruleLabel}
                />
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
