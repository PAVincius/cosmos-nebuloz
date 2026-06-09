"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { AssessmentsTab } from "./assessments-tab";
import { CompetencyRadar } from "./competency-radar";
import { ImprovementActionsTab } from "./improvement-actions-tab";

type AssessmentItem = {
  id: string;
  competency: string;
  competencyLabel: string;
  scope: string;
  scopeId: string;
  score: number;
  notes: string | null;
  assessedAt: Date;
  actions: { id: string; title: string; status: string }[];
};

type ActionItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  relatedMetric: string | null;
  dueDate: Date | null;
  scope: string;
  scopeId: string;
};

type ScopeOption = {
  id: string;
  label: string;
  type: string;
};

const METRIC_LABELS: Record<string, string> = {
  flow_velocity: "Flow Velocity",
  flow_time: "Flow Time",
  flow_load: "Flow Load",
  flow_efficiency: "Flow Efficiency",
  flow_predictability: "Flow Predictability",
  flow_distribution: "Flow Distribution",
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "oklch(0.68 0.18 50)",
  "hsl(var(--destructive))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-3))",
];

function MetricImpactMatrix({ actions }: { actions: ActionItem[] }) {
  const withMetric = actions.filter((a) => a.relatedMetric);
  const grouped: Record<string, number> = {};
  for (const a of withMetric) {
    const m = a.relatedMetric ?? "";
    if (m) {
      grouped[m] = (grouped[m] ?? 0) + 1;
    }
  }
  const data = Object.entries(grouped)
    .map(([metric, count]) => ({
      metric: METRIC_LABELS[metric] ?? metric,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        Nenhuma ação vinculada a Flow Metrics. Ao criar ações de melhoria,
        selecione a métrica impactada.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div className="flex items-center gap-3" key={d.metric}>
          <span className="w-36 truncate text-muted-foreground text-sm">
            {d.metric}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.count / data[0].count) * 100}%`,
                background: COLORS[i % COLORS.length],
              }}
            />
          </div>
          <span className="w-6 text-right font-mono text-xs">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

export function MeasureGrowDashboard({
  assessments,
  actions,
  scopes,
}: {
  assessments: AssessmentItem[];
  actions: ActionItem[];
  scopes: ScopeOption[];
}) {
  return (
    <Tabs className="flex flex-col gap-4" defaultValue="assessments">
      <TabsList className="w-fit">
        <TabsTrigger value="assessments">
          Assessments ({assessments.length})
        </TabsTrigger>
        <TabsTrigger value="actions">
          Ações de Melhoria ({actions.length})
        </TabsTrigger>
        <TabsTrigger value="impact">Impacto Operacional</TabsTrigger>
      </TabsList>
      <TabsContent value="assessments">
        <AssessmentsTab initialAssessments={assessments} scopes={scopes} />
      </TabsContent>
      <TabsContent value="actions">
        <ImprovementActionsTab initialActions={actions} scopes={scopes} />
      </TabsContent>
      <TabsContent value="impact">
        <div className="space-y-6">
          <div className="rounded-lg border p-4">
            <p className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              Competências SAFe — Radar do Time
            </p>
            <CompetencyRadar assessments={assessments} />
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              Ações de Melhoria × Flow Metrics
            </p>
            <MetricImpactMatrix actions={actions} />
            <p className="mt-4 text-[10px] text-muted-foreground">
              Mostra quantas ações de melhoria estão vinculadas a cada Flow
              Metric. Uma alta concentração em Flow Predictability ou Flow Load
              indica onde a organização mais investe em melhoria.
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
