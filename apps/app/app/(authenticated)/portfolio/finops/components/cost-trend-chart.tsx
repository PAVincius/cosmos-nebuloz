"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyTrendRow } from "@/app/actions/billing/cost-summary";

type Props = { data: MonthlyTrendRow[] };

export function CostTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer height={160} width="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="costGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
        <YAxis
          tick={{ fontSize: 10 }}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Custo"]} />
        <Area
          dataKey="cost"
          fill="url(#costGrad)"
          name="Custo"
          stroke="#6366f1"
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
