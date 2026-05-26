"use client";

import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

type Props = {
  value: number; // 0–1
};

function getEfficiencyColor(pct: number): string {
  if (pct >= 60) {
    return "#22c55e";
  }
  if (pct >= 40) {
    return "#f59e0b";
  }
  return "#ef4444";
}

export function FlowEfficiencyGauge({ value }: Props) {
  const pct = Math.round(value * 100);
  const color = getEfficiencyColor(pct);

  return (
    <div className="relative flex flex-col items-center">
      <ResponsiveContainer height={160} width={160}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          data={[{ value: pct, fill: color }]}
          endAngle={-270}
          innerRadius="60%"
          outerRadius="90%"
          startAngle={90}
        >
          <RadialBar
            background={{ fill: "#e2e8f0" }}
            cornerRadius={8}
            dataKey="value"
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-2xl" style={{ color }}>
          {pct}%
        </span>
        <span className="text-muted-foreground text-xs">eficiência</span>
      </div>
      <p className="max-w-32 text-center text-muted-foreground text-xs">
        Tempo ativo / tempo total de ciclo
      </p>
    </div>
  );
}
