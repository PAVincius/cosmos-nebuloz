"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
  InfoIcon,
  MinusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";

export type ExplainabilitySuggestion = {
  featureId: string;
  featureTitle: string;
  epicTitle: string;
  currentWSJF: number;
  suggestedWSJF: number;
  delta: number;
  impactFactor: string;
  confidence: number;
  justification?: string;
};

const IMPACT_LABELS: Record<string, string> = {
  dependency: "Dependência crítica",
  team_capacity: "Capacidade do time",
  member_availability: "Disponibilidade de membro",
  velocity_trend: "Tendência de velocity",
  priority_drift: "Desvio de prioridade",
  deadline: "Prazo identificado",
};

type ExplainabilityPanelProps = {
  suggestions: ExplainabilitySuggestion[];
};

export function ExplainabilityPanel({ suggestions }: ExplainabilityPanelProps) {
  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center text-muted-foreground text-sm">
        <InfoIcon className="mb-2 h-5 w-5" />
        Execute o Rebalanceamento IA para ver explicações de prioridade.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {suggestions.map((s) => {
        const improved = s.delta > 0.05;
        const declined = s.delta < -0.05;
        return (
          <div
            className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-3 shadow-[var(--card-shadow)]"
            key={s.featureId}
          >
            <div className="mt-0.5 shrink-0">
              {improved ? (
                <TrendingUpIcon className="h-4 w-4 text-emerald-500" />
              ) : declined ? (
                <TrendingDownIcon className="h-4 w-4 text-rose-500" />
              ) : (
                <MinusIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-sm">
                  {s.featureTitle}
                </span>
                <span className="text-muted-foreground text-xs">
                  ({s.epicTitle})
                </span>
                <Badge className="shrink-0 text-xs" variant="outline">
                  {IMPACT_LABELS[s.impactFactor] ?? s.impactFactor}
                </Badge>
                <Badge
                  className="shrink-0 text-xs tabular-nums"
                  variant="secondary"
                >
                  {Math.round(s.confidence * 100)}% confiança
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                WSJF:{" "}
                <span className="font-medium tabular-nums">
                  {s.currentWSJF.toFixed(1)}
                </span>
                {" → "}
                <span
                  className={[
                    "font-semibold tabular-nums",
                    improved
                      ? "text-emerald-600"
                      : declined
                        ? "text-rose-600"
                        : "text-foreground",
                  ].join(" ")}
                >
                  {s.suggestedWSJF.toFixed(1)}
                </span>
                {Math.abs(s.delta) > 0.05 && (
                  <span
                    className={
                      improved ? "ml-1 text-emerald-500" : "ml-1 text-rose-500"
                    }
                  >
                    ({improved ? "+" : ""}
                    {s.delta.toFixed(1)})
                  </span>
                )}
              </p>
              {s.justification && (
                <p className="mt-1 text-muted-foreground/80 text-xs italic">
                  {s.justification}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
