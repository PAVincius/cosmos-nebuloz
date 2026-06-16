"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  PortfolioCFDData,
  PortfolioDistribution,
} from "@/app/actions/analytics/portfolio-cfd";

const STATUS_COLORS: Record<string, string> = {
  FUNNEL: "hsl(var(--chart-1))",
  ANALYZING: "hsl(var(--chart-2))",
  PORTFOLIO_BACKLOG: "hsl(var(--chart-3))",
  IMPLEMENTING: "hsl(var(--chart-4))",
  DONE: "hsl(var(--chart-5))",
  REJECTED: "hsl(220 5% 65%)",
};

function DistributionChart({ data }: { data: PortfolioDistribution[] }) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">Distribuição Atual por Status</h3>
      <ResponsiveContainer height={220} width="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 16, right: 24, top: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis allowDecimals={false} type="number" />
          <YAxis dataKey="label" type="category" width={110} />
          <Tooltip
            formatter={(v: number) => [v, "Épicos"]}
            labelFormatter={(l: string) => l}
          />
          <Bar dataKey="count" maxBarSize={28} radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell
                fill={STATUS_COLORS[d.status] ?? "hsl(var(--chart-1))"}
                key={d.status}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendChart({
  data,
}: {
  data: { date: string; velocity: number; load: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Sem histórico de snapshots para este escopo.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">
        Throughput vs. WIP ao Longo do Tempo
      </h3>
      <ResponsiveContainer height={220} width="100%">
        <LineChart
          data={data}
          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line
            dataKey="velocity"
            dot={false}
            name="Throughput"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            type="monotone"
          />
          <Line
            dataKey="load"
            dot={false}
            name="WIP"
            stroke="hsl(var(--chart-4))"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PortfolioCFDChart({ data }: { data: PortfolioCFDData }) {
  return (
    <div className="space-y-8">
      <DistributionChart data={data.distribution} />
      <TrendChart data={data.trend} />
    </div>
  );
}
