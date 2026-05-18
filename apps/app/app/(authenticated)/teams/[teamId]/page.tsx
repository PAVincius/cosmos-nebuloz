import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { Badge } from "@repo/design-system/components/ui/badge";
import { TrainFrontIcon, UsersIcon, ZapIcon, ClockIcon } from "lucide-react";
import { getTeamById, getArts } from "../actions";
import type { TeamMember } from "../actions";
import { getTeamVelocityStats, getSprintBurndownData } from "@/app/actions/velocity";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";

const TeamConfigPanel = dynamic(
  () => import("./components/team-config-panel").then((m) => m.TeamConfigPanel),
  {
    loading: () => (
      <div className="min-h-[200px] animate-pulse rounded-lg border border-border bg-muted/20 p-4" aria-hidden />
    ),
  }
);

const SprintBurndownChart = dynamic(
  () => import("./components/sprint-burndown-chart").then((m) => m.SprintBurndownChart),
  {
    loading: () => (
      <div className="flex min-h-[280px] items-center justify-center gap-3 text-muted-foreground text-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
        <span>A carregar burndown…</span>
      </div>
    ),
  }
);

interface TeamPageProps {
  params: Promise<{ teamId: string }>;
}

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

  if (!team) notFound();

  const members = (team.members ?? []) as TeamMember[];
  const totalHours = members.reduce((sum, m) => sum + m.hoursPerWeek, 0);

  const sprintDays = team.sprintLengthDays ?? 14;

  const [velocityStats, burndownData] = await Promise.all([
    getTeamVelocityStats(teamId).catch(() => null),
    getSprintBurndownData(sprintDays, teamId).catch(() => []),
  ]);
  const sprintCapacityHours =
    Math.round((totalHours / 5) * (team.sprintLengthDays ?? 14)) * members.length === 0
      ? 0
      : members.reduce(
          (sum, m) => sum + Math.round((m.hoursPerWeek / 5) * (team.sprintLengthDays ?? 14)),
          0
        );

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[{ label: "Times", href: "/teams" }]}
        title={team.name}
        subtitle={team.art ? team.art.name : "Time Independente"}
        badge={
          <Badge variant={team.art ? "default" : "secondary"}>
            {team.art ? team.art.name : "Independente"}
          </Badge>
        }
        stats={[
          { label: "Membros", value: members.length, icon: UsersIcon },
          { label: "Velocidade", value: team.velocity != null ? `${team.velocity} SP` : "—", icon: ZapIcon },
          { label: "Cap. Sprint", value: `${sprintCapacityHours}h`, icon: ClockIcon },
        ]}
      />

      <div className={appDesign.bodyScroll}>
      <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <UsersIcon className="h-3.5 w-3.5" />
            Membros
          </div>
          <p className="text-2xl font-semibold">{members.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <ZapIcon className="h-3.5 w-3.5" />
            Velocidade
          </div>
          <p className="text-2xl font-semibold">
            {team.velocity ?? "—"}
            {team.velocity && <span className="text-sm font-normal text-muted-foreground ml-1">SP</span>}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <ClockIcon className="h-3.5 w-3.5" />
            Cap. Sprint
          </div>
          <p className="text-2xl font-semibold">
            {sprintCapacityHours}
            <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <ClockIcon className="h-3.5 w-3.5" />
            Sprint
          </div>
          <p className="text-2xl font-semibold">
            {team.sprintLengthDays ?? 14}
            <span className="text-sm font-normal text-muted-foreground ml-1">dias</span>
          </p>
        </div>
      </div>

      <TeamConfigPanel
        team={{
          id: team.id,
          name: team.name,
          artId: team.artId,
          velocity: team.velocity,
          sprintLengthDays: sprintDays,
          members,
        }}
        arts={arts}
      />

      <div className="rounded-lg border p-5">
        <SprintBurndownChart
          burndownData={burndownData}
          memberStats={velocityStats?.memberStats.map((m) => ({
            userId: m.userId,
            name: members.find((mb) => mb.id === m.userId)?.name ?? m.userId,
            avgSPPerSprint: m.avgSPPerSprint,
            totalSPCompleted: m.totalSPCompleted,
          }))}
          sprintLengthDays={sprintDays}
          teamVelocity={velocityStats?.totalTeamSPPerSprint ?? team.velocity ?? undefined}
          teamName={team.name}
        />
      </div>
      </div>
      </div>
    </div>
  );
}
