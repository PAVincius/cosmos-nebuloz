import { listAllAssessments, listAllImprovementActions } from "@/app/actions/measure-grow";
import { getFlowScopeOptions } from "@/app/actions/flow-metrics";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { StarIcon, TrendingUpIcon, CheckCircle2Icon } from "lucide-react";
import { MeasureGrowDashboard } from "./components/measure-grow-dashboard";

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
    id:    s.id,
    label: s.label,
    type:  s.type as string,
  }));

  const avgScore =
    assessments.length > 0
      ? Math.round(
          (assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length) * 10
        ) / 10
      : 0;

  const openCount = actions.filter(
    (a) => a.status === "OPEN" || a.status === "IN_PROGRESS"
  ).length;

  // Normalise Prisma result to the component's ActionItem shape
  const actionItems = actions.map((a) => ({
    id:            a.id,
    title:         a.title,
    description:   a.description,
    status:        a.status,
    relatedMetric: a.relatedMetric,
    dueDate:       a.dueDate,
    scope:         a.scope,
    scopeId:       a.scopeId,
  }));

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[{ label: "Analytics", href: "/analytics" }]}
        title="Measure & Grow"
        subtitle="Avalie as competências SAFe da organização e registre ações de melhoria ligadas às Flow Metrics."
        stats={[
          { label: "Assessments",   value: assessments.length, icon: StarIcon },
          { label: "Score Médio",   value: `${avgScore}/5`,    icon: TrendingUpIcon },
          { label: "Ações Abertas", value: openCount,          icon: CheckCircle2Icon },
        ]}
      />
      <div className={appDesign.bodyScroll}>
        <MeasureGrowDashboard
          assessments={assessments}
          actions={actionItems}
          scopes={scopes}
        />
      </div>
    </div>
  );
}
