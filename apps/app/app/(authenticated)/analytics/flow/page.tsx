import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { CopilotTriggerButton } from "@/app/(authenticated)/components/copilot/copilot-trigger-button";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import {
  getFlowMetrics,
  getFlowScopeOptions,
} from "@/app/actions/flow-metrics";
import {
  getAssessments,
  getImprovementActions,
} from "@/app/actions/measure-grow";
import { appDesign } from "@/lib/app-design";
import { FlowMetricsDashboard } from "./components/flow-metrics-dashboard";

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
  const defaultScope =
    scopeOptions.find((s) => s.type === "art") ?? scopeOptions[0];

  let selectedScope: {
    type: "team" | "art" | "value_stream";
    id: string;
  } | null = null;
  if (sp.scope && sp.scopeId) {
    selectedScope = {
      type: sp.scope as "team" | "art" | "value_stream",
      id: sp.scopeId,
    };
  } else if (defaultScope) {
    selectedScope = { type: defaultScope.type, id: defaultScope.id };
  }

  const [metrics, assessments, actions] = selectedScope
    ? await Promise.all([
        getFlowMetrics(selectedScope.type, selectedScope.id),
        getAssessments(selectedScope.type, selectedScope.id),
        getImprovementActions(selectedScope.type, selectedScope.id),
      ])
    : [null, [], []];

  return (
    <div className={`${appDesign.shell} h-full overflow-auto`}>
      <PageHeader
        actions={
          <CopilotTriggerButton
            contextRef={
              selectedScope
                ? { scope: selectedScope.type, scopeId: selectedScope.id }
                : {}
            }
            label="Copilot Flow"
            mode="spc"
            surface="flow_dashboard"
          />
        }
        breadcrumb={[{ label: "Analytics", href: "/analytics" }]}
        subtitle="SAFe 6.0 — Distribution · Velocity · Time · Load · Efficiency · Predictability"
        title="Flow Metrics"
      />

      <div className="min-w-0 flex-1 p-6">
        <FlowMetricsDashboard
          actions={actions}
          assessments={assessments}
          metrics={metrics}
          scopeOptions={scopeOptions}
          selectedScope={selectedScope}
          snapshotId={metrics?.id ?? undefined}
          staleness={metrics?.staleness ?? undefined}
        />
      </div>
    </div>
  );
}
