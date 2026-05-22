"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { analyzeFlowAnomalies } from "@/app/actions/flow-intelligence/analyze-flow";
import type { DetectedAnomaly } from "@/app/actions/flow-intelligence/anomaly-rules";

const SEV_CFG = {
  CRITICAL: {
    label: "CRÍTICO",
    cls: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
  HIGH: {
    label: "ALTO",
    cls: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  },
  MEDIUM: {
    label: "MÉDIO",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  LOW: {
    label: "BAIXO",
    cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
} as const;

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

export function AnomalySummaryPanel({ snapshotId }: { snapshotId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [anomalies, setAnomalies] = useState<DetectedAnomaly[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      const result = await analyzeFlowAnomalies(snapshotId, "manual");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnomalies(result.data.anomalies);
      setAnalyzed(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
          Copilot — Anomalias de Flow
        </p>
        <button
          className="rounded-md border px-3 py-1 font-medium text-xs transition-colors hover:bg-muted/50 disabled:opacity-50"
          disabled={isPending}
          onClick={handleAnalyze}
          type="button"
        >
          {isPending ? "Analisando..." : "Analisar Flow"}
        </button>
      </div>

      {error ? (
        <p className="text-red-600 text-xs dark:text-red-400">{error}</p>
      ) : null}

      {analyzed || isPending ? null : (
        <p className="text-muted-foreground text-xs">
          Clique em "Analisar Flow" para detectar anomalias no snapshot atual.
        </p>
      )}

      {/* biome-ignore lint/nursery/noLeakedRender: both conditions are explicitly boolean */}
      {analyzed && anomalies.length === 0 && (
        <div className="flex items-center gap-2 text-green-600 text-xs dark:text-green-400">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Nenhuma anomalia detectada. Flow saudável.
        </div>
      )}

      {anomalies.length > 0 ? (
        <div className="space-y-2">
          {anomalies.map((a) => {
            const cfg = SEV_CFG[a.severity];
            return (
              <div
                className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${cfg.cls}`}
                key={`${a.rule}-${a.metric}`}
              >
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {RULE_LABELS[a.rule] ?? a.rule}
                  </p>
                  <p className="opacity-80">
                    {a.metric} · delta: {a.delta > 0 ? "+" : ""}
                    {a.delta}
                    {a.severity === "CRITICAL"
                      ? " · Ação criada automaticamente"
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 font-semibold ${cfg.cls}`}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
