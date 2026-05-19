"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { AssessmentsTab } from "./assessments-tab";
import { ImprovementActionsTab } from "./improvement-actions-tab";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

const COMPETENCY_LABELS: Record<string, string> = {
  TEAM_TECHNICAL_AGILITY:      "Agilidade Técnica",
  AGILE_PRODUCT_DELIVERY:      "Entrega Ágil",
  ENTERPRISE_SOLUTION_DELIVERY:"Entrega Enterprise",
  LEAN_PORTFOLIO_MANAGEMENT:   "LPM",
  ORGANIZATIONAL_AGILITY:      "Agilidade Org.",
  CONTINUOUS_LEARNING_CULTURE: "Aprendizado Contínuo",
  LEAN_AGILE_LEADERSHIP:       "Liderança",
};

const METRIC_LABELS: Record<string, string> = {
  flow_velocity:       "Flow Velocity",
  flow_time:           "Flow Time",
  flow_load:           "Flow Load",
  flow_efficiency:     "Flow Efficiency",
  flow_predictability: "Flow Predictability",
  flow_distribution:   "Flow Distribution",
};

const COLORS = ["#5e6ad2", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

function CompetencyRadarChart({ assessments }: { assessments: AssessmentItem[] }) {
  const grouped: Record<string, number[]> = {};
  for (const a of assessments) {
    if (!grouped[a.competency]) grouped[a.competency] = [];
    grouped[a.competency].push(a.score);
  }
  const data = Object.entries(grouped).map(([comp, scores]) => ({
    competency: COMPETENCY_LABELS[comp] ?? comp,
    avg: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10,
    count: scores.length,
  })).sort((a, b) => a.avg - b.avg);

  if (data.length === 0) return (
    <p className="text-sm text-muted-foreground text-center py-8">Nenhum assessment registrado.</p>
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10 }} />
        <YAxis dataKey="competency" type="category" tick={{ fontSize: 11 }} width={110} />
        <Tooltip
          formatter={(v: number, _: string, props: { payload?: { count: number } }) =>
            [`${v}/5 (${props.payload?.count ?? 0} avaliações)`, "Score médio"]
          }
          contentStyle={{ fontSize: 11 }}
        />
        <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MetricImpactMatrix({ actions }: { actions: ActionItem[] }) {
  const withMetric = actions.filter((a) => a.relatedMetric);
  const grouped: Record<string, number> = {};
  for (const a of withMetric) {
    const m = a.relatedMetric!;
    grouped[m] = (grouped[m] ?? 0) + 1;
  }
  const data = Object.entries(grouped).map(([metric, count]) => ({
    metric: METRIC_LABELS[metric] ?? metric,
    count,
  })).sort((a, b) => b.count - a.count);

  if (data.length === 0) return (
    <p className="text-sm text-muted-foreground text-center py-8">
      Nenhuma ação vinculada a Flow Metrics. Ao criar ações de melhoria, selecione a métrica impactada.
    </p>
  );

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.metric} className="flex items-center gap-3">
          <span className="text-sm w-36 text-muted-foreground truncate">{d.metric}</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.count / data[0].count) * 100}%`, background: COLORS[i % COLORS.length] }}
            />
          </div>
          <span className="text-xs font-mono w-6 text-right">{d.count}</span>
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
    <Tabs defaultValue="assessments" className="flex flex-col gap-4">
      <TabsList className="w-fit">
        <TabsTrigger value="assessments">
          Assessments ({assessments.length})
        </TabsTrigger>
        <TabsTrigger value="actions">
          Ações de Melhoria ({actions.length})
        </TabsTrigger>
        <TabsTrigger value="impact">
          Impacto Operacional
        </TabsTrigger>
      </TabsList>
      <TabsContent value="assessments">
        <AssessmentsTab initialAssessments={assessments} scopes={scopes} />
      </TabsContent>
      <TabsContent value="actions">
        <ImprovementActionsTab initialActions={actions} scopes={scopes} />
      </TabsContent>
      <TabsContent value="impact">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Scores por Competência SAFe
            </p>
            <CompetencyRadarChart assessments={assessments} />
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Ações de Melhoria × Flow Metrics
            </p>
            <MetricImpactMatrix actions={actions} />
            <p className="text-[10px] text-muted-foreground mt-4">
              Mostra quantas ações de melhoria estão vinculadas a cada Flow Metric.
              Uma alta concentração em Flow Predictability ou Flow Load indica onde a organização mais investe em melhoria.
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
