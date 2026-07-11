import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";

const ICON_TARGET =
  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z";
const ICON_TRENDING = "M22 7l-8.5 8.5-5-5L1 18";
const ICON_CHECK = "M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3";
const ICON_SHIELD = "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z";

type PiKpiRowProps = {
  /** Program Predictability (Story-023 PPM), 0-1 fraction — null when not yet computed. */
  ppm: number | null;
  /** PI Completion, 0-1 fraction (denormalized from feature status). */
  completionPct: number;
  currentWeek: number;
  totalWeeks: number;
  objectivesAchieved: number;
  objectivesTotal: number;
  risksOpen: number;
  risksTotal: number;
};

/** Persistent grid4 KPI row (DESIGN.md §3 "Sangria + Sinal Vivo") — shown above every tab. */
export function PiKpiRow({
  ppm,
  completionPct,
  currentWeek,
  totalWeeks,
  objectivesAchieved,
  objectivesTotal,
  risksOpen,
  risksTotal,
}: PiKpiRowProps) {
  const ppmPct = ppm == null ? null : Math.round(ppm * 100);

  return (
    <KpiGrid>
      <KpiCard
        badge={ppmPct == null ? "— Ainda sem dados" : ppmPct >= 80 ? "↗ Acima de 80%" : "— Abaixo da meta"}
        iconPath={ICON_TARGET}
        label="Program Predictability"
        tone={ppmPct == null ? "accent" : ppmPct >= 80 ? "green" : "amber"}
        unit={ppmPct == null ? undefined : "%"}
        value={ppmPct == null ? "—" : ppmPct}
      />
      <KpiCard
        badge={`— Semana ${currentWeek} de ${totalWeeks}`}
        iconPath={ICON_TRENDING}
        label="PI Completion"
        tone="accent"
        unit="%"
        value={Math.round(completionPct * 100)}
      />
      <KpiCard
        badge="— Business value entregue"
        iconPath={ICON_CHECK}
        label="Objectives atingidos"
        tone="blue"
        value={`${objectivesAchieved}/${objectivesTotal}`}
      />
      <KpiCard
        badge={`— ${risksTotal} totais no board`}
        iconPath={ICON_SHIELD}
        label="Risks abertos (ROAM)"
        tone="red"
        value={risksOpen}
      />
    </KpiGrid>
  );
}
