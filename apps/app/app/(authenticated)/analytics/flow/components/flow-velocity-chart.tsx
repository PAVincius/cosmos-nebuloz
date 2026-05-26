"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: { label: string; total: number }[];
};

export function FlowVelocityChart({ data }: Props) {
  return (
    <ResponsiveContainer height={140} width="100%">
      <AreaChart
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
      >
        <defs>
          <linearGradient id="velGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Area
          dataKey="total"
          fill="url(#velGrad)"
          name="Velocity"
          stroke="#6366f1"
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
