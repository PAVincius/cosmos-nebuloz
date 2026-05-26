import {
  costSummaryByTheme,
  costTrendByMonth,
} from "@/app/actions/billing/cost-summary";
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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">FinOps — Custo de Nuvem</h1>
        <p className="text-sm text-muted-foreground">
          Alocação por Tema Estratégico · Padrão FOCUS v1.1
        </p>
      </div>

      <UnmappedCostAlert
        unmappedPct={summary.unmappedPct}
        unmappedCost={summary.unmappedCost}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Custo Total", value: formatUSD(summary.totalCost), color: "" },
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
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Distribuição por Tema</h2>
          <CostTreemap data={summary.mapped} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Tendência Mensal</h2>
          <CostTrendChart data={trend} />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Alocação por Tema Estratégico
        </h2>
        <CostAllocationTable
          rows={summary.mapped}
          totalCost={summary.totalCost}
        />
      </div>
    </div>
  );
}
