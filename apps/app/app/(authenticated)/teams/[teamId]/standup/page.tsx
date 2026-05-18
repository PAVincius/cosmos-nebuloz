import { notFound } from "next/navigation";
import Link from "next/link";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Badge } from "@repo/design-system/components/ui/badge";
import { AlertTriangleIcon, CalendarIcon, UserIcon } from "lucide-react";
import { getTeamById } from "../actions";
import { listTodayStandup, getStandupHistory } from "@/app/actions/standup";
import { StandupForm } from "./components/standup-form";

interface StandupPageProps {
  params: Promise<{ teamId: string }>;
}

export async function generateMetadata({ params }: StandupPageProps) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  return {
    title: team ? `Standup — ${team.name} | COSMOS` : "Standup | COSMOS",
  };
}

export default async function StandupPage({ params }: StandupPageProps) {
  const { teamId } = await params;

  const [team, ctx] = await Promise.all([
    getTeamById(teamId),
    requireTenantSession(await headers()),
  ]);

  if (!team) notFound();

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
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(entry);
      return acc;
    },
    {},
  );

  const historyDates = Object.keys(historyByDate).sort((a, b) =>
    b.localeCompare(a),
  );

  // Current user's existing entry today (if any)
  const myEntry = entries.find((e) => e.userId === ctx.userId);

  // Other team members' entries
  const otherEntries = entries.filter((e) => e.userId !== ctx.userId);

  const displayDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <p className="text-muted-foreground text-xs">
          <Link href={`/teams/${teamId}`} className="hover:underline">
            {team.name}
          </Link>
          {" / Standup"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Daily Standup</h1>
        <p className="text-muted-foreground text-sm mt-1 capitalize">{displayDate}</p>
      </div>

      {/* My standup form */}
      <StandupForm
        teamId={teamId}
        todayIso={todayIso}
        existing={
          myEntry
            ? {
                yesterday: myEntry.yesterday,
                today: myEntry.today,
                blockers: myEntry.blockers,
              }
            : undefined
        }
      />

      {/* Team entries today */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Time hoje ({entries.length} {entries.length === 1 ? "entrada" : "entradas"})
        </h2>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <UserIcon className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              Nenhum membro fez standup hoje ainda.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {myEntry && (
              <EntryCard
                entry={myEntry}
                label="Você"
                isMe
              />
            )}
            {otherEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                label={entry.userId.slice(0, 8)}
              />
            ))}
          </div>
        )}
      </section>

      {/* History — last 5 days */}
      {historyDates.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Histórico recente
          </h2>
          <div className="flex flex-col gap-4">
            {historyDates.map((dateKey) => {
              const dayEntries = historyByDate[dateKey];
              const label = new Date(dateKey + "T12:00:00Z").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              });
              return (
                <div key={dateKey}>
                  <p className="text-xs text-muted-foreground font-medium mb-2 capitalize">
                    {label}
                  </p>
                  <div className="flex flex-col gap-2">
                    {dayEntries.map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        label={entry.userId === ctx.userId ? "Você" : entry.userId.slice(0, 8)}
                        isMe={entry.userId === ctx.userId}
                        compact
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
  );
}

function EntryCard({
  entry,
  label,
  isMe,
  compact,
}: {
  entry: {
    yesterday?: string | null;
    today?: string | null;
    blockers?: string | null;
  };
  label: string;
  isMe?: boolean;
  compact?: boolean;
}) {
  const hasBlockers = entry.blockers && entry.blockers.trim().length > 0;

  return (
    <Card className={isMe ? "border-primary/30 bg-primary/5" : compact ? "opacity-70" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          {label}
          {isMe && <Badge variant="outline" className="text-xs">você</Badge>}
          {hasBlockers && (
            <Badge variant="destructive" className="text-xs flex items-center gap-1">
              <AlertTriangleIcon className="h-3 w-3" />
              Bloqueio
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Ontem</p>
          <p className="text-sm whitespace-pre-wrap">
            {entry.yesterday?.trim() || <span className="text-muted-foreground italic">—</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Hoje</p>
          <p className="text-sm whitespace-pre-wrap">
            {entry.today?.trim() || <span className="text-muted-foreground italic">—</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Bloqueios</p>
          <p className="text-sm whitespace-pre-wrap">
            {entry.blockers?.trim() || <span className="text-muted-foreground italic">Nenhum</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
