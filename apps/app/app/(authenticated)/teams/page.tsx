import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ChevronRightIcon,
  TrainFrontIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getTenantMembersForSearch } from "@/app/actions/teams/members";
import { appDesign } from "@/lib/app-design";
import type { TeamMember } from "./actions";
import { getArts, getTeams } from "./actions";

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
  title: "Equipes Ágeis | COSMOS",
  description: "Gerencie os times ágeis e associe-os aos Agile Release Trains",
};

export default async function TeamsPage() {
  const [teams, arts, initialMembers] = await Promise.all([
    getTeams(),
    getArts(),
    getTenantMembersForSearch(),
  ]);

  return (
    <div className={`${appDesign.shell} h-full`}>
      <header className={appDesign.pageHeader}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className={appDesign.pageTitle}>Equipes Ágeis</h1>
            <p className={appDesign.pageSubtitle}>
              Times SAFe com configuração de membros, skills e capacidade
            </p>
            <div aria-hidden className={appDesign.accentBar} />
          </div>
          <CreateTeamWizard arts={arts} initialMembers={initialMembers} />
        </div>
      </header>

      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <UsersIcon className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-3 text-muted-foreground text-sm">
              Nenhuma equipe cadastrada neste Tenant.
            </p>
            <CreateTeamWizard arts={arts} initialMembers={initialMembers} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const members = (team.members ?? []) as TeamMember[];
              const totalHours = members.reduce(
                (s, m) => s + m.hoursPerWeek,
                0
              );
              return (
                <div
                  className="hover:-translate-y-0.5 flex flex-col rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)] transition-all duration-200 hover:border-primary/40 hover:shadow-[var(--hover-shadow)]"
                  key={team.id}
                >
                  <div className="flex items-start justify-between p-5 pb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <UsersIcon className="h-4 w-4" />
                    </div>
                    <Badge variant={team.art ? "default" : "secondary"}>
                      {team.art ? team.art.name : "Independente"}
                    </Badge>
                  </div>
                  <div className="flex-1 px-5 pb-3">
                    <h3 className="font-semibold text-base leading-snug">
                      {team.name}
                    </h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {members.length > 0
                        ? `${members.length} membros · ${totalHours}h/sem`
                        : "Sem membros configurados"}
                    </p>
                    <div className="mt-3 flex flex-col gap-1.5">
                      {team.velocity && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <ZapIcon className="h-3 w-3" />
                          <span>Velocidade: {team.velocity} SP/sprint</span>
                        </div>
                      )}
                      {team.art && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <TrainFrontIcon className="h-3 w-3" />
                          <span>Cadência: {team.art.cadence}w por PI</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-hairline border-t px-5 py-3">
                    <Link href={`/teams/${team.id}`}>
                      <Button className="w-full" size="sm" variant="outline">
                        Configurar time
                        <ChevronRightIcon className="ml-auto h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
