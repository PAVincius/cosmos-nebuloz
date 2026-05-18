import dynamic from "next/dynamic";
import { getTeams, getArts } from "./actions";
import { getTenantMembersForSearch } from "@/app/actions/teams/members";
import type { TeamMember } from "./actions";
import Link from "next/link";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  UsersIcon,
  TrainFrontIcon,
  ZapIcon,
  ChevronRightIcon,
} from "lucide-react";

const CreateTeamWizard = dynamic(
  () => import("./components/create-team-wizard").then((m) => m.CreateTeamWizard),
  {
    loading: () => (
      <div className="h-9 w-32 shrink-0 animate-pulse rounded-md bg-muted" aria-hidden />
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipes Ágeis</h1>
          <p className="text-muted-foreground text-sm">
            Times SAFe com configuração de membros, skills e capacidade
          </p>
        </div>
        <CreateTeamWizard arts={arts} initialMembers={initialMembers} />
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <UsersIcon className="text-muted-foreground mb-4 h-10 w-10" />
          <p className="text-muted-foreground text-sm mb-3">
            Nenhuma equipe cadastrada neste Tenant.
          </p>
          <CreateTeamWizard arts={arts} initialMembers={initialMembers} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const members = (team.members ?? []) as TeamMember[];
            const totalHours = members.reduce((s, m) => s + m.hoursPerWeek, 0);
            return (
              <Card
                key={team.id}
                className="hover:border-primary/50 transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <UsersIcon className="text-primary h-5 w-5" />
                    <Badge variant={team.art ? "default" : "secondary"}>
                      {team.art ? team.art.name : "Independente"}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2 text-base">{team.name}</CardTitle>
                  <CardDescription>
                    {members.length > 0
                      ? `${members.length} membros · ${totalHours}h/sem`
                      : "Sem membros configurados"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 flex flex-col gap-2">
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
                  <Link href={`/teams/${team.id}`}>
                    <Button className="w-full mt-1" size="sm" variant="outline">
                      Configurar time
                      <ChevronRightIcon className="ml-auto h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
