import { requireTenantSession } from "@repo/auth/server";
import { Badge } from "@repo/design-system/components/cosmos/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  PlusIcon,
  UserIcon,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getActiveSprint } from "@/app/actions/sprints";
import { getStandupHistory, listTodayStandup } from "@/app/actions/standup";
import { appDesign } from "@/lib/app-design";
import { getTeamById } from "../actions";
import {
  type StandupAvatarTone,
  StandupEntryCard,
} from "./components/standup-entry-card";
import { StandupForm } from "./components/standup-form";

const ICON_USERS =
  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_KANBAN = "M4 4h16v16H4zM9 4v16M15 4v16";
const ICON_ALERT =
  "M21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01";

const TEAM_TONES: StandupAvatarTone[] = ["blue", "green", "purple", "amber"];

/** Deterministic tone per team so every member avatar in a team shares an accent (mirrors prototype's per-team `t.tone`). */
function teamTone(teamId: string): StandupAvatarTone {
  let hash = 0;
  for (const char of teamId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return TEAM_TONES[hash % TEAM_TONES.length];
}

type StandupPageProps = {
  params: Promise<{ teamId: string }>;
};

export async function generateMetadata({ params }: StandupPageProps) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  return {
    title: team ? `Standup — ${team.name} | COSMOS` : "Standup | COSMOS",
  };
}

