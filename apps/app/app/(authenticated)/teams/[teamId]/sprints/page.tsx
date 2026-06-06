import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  CalendarIcon,
  ChevronRightIcon,
  KanbanIcon,
  TargetIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getActiveSprint, listSprints } from "@/app/actions/sprints";
import { appDesign } from "@/lib/app-design";
import { getTeamById } from "../../actions";
import { CreateSprintDialog } from "./components/create-sprint-dialog";
import { SprintActionButtons } from "./components/sprint-action-buttons";

type SprintsPageProps = {
  params: Promise<{ teamId: string }>;
};

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

  if (!team) {
    notFound();
  }

  const sprints = sprintsResult.ok ? sprintsResult.data.items : [];
  const activeSprint = activeSprintResult.ok ? activeSprintResult.data : null;

  function formatDate(d: Date) {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            {!!activeSprint && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/teams/${teamId}/kanban`}>
                  <KanbanIcon className="mr-2 h-4 w-4" />
                  Kanban
                </Link>
              </Button>
            )}
            <CreateSprintDialog teamId={teamId} />
          </div>
        }
        breadcrumb={[
          { label: team.name, href: `/teams/${teamId}` },
          { label: "Sprints" },
        ]}
        subtitle={`${sprints.length} sprint${sprints.length !== 1 ? "s" : ""}`}
        title="Sprints"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          {/* Active sprint highlight */}
          {!!activeSprint && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="default">Ativo</Badge>
                  <div>
                    <p className="font-medium">{activeSprint.name}</p>
                    {!!activeSprint.goal && (
                      <p className="mt-0.5 flex items-center gap-1 text-muted-foreground text-sm">
                        <TargetIcon className="h-3.5 w-3.5" />
                        {activeSprint.goal}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SprintActionButtons
                    sprintId={activeSprint.id}
                    status={activeSprint.status}
                    teamId={teamId}
                  />
                  <Button asChild size="sm">
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
              <p className="text-muted-foreground text-sm">
                Nenhum sprint criado ainda.
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Crie o primeiro sprint para começar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sprints.map((sprint) => (
                <Card
                  className="transition-shadow hover:shadow-sm"
                  key={sprint.id}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 font-medium text-base">
                        {sprint.name}
                        <Badge
                          variant={
                            STATUS_VARIANTS[sprint.status] ?? "secondary"
                          }
                        >
                          {STATUS_LABELS[sprint.status] ?? sprint.status}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <SprintActionButtons
                          sprintId={sprint.id}
                          status={sprint.status}
                          teamId={teamId}
                        />
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/teams/${teamId}/sprints/${sprint.id}`}>
                            Detalhes
                            <ChevronRightIcon className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4 text-muted-foreground text-sm">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {formatDate(sprint.startDate)} —{" "}
                      {formatDate(sprint.endDate)}
                    </span>
                    <span>{sprint._count.stories} stories</span>
                    {sprint.capacity !== null &&
                      sprint.capacity !== undefined && (
                        <span>Cap: {sprint.capacity} SP</span>
                      )}
                    {!!sprint.review?.goalMet && (
                      <Badge className="text-xs" variant="outline">
                        Meta atingida
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
