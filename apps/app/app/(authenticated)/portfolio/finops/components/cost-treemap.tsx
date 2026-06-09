"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import type { ThemeCostRow } from "@/app/actions/billing/cost-summary";

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type Props = { data: ThemeCostRow[] };

export function CostTreemap({ data }: Props) {
  const treemapData = data.map((d, i) => ({
    name: d.themeName,
    size: d.cost,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <ResponsiveContainer height={280} width="100%">
      <Treemap data={treemapData} dataKey="size" nameKey="name">
        <Tooltip formatter={(v: number) => formatUSD(v)} />
      </Treemap>
    </ResponsiveContainer>
  );
}
