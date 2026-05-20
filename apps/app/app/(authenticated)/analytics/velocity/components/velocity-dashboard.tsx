"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from "recharts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@repo/design-system/components/ui/select";
import { TrendingUpIcon, TrendingDownIcon, MinusIcon, ZapIcon } from "lucide-react";
import type { TeamVelocitySummary } from "@/app/actions/velocity";

const PRIMARY   = "#5e6ad2";
const SUCCESS   = "#22c55e";
const WARNING   = "#f59e0b";
const MUTED     = "#8a8f98";

function TrendIcon({ trend }: { trend: "up" | "down" | "neutral" }) {
  if (trend === "up")      return <TrendingUpIcon   className="h-3.5 w-3.5 text-green-500" />;
  if (trend === "down")    return <TrendingDownIcon  className="h-3.5 w-3.5 text-red-500" />;
  return                          <MinusIcon         className="h-3.5 w-3.5 text-muted-foreground" />;
}

function sparkColor(trend: "up" | "down" | "neutral") {
  return trend === "up" ? SUCCESS : trend === "down" ? "#ef4444" : MUTED;
}

type Props = {
  teams: TeamVelocitySummary[];
  arts:  { id: string; name: string }[];
};

export function VelocityDashboard({ teams, arts }: Props) {
  const [filterArt, setFilterArt] = useState("ALL");

  const filtered = filterArt === "ALL"
    ? teams
    : teams.filter((t) => t.artId === filterArt);

  // Multi-team sprint series for line chart
  const sprintLabels = filtered[0]?.sprints.map((s) => s.label) ?? [];
  const lineData = sprintLabels.map((label, idx) => {
    const entry: Record<string, string | number> = { sprint: label };
    for (const t of filtered.slice(0, 6)) {
      entry[t.teamName] = t.sprints[idx]?.sp ?? 0;
    }
    return entry;
  });

  const teamColors = [PRIMARY, SUCCESS, WARNING, "#8b5cf6", "#06b6d4", "#f97316"];

  return (
    <div className="flex flex-col gap-6">
      {/* Filter */}
      {arts.length > 1 && (
        <div className="flex items-center gap-3">
          <Select value={filterArt} onValueChange={setFilterArt}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Filtrar ART" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os ARTs</SelectItem>
              {arts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} time(s)</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <ZapIcon className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum time encontrado</p>
        </div>
      ) : (
        <>
          {/* Team cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((team) => (
              <div key={team.teamId} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{team.teamName}</p>
                    {team.artName && (
                      <p className="text-xs text-muted-foreground">{team.artName}</p>
                    )}
                  </div>
                  <TrendIcon trend={team.trend} />
                </div>

                <div className="flex items-baseline gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Últ. Sprint</p>
                    <p className="text-xl font-bold tabular-nums" style={{ color: sparkColor(team.trend) }}>
                      {team.lastSprintSP}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Média</p>
                    <p className="text-xl font-bold tabular-nums text-foreground">
                      {team.avgSPPerSprint}
                    </p>
                  </div>
                </div>

                {/* Mini sparkline */}
                <div className="h-14">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={team.sprints} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <Bar dataKey="sp" radius={[2, 2, 0, 0]}>
                        {team.sprints.map((s, i) => (
                          <Cell
                            key={i}
                            fill={i === team.sprints.length - 1 ? sparkColor(team.trend) : `${sparkColor(team.trend)}60`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  {team.sprints.map((s) => <span key={s.label}>{s.label}</span>)}
                </div>
              </div>
            ))}
          </div>

          {/* Comparative line chart */}
          {filtered.length > 1 && lineData.length > 0 && (
            <div className="rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Comparativo de Velocity — {filtered.length} times
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={28} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {filtered.slice(0, 6).map((t, i) => (
                      <Line
                        key={t.teamId}
                        type="monotone"
                        dataKey={t.teamName}
                        stroke={teamColors[i % teamColors.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Capacity note */}
          <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
            <strong>Nota:</strong> Velocity é uma métrica de capacidade histórica, não de valor entregue.
            Use junto com Flow Metrics para um panorama completo de fluxo de valor.
          </div>
        </>
      )}
    </div>
  );
}
