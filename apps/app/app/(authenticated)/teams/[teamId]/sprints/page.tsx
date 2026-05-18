import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Button } from "@repo/design-system/components/ui/button";
import { CalendarIcon, ChevronRightIcon, KanbanIcon, TargetIcon } from "lucide-react";
import { getTeamById } from "../../actions";
import { listSprints, getActiveSprint } from "@/app/actions/sprints";
import { CreateSprintDialog } from "./components/create-sprint-dialog";
import { SprintActionButtons } from "./components/sprint-action-buttons";

interface SprintsPageProps {
  params: Promise<{ teamId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planejamento",
  ACTIVE: "Ativo",
  COMPLETED: "Concluído",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PLANNING: "secondary",
  ACTIVE: "default",
  COMPLETED: "outline",
};

export async function generateMetadata({ params }: SprintsPageProps) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  return {
    title: team ? `Sprints — ${team.name} | COSMOS` : "Sprints | COSMOS",
  };
}

export default async function SprintsPage({ params }: SprintsPageProps) {
  const { teamId } = await params;

  const [team, sprintsResult, activeSprintResult] = await Promise.all([
    getTeamById(teamId),
    listSprints({ teamId, limit: 50 }),
    getActiveSprint(teamId),
  ]);

  if (!team) notFound();

  const sprints = sprintsResult.ok ? sprintsResult.data.items : [];
  const activeSprint = activeSprintResult.ok ? activeSprintResult.data : null;

  function formatDate(d: Date) {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            <Link href={`/teams/${teamId}`} className="hover:underline">
              {team.name}
            </Link>
            {" / Sprints"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Sprints</h1>
          <p className="text-muted-foreground text-sm">
            {sprints.length} sprint{sprints.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSprint && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/teams/${teamId}/kanban`}>
                <KanbanIcon className="mr-2 h-4 w-4" />
                Kanban
              </Link>
            </Button>
          )}
          <CreateSprintDialog teamId={teamId} />
        </div>
      </div>

      {/* Active sprint highlight */}
      {activeSprint && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="default">Ativo</Badge>
              <div>
                <p className="font-medium">{activeSprint.name}</p>
                {activeSprint.goal && (
                  <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1">
                    <TargetIcon className="h-3.5 w-3.5" />
                    {activeSprint.goal}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SprintActionButtons sprintId={activeSprint.id} status={activeSprint.status} teamId={teamId} />
              <Button size="sm" asChild>
                <Link href={`/teams/${teamId}/sprints/${activeSprint.id}`}>
                  Ver Sprint
                  <ChevronRightIcon className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sprint list */}
      {sprints.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">Nenhum sprint criado ainda.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Crie o primeiro sprint para começar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sprints.map((sprint) => (
            <Card key={sprint.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    {sprint.name}
                    <Badge variant={STATUS_VARIANTS[sprint.status] ?? "secondary"}>
                      {STATUS_LABELS[sprint.status] ?? sprint.status}
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <SprintActionButtons sprintId={sprint.id} status={sprint.status} teamId={teamId} />
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/teams/${teamId}/sprints/${sprint.id}`}>
                        Detalhes
                        <ChevronRightIcon className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
                </span>
                <span>{sprint._count.stories} stories</span>
                {sprint.capacity && <span>Cap: {sprint.capacity} SP</span>}
                {sprint.review?.goalMet && (
                  <Badge variant="outline" className="text-xs">
                    Meta atingida
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
