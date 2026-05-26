"use client";

import type { BudgetOverviewItem } from "@/app/actions/billing/snapshots";
import type { LeanBudgetWithStats } from "@/app/actions/lean-budget";
import { CostBreakdownCard } from "./cost-breakdown-card";
import { CostTrendChart } from "./cost-trend-chart";

type Props = {
  budget: LeanBudgetWithStats;
  snapshots: BudgetOverviewItem[];
};

function getProgressColor(isOverBudget: boolean, isNearLimit: boolean): string {
  if (isOverBudget) {
    return "bg-destructive";
  }
  if (isNearLimit) {
    return "bg-amber-500";
  }
  return "bg-primary";
}

export function BudgetDetail({ budget, snapshots }: Props) {
  const themeSnapshots = snapshots.filter((s) => s.themeId === budget.themeId);
  const totalCloud = themeSnapshots.reduce((s, r) => s + r.cloudCost, 0);
  const totalActual = themeSnapshots.reduce((s, r) => s + r.actualCost, 0);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD",
    }).format(v);

  const progressColor = getProgressColor(
    budget.isOverBudget,
    budget.isNearLimit
  );

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main — 8 cols */}
      <div className="col-span-8 space-y-6">
        <CostBreakdownCard
          cloudCost={totalCloud}
          peopleCost={0}
          planned={budget.amount}
          saasCost={0}
        />
        <CostTrendChart planned={budget.amount} snapshots={themeSnapshots} />
      </div>

      {/* Side — 4 cols */}
      <div className="col-span-4 space-y-4">
        <div className="rounded-lg border p-4">
          <p className="font-medium text-sm">Orçamento</p>
          <p className="mt-1 font-bold text-2xl tabular-nums">
            {fmt(budget.amount)}
          </p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${progressColor}`}
              style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            {budget.percentUsed.toFixed(1)}% utilizado
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="mb-2 font-medium text-sm">Real vs Planejado</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Real</span>
            <span className="font-medium tabular-nums">{fmt(totalActual)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Planejado</span>
            <span className="tabular-nums">{fmt(budget.amount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
