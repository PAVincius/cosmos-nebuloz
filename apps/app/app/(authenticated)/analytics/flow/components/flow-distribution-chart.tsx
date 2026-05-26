"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS: Record<string, string> = {
  História: "#6366f1",
  Feature: "#22c55e",
  Defect: "#ef4444",
  Enabler: "#f59e0b",
};

type Props = {
  data: { type: string; count: number; pct: number }[];
};

export function FlowDistributionChart({ data }: Props) {
  return (
    <div className="space-y-3">
      <ResponsiveContainer height={160} width="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis domain={[0, 100]} tickCount={5} type="number" unit="%" />
          <YAxis
            dataKey="type"
            tick={{ fontSize: 12 }}
            type="category"
            width={72}
          />
          <Tooltip formatter={(v: number) => [`${v}%`, "Proporção"]} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell fill={COLORS[d.type] ?? "#94a3b8"} key={d.type} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3">
        {data.map((d) => (
          <span
            className="flex items-center gap-1 text-muted-foreground text-xs"
            key={d.type}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: COLORS[d.type] ?? "#94a3b8" }}
            />
            {d.type}: <strong>{d.pct}%</strong> ({d.count})
          </span>
        ))}
      </div>
    </div>
  );
}
