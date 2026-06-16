"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  MinusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TeamVelocitySummary } from "@/app/actions/velocity/types";

function TrendIcon({ trend }: { trend: "up" | "down" | "neutral" }) {
  if (trend === "up") {
    return (
      <TrendingUpIcon className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
    );
  }
  if (trend === "down") {
    return (
      <TrendingDownIcon className="h-3.5 w-3.5 text-[hsl(var(--destructive))]" />
    );
  }
  return <MinusIcon className="h-3.5 w-3.5 text-muted-foreground" />;
}

function sparkColor(trend: "up" | "down" | "neutral") {
  return trend === "up"
    ? "hsl(var(--success))"
    : trend === "down"
      ? "hsl(var(--destructive))"
      : "hsl(var(--muted-foreground))";
}

type Props = {
  teams: TeamVelocitySummary[];
  arts: { id: string; name: string }[];
};

export function VelocityDashboard({ teams, arts }: Props) {
  const [filterArt, setFilterArt] = useState("ALL");

  const filtered =
    filterArt === "ALL" ? teams : teams.filter((t) => t.artId === filterArt);

  // Multi-team sprint series for line chart
  const sprintLabels = filtered[0]?.sprints.map((s) => s.label) ?? [];
  const lineData = sprintLabels.map((label, idx) => {
    const entry: Record<string, string | number> = { sprint: label };
    for (const t of filtered.slice(0, 6)) {
      entry[t.teamName] = t.sprints[idx]?.sp ?? 0;
    }
    return entry;
  });

  const teamColors = [
    "hsl(var(--primary))",
    "hsl(var(--success))",
    "oklch(0.68 0.18 50)",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-2))",
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Filter */}
      {arts.length > 1 && (
        <div className="flex items-center gap-3">
          <Select onValueChange={setFilterArt} value={filterArt}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Filtrar ART" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os ARTs</SelectItem>
              {arts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs">
            {filtered.length} time(s)
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <ZapIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Nenhum time encontrado
          </p>
        </div>
      ) : (
        <>
          {/* Team cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((team) => (
              <div
                className="space-y-3 rounded-lg border p-4"
                key={team.teamId}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm">
                      {team.teamName}
                    </p>
                    {team.artName && (
                      <p className="text-muted-foreground text-xs">
                        {team.artName}
                      </p>
                    )}
                  </div>
                  <TrendIcon trend={team.trend} />
                </div>

                <div className="flex items-baseline gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Últ. Sprint
                    </p>
                    <p
                      className="font-bold text-xl tabular-nums"
                      style={{ color: sparkColor(team.trend) }}
                    >
                      {team.lastSprintSP}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Média
                    </p>
                    <p className="font-bold text-foreground text-xl tabular-nums">
                      {team.avgSPPerSprint}
                    </p>
                  </div>
                </div>

                {/* Mini sparkline */}
                <div className="h-14">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart
                      data={team.sprints}
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <Bar dataKey="sp" radius={[2, 2, 0, 0]}>
                        {team.sprints.map((s, i) => (
                          <Cell
                            fill={
                              i === team.sprints.length - 1
                                ? sparkColor(team.trend)
                                : `${sparkColor(team.trend)}60`
                            }
                            key={i}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  {team.sprints.map((s) => (
                    <span key={s.label}>{s.label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Comparative line chart */}
          {filtered.length > 1 && lineData.length > 0 && (
            <div className="rounded-lg border p-4">
              <p className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Comparativo de Velocity — {filtered.length} times
              </p>
              <div className="h-56">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart
                    data={lineData}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={28} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {filtered.slice(0, 6).map((t, i) => (
                      <Line
                        connectNulls
                        dataKey={t.teamName}
                        dot={false}
                        key={t.teamId}
                        stroke={teamColors[i % teamColors.length]}
                        strokeWidth={2}
                        type="monotone"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Capacity note */}
          <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-amber-400 text-xs">
            <strong>Nota:</strong> Velocity é uma métrica de capacidade
            histórica, não de valor entregue. Use junto com Flow Metrics para um
            panorama completo de fluxo de valor.
          </div>
        </>
      )}
    </div>
  );
}
