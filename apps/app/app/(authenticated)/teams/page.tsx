import { UsersIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getTenantMembersForSearch } from "@/app/actions/teams/members";
import { appDesign } from "@/lib/app-design";
import type { TeamMember } from "./actions";
import { getArts, getTeams } from "./actions";
import { TeamCard } from "./components/team-card";

// screens-team.js:4 (screenTeams kpiRow) — users / users / activity / alert
const ICON_USERS =
  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_ALERT =
  "M21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01";

const CreateTeamWizard = dynamic(
  () =>
    import("./components/create-team-wizard").then((m) => m.CreateTeamWizard),
  {
    loading: () => (
      <div
        aria-hidden
        className="h-9 w-32 shrink-0 animate-pulse rounded-md bg-muted"
      />
    ),
  }
);

export const metadata = {
  title: "Times | COSMOS",
  description: "Times ágeis do workspace, agrupados por ART",
};

export default async function TeamsPage() {
  const [teams, arts, initialMembers] = await Promise.all([
    getTeams(),
    getArts(),
    getTenantMembersForSearch(),
  ]);

  const teamsWithVelocity = teams.filter((t) => t.velocity != null);
  const totalMembers = teams.reduce(
    (s, t) => s + ((t.members as TeamMember[] | null)?.length ?? 0),
    0
  );
  const avgVelocity =
    teamsWithVelocity.length > 0
      ? Math.round(
          teamsWithVelocity.reduce((s, t) => s + (t.velocity ?? 0), 0) /
            teamsWithVelocity.length
        )
      : 0;
  const blockedTeams = teams.reduce((s, t) => s + t.openImpediments, 0);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <CreateTeamWizard arts={arts} initialMembers={initialMembers} />
        }
        stats={[
          { label: "Squads", value: teams.length, icon: UsersIcon },
          { label: "ARTs", value: arts.length },
          { label: "Impedimentos abertos", value: blockedTeams },
        ]}
        subtitle="Todos os times do workspace, agrupados por ART. Clique em um time para abrir o standup diário."
        title="Times"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          <KpiGrid>
            <KpiCard
              badge={`— ${arts.length} ART${arts.length === 1 ? "" : "s"}`}
              iconPath={ICON_USERS}
              label="Times ativos"
              tone="blue"
              value={teams.length}
            />
            <KpiCard
              badge="— No workspace"
              iconPath={ICON_USERS}
              label="Membros"
              tone="accent"
              value={totalMembers}
            />
            <KpiCard
              badge="— Por sprint"
              iconPath={ICON_ACTIVITY}
              label="Velocity média"
              tone="green"
              unit="SP"
              value={avgVelocity}
            />
            <KpiCard
              badge={blockedTeams > 0 ? "— Requer atenção" : "↗ Nenhum ativo"}
              iconPath={ICON_ALERT}
              label="Impedimentos"
              tone={blockedTeams > 0 ? "red" : "green"}
              value={blockedTeams}
            />
          </KpiGrid>

          {teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-cosmos-lg border border-hairline border-dashed py-16 text-center">
              <UsersIcon className="mb-4 h-10 w-10 text-ink-muted" />
              <p className="mb-3 text-ink-muted text-sm">
                Nenhum time cadastrado neste tenant.
              </p>
              <CreateTeamWizard arts={arts} initialMembers={initialMembers} />
            </div>
          ) : (
            <div
              className="grid gap-3.5"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              }}
            >
              {teams.map((team, index) => (
                <TeamCard index={index} key={team.id} team={team} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
