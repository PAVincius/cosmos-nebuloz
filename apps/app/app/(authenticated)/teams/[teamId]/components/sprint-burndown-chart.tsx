"use client";

import { Activity, TrendingUp, Zap } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BurndownPoint = {
  day: number;
  label: string;
  ideal: number;
  actual: number | null;
  completed: number;
  inProgress: number;
};

type MemberVelocityStat = {
  userId: string;
  name: string;
  avgSPPerSprint: number;
  totalSPCompleted: number;
};

type SprintBurndownChartProps = {
  burndownData: BurndownPoint[];
  memberStats?: MemberVelocityStat[];
  sprintLengthDays: number;
  teamVelocity?: number;
  teamName: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatSP(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toLocaleString("pt-BR");
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

type MetricCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
};

function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: "var(--surface-2)" }}
      >
        <span style={{ color: "var(--accent-2)" }}>{icon}</span>
      </div>
      <div className="flex min-w-0 flex-col">
        <span
          className="truncate font-medium text-xs uppercase tracking-wide"
          style={{ color: "var(--text-faint)", letterSpacing: "0.08em" }}
        >
          {label}
        </span>
        <span
          className="font-semibold text-xl tabular-nums"
          style={{
            fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
            color: "var(--text)",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

type TooltipPayloadEntry = {
  name: string;
  value: number | null;
  color: string;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!(active && payload) || payload.length === 0) {
    return null;
  }

  const labelMap: Record<string, string> = {
    ideal: "Ideal",
    actual: "Real",
    completed: "Completado",
  };

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--surface-2)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <p className="mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      {payload.map((entry) => {
        if (entry.value === null || entry.value === undefined) {
          return null;
        }
        return (
          <div className="flex items-center gap-2" key={entry.name}>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: entry.color }}
            />
            <span style={{ color: "var(--text-muted)" }}>
              {labelMap[entry.name] ?? entry.name}:
            </span>
            <span
              className="ml-auto pl-2 font-semibold tabular-nums"
              style={{
                fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
                color: "var(--text)",
              }}
            >
              {entry.value} SP
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Member Velocity Table
// ---------------------------------------------------------------------------

type MemberVelocityTableProps = {
  memberStats: MemberVelocityStat[];
};

