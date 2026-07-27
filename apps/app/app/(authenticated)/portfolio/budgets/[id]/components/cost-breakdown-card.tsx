"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type Props = {
  cloudCost: number;
  peopleCost: number;
  saasCost: number;
};

const COLORS = ["#6366f1", "#22c55e", "#f59e0b"];

export function CostBreakdownCard({ cloudCost, peopleCost, saasCost }: Props) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD",
    }).format(v);

  const data = [
    { name: "Cloud", value: cloudCost },
    { name: "Pessoas", value: peopleCost },
    { name: "SaaS", value: saasCost },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-muted-foreground">
        <p className="text-sm">Sem dados de custo para este período.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <h3 className="mb-4 font-medium text-sm">Composição de Custo</h3>
      <ResponsiveContainer height={200} width="100%">
        <PieChart>
          <Pie
            cx="50%"
            cy="50%"
            data={data}
            dataKey="value"
            innerRadius={60}
            outerRadius={90}
          >
            {data.map((_, i) => (
              <Cell fill={COLORS[i % COLORS.length]} key={i} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => (typeof v === "number" ? fmt(v) : String(v))}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
