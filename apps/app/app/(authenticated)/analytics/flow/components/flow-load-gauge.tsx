"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  current: number;
  history: { label: string; wip: number }[];
  wipLimit?: number;
};

export function FlowLoadGauge({ current, history, wipLimit }: Props) {
  const isOverloaded = wipLimit !== undefined ? current > wipLimit : false;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span
          className={`font-bold text-3xl ${isOverloaded ? "text-rose-500" : "text-foreground"}`}
        >
          {current}
        </span>
        <span className="text-muted-foreground text-sm">
          itens em andamento
        </span>
        {isOverloaded ? (
          <span className="font-medium text-rose-500 text-xs">
            ⚠ acima do limite WIP
          </span>
        ) : null}
      </div>
      <ResponsiveContainer height={80} width="100%">
        <LineChart
          data={history}
          margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
        >
          <XAxis dataKey="label" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip />
          {wipLimit !== undefined ? (
            <ReferenceLine
              label={{ value: "Limite", fontSize: 9 }}
              stroke="#ef4444"
              strokeDasharray="4 2"
              y={wipLimit}
            />
          ) : null}
          <Line
            dataKey="wip"
            dot={false}
            stroke="#f59e0b"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