function MemberVelocityTable({ memberStats }: MemberVelocityTableProps) {
  if (memberStats.length === 0) {
    return null;
  }

  const maxAvg = Math.max(...memberStats.map((m) => m.avgSPPerSprint), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--border)" }}>
            {(
              [
                "Membro",
                "SP Completados",
                "Média SP/Sprint",
                "Contribuição",
              ] as const
            ).map((header) => (
              <th
                className="pb-2 text-left font-medium text-xs uppercase tracking-wide"
                key={header}
                style={{
                  color: "var(--text-faint)",
                  letterSpacing: "0.08em",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {memberStats.map((member) => {
            const contributionPct =
              maxAvg > 0
                ? Math.round((member.avgSPPerSprint / maxAvg) * 100)
                : 0;
            return (
              <tr
                className="border-b transition-colors"
                key={member.userId}
                style={{
                  borderColor: "var(--border)",
                }}
              >
                {/* Membro */}
                <td className="py-2.5 pr-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-semibold text-xs"
                      style={{
                        background: "var(--surface-3)",
                        color: "var(--accent-2)",
                      }}
                    >
                      {getInitials(member.name)}
                    </div>
                    <span
                      className="truncate font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {member.name}
                    </span>
                  </div>
                </td>

                {/* SP Completados */}
                <td className="py-2.5 pr-4">
                  <span
                    className="tabular-nums"
                    style={{
                      fontFamily:
                        "var(--font-geist-mono, 'Geist Mono', monospace)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {formatSP(member.totalSPCompleted)}
                  </span>
                </td>

                {/* Média SP/Sprint */}
                <td className="py-2.5 pr-4">
                  <span
                    className="tabular-nums"
                    style={{
                      fontFamily:
                        "var(--font-geist-mono, 'Geist Mono', monospace)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {member.avgSPPerSprint.toFixed(1)}
                  </span>
                </td>

                {/* Contribuição (progress bar) */}
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 w-24 overflow-hidden rounded-full"
                      style={{ background: "rgba(124,108,255,0.15)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${contributionPct}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                    <span
                      className="text-xs tabular-nums"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {contributionPct}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SprintBurndownChart({
  burndownData,
  memberStats,
  sprintLengthDays: _sprintLengthDays,
  teamVelocity,
  teamName: _teamName,
}: SprintBurndownChartProps) {
  // --- Derived values ---
  const hasData = burndownData.length > 0;
  const lastPoint = hasData ? burndownData.at(-1) : null;
  const sprintStarted = hasData && burndownData.some((p) => p.actual !== null);

  const currentCompleted = lastPoint?.completed ?? 0;
  const currentInProgress = lastPoint?.inProgress ?? 0;

  // --- Empty states ---
  if (!hasData) {
    return (
      <div
        className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Sem dados de sprint disponíveis
        </p>
      </div>
    );
  }

  if (!sprintStarted) {
    return (
      <div
        className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Sprint não iniciada
        </p>
      </div>
    );
  }

  // --- Chart data: filter nulls for the "actual" line by splitting ---
  // We still pass the full array but recharts skips null values via
  // connectNulls={false} — nulls become gaps which is correct for future days.
  const chartData = burndownData;

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>
        Burndown da Sprint Atual
      </p>

      {/* Section 1: Velocity summary row */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <MetricCard
          icon={<Zap size={16} />}
          label="Velocidade do Time"
          value={
            teamVelocity !== undefined
              ? `${teamVelocity} SP/sprint`
              : "— SP/sprint"
          }
        />
        <MetricCard
          icon={<TrendingUp size={16} />}
          label="Entregues (sprint atual)"
          value={`${formatSP(currentCompleted)} SP`}
        />
        <MetricCard
          icon={<Activity size={16} />}
          label="Em andamento"
          value={`${formatSP(currentInProgress)} SP`}
        />
      </div>

      {/* Section 2: Burndown Area Chart */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <ResponsiveContainer height={220} width="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <defs>
              {/* Gradient for actual burndown */}
              <linearGradient id="gradActual" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--primary, 262 83% 70%))"
                  stopOpacity={0.25}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--primary, 262 83% 70%))"
                  stopOpacity={0}
                />
              </linearGradient>
              {/* Gradient for completed */}
              <linearGradient id="gradCompleted" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              axisLine={false}
              dataKey="label"
              interval="preserveStartEnd"
              tick={{
                fontSize: 11,
                fill: "var(--text-faint)",
                fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
              }}
              tickLine={false}
            />

            <YAxis
              axisLine={false}
              tick={{
                fontSize: 11,
                fill: "var(--text-faint)",
                fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
              }}
              tickFormatter={(v: number) => `${v}`}
              tickLine={false}
              width={40}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "rgba(255,255,255,0.08)",
                strokeWidth: 1,
              }}
            />

            <ReferenceLine
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={1}
              y={0}
            />

            {/* Ideal line (dashed, muted) */}
            <Area
              activeDot={false}
              connectNulls
              dataKey="ideal"
              dot={false}
              fill="none"
              stroke="var(--text-faint)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              strokeWidth={1.5}
              type="linear"
            />

            {/* Completed (cumulative SP done) */}
            <Area
              activeDot={{ r: 3, fill: "#22c55e" }}
              connectNulls
              dataKey="completed"
              dot={false}
              fill="url(#gradCompleted)"
              stroke="#22c55e"
              strokeWidth={1.5}
              type="monotone"
            />

            {/* Actual remaining (primary, filled) */}
            <Area
              activeDot={{
                r: 4,
                fill: "var(--accent)",
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
              connectNulls={false}
              dataKey="actual"
              dot={false}
              fill="url(#gradActual)"
              stroke="var(--accent)"
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {(
            [
              { color: "var(--text-faint)", label: "Ideal", dashed: true },
              { color: "var(--accent)", label: "Real", dashed: false },
              { color: "#22c55e", label: "Completado", dashed: false },
            ] as const
          ).map((item) => (
            <div className="flex items-center gap-1.5" key={item.label}>
              <svg className="shrink-0" height="8" width="16">
                <line
                  stroke={item.color}
                  strokeDasharray={item.dashed ? "3 2" : undefined}
                  strokeOpacity={item.dashed ? 0.6 : 1}
                  strokeWidth="1.5"
                  x1="0"
                  x2="16"
                  y1="4"
                  y2="4"
                />
              </svg>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Member velocity table */}
      {memberStats && memberStats.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          <p
            className="mb-3 font-medium text-xs uppercase tracking-wide"
            style={{
              color: "var(--text-faint)",
              letterSpacing: "0.08em",
            }}
          >
            Velocidade por Membro
          </p>
          <MemberVelocityTable memberStats={memberStats} />
        </div>
      )}
    </div>
  );
}
