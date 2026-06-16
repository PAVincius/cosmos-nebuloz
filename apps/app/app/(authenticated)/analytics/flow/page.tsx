import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { z } from "zod";
import { CopilotTriggerButton } from "@/app/(authenticated)/components/copilot/copilot-trigger-button";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getCycleTimeData } from "@/app/actions/analytics/cycle-time";
import { getPIBurnupData } from "@/app/actions/analytics/pi-burnup";
import { getPortfolioCFDData } from "@/app/actions/analytics/portfolio-cfd";
import { computeTeamCapability } from "@/app/actions/flow-intelligence/capability-planning/team-capability-profile";
import {
  getFlowMetrics,
  getFlowScopeOptions,
} from "@/app/actions/flow-metrics";
import {
  getAssessments,
  getImprovementActions,
} from "@/app/actions/measure-grow";
import { getPIPlansByART } from "@/app/actions/program-board";
import { appDesign } from "@/lib/app-design";
import { CapabilityTab } from "./components/capability-tab";
import { TeamCapacityTab } from "./components/capacity/team-capacity-tab";
import { CycleTimeChart } from "./components/cycle-time-chart";
import { FlowMetricsDashboard } from "./components/flow-metrics-dashboard";
import { PIBurnupChart } from "./components/pi-burnup-chart";
import { PortfolioCFDChart } from "./components/portfolio-cfd-chart";

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

const UUID_SCHEMA = z.string().uuid();
const FLOW_SCOPE_VALUES = ["team", "art", "value_stream"] as const;

function resolveSelectedScope(
  searchParams: { scope?: string; scopeId?: string },
  defaultScope:
    | { type: "team" | "art" | "value_stream"; id: string }
    | undefined
): SelectedScope | null {
  const isValidScope = (s?: string): s is "team" | "art" | "value_stream" =>
    FLOW_SCOPE_VALUES.includes(s as "team" | "art" | "value_stream");

  if (
    isValidScope(searchParams.scope) &&
    UUID_SCHEMA.safeParse(searchParams.scopeId).success
  ) {
    return {
      type: searchParams.scope,
      id: searchParams.scopeId as string,
    };
  }
  if (defaultScope) {
    return { type: defaultScope.type, id: defaultScope.id };
  }
  return null;
}

export default async function FlowMetricsPage({ searchParams }: Props) {
  const ctx = await requireTenantSession(await headers());

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

  const cfdData =
    activeTab === "portfolio" && selectedScope?.type !== "team"
      ? await getPortfolioCFDData(
          selectedScope?.type === "art" ? selectedScope.id : undefined
        )
      : null;

  const capabilityProfile =
    activeTab === "synergy" && isTeamScope && selectedScope
      ? await computeTeamCapability({
          tenantId: ctx.tenantId,
          teamId: selectedScope.id,
          windowSprints: 5,
        }).catch(() => null)
      : null;

  // FLW-01: PI Burnup — for ART scope
  const burnupData =
    activeTab === "burnup" && selectedScope?.type === "art"
      ? await (async () => {
          const plans = await getPIPlansByART(selectedScope.id);
          const latestPlan = plans[0];
          if (!latestPlan?.id) {
            return null;
          }
          const r = await getPIBurnupData(latestPlan.id);
          return r.ok ? r.data : null;
        })()
      : null;

  // FLW-02: Cycle Time — for team scope
  const cycleTimeData =
    activeTab === "cycletime" && isTeamScope && selectedScope
      ? await getCycleTimeData(selectedScope.id).then((r) =>
          r.ok ? r.data : null
        )
      : null;

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
              active={activeTab === "cycletime"}
              href={`?scope=team&scopeId=${selectedScope?.id}&tab=cycletime`}
              label="Cycle Time"
            />
            <TabButton
              active={activeTab === "synergy"}
              href={`?scope=team&scopeId=${selectedScope?.id}&tab=synergy`}
              label="Sinergia"
            />
          </div>
        ) : (
          <div className="mb-6 flex gap-2 border-border border-b">
            <TabButton
              active={activeTab !== "portfolio" && activeTab !== "burnup"}
              href={
                selectedScope
                  ? `?scope=${selectedScope.type}&scopeId=${selectedScope.id}`
                  : "?"
              }
              label="Flow Metrics"
            />
            <TabButton
              active={activeTab === "portfolio"}
              href={
                selectedScope
                  ? `?scope=${selectedScope.type}&scopeId=${selectedScope.id}&tab=portfolio`
                  : "?tab=portfolio"
              }
              label="Portfolio CFD"
            />
            {selectedScope?.type === "art" && (
              <TabButton
                active={activeTab === "burnup"}
                href={`?scope=art&scopeId=${selectedScope.id}&tab=burnup`}
                label="PI Burnup"
              />
            )}
          </div>
        )}

        {activeTab === "capacity" && isTeamScope && selectedScope ? (
          <TeamCapacityTab teamId={selectedScope.id} />
        ) : null}
        {activeTab === "synergy" && isTeamScope && selectedScope ? (
          <CapabilityTab
            gaps={[]}
            teams={[
              {
                id: selectedScope.id,
                name:
                  scopeOptions.find((o) => o.id === selectedScope.id)?.label ??
                  selectedScope.id,
                capabilities: capabilityProfile?.capabilities ?? {},
              },
            ]}
          />
        ) : null}
        {activeTab === "portfolio" && cfdData?.ok ? (
          <PortfolioCFDChart data={cfdData.data} />
        ) : null}
        {activeTab === "burnup" && burnupData ? (
          <PIBurnupChart data={burnupData} />
        ) : null}
        {activeTab === "cycletime" && cycleTimeData ? (
          <CycleTimeChart data={cycleTimeData} />
        ) : null}
        {activeTab !== "capacity" &&
        activeTab !== "synergy" &&
        activeTab !== "portfolio" &&
        activeTab !== "burnup" &&
        activeTab !== "cycletime" ? (
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
