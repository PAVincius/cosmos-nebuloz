import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  CheckCircleIcon,
  ShieldAlertIcon,
  TargetIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { generatePIRetroReport } from "@/app/actions/analytics/pi-retro";
import { appDesign } from "@/lib/app-design";
import { PageHeader } from "../../../components/page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ piPlanId: string }>;
}) {
  const { piPlanId } = await params;
  return { title: `PI Retrospectiva ${piPlanId} | COSMOS` };
}

const OBJ_STATUS_COLORS: Record<string, string> = {
  ACHIEVED: "default",
  PARTIAL: "secondary",
  MISSED: "destructive",
  PLANNED: "outline",
};

const RISK_STATUS_LABELS: Record<string, string> = {
  IDENTIFIED: "Identificado",
  OWNED: "Dono",
  ACCEPTED: "Aceito",
  MITIGATED: "Mitigado",
};

export default async function PIRetroPage({
  params,
}: {
  params: Promise<{ piPlanId: string }>;
}) {
  const { piPlanId } = await params;
  const result = await generatePIRetroReport(piPlanId);

  if (!result.ok) {
    notFound();
  }

  const { piPlan, objectives, sprints, risks, impediments, summary } =
    result.data;

  const velocityPct =
    summary.plannedPoints > 0
      ? Math.round((summary.actualPoints / summary.plannedPoints) * 100)
      : null;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Analytics", href: "/analytics/executive" },
          { label: "Retrospectiva PI" },
        ]}
        subtitle={`${piPlan.artName} · ${
          piPlan.startDate
            ? new Date(piPlan.startDate).toLocaleDateString("pt-BR")
            : "?"
        } → ${
          piPlan.endDate
            ? new Date(piPlan.endDate).toLocaleDateString("pt-BR")
            : "?"
        }`}
        title={piPlan.name}
      />
      <div className={appDesign.bodyScroll}>
        <div className="space-y-6">
          {/* KPI summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <TargetIcon className="h-3.5 w-3.5" />
                  Objetivos PI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-bold text-2xl">
                  {summary.objectivesAchieved}/{summary.objectivesTotal}
                </p>
                <p className="text-muted-foreground text-xs">alcançados</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <TrendingUpIcon className="h-3.5 w-3.5" />
                  Velocity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-bold text-2xl">
                  {summary.actualPoints}
                  <span className="font-normal text-muted-foreground text-sm">
                    /{summary.plannedPoints} SP
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {velocityPct !== null ? `${velocityPct}% do planejado` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <ShieldAlertIcon className="h-3.5 w-3.5" />
                  Riscos ROAM
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-bold text-2xl">
                  {summary.risksMitigated}/{summary.risksTotal}
                </p>
                <p className="text-muted-foreground text-xs">mitigados</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <ZapIcon className="h-3.5 w-3.5" />
                  Impedimentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-bold text-2xl">
                  {summary.impedimentsResolved}/{summary.impedimentsTotal}
                </p>
                <p className="text-muted-foreground text-xs">resolvidos</p>
              </CardContent>
            </Card>
          </div>

          {/* PI Objectives */}
          {objectives.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">Objetivos PI</h2>
              <ul className="divide-y rounded-lg border">
                {objectives.map((obj) => (
                  <li
                    className="flex items-center justify-between gap-4 px-4 py-3"
                    key={obj.id}
                  >
                    <div>
                      <p className="text-sm">{obj.title}</p>
                      {obj.businessValue !== null && (
                        <p className="text-muted-foreground text-xs">
                          BV {obj.businessValue}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {obj.isStretch && (
                        <Badge variant="outline">Stretch</Badge>
                      )}
                      <Badge
                        variant={
                          (OBJ_STATUS_COLORS[obj.status] as
                            | "default"
                            | "secondary"
                            | "destructive"
                            | "outline") ?? "outline"
                        }
                      >
                        {obj.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Sprint velocity table */}
          {sprints.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">Velocidade por Sprint</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs">
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Sprint</th>
                      <th className="px-4 py-2 text-right">Capacidade</th>
                      <th className="px-4 py-2 text-right">Velocity</th>
                      <th className="px-4 py-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sprints.map((sp) => {
                      const pct =
                        sp.capacity && sp.velocity !== null
                          ? Math.round((sp.velocity / sp.capacity) * 100)
                          : null;
                      return (
                        <tr key={sp.id}>
                          <td className="px-4 py-2 text-muted-foreground text-xs">
                            {sp.teamName}
                          </td>
                          <td className="px-4 py-2">{sp.name}</td>
                          <td className="px-4 py-2 text-right">
                            {sp.capacity ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sp.velocity ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {pct !== null ? (
                              <span
                                className={
                                  pct >= 80
                                    ? "text-green-600"
                                    : pct >= 60
                                      ? "text-amber-600"
                                      : "text-red-600"
                                }
                              >
                                {pct}%
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Risks ROAM */}
          {risks.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">Riscos ROAM</h2>
              <ul className="divide-y rounded-lg border">
                {risks.map((risk) => (
                  <li
                    className="flex items-center justify-between gap-4 px-4 py-3"
                    key={risk.id}
                  >
                    <p className="text-sm">{risk.title}</p>
                    <div className="flex shrink-0 gap-2">
                      {risk.category && (
                        <Badge variant="outline">{risk.category}</Badge>
                      )}
                      <Badge
                        variant={
                          risk.status === "MITIGATED" ? "default" : "secondary"
                        }
                      >
                        {RISK_STATUS_LABELS[risk.status] ?? risk.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Impediments */}
          {impediments.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">
                Impedimentos ({impediments.length})
              </h2>
              <ul className="divide-y rounded-lg border">
                {impediments.map((imp) => (
                  <li
                    className="flex items-center justify-between gap-4 px-4 py-3"
                    key={imp.id}
                  >
                    <p className="text-sm">{imp.title}</p>
                    <Badge
                      variant={
                        imp.status === "RESOLVED" ? "default" : "secondary"
                      }
                    >
                      {imp.status === "RESOLVED" ? (
                        <CheckCircleIcon className="mr-1 h-3 w-3" />
                      ) : null}
                      {imp.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
