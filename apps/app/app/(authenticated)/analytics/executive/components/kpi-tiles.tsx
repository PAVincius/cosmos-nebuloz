"use client";

import { Card, CardContent } from "@repo/design-system/components/ui/card";
import type { KpiTiles as KpiTilesData } from "@/lib/analytics/executive-dashboard";

type Props = {
  kpis: KpiTilesData;
};

const tiles = (kpis: KpiTilesData) => [
  {
    label: "Predictability",
    value: `${kpis.predictabilityPct}%`,
    desc: "PI objectives achieved (avg)",
  },
  {
    label: "Flow Efficiency",
    value: `${kpis.flowEfficiency}%`,
    desc: "Active vs total flow time",
  },
  {
    label: "Cycle Time",
    value: `${kpis.cycleTimeDays}d`,
    desc: "Median story cycle time",
  },
  {
    label: "Cost / Point",
    value: kpis.costPerPoint != null ? `$${kpis.costPerPoint}` : "—",
    desc: "Phase 2 (FinOps integration)",
  },
  {
    label: "Action Rate",
    value: `${kpis.actionCompletionRate}%`,
    desc: "Retro action items completed",
  },
  {
    label: "Active ARTs",
    value: String(kpis.activeARTsCount),
    desc: "Currently active trains",
  },
];

export function KpiTilesGrid({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {tiles(kpis).map((t) => (
        <Card key={t.label}>
          <CardContent className="pt-5">
            <p className="text-muted-foreground text-xs">{t.label}</p>
            <p className="mt-1 font-semibold text-2xl tabular-nums">
              {t.value}
            </p>
            <p className="mt-1 text-muted-foreground text-xs">{t.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
