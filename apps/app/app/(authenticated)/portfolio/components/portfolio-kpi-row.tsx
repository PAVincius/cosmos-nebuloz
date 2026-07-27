import { KpiCard } from "@repo/design-system/components/cosmos/kpi-card";
import type { PortfolioOverviewData } from "@/app/actions/portfolio/overview";

const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_EPICS = "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";
const ICON_BUDGET = "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6";
const ICON_TARGET =
  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z";

type PortfolioKpiRowProps = {
  data: PortfolioOverviewData;
};

export function PortfolioKpiRow({ data }: PortfolioKpiRowProps) {
  const {
    throughputSP,
    activeEpics,
    totalEpics,
    budgetSpentM,
    budgetAllocatedM,
    piCurrentWeek,
    piTotalWeeks,
    artHealth,
  } = data;

  const budgetPct =
    budgetAllocatedM > 0
      ? Math.round((budgetSpentM / budgetAllocatedM) * 100)
      : 0;

  const piPct =
    piCurrentWeek !== null
      ? Math.round((piCurrentWeek / piTotalWeeks) * 100)
      : null;

  const activeArtsCount = artHealth.length;

  return (
    <div className="grid grid-cols-2 gap-[var(--cosmos-gap,16px)] sm:grid-cols-4">
      <KpiCard
        delta={{ value: "+14% vs PI anterior", positive: true }}
        hint="throughput médio"
        iconPath={ICON_ACTIVITY}
        label="Throughput médio (SP/PI)"
        tone="green"
        unit="SP"
        value={throughputSP > 0 ? throughputSP : "—"}
      />
      <KpiCard
        hint={`${activeArtsCount} ARTs em execução`}
        iconPath={ICON_EPICS}
        label="Épicos ativos no portfolio"
        tone="accent"
        unit={`/ ${totalEpics}`}
        value={activeEpics}
      />
      <KpiCard
        hint={
          budgetAllocatedM > 0
            ? `— ${budgetPct}% do alocado`
            : "— Sem budget configurado"
        }
        iconPath={ICON_BUDGET}
        label="Budget consumido (período)"
        tone="amber"
        unit="M"
        value={
          budgetSpentM > 0
            ? `US$ ${budgetSpentM.toFixed(2).replace(".", ",")}`
            : "US$ —"
        }
      />
      <KpiCard
        hint={
          piCurrentWeek !== null
            ? `semana ${piCurrentWeek} de ${piTotalWeeks}`
            : "— Sem PI ativo"
        }
        iconPath={ICON_TARGET}
        label="PI Completion"
        tone="purple"
        unit="%"
        value={piPct !== null ? piPct : "—"}
      />
    </div>
  );
}
