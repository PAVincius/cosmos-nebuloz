import { Badge } from "@repo/design-system/components/ui/badge";
import { CheckCircle2Icon, StarIcon, TrendingUpIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getFlowScopeOptions } from "@/app/actions/flow-metrics";
import {
  listAllAssessments,
  listAllImprovementActions,
} from "@/app/actions/measure-grow";
import { SAFE_COMPETENCIES } from "@/app/actions/measure-grow/schema";
import { appDesign } from "@/lib/app-design";
import { computeCompetencyMaturity } from "./components/maturity-utils";
import { MaturityOverview } from "./components/maturity-overview";
import { MeasureGrowDashboard } from "./components/measure-grow-dashboard";
import { MeasureGrowHeaderActions } from "./components/measure-grow-header-actions";

export const metadata = {
  title: "Measure & Grow | COSMOS",
  description: "Assessments de competências SAFe e ações de melhoria contínua",
};

export default async function MeasureGrowPage() {
  const [assessments, actions, scopeOptions] = await Promise.all([
    listAllAssessments(),
    listAllImprovementActions(),
    getFlowScopeOptions(),
  ]);

  // Normalise FlowScopeOption (type: FlowScope) into the generic ScopeOption shape
  const scopes = scopeOptions.map((s) => ({
    id: s.id,
    label: s.label,
    type: s.type as string,
  }));

  const avgScore =
    assessments.length > 0
      ? Math.round(
          (assessments.reduce((sum, a) => sum + a.score, 0) /
            assessments.length) *
            10
        ) / 10
      : 0;

  const openCount = actions.filter(
    (a) => a.status === "OPEN" || a.status === "IN_PROGRESS"
  ).length;

  const maturity = computeCompetencyMaturity(
    SAFE_COMPETENCIES.map((c) => c.key),
    assessments
  );
  const improvedCount = Object.values(maturity).filter(
    (m) => m.delta > 0
  ).length;

  // Normalise Prisma result to the component's ActionItem shape
  const actionItems = actions.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    relatedMetric: a.relatedMetric,
    dueDate: a.dueDate,
    scope: a.scope,
    scopeId: a.scopeId,
  }));

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={<MeasureGrowHeaderActions scopes={scopes} />}
        badge={
          <>
            <Badge variant="outline">
              {SAFE_COMPETENCIES.length} competências
            </Badge>
            <Badge
              className="border-transparent bg-emerald-500/15 text-emerald-400"
              variant="outline"
            >
              {improvedCount} em evolução
            </Badge>
            <Badge variant="outline">Escala 1–5</Badge>
          </>
        }
        breadcrumb={[{ label: "Analytics", href: "/analytics" }]}
        stats={[
          { label: "Assessments", value: assessments.length, icon: StarIcon },
          {
            label: "Score Médio",
            value: `${avgScore}/5`,
            icon: TrendingUpIcon,
          },
          { label: "Ações Abertas", value: openCount, icon: CheckCircle2Icon },
        ]}
        subtitle="Avalie as competências SAFe da organização e registre ações de melhoria ligadas às Flow Metrics."
        title="Measure & Grow"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          <MaturityOverview assessments={assessments} />
          <MeasureGrowDashboard
            actions={actionItems}
            assessments={assessments}
            scopes={scopes}
          />
        </div>
      </div>
    </div>
  );
}
