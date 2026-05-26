"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BudgetOverviewItem } from "@/app/actions/billing/snapshots";

type Props = {
  snapshots: BudgetOverviewItem[];
  planned: number;
};

export function CostTrendChart({ snapshots, planned }: Props) {
  const data = [...snapshots]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((s) => ({
      date: new Date(s.period).toLocaleDateString("pt-BR", {
        month: "short",
        day: "numeric",
      }),
      actual: Number(s.actualCost.toFixed(2)),
    }));

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);

  const dailyBudget = data.length > 0 ? planned / data.length : 0;

  return (
    <div className="rounded-lg border p-6">
      <h3 className="mb-4 font-medium text-sm">Tendência de Custo (90 dias)</h3>
      <ResponsiveContainer height={240} width="100%">
        <AreaChart data={data}>
          <CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={80} />
          <Tooltip formatter={(v: unknown) => fmt(v as number)} />
          <ReferenceLine
            label={{ value: "Budget/dia", fontSize: 11, fill: "#f59e0b" }}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            y={dailyBudget}
          />
          <Area
            dataKey="actual"
            fill="#6366f1"
            fillOpacity={0.1}
            stroke="#6366f1"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
