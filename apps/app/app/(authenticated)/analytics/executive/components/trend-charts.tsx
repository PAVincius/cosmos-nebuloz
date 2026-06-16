"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import { Line, LineChart, XAxis, YAxis } from "recharts";

export type TrendPoint = {
  pi: string;
  predictabilityPct: number;
  cycleTimeDays: number;
  costPerPoint: number | null;
};

type Props = {
  data: TrendPoint[];
};

const predConfig: ChartConfig = {
  predictabilityPct: { label: "Predictability (%)", color: "#3b82f6" },
};
const cycleConfig: ChartConfig = {
  cycleTimeDays: { label: "Cycle Time (days)", color: "#f59e0b" },
};
const costConfig: ChartConfig = {
  costPerPoint: { label: "Cost / Point ($)", color: "#10b981" },
};

export function TrendCharts({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground text-sm">
        No trend data — need at least one completed PI with FlowMetricSnapshots.
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div>
        <p className="mb-2 font-medium text-sm">Predictability</p>
        <ChartContainer className="h-40 w-full" config={predConfig}>
          <LineChart data={data}>
            <XAxis dataKey="pi" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="predictabilityPct"
              dot={false}
              stroke="var(--color-predictabilityPct)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </div>
      <div>
        <p className="mb-2 font-medium text-sm">Cycle Time</p>
        <ChartContainer className="h-40 w-full" config={cycleConfig}>
          <LineChart data={data}>
            <XAxis dataKey="pi" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="cycleTimeDays"
              dot={false}
              stroke="var(--color-cycleTimeDays)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </div>
      <div>
        <p className="mb-2 font-medium text-sm">Cost / Point</p>
        <ChartContainer className="h-40 w-full" config={costConfig}>
          <LineChart data={data}>
            <XAxis dataKey="pi" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="costPerPoint"
              dot={false}
              stroke="var(--color-costPerPoint)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}
