import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";

const ICON_CHECK = "M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3";
const ICON_TARGET =
  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z";
const ICON_TRENDING = "M22 7l-8.5 8.5-5-5L1 18";
const ICON_DOLLAR =
  "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6";

type ArtKpiRowProps = {
  confidenceAvg?: number;
  ppm?: number;
  historicalPpm?: number;
  budgetSpentM?: number;
  budgetAllocatedM?: number;
};

export function ArtKpiRow({
  confidenceAvg = 4.1,
  ppm = 92,
  historicalPpm = 91,
  budgetSpentM = 1.62,
  budgetAllocatedM = 2.4,
}: ArtKpiRowProps) {
  const confidenceTone =
    confidenceAvg >= 3.5 ? "green" : confidenceAvg >= 3 ? "amber" : "red";
  const confidenceAbove = confidenceAvg >= 3.5;
  const ppmTone = ppm >= 80 ? "green" : "amber";
  const historicalPpmTone = historicalPpm >= 80 ? "green" : "amber";
  const budgetUtilization = (budgetSpentM / budgetAllocatedM) * 100;
  const budgetTone =
    budgetUtilization > 90 ? "red" : budgetUtilization >= 75 ? "amber" : "green";
  const budgetBadge = `— de US$ ${budgetAllocatedM.toFixed(2)}M alocado`;

  return (
    <KpiGrid>
      <KpiCard
        badge={confidenceAbove ? "↗ Acima do threshold" : "— Atenção"}
        iconPath={ICON_CHECK}
        label="Confidence Vote"
        tone={confidenceTone}
        unit="/5"
        value={confidenceAvg.toFixed(1)}
      />
      <KpiCard
        badge="— PPM do PI atual"
        iconPath={ICON_TARGET}
        label="Program Predictability"
        tone={ppmTone}
        unit="%"
        value={ppm}
      />
      <KpiCard
        badge="— Últimos PIs"
        iconPath={ICON_TRENDING}
        label="Predictability histórica"
        tone={historicalPpmTone}
        unit="%"
        value={historicalPpm}
      />
      <KpiCard
        badge={budgetBadge}
        iconPath={ICON_DOLLAR}
        label="Budget consumido"
        tone={budgetTone}
        unit="M"
        value={`US$ ${budgetSpentM.toFixed(2)}`}
      />
    </KpiGrid>
  );
}
