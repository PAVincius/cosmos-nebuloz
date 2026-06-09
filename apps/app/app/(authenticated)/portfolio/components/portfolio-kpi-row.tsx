import { KpiCard } from "@repo/design-system/components/cosmos/kpi-card";
import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";

// Lucide icon paths (viewBox 0 0 24 24) for the bleeding watermark
const ICON_LAYERS = "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";
const ICON_LIST = "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01";
const ICON_STAR =
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
const ICON_TARGET =
  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z";

type PortfolioKpiRowProps = {
  epics: PortfolioEpic[];
};

export function PortfolioKpiRow({ epics }: PortfolioKpiRowProps) {
  const total = epics.length;
  const totalFeatures = epics.reduce((s, e) => s + e.featureCount, 0);
  const totalOkrs = epics.reduce((s, e) => s + e.linkedOKRCount, 0);

  const wsjfValues = epics.map((e) => e.wsjfScore).filter((v) => v > 0);
  const avgWsjf =
    wsjfValues.length > 0
      ? Math.round(
          (wsjfValues.reduce((s, v) => s + v, 0) / wsjfValues.length) * 10
        ) / 10
      : 0;

  const withInvest = epics.filter((e) => e.investScore !== null).length;
  const investPct = total > 0 ? Math.round((withInvest / total) * 100) : 0;

  const featuresDelta =
    totalFeatures > 0
      ? {
          value: `${Math.round(totalFeatures / Math.max(total, 1))} / épico`,
          positive: true,
        }
      : undefined;
  const wsjfDelta =
    avgWsjf > 0
      ? { value: avgWsjf >= 5 ? "alta" : "média", positive: avgWsjf >= 5 }
      : undefined;
  const okrsDelta =
    totalOkrs > 0
      ? { value: `${investPct}% com INVEST`, positive: investPct >= 50 }
      : undefined;

  return (
    <div className="grid grid-cols-2 gap-[var(--cosmos-gap,16px)] sm:grid-cols-4">
      <KpiCard
        hint="total cadastrado"
        iconPath={ICON_LAYERS}
        label="Épicos no portfólio"
        tone="accent"
        value={total}
      />
      <KpiCard
        delta={featuresDelta}
        hint={`em ${total} épico${total !== 1 ? "s" : ""}`}
        iconPath={ICON_LIST}
        label="Features mapeadas"
        tone="blue"
        value={totalFeatures}
      />
      <KpiCard
        delta={wsjfDelta}
        hint="prioridade ponderada"
        iconPath={ICON_STAR}
        label="WSJF médio"
        tone="amber"
        value={avgWsjf > 0 ? avgWsjf : "—"}
      />
      <KpiCard
        delta={okrsDelta}
        hint={`INVEST coberto ${investPct}%`}
        iconPath={ICON_TARGET}
        label="OKRs vinculados"
        tone="green"
        value={totalOkrs}
      />
    </div>
  );
}
