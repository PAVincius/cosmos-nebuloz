import { requireTenantSession } from "@repo/auth/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getExecutiveDashboard } from "@/app/actions/analytics/executive";
import { getExecutiveTrends } from "@/app/actions/analytics/executive-trends";
import { AnomalyFeed } from "./components/anomaly-feed";
import { ArtHealthTable } from "./components/art-health-table";
import { KpiTilesGrid as KpiTiles } from "./components/kpi-tiles";
import { TrendCharts } from "./components/trend-charts";

export const metadata: Metadata = { title: "Executive Dashboard" };

export default async function ExecutiveDashboardPage() {
  await requireTenantSession(await headers());

  const [dashResult, trendsResult] = await Promise.all([
    getExecutiveDashboard(),
    getExecutiveTrends(),
  ]);

  if (!dashResult.ok) {
    return (
      <div className="p-8 text-center text-red-500">{dashResult.error}</div>
    );
  }

  const { kpis, artTable, anomalyFeed } = dashResult.data;
  const trends = trendsResult.ok ? trendsResult.data : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl">Executive Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Organization-wide SAFe health overview
        </p>
      </div>

      <KpiTiles kpis={kpis} />

      <Card>
        <CardHeader>
          <CardTitle>Trend — Last 6 PIs</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendCharts data={trends} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ART Health</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ArtHealthTable rows={artTable} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <AnomalyFeed items={anomalyFeed} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
