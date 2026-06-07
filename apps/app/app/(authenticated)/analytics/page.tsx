import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  GitBranchIcon,
  ShieldAlertIcon,
  StarIcon,
  TargetIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { buildTeamVelocityRows } from "@/lib/analytics-team-velocity";
import { appDesign } from "@/lib/app-design";
import { PageHeader } from "../components/page-header";
import { AnalyticsEmptyBanners } from "./components/analytics-empty";
import { ExecutiveROISummary } from "./components/executive-roi-summary";

export const metadata = {
  title: "Analytics | COSMOS",
  description: "Métricas SAFe 6.0 — PI Predictability, Velocity, Risks",
};

async function getAnalyticsData(tenantId: string) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [piPlans, risks, features, teams, completedSprints] = await Promise.all(
    [
      database.pIPlan.findMany({
        where: { tenantId },
        include: {
          piObjectives: {
            select: {
              id: true,
              status: true,
              isStretch: true,
              businessValue: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      database.risk.findMany({
        where: { tenantId },
        select: { id: true, status: true },
      }),
      database.feature.findMany({
        where: { tenantId, completedAt: { gte: sixMonthsAgo } },
        select: {
          id: true,
          storyPoints: true,
          completedAt: true,
          piPlanId: true,
        },
      }),
      database.team.findMany({
        where: { tenantId },
        select: { id: true, name: true, velocity: true },
      }),
      database.sprint.findMany({
        where: { tenantId, status: "COMPLETED" },
        orderBy: { endDate: "desc" },
        select: {
          teamId: true,
          endDate: true,
          stories: {
            where: { status: "DONE" },
            select: { storyPoints: true },
          },
        },
      }),
    ]
  );

  // 1. PI Predictability — ACHIEVED committed objectives / total committed objectives
  const latestPI = piPlans[0];
  let piPredictability = 0;
  if (latestPI) {
    const committed = latestPI.piObjectives.filter((o) => !o.isStretch);
    const achieved = committed.filter((o) => o.status === "ACHIEVED");
    piPredictability =
      committed.length > 0
        ? Math.round((achieved.length / committed.length) * 100)
        : 0;
  }

  // 2. Avg Velocity (avg of all teams with velocity set)
  const teamsWithVelocity = teams.filter(
    (t) => t.velocity !== null && t.velocity > 0
  );
  const avgVelocity =
    teamsWithVelocity.length > 0
      ? Math.round(
          teamsWithVelocity.reduce((sum, t) => sum + (t.velocity ?? 0), 0) /
            teamsWithVelocity.length
        )
      : 0;

  // 3. Risk Resolution Rate
  const totalRisks = risks.length;
  const resolvedRisks = risks.filter((r) =>
    ["RESOLVED", "MITIGATED", "ACCEPTED"].includes(r.status)
  ).length;
  const riskResolutionRate =
    totalRisks > 0 ? Math.round((resolvedRisks / totalRisks) * 100) : 0;

  // 4. Feature Throughput (completed features in latest PI or last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const recentFeatures = features.filter(
    (f) => f.completedAt && new Date(f.completedAt) >= ninetyDaysAgo
  );
  const featureThroughput = recentFeatures.length;

  // 5. Historical PI Predictability table
  const piHistory = piPlans.map((pi) => {
    const committed = pi.piObjectives.filter((o) => !o.isStretch);
    const achieved = committed.filter((o) => o.status === "ACHIEVED");
    const predictability =
      committed.length > 0
        ? Math.round((achieved.length / committed.length) * 100)
        : null;
    return {
      id: pi.id,
      name: pi.name,
      total: committed.length,
      achieved: achieved.length,
      predictability,
    };
  });

  const teamVelocityData = buildTeamVelocityRows(teams, completedSprints);

  return {
    hasPIPlans: piPlans.length > 0,
    hasTeams: teams.length > 0,
    piPredictability,
    avgVelocity,
    riskResolutionRate,
    featureThroughput,
    piHistory,
    teamVelocityData,
    totalRisks,
    resolvedRisks,
    latestPIName: latestPI?.name ?? null,
  };
}

function KPICard({
  title,
  value,
  suffix,
  description,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: number | string;
  suffix?: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div className="hover:-translate-y-0.5 rounded-xl border border-hairline bg-surface p-4 shadow-[var(--card-shadow)] transition-all duration-200 hover:border-primary/40 hover:shadow-[var(--hover-shadow)]">
      <p className="flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        <Icon className={`size-4 ${colorClass}`} />
        {title}
      </p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`font-bold text-3xl ${colorClass}`}>{value}</span>
        {suffix ? (
          <span className="text-muted-foreground text-sm">{suffix}</span>
        ) : null}
      </div>
      <p className="mt-1 text-muted-foreground text-xs">{description}</p>
    </div>
  );
}

function getBadgeVariant(
  value: number
): "default" | "secondary" | "destructive" {
  if (value >= 80) {
    return "default";
  }
  if (value >= 60) {
    return "secondary";
  }
  return "destructive";
}

function getPredictabilityColor(value: number) {
  if (value >= 80) {
    return "text-green-600";
  }
  if (value >= 60) {
    return "text-amber-600";
  }
  return "text-destructive";
}

const SPRINT_COLS = ["S-5", "S-4", "S-3", "S-2", "S-1", "Atual"] as const;

export default async function AnalyticsPage() {
  const ctx = await requireTenantSession(await headers());
  const data = await getAnalyticsData(ctx.tenantId);
  const showNoTeams = !data.hasTeams;
  const showEmptyVelocity = data.hasTeams && data.teamVelocityData.length === 0;
  const showVelocityTable = data.hasTeams && data.teamVelocityData.length > 0;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        stats={[
          {
            label: "PI Predictability",
            value: `${data.piPredictability}%`,
            icon: TargetIcon,
          },
          {
            label: "Avg Velocity",
            value: `${data.avgVelocity} SP/sprint`,
            icon: TrendingUpIcon,
          },
          {
            label: "Risk Resolution",
            value: `${data.riskResolutionRate}%`,
            icon: ShieldAlertIcon,
          },
          {
            label: "Feature Throughput",
            value: String(data.featureThroughput),
            icon: ZapIcon,
          },
        ]}
        subtitle="Métricas de desempenho baseadas em SAFe 6.0"
        title="Analytics SAFe"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          <AnalyticsEmptyBanners
            hasPIPlans={data.hasPIPlans}
            hasTeams={data.hasTeams}
          />

          <ExecutiveROISummary
            avgVelocity={data.avgVelocity}
            featureThroughput={data.featureThroughput}
            latestPIName={data.latestPIName}
            piPredictability={data.piPredictability}
            resolvedRisks={data.resolvedRisks}
            riskResolutionRate={data.riskResolutionRate}
            totalRisks={data.totalRisks}
          />

          {/* Quick links to detailed dashboards */}
          <div className="flex flex-wrap gap-2">
            <Link href="/analytics/flow">
              <Button className="gap-1.5" size="sm" variant="outline">
                <GitBranchIcon className="h-3.5 w-3.5" />
                Flow Metrics
              </Button>
            </Link>
            <Link href="/analytics/velocity">
              <Button className="gap-1.5" size="sm" variant="outline">
                <ZapIcon className="h-3.5 w-3.5" />
                Velocity Dashboard
              </Button>
            </Link>
            <Link href="/analytics/measure-grow">
              <Button className="gap-1.5" size="sm" variant="outline">
                <StarIcon className="h-3.5 w-3.5" />
                Measure &amp; Grow
              </Button>
            </Link>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              colorClass={getPredictabilityColor(data.piPredictability)}
              description={
                data.latestPIName
                  ? `Último PI: ${data.latestPIName}`
                  : "Nenhum PI com dados"
              }
              icon={TargetIcon}
              suffix="%"
              title="PI Predictability"
              value={data.piPredictability}
            />
            <KPICard
              colorClass="text-blue-600"
              description={`Média de ${data.teamVelocityData.filter((t) => t.velocity > 0).length} time(s)`}
              icon={TrendingUpIcon}
              suffix="SP/sprint"
              title="Avg Velocity"
              value={data.avgVelocity}
            />
            <KPICard
              colorClass={
                data.riskResolutionRate >= 70
                  ? "text-green-600"
                  : "text-amber-600"
              }
              description={`${data.resolvedRisks} de ${data.totalRisks} riscos resolvidos`}
              icon={ShieldAlertIcon}
              suffix="%"
              title="Risk Resolution"
              value={data.riskResolutionRate}
            />
            <KPICard
              colorClass="text-purple-600"
              description="Concluídas nos últimos 90 dias"
              icon={ZapIcon}
              suffix="features"
              title="Feature Throughput"
              value={data.featureThroughput}
            />
          </div>

          {/* PI Predictability History */}
          <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
            <div className="border-hairline border-b bg-surface-2 px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-sm">
                <TargetIcon className="size-4 text-primary" />
                Histórico de PI Predictability
              </h2>
              <p className="mt-0.5 text-muted-foreground text-xs">
                Predictability por PI (objetivos committed)
              </p>
            </div>
            <div className="px-5">
              {data.piHistory.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground text-sm">
                  Nenhum PI encontrado. Crie PIs e objetivos para ver o
                  histórico.
                </p>
              ) : (
                <div className="divide-y divide-hairline text-sm">
                  <div className="flex items-center gap-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    <span className="flex-1">PI</span>
                    <span className="w-20 text-right">Objectives</span>
                    <span className="w-20 text-right">Achieved</span>
                    <span className="w-24 text-right">Predictability</span>
                  </div>
                  {data.piHistory.map((pi) => (
                    <div className="flex items-center gap-3 py-2.5" key={pi.id}>
                      <span className="flex-1 truncate font-medium">
                        {pi.name}
                      </span>
                      <span className="w-20 text-right text-muted-foreground">
                        {pi.total}
                      </span>
                      <span className="w-20 text-right text-muted-foreground">
                        {pi.achieved}
                      </span>
                      <span className="w-24 text-right">
                        {pi.predictability !== null ? (
                          <Badge
                            className="text-xs"
                            variant={getBadgeVariant(pi.predictability)}
                          >
                            {pi.predictability}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Team Velocity Table */}
          <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
            <div className="border-hairline border-b bg-surface-2 px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-sm">
                <TrendingUpIcon className="size-4 text-primary" />
                Velocity por Time — Últimos 6 Sprints
              </h2>
              <p className="mt-0.5 text-muted-foreground text-xs">
                Story points concluídos nos últimos 6 sprints completos por
                time.
              </p>
            </div>
            <div className="px-5 py-4">
              {showNoTeams ? (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  Nenhum time cadastrado.{" "}
                  <Link
                    className="text-primary underline-offset-4 hover:underline"
                    href="/teams"
                  >
                    Criar times
                  </Link>
                </p>
              ) : null}
              {showEmptyVelocity ? (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  Nenhum time encontrado.
                </p>
              ) : null}
              {showVelocityTable ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-hairline border-b text-muted-foreground text-xs">
                        <th className="py-2 pr-4 text-left font-medium">
                          Time
                        </th>
                        {["S-5", "S-4", "S-3", "S-2", "S-1", "Atual"].map(
                          (s) => (
                            <th
                              className="px-2 py-2 text-right font-medium"
                              key={s}
                            >
                              {s}
                            </th>
                          )
                        )}
                        <th className="py-2 pl-4 text-right font-medium">
                          Ref.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teamVelocityData.map((team) => (
                        <tr
                          className="border-hairline border-b last:border-0"
                          key={team.id}
                        >
                          <td className="max-w-32 truncate py-2.5 pr-4 font-medium">
                            {team.name}
                          </td>
                          {SPRINT_COLS.map((label, i) => (
                            <td
                              className="px-2 py-2.5 text-right text-muted-foreground"
                              key={`${team.id}-${label}`}
                            >
                              {team.sprints[i] !== null ? team.sprints[i] : "—"}
                            </td>
                          ))}
                          <td className="py-2.5 pl-4 text-right">
                            {team.velocity > 0 ? (
                              <Badge className="text-xs" variant="secondary">
                                {team.velocity} SP
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