export default async function StandupPage({ params }: StandupPageProps) {
  const { teamId } = await params;

  const [team, ctx, activeSprintResult] = await Promise.all([
    getTeamById(teamId),
    requireTenantSession(await headers()),
    getActiveSprint(teamId),
  ]);
  const activeSprint = activeSprintResult.ok ? activeSprintResult.data : null;

  if (!team) {
    notFound();
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = today.toISOString().split("T")[0]; // "YYYY-MM-DD"

  const [todayResult, historyResult] = await Promise.all([
    listTodayStandup(teamId),
    getStandupHistory(teamId, 5),
  ]);

  const entries = todayResult.ok ? todayResult.data : [];
  const historyEntries = historyResult.ok ? historyResult.data : [];

  // Exclude today's entries from history (already shown above)
  const todayDate = today.toISOString().split("T")[0];
  const pastEntries = historyEntries.filter((e) => {
    const entryDate =
      e.date instanceof Date
        ? e.date.toISOString().split("T")[0]
        : String(e.date).split("T")[0];
    return entryDate !== todayDate;
  });

  // Group past entries by date
  const historyByDate = pastEntries.reduce<Record<string, typeof pastEntries>>(
    (acc, entry) => {
      const dateKey =
        entry.date instanceof Date
          ? entry.date.toISOString().split("T")[0]
          : String(entry.date).split("T")[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(entry);
      return acc;
    },
    {}
  );

  const historyDates = Object.keys(historyByDate).sort((a, b) =>
    b.localeCompare(a)
  );

  // Current user's existing entry today (if any)
  const myEntry = entries.find((e) => e.userId === ctx.userId);
  const existingEntry = myEntry
    ? {
        yesterday: myEntry.yesterday,
        today: myEntry.today,
        blockers: myEntry.blockers,
      }
    : undefined;

  // Other team members' entries
  const otherEntries = entries.filter((e) => e.userId !== ctx.userId);

  const displayDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Legacy `members` JSON roster — display-only headcount, not used for capacity logic.
  const memberCount = Array.isArray(team.members)
    ? team.members.length
    : entries.length;
  const blockedCount = entries.filter((e) => !!e.blockers?.trim()).length;
  const tone = teamTone(teamId);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        accentRgb="91,141,239"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/teams">
                <ChevronLeftIcon className="mr-1.5 h-4 w-4" />
                Todos os times
              </Link>
            </Button>
            <Button asChild size="sm">
              <a href="#meu-standup">
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Preencher
              </a>
            </Button>
          </div>
        }
        badge={
          blockedCount > 0 ? (
            <Badge tone="red">
              {blockedCount} bloqueio{blockedCount > 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge tone="green">sem bloqueios</Badge>
          )
        }
        breadcrumb={[
          { label: "Times", href: "/teams" },
          { label: team.name, href: `/teams/${teamId}` },
          { label: "Standup" },
        ]}
        subtitle={
          activeSprint?.goal
            ? `Sprint goal: ${activeSprint.goal}`
            : displayDate
        }
        title="Daily Standup"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          <KpiGrid cols={4}>
            <KpiCard
              badge="— No time"
              iconPath={ICON_USERS}
              label="Membros"
              tone="blue"
              value={memberCount}
            />
            <KpiCard
              badge="— Sprint atual"
              iconPath={ICON_ACTIVITY}
              label="Velocity"
              tone="green"
              unit="SP"
              value={team.velocity ?? 0}
            />
            <KpiCard
              badge={team.wip > 6 ? "— Acima do limite" : "— Saudável"}
              iconPath={ICON_KANBAN}
              label="Flow load (WIP)"
              tone={team.wip > 6 ? "red" : "accent"}
              value={team.wip}
            />
            <KpiCard
              badge={blockedCount > 0 ? "— Ativos hoje" : "↗ Nenhum"}
              iconPath={ICON_ALERT}
              label="Bloqueios"
              tone={blockedCount > 0 ? "red" : "green"}
              value={blockedCount}
            />
          </KpiGrid>

          {/* My standup form */}
          <div id="meu-standup">
            <StandupForm
              existing={existingEntry}
              teamId={teamId}
              todayIso={todayIso}
            />
          </div>

          {/* Team entries today */}
          <section>
            <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Time hoje ({entries.length}{" "}
              {entries.length === 1 ? "entrada" : "entradas"})
            </h2>

            {todayResult.ok ? (
              entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
                  <UserIcon className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">
                    Nenhum membro fez standup hoje ainda.
                  </p>
                  <Button asChild className="mt-1" size="sm" variant="outline">
                    <a href="#meu-standup">Preencher meu standup</a>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                  {!!myEntry && (
                    <StandupEntryCard
                      blockers={myEntry.blockers}
                      isMe
                      name="Você"
                      today={myEntry.today}
                      tone={tone}
                      yesterday={myEntry.yesterday}
                    />
                  )}
                  {otherEntries.map((entry) => (
                    <StandupEntryCard
                      blockers={entry.blockers}
                      key={entry.id}
                      name={entry.userId.slice(0, 8)}
                      today={entry.today}
                      tone={tone}
                      yesterday={entry.yesterday}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-4 py-3 text-red-text text-sm">
                <AlertTriangleIcon aria-hidden size={16} />
                <span>
                  Falha ao carregar o standup de hoje: {todayResult.error}.{" "}
                  <a className="underline" href={`/teams/${teamId}/standup`}>
                    Tentar novamente
                  </a>
                </span>
              </div>
            )}
          </section>

          {/* History — last 5 days */}
          {!historyResult.ok && (
            <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-4 py-3 text-red-text text-sm">
              <AlertTriangleIcon aria-hidden size={16} />
              <span>
                Falha ao carregar o histórico: {historyResult.error}.{" "}
                <a className="underline" href={`/teams/${teamId}/standup`}>
                  Tentar novamente
                </a>
              </span>
            </div>
          )}

          {historyResult.ok && historyDates.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
                <CalendarIcon className="h-4 w-4" />
                Histórico recente
              </h2>
              <div className="flex flex-col gap-4">
                {historyDates.map((dateKey) => {
                  const dayEntries = historyByDate[dateKey];
                  const label = new Date(
                    `${dateKey}T12:00:00Z`
                  ).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  });
                  return (
                    <div key={dateKey}>
                      <p className="mb-2 font-medium text-muted-foreground text-xs capitalize">
                        {label}
                      </p>
                      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                        {dayEntries.map((entry) => (
                          <StandupEntryCard
                            blockers={entry.blockers}
                            compact
                            isMe={entry.userId === ctx.userId}
                            key={entry.id}
                            name={
                              entry.userId === ctx.userId
                                ? "Você"
                                : entry.userId.slice(0, 8)
                            }
                            today={entry.today}
                            tone={tone}
                            yesterday={entry.yesterday}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
