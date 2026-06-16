"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CycleTimeData } from "@/app/actions/analytics/cycle-time";

type Props = { data: CycleTimeData };

export function CycleTimeChart({ data }: Props) {
  if (data.points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Sem histórico de cycle time para este escopo.
      </p>
    );
  }

  // Recharts ScatterChart expects numeric x — convert date to timestamp
  const chartData = data.points.map((p) => ({
    ...p,
    x: new Date(p.completedAt).getTime(),
    y: p.cycleTimeDays,
    r: Math.max(4, p.storyPoints * 2),
  }));

  const minX = Math.min(...chartData.map((p) => p.x));
  const maxX = Math.max(...chartData.map((p) => p.x));

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString("pt-BR", {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-muted-foreground text-xs">Stories analisadas</p>
          <p className="font-semibold text-lg">{data.points.length}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">P50 (mediana)</p>
          <p className="font-semibold text-lg">{data.p50}d</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">P85</p>
          <p className="font-semibold text-amber-500 text-lg">{data.p85}d</p>
        </div>
      </div>

      <ResponsiveContainer height={280} width="100%">
        <ScatterChart margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            domain={[minX, maxX]}
            name="Data"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => formatDate(v)}
            type="number"
          />
          <YAxis
            dataKey="y"
            label={{
              value: "dias",
              angle: -90,
              position: "insideLeft",
              fontSize: 10,
            }}
            name="Cycle Time"
            type="number"
          />
          <Tooltip
            content={({ payload }) => {
              const p = payload?.[0]?.payload as
                | (typeof chartData)[0]
                | undefined;
              if (!p) {
                return null;
              }
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-muted-foreground">
                    {p.cycleTimeDays}d · {p.storyPoints} SP · {p.completedAt}
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine
            label={{ value: "P85", position: "right", fontSize: 10 }}
            stroke="hsl(var(--chart-4))"
            strokeDasharray="4 4"
            y={data.p85}
          />
          <ReferenceLine
            label={{ value: "P50", position: "right", fontSize: 10 }}
            stroke="hsl(var(--chart-3))"
            strokeDasharray="4 4"
            y={data.p50}
          />
          <Scatter
            data={chartData}
            fill="hsl(var(--chart-1))"
            fillOpacity={0.7}
            name="Story"
          />
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-muted-foreground">
        Tamanho do ponto proporcional ao story points. Linha amarela = P85.
      </p>
    </div>
  );
}
