import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { CalendarIcon, TargetIcon, ZapIcon } from "lucide-react";
import { getTeamById } from "../actions";
import { getActiveSprint } from "@/app/actions/sprints";
import { listStories } from "@/app/actions/stories";
import { KanbanBoard } from "./components/kanban-board";

interface KanbanPageProps {
  params: Promise<{ teamId: string }>;
}

export async function generateMetadata({ params }: KanbanPageProps) {
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  return {
    title: team ? `Kanban — ${team.name} | COSMOS` : "Kanban | COSMOS",
  };
}

export default async function KanbanPage({ params }: KanbanPageProps) {
  const { teamId } = await params;

  const team = await getTeamById(teamId);
  if (!team) notFound();

  const activeSprintResult = await getActiveSprint(teamId);
  const activeSprint = activeSprintResult.ok ? activeSprintResult.data : null;

  const storiesResult = activeSprint
    ? await listStories({ sprintId: activeSprint.id, limit: 100 })
    : null;
  const stories = storiesResult?.ok ? storiesResult.data.items : [];

  function formatDate(d: Date) {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
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
            {" / Kanban"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
          {activeSprint ? (
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="default">Sprint Ativo</Badge>
              <span className="text-sm font-medium">{activeSprint.name}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" />
                {formatDate(activeSprint.startDate)} — {formatDate(activeSprint.endDate)}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm mt-1">Nenhum sprint ativo.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/teams/${teamId}/sprints`}>Ver Sprints</Link>
          </Button>
          {activeSprint && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/teams/${teamId}/sprints/${activeSprint.id}`}>
                Detalhe do Sprint
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Sprint goal */}
      {activeSprint?.goal && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
          <TargetIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Objetivo:</span>
          <span className="font-medium">{activeSprint.goal}</span>
        </div>
      )}

      {/* SP summary */}
      {activeSprint && stories.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <ZapIcon className="h-3.5 w-3.5" />
            {stories.reduce((acc, s) => acc + s.storyPoints, 0)} SP total
          </span>
          <span>
            {stories.filter((s) => s.status === "DONE").reduce((acc, s) => acc + s.storyPoints, 0)} SP concluídos
          </span>
          <span>{stories.filter((s) => s.status === "DONE").length} / {stories.length} stories concluídas</span>
        </div>
      )}

      {/* Kanban board or empty state */}
      {!activeSprint ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <p className="text-muted-foreground text-sm">Nenhum sprint ativo no momento.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Ative um sprint na página de Sprints para ver o Kanban.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href={`/teams/${teamId}/sprints`}>Ir para Sprints</Link>
          </Button>
        </div>
      ) : stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <p className="text-muted-foreground text-sm">Nenhuma story no sprint ativo.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Adicione stories ao sprint para visualizá-las no Kanban.
          </p>
        </div>
      ) : (
        <KanbanBoard
          sprintId={activeSprint!.id}
          stories={stories.map((s) => ({
            id: s.id,
            title: s.title,
            storyPoints: s.storyPoints,
            status: s.status,
            priority: s.priority,
            assigneeUserId: s.assigneeUserId ?? null,
          }))}
        />
      )}
    </div>
  );
}
