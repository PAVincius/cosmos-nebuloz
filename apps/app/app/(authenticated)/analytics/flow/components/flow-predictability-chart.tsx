"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  history: { label: string; planned: number; delivered: number }[];
  current: number; // 0–1
};

function getPredictabilityColorClass(pct: number): string {
  if (pct >= 80) {
    return "text-emerald-600";
  }
  if (pct >= 60) {
    return "text-amber-500";
  }
  return "text-rose-500";
}

export function FlowPredictabilityChart({ history, current }: Props) {
  const pct = Math.round(current * 100);
  const colorClass = getPredictabilityColorClass(pct);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className={`font-bold text-3xl ${colorClass}`}>{pct}%</span>
        <span className="text-muted-foreground text-sm">
          previsibilidade atual
        </span>
      </div>
      <ResponsiveContainer height={140} width="100%">
        <BarChart
          data={history}
          margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
        >
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar
            dataKey="planned"
            fill="#94a3b8"
            name="Planejado"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="delivered"
            fill="#6366f1"
            name="Entregue"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
