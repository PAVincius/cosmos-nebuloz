import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";

const ICON_INVEST = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_WSJF = "M22 7l-8.5 8.5-5-5L1 18";
const ICON_BUDGET = "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6";
const ICON_FEATURES = "M3 3h18v18H3zM3 9h18M9 21V9";

type EpicKpiRowProps = {
  investScore: number;
  avgWSJF: number;
  leanBudgetAllocation: number | null;
  featuresDone: number;
  featuresCount: number;
};

export function EpicKpiRow({
  investScore,
  avgWSJF,
  leanBudgetAllocation,
  featuresDone,
  featuresCount,
}: EpicKpiRowProps) {
  const investReady = investScore >= 70;
  const featurePct =
    featuresCount > 0 ? Math.round((featuresDone / featuresCount) * 100) : 0;
  const budgetValue = leanBudgetAllocation
    ? leanBudgetAllocation.toFixed(2)
    : "0.00";

  return (
    <KpiGrid>
      <KpiCard
        badge={investReady ? "↗ Pronto para PI" : "— Em análise"}
        iconPath={ICON_INVEST}
        label="INVEST Score"
        tone={investReady ? "green" : "amber"}
        value={Math.round(investScore)}
      />
      <KpiCard
        badge="— Prioridade relativa"
        iconPath={ICON_WSJF}
        label="WSJF"
        tone="blue"
        value={avgWSJF > 0 ? avgWSJF.toFixed(1) : "—"}
      />
      <KpiCard
        badge="— Capital comprometido"
        iconPath={ICON_BUDGET}
        label="Lean Budget alocado"
        tone="amber"
        unit="M"
        value={`US$ ${budgetValue}`}
      />
      <KpiCard
        badge={`— ${featurePct}% do épico`}
        iconPath={ICON_FEATURES}
        label="Features concluídas"
        tone="accent"
        value={`${featuresDone}/${featuresCount}`}
      />
    </KpiGrid>
  );
}
