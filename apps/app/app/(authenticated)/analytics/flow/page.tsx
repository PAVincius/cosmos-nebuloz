import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { Suspense } from "react";
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
import { TeamCapacityTab } from "./components/capacity/team-capacity-tab";
import { FlowMetricsDashboard } from "./components/flow-metrics-dashboard";
import { SynergyTab } from "./components/synergy-tab";

export const metadata = {
  title: "Flow Metrics | COSMOS",
  description: "SAFe 6.0 Flow Metrics & Measure-and-Grow",
};

type Props = {
  searchParams: Promise<{ scope?: string; scopeId?: string; tab?: string }>;
};

type SelectedScope = {
  type: "team" | "art" | "value_stream";
  id: string;
};

function resolveSelectedScope(
  searchParams: { scope?: string; scopeId?: string },
  defaultScope:
    | { type: "team" | "art" | "value_stream"; id: string }
    | undefined
): SelectedScope | null {
  if (searchParams.scope && searchParams.scopeId) {
    return {
      type: searchParams.scope as "team" | "art" | "value_stream",
      id: searchParams.scopeId,
    };
  }
  if (defaultScope) {
    return { type: defaultScope.type, id: defaultScope.id };
  }
  return null;
}

export default async function FlowMetricsPage({ searchParams }: Props) {
  await requireTenantSession(await headers());

  const sp = await searchParams;
  const scopeOptions = await getFlowScopeOptions();

  // Default to first ART, then first team
  const defaultScope =
    scopeOptions.find((s) => s.type === "art") ?? scopeOptions[0];

  const selectedScope = resolveSelectedScope(sp, defaultScope);

  const [metrics, assessments, actions] = selectedScope
    ? await Promise.all([
        getFlowMetrics(selectedScope.type, selectedScope.id),
        getAssessments(selectedScope.type, selectedScope.id),
        getImprovementActions(selectedScope.type, selectedScope.id),
      ])
    : [null, [], []];

  const activeTab = sp.tab ?? "metrics";
  const isTeamScope = selectedScope?.type === "team";

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
        {isTeamScope ? (
          <div className="mb-6 flex gap-2 border-border border-b">
            <TabButton
              active={activeTab === "metrics"}
              href={`?scope=team&scopeId=${selectedScope?.id}`}
              label="Flow Metrics"
            />
            <TabButton
              active={activeTab === "capacity"}
              href={`?scope=team&scopeId=${selectedScope?.id}&tab=capacity`}
              label="Team Capacity"
            />
            <TabButton
              active={activeTab === "synergy"}
              href={`?scope=team&scopeId=${selectedScope?.id}&tab=synergy`}
              label="Sinergia"
            />
          </div>
        ) : null}

        {activeTab === "capacity" && isTeamScope && selectedScope ? (
          <TeamCapacityTab teamId={selectedScope.id} />
        ) : null}
        {activeTab === "synergy" && isTeamScope && selectedScope ? (
          <Suspense
            fallback={
              <div className="p-4 text-muted-foreground text-sm">
                Carregando sinergia...
              </div>
            }
          >
            <SynergyTab teamId={selectedScope.id} />
          </Suspense>
        ) : null}
        {activeTab !== "capacity" && activeTab !== "synergy" ? (
          <FlowMetricsDashboard
            actions={actions}
            assessments={assessments}
            metrics={metrics}
            scopeOptions={scopeOptions}
            selectedScope={selectedScope}
            snapshotId={metrics?.id ?? undefined}
            staleness={metrics?.staleness ?? undefined}
          />
        ) : null}
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <a
      className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
      href={href}
    >
      {label}
    </a>
  );
}
