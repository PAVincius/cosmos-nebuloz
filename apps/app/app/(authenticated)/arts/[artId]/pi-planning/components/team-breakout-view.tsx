"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { UsersIcon, ZapIcon } from "lucide-react";
import Link from "next/link";

type Feature = {
  id: string;
  title: string;
  storyPoints: number;
  wsjfScore: number;
  statusId: string;
  epicId?: string | null;
  epicTitle?: string | null;
  assigneeUserId?: string | null;
};

type Team = { id: string; name: string; velocity?: number | null };

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  ANALYSIS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  REVIEW:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  IMPLEMENTING:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function loadColor(pct: number): string {
  if (pct > 100) {
    return "bg-destructive";
  }
  if (pct > 85) {
    return "bg-amber-500";
  }
  return "bg-primary";
}

type TeamBreakoutPanelProps = {
  team: Team;
  features: Feature[];
  sprints: string[];
  featuresPerSprint: Feature[][];
};

function TeamBreakoutPanel({
  team,
  features,
  sprints,
  featuresPerSprint,
}: TeamBreakoutPanelProps) {
  const totalSP = features.reduce((sum, f) => sum + f.storyPoints, 0);
  const capacity = (team.velocity ?? 0) * (sprints.length - 1);
  const loadPct = capacity > 0 ? Math.round((totalSP / capacity) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          {team.name}
        </CardTitle>
        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span>
            <span className="font-medium text-foreground">{totalSP} SP</span>{" "}
            comprometidos
          </span>
          {capacity > 0 && (
            <span>
              capacidade:{" "}
              <span className="font-medium text-foreground">{capacity} SP</span>
            </span>
          )}
          {team.velocity && (
            <Badge className="h-5 gap-1 text-[10px]" variant="outline">
              <ZapIcon className="h-2.5 w-2.5" />
              {team.velocity} SP/sprint
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-4">
        {/* Load bar */}
        {capacity > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Carga</span>
              <span
                className={
                  loadPct > 100
                    ? "font-medium text-destructive"
                    : loadPct > 85
                      ? "font-medium text-amber-500"
                      : ""
                }
              >
                {loadPct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${loadColor(loadPct)}`}
                style={{ width: `${Math.min(loadPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Sprint breakdown */}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(sprints.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {sprints.map((sprint, si) => {
            const sprintFeatures = featuresPerSprint[si] ?? [];
            const sprintSP = sprintFeatures.reduce(
              (s, f) => s + f.storyPoints,
              0
            );
            const isIP = sprint === "IP Sprint";

            return (
              <div
                className={`flex flex-col gap-1.5 rounded-md border p-2 text-xs ${
                  isIP
                    ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10"
                    : ""
                }`}
                key={si}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-medium ${isIP ? "text-amber-700 dark:text-amber-400" : ""}`}
                  >
                    {sprint}
                  </span>
                  {sprintSP > 0 && (
                    <span className="text-muted-foreground">{sprintSP} SP</span>
                  )}
                </div>
                {sprintFeatures.length === 0 ? (
                  <span className="py-2 text-center text-muted-foreground/50">
                    —
                  </span>
                ) : (
                  sprintFeatures.map((f) => (
                    <Link href={`/features/${f.id}`} key={f.id}>
                      <div
                        className={`rounded px-1.5 py-1 transition-opacity hover:opacity-80 ${
                          STATUS_COLORS[f.statusId] ?? STATUS_COLORS.BACKLOG
                        }`}
                      >
                        <p className="truncate font-medium leading-snug">
                          {f.title}
                        </p>
                        <span className="text-[10px] opacity-75">
                          {f.storyPoints} SP
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

type TeamBreakoutViewProps = {
  teams: Team[];
  features: Feature[];
  cadence?: number | null;
};

export function TeamBreakoutView({
  teams,
  features,
  cadence,
}: TeamBreakoutViewProps) {
  const iterationCount = Math.min(
    Math.max(Math.floor((cadence ?? 10) / 2), 4),
    5
  );
  const sprints: string[] = Array.from(
    { length: iterationCount },
    (_, i) => `Sprint ${i + 1}`
  );
  sprints.push("IP Sprint");

  if (teams.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        Nenhum time associado a este ART.
      </p>
    );
  }

  const userToTeamIndex = new Map<string, number>();
  let userCounter = 0;
  for (const f of features) {
    if (f.assigneeUserId && !userToTeamIndex.has(f.assigneeUserId)) {
      userToTeamIndex.set(f.assigneeUserId, userCounter % teams.length);
      userCounter++;
    }
  }

  const teamSprintCounter = new Map<string, number>();
  const teamFeatureMap = new Map<string, Feature[][]>();

  for (const team of teams) {
    teamFeatureMap.set(
      team.id,
      Array.from({ length: sprints.length }, () => [])
    );
    teamSprintCounter.set(team.id, 0);
  }

  for (const feature of features) {
    let teamIdx = 0;
    if (feature.assigneeUserId) {
      teamIdx = userToTeamIndex.get(feature.assigneeUserId) ?? 0;
    }
    const team = teams[teamIdx] ?? teams[0];
    const sprintSlots = teamFeatureMap.get(team.id)!;
    const si = (teamSprintCounter.get(team.id) ?? 0) % (sprints.length - 1);
    teamSprintCounter.set(team.id, si + 1);
    sprintSlots[si].push(feature);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 text-muted-foreground text-sm">
        <span>
          <span className="font-medium text-foreground">{teams.length}</span>{" "}
          times
        </span>
        <span>
          <span className="font-medium text-foreground">{features.length}</span>{" "}
          features
        </span>
        <span>
          <span className="font-medium text-foreground">
            {features.reduce((s, f) => s + f.storyPoints, 0)}
          </span>{" "}
          SP totais
        </span>
      </div>

      {teams.map((team) => (
        <TeamBreakoutPanel
          features={features.filter((f) => {
            const idx = f.assigneeUserId
              ? (userToTeamIndex.get(f.assigneeUserId) ?? 0)
              : 0;
            return teams[idx]?.id === team.id;
          })}
          featuresPerSprint={teamFeatureMap.get(team.id)!}
          key={team.id}
          sprints={sprints}
          team={team}
        />
      ))}
    </div>
  );
}
