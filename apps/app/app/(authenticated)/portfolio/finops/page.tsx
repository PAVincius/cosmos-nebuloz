import { PageHeader } from "@/app/(authenticated)/components/page-header";
import {
  costSummaryByTheme,
  costTrendByMonth,
} from "@/app/actions/billing/cost-summary";
import { appDesign } from "@/lib/app-design";
import { CostAllocationTable } from "./components/cost-allocation-table";
import { CostTreemap } from "./components/cost-treemap";
import { CostTrendChart } from "./components/cost-trend-chart";
import { UnmappedCostAlert } from "./components/unmapped-cost-alert";

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function FinOpsPage() {
  const [summary, trend] = await Promise.all([
    costSummaryByTheme(),
    costTrendByMonth(6),
  ]);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "FinOps" },
        ]}
        subtitle="Alocação por Tema Estratégico · Padrão FOCUS v1.1"
        title="FinOps — Custo de Nuvem"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          <UnmappedCostAlert
            unmappedCost={summary.unmappedCost}
            unmappedPct={summary.unmappedPct}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                label: "Custo Total",
                value: formatUSD(summary.totalCost),
                color: "",
              },
              {
                label: "Temas Mapeados",
                value: String(summary.mapped.length),
                color: "",
              },
              {
                label: "Não Mapeado",
                value: `${summary.unmappedPct}%`,
                color: "text-amber-600",
              },
            ].map(({ label, value, color }) => (
              <div
                className="rounded-xl border border-hairline bg-surface p-4 shadow-[var(--card-shadow)]"
                key={label}
              >
                <p className="font-medium text-muted-foreground text-xs">
                  {label}
                </p>
                <p className={`mt-1 font-bold text-3xl ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-hairline bg-surface p-4 shadow-[var(--card-shadow)]">
              <h2 className="mb-3 font-semibold text-sm">
                Distribuição por Tema
              </h2>
              <CostTreemap data={summary.mapped} />
            </div>
            <div className="rounded-xl border border-hairline bg-surface p-4 shadow-[var(--card-shadow)]">
              <h2 className="mb-3 font-semibold text-sm">Tendência Mensal</h2>
              <CostTrendChart data={trend} />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 font-semibold text-sm">
              Alocação por Tema Estratégico
            </h2>
            <CostAllocationTable
              rows={summary.mapped}
              totalCost={summary.totalCost}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
