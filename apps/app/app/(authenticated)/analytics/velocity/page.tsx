import { getVelocityOverview } from "@/app/actions/velocity";
import { getFlowScopeOptions } from "@/app/actions/flow-metrics";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { ZapIcon, TrendingUpIcon, UsersIcon } from "lucide-react";
import { VelocityDashboard } from "./components/velocity-dashboard";

export const metadata = {
  title: "Velocity | COSMOS",
  description: "Histórico de velocity por time e ART",
};

export default async function VelocityPage() {
  const [teams, scopeOptions] = await Promise.all([
    getVelocityOverview(),
    getFlowScopeOptions(),
  ]);

  const arts = Array.from(
    new Map(
      teams
        .filter((t) => t.artId && t.artName)
        .map((t) => [t.artId!, t.artName!])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const avgVelocity = teams.length > 0
    ? Math.round(teams.reduce((s, t) => s + t.avgSPPerSprint, 0) / teams.length)
    : 0;
  const trendUp = teams.filter((t) => t.trend === "up").length;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[{ label: "Analytics", href: "/analytics" }]}
        title="Velocity"
        subtitle="Histórico de entrega por sprint, por time e por ART. Métrica de capacidade — não de valor entregue."
        stats={[
          { label: "Times",           value: teams.length,  icon: UsersIcon },
          { label: "Média SP/Sprint", value: avgVelocity,   icon: ZapIcon },
          { label: "Trend ↑",        value: trendUp,        icon: TrendingUpIcon },
        ]}
      />
      <div className={appDesign.bodyScroll}>
        <VelocityDashboard teams={teams} arts={arts} />
      </div>
    </div>
  );
}
