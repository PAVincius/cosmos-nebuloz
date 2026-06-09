import { Badge } from "@repo/design-system/components/ui/badge";
import { ClockIcon, UsersIcon, ZapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import {
  getSprintBurndownData,
  getTeamVelocityStats,
} from "@/app/actions/velocity";
import { appDesign } from "@/lib/app-design";
import type { TeamMember } from "../actions";
import { getArts, getTeamById } from "../actions";

const TeamConfigPanel = dynamic(
  () => import("./components/team-config-panel").then((m) => m.TeamConfigPanel),
  {
    loading: () => (
      <div
        aria-hidden
        className="min-h-[200px] animate-pulse rounded-lg border border-border bg-muted/20 p-4"
      />
    ),
  }
);

const SprintBurndownChart = dynamic(
  () =>
    import("./components/sprint-burndown-chart").then(
      (m) => m.SprintBurndownChart
    ),
  {
    loading: () => (
      <div className="flex min-h-[280px] items-center justify-center gap-3 text-muted-foreground text-sm">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <span>A carregar burndown…</span>
      </div>
    ),
  }
);

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

export async function generateMetadata({ params }: TeamPageProps) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  return {
    title: team ? `${team.name} | COSMOS` : "Time | COSMOS",
  };
}

export default async function TeamDetailPage({ params }: TeamPageProps) {
  const { teamId } = await params;
  const [team, arts] = await Promise.all([getTeamById(teamId), getArts()]);

  if (!team) {
    notFound();
  }

  const members = (team.members ?? []) as TeamMember[];
  const totalHours = members.reduce((sum, m) => sum + m.hoursPerWeek, 0);

  const sprintDays = team.sprintLengthDays ?? 14;

  const [velocityStats, burndownData] = await Promise.all([
    getTeamVelocityStats(teamId).catch(() => null),
    getSprintBurndownData(sprintDays, teamId).catch(() => []),
  ]);
  const sprintCapacityHours =
    Math.round((totalHours / 5) * (team.sprintLengthDays ?? 14)) *
      members.length ===
    0
      ? 0
      : members.reduce(
          (sum, m) =>
            sum +
            Math.round((m.hoursPerWeek / 5) * (team.sprintLengthDays ?? 14)),
          0
        );

  return (
    <div className={appDesign.shell}>
      <PageHeader
        badge={
          <Badge variant={team.art ? "default" : "secondary"}>
            {team.art ? team.art.name : "Independente"}
          </Badge>
        }
        breadcrumb={[{ label: "Times", href: "/teams" }]}
        stats={[
          { label: "Membros", value: members.length, icon: UsersIcon },
          {
            label: "Velocidade",
            value: team.velocity != null ? `${team.velocity} SP` : "—",
            icon: ZapIcon,
          },
          {
            label: "Cap. Sprint",
            value: `${sprintCapacityHours}h`,
            icon: ClockIcon,
          },
        ]}
        subtitle={team.art ? team.art.name : "Time Independente"}
        title={team.name}
      />

      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs">
                <UsersIcon className="h-3.5 w-3.5" />
                Membros
              </div>
              <p className="font-semibold text-2xl">{members.length}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs">
                <ZapIcon className="h-3.5 w-3.5" />
                Velocidade
              </div>
              <p className="font-semibold text-2xl">
                {team.velocity ?? "—"}
                {team.velocity && (
                  <span className="ml-1 font-normal text-muted-foreground text-sm">
                    SP
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs">
                <ClockIcon className="h-3.5 w-3.5" />
                Cap. Sprint
              </div>
              <p className="font-semibold text-2xl">
                {sprintCapacityHours}
                <span className="ml-1 font-normal text-muted-foreground text-sm">
                  h
                </span>
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs">
                <ClockIcon className="h-3.5 w-3.5" />
                Sprint
              </div>
              <p className="font-semibold text-2xl">
                {team.sprintLengthDays ?? 14}
                <span className="ml-1 font-normal text-muted-foreground text-sm">
                  dias
                </span>
              </p>
            </div>
          </div>

          <TeamConfigPanel
            arts={arts}
            team={{
              id: team.id,
              name: team.name,
              artId: team.artId,
              velocity: team.velocity,
              sprintLengthDays: sprintDays,
              members,
            }}
          />

          <div className="rounded-lg border p-5">
            <SprintBurndownChart
              burndownData={burndownData}
              memberStats={velocityStats?.memberStats.map((m) => ({
                userId: m.userId,
                name:
                  members.find((mb) => mb.id === m.userId)?.name ?? m.userId,
                avgSPPerSprint: m.avgSPPerSprint,
                totalSPCompleted: m.totalSPCompleted,
              }))}
              sprintLengthDays={sprintDays}
              teamName={team.name}
              teamVelocity={
                velocityStats?.totalTeamSPPerSprint ??
                team.velocity ??
                undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
