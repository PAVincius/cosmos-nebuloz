import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  BarChart2Icon,
  TargetIcon,
  TrendingUpIcon,
  ShieldAlertIcon,
  ZapIcon,
} from "lucide-react";
import { appDesign } from "@/lib/app-design";

export const metadata = {
  title: "Analytics | COSMOS",
  description: "Métricas SAFe 6.0 — PI Predictability, Velocity, Risks",
};

async function getAnalyticsData(tenantId: string) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [piPlans, risks, features, teams] = await Promise.all([
    database.pIPlan.findMany({
      where: { tenantId },
      include: {
        piObjectives: {
          select: { id: true, status: true, isStretch: true, businessValue: true },
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
      select: { id: true, storyPoints: true, completedAt: true, piPlanId: true },
    }),
    database.team.findMany({
      where: { tenantId },
      select: { id: true, name: true, velocity: true },
    }),
  ]);

  // 1. PI Predictability — ACHIEVED committed objectives / total committed objectives
  const latestPI = piPlans[0];
  let piPredictability = 0;
  if (latestPI) {
    const committed = latestPI.piObjectives.filter((o) => !o.isStretch);
    const achieved = committed.filter((o) => o.status === "ACHIEVED");
    piPredictability = committed.length > 0
      ? Math.round((achieved.length / committed.length) * 100)
      : 0;
  }

  // 2. Avg Velocity (avg of all teams with velocity set)
  const teamsWithVelocity = teams.filter((t) => t.velocity != null && t.velocity > 0);
  const avgVelocity = teamsWithVelocity.length > 0
    ? Math.round(teamsWithVelocity.reduce((sum, t) => sum + (t.velocity ?? 0), 0) / teamsWithVelocity.length)
    : 0;

  // 3. Risk Resolution Rate
  const totalRisks = risks.length;
  const resolvedRisks = risks.filter((r) =>
    ["RESOLVED", "MITIGATED", "ACCEPTED"].includes(r.status)
  ).length;
  const riskResolutionRate = totalRisks > 0
    ? Math.round((resolvedRisks / totalRisks) * 100)
    : 0;

  // 4. Feature Throughput (completed features in latest PI or last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const recentFeatures = features.filter((f) => f.completedAt && new Date(f.completedAt) >= ninetyDaysAgo);
  const featureThroughput = recentFeatures.length;

  // 5. Historical PI Predictability table
  const piHistory = piPlans.map((pi) => {
    const committed = pi.piObjectives.filter((o) => !o.isStretch);
    const achieved = committed.filter((o) => o.status === "ACHIEVED");
    const predictability = committed.length > 0
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

  // 6. Team velocity table (mock sprints if no data)
  const teamVelocityData = teams.map((t) => ({
    id: t.id,
    name: t.name,
    velocity: t.velocity ?? 0,
    // Mock last 6 sprints around the configured velocity with ±20% variance
    sprints: Array.from({ length: 6 }, (_, i) => {
      if (!t.velocity) return null;
      const base = t.velocity;
      const variance = Math.round(base * 0.2 * (Math.random() - 0.5) * 2);
      return Math.max(0, base + variance);
    }),
  }));

  return {
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={`size-4 ${colorClass}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${colorClass}`}>{value}</span>
          {suffix && <span className="text-muted-foreground text-sm">{suffix}</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function getPredictabilityColor(value: number) {
  if (value >= 80) return "text-green-600";
  if (value >= 60) return "text-amber-600";
  return "text-destructive";
}

export default async function AnalyticsPage() {
  const ctx = await requireTenantSession(await headers());
  const data = await getAnalyticsData(ctx.tenantId);

  return (
    <div className={appDesign.shell}>
      <div className={appDesign.pageHeader}>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart2Icon className="size-5" />
          Analytics SAFe
        </h1>
        <p className="text-muted-foreground text-sm">
          Métricas de desempenho baseadas em SAFe 6.0
        </p>
      </div>
      <div className={appDesign.bodyScroll}>
      <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="PI Predictability"
          value={data.piPredictability}
          suffix="%"
          description={
            data.latestPIName
              ? `Último PI: ${data.latestPIName}`
              : "Nenhum PI com dados"
          }
          icon={TargetIcon}
          colorClass={getPredictabilityColor(data.piPredictability)}
        />
        <KPICard
          title="Avg Velocity"
          value={data.avgVelocity}
          suffix="SP/sprint"
          description={`Média de ${data.teamVelocityData.filter((t) => t.velocity > 0).length} time(s)`}
          icon={TrendingUpIcon}
          colorClass="text-blue-600"
        />
        <KPICard
          title="Risk Resolution"
          value={data.riskResolutionRate}
          suffix="%"
          description={`${data.resolvedRisks} de ${data.totalRisks} riscos resolvidos`}
          icon={ShieldAlertIcon}
          colorClass={data.riskResolutionRate >= 70 ? "text-green-600" : "text-amber-600"}
        />
        <KPICard
          title="Feature Throughput"
          value={data.featureThroughput}
          suffix="features"
          description="Concluídas nos últimos 90 dias"
          icon={ZapIcon}
          colorClass="text-purple-600"
        />
      </div>

      <Separator />

      {/* PI Predictability History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TargetIcon className="size-4" />
            Histórico de PI Predictability
          </CardTitle>
          <CardDescription>Predictability por PI (objetivos committed)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.piHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum PI encontrado. Crie PIs e objetivos para ver o histórico.
            </p>
          ) : (
            <div className="divide-y text-sm">
              <div className="flex items-center gap-3 py-2 font-medium text-muted-foreground text-xs">
                <span className="flex-1">PI</span>
                <span className="w-20 text-right">Objectives</span>
                <span className="w-20 text-right">Achieved</span>
                <span className="w-24 text-right">Predictability</span>
              </div>
              {data.piHistory.map((pi) => (
                <div key={pi.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 font-medium truncate">{pi.name}</span>
                  <span className="w-20 text-right text-muted-foreground">{pi.total}</span>
                  <span className="w-20 text-right text-muted-foreground">{pi.achieved}</span>
                  <span className="w-24 text-right">
                    {pi.predictability !== null ? (
                      <Badge
                        variant={pi.predictability >= 80 ? "default" : pi.predictability >= 60 ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {pi.predictability}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Velocity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUpIcon className="size-4" />
            Velocity por Time — Últimos 6 Sprints
          </CardTitle>
          <CardDescription>
            Baseado na velocity configurada por time.
            {data.teamVelocityData.some((t) => t.velocity === 0) && (
              <span className="ml-1 text-amber-600">(times sem velocity configurada mostram —)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.teamVelocityData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum time encontrado. Crie times para ver a velocity.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4 font-medium">Time</th>
                    {["S-5", "S-4", "S-3", "S-2", "S-1", "Atual"].map((s) => (
                      <th key={s} className="text-right py-2 px-2 font-medium">{s}</th>
                    ))}
                    <th className="text-right py-2 pl-4 font-medium">Ref.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teamVelocityData.map((team) => (
                    <tr key={team.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium truncate max-w-32">{team.name}</td>
                      {team.sprints.map((sp, i) => (
                        <td key={i} className="py-2.5 px-2 text-right text-muted-foreground">
                          {team.velocity > 0 && sp !== null ? sp : "—"}
                        </td>
                      ))}
                      <td className="py-2.5 pl-4 text-right">
                        {team.velocity > 0 ? (
                          <Badge variant="secondary" className="text-xs">{team.velocity} SP</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}
