"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PIBurnupData } from "@/app/actions/analytics/pi-burnup";

type Props = { data: PIBurnupData };

export function PIBurnupChart({ data }: Props) {
  if (data.points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Sem dados de sprint para este PI.
      </p>
    );
  }

  const completionPct =
    data.totalPlanned > 0
      ? Math.round((data.totalActual / data.totalPlanned) * 100)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-muted-foreground text-xs">Planejado total</p>
          <p className="font-semibold text-lg">{data.totalPlanned} pts</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Realizado total</p>
          <p className="font-semibold text-lg">{data.totalActual} pts</p>
        </div>
        {completionPct !== null && (
          <div>
            <p className="text-muted-foreground text-xs">
              Velocidade vs. capacidade
            </p>
            <p
              className={`font-semibold text-lg ${
                completionPct >= 80
                  ? "text-green-500"
                  : completionPct >= 60
                    ? "text-amber-500"
                    : "text-red-500"
              }`}
            >
              {completionPct}%
            </p>
          </div>
        )}
      </div>

      <ResponsiveContainer height={280} width="100%">
        <LineChart
          aria-label="Burnup do PI"
          data={data.points}
          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="sprintName"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) => v.split(" ").at(-1) ?? v}
          />
          <YAxis allowDecimals={false} />
          <Tooltip
            formatter={(v: number, name: string) => [
              `${v} pts`,
              name === "plannedCumulative" ? "Planejado" : "Realizado",
            ]}
          />
          <Legend
            formatter={(v: string) =>
              v === "plannedCumulative"
                ? "Planejado (acumulado)"
                : "Realizado (acumulado)"
            }
          />
          <ReferenceLine
            label={{ value: "Meta", position: "right", fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            y={data.totalPlanned}
          />
          <Line
            dataKey="plannedCumulative"
            dot={false}
            name="plannedCumulative"
            stroke="hsl(var(--chart-3))"
            strokeDasharray="5 3"
            strokeWidth={2}
            type="monotone"
          />
          <Line
            dataKey="actualCumulative"
            dot={{ r: 3 }}
            name="actualCumulative"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
