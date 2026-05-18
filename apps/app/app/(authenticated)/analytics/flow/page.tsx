import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { getFlowScopeOptions, getFlowMetrics } from "@/app/actions/flow-metrics";
import { getAssessments, getImprovementActions } from "@/app/actions/measure-grow";
import { FlowMetricsDashboard } from "./components/flow-metrics-dashboard";
import { appDesign } from "@/lib/app-design";

export const metadata = {
  title: "Flow Metrics | COSMOS",
  description: "SAFe 6.0 Flow Metrics & Measure-and-Grow",
};

type Props = {
  searchParams: Promise<{ scope?: string; scopeId?: string }>;
};

export default async function FlowMetricsPage({ searchParams }: Props) {
  await requireTenantSession(await headers());

  const sp = await searchParams;
  const scopeOptions = await getFlowScopeOptions();

  // Default to first ART, then first team
  const defaultScope = scopeOptions.find((s) => s.type === "art") ?? scopeOptions[0];

  const selectedScope = sp.scope && sp.scopeId
    ? { type: sp.scope as "team" | "art" | "value_stream", id: sp.scopeId }
    : defaultScope
    ? { type: defaultScope.type, id: defaultScope.id }
    : null;

  const [metrics, assessments, actions] = selectedScope
    ? await Promise.all([
        getFlowMetrics(selectedScope.type, selectedScope.id),
        getAssessments(selectedScope.type, selectedScope.id),
        getImprovementActions(selectedScope.type, selectedScope.id),
      ])
    : [null, [], []];

  return (
    <div className={`${appDesign.shell} h-full overflow-auto`}>
      <header className={appDesign.pageHeader}>
        <h1 className={appDesign.pageTitle}>Flow Metrics</h1>
        <p className={appDesign.pageSubtitle}>
          SAFe 6.0 — Distribution · Velocity · Time · Load · Efficiency · Predictability
        </p>
        <div className={appDesign.accentBar} aria-hidden />
      </header>

      <div className="min-w-0 flex-1 p-6">
        <FlowMetricsDashboard
          scopeOptions={scopeOptions}
          selectedScope={selectedScope}
          metrics={metrics}
          assessments={assessments}
          actions={actions}
        />
      </div>
    </div>
  );
}
