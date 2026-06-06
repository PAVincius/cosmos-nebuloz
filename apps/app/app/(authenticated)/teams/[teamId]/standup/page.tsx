import { requireTenantSession } from "@repo/auth/server";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { AlertTriangleIcon, CalendarIcon, UserIcon } from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getStandupHistory, listTodayStandup } from "@/app/actions/standup";
import { appDesign } from "@/lib/app-design";
import { getTeamById } from "../actions";
import { StandupForm } from "./components/standup-form";

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

  const [team, ctx] = await Promise.all([
    getTeamById(teamId),
    requireTenantSession(await headers()),
  ]);

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

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: team.name, href: `/teams/${teamId}` },
          { label: "Standup" },
        ]}
        stats={[
          { label: "Entradas hoje", value: entries.length, icon: UserIcon },
        ]}
        subtitle={displayDate}
        title="Daily Standup"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          {/* My standup form */}
          <StandupForm
            existing={existingEntry}
            teamId={teamId}
            todayIso={todayIso}
          />

          {/* Team entries today */}
          <section>
            <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Time hoje ({entries.length}{" "}
              {entries.length === 1 ? "entrada" : "entradas"})
            </h2>

            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                <UserIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  Nenhum membro fez standup hoje ainda.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {!!myEntry && <EntryCard entry={myEntry} isMe label="Você" />}
                {otherEntries.map((entry) => (
                  <EntryCard
                    entry={entry}
                    key={entry.id}
                    label={entry.userId.slice(0, 8)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* History — last 5 days */}
          {historyDates.length > 0 && (
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
                      <div className="flex flex-col gap-2">
                        {dayEntries.map((entry) => (
                          <EntryCard
                            compact
                            entry={entry}
                            isMe={entry.userId === ctx.userId}
                            key={entry.id}
                            label={
                              entry.userId === ctx.userId
                                ? "Você"
                                : entry.userId.slice(0, 8)
                            }
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
  const hasBlockers = !!(entry.blockers && entry.blockers.trim().length > 0);

  let cardClassName: string | undefined;
  if (isMe) {
    cardClassName = "border-primary/30 bg-primary/5";
  } else if (compact) {
    cardClassName = "opacity-70";
  }

  return (
    <Card className={cardClassName}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          {label}
          {!!isMe && (
            <Badge className="text-xs" variant="outline">
              você
            </Badge>
          )}
          {hasBlockers ? (
            <Badge
              className="flex items-center gap-1 text-xs"
              variant="destructive"
            >
              <AlertTriangleIcon className="h-3 w-3" />
              Bloqueio
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="mb-1 font-medium text-muted-foreground text-xs">
            Ontem
          </p>
          <p className="whitespace-pre-wrap text-sm">
            {entry.yesterday?.trim() || (
              <span className="text-muted-foreground italic">—</span>
            )}
          </p>
        </div>
        <div>
          <p className="mb-1 font-medium text-muted-foreground text-xs">Hoje</p>
          <p className="whitespace-pre-wrap text-sm">
            {entry.today?.trim() || (
              <span className="text-muted-foreground italic">—</span>
            )}
          </p>
        </div>
        <div>
          <p className="mb-1 font-medium text-muted-foreground text-xs">
            Bloqueios
          </p>
          <p className="whitespace-pre-wrap text-sm">
            {entry.blockers?.trim() || (
              <span className="text-muted-foreground italic">Nenhum</span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
