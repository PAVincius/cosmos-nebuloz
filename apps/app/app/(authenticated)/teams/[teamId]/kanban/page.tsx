import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { TargetIcon, ZapIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getActiveSprint } from "@/app/actions/sprints";
import { listStories } from "@/app/actions/stories";
import { appDesign } from "@/lib/app-design";
import { getTeamById } from "../actions";
import { KanbanBoard } from "./components/kanban-board";

type KanbanPageProps = {
  params: Promise<{ teamId: string }>;
};

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
  if (!team) {
    notFound();
  }

  const activeSprintResult = await getActiveSprint(teamId);
  const activeSprint = activeSprintResult.ok ? activeSprintResult.data : null;

  const storiesResult = activeSprint
    ? await listStories({ sprintId: activeSprint.id, limit: 100 })
    : null;
  const stories = storiesResult?.ok ? storiesResult.data.items : [];

  // Fetch user names for assignees present in this sprint
  const assigneeIds = [
    ...new Set(stories.map((s) => s.assigneeUserId).filter(Boolean)),
  ] as string[];
  const _ctx = await requireTenantSession(await headers());
  const assigneeUsers =
    assigneeIds.length > 0
      ? await database.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, image: true },
        })
      : [];
  const members = assigneeUsers.map((u) => ({
    id: u.id,
    name: u.name ?? u.id,
    avatar: u.image ?? null,
  }));

  function formatDate(d: Date) {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const totalSP = stories.reduce((acc, s) => acc + s.storyPoints, 0);
  const doneSP = stories
    .filter((s) => s.status === "DONE")
    .reduce((acc, s) => acc + s.storyPoints, 0);
  const doneCount = stories.filter((s) => s.status === "DONE").length;

  const boardContent = getBoardContent(activeSprint, stories, teamId, members);
  const sprintStats =
    activeSprint && stories.length > 0
      ? [
          { label: "SP total", value: totalSP, icon: ZapIcon },
          { label: "SP concluídos", value: doneSP },
          { label: "Stories", value: `${doneCount}/${stories.length}` },
        ]
      : undefined;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/teams/${teamId}/sprints`}>Ver Sprints</Link>
            </Button>
            {!!activeSprint && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/teams/${teamId}/sprints/${activeSprint.id}`}>
                  Detalhe do Sprint
                </Link>
              </Button>
            )}
          </div>
        }
        breadcrumb={[
          { label: team.name, href: `/teams/${teamId}` },
          { label: "Kanban" },
        ]}
        stats={sprintStats}
        subtitle={
          activeSprint
            ? `${activeSprint.name} · ${formatDate(activeSprint.startDate)} — ${formatDate(activeSprint.endDate)}`
            : "Nenhum sprint ativo"
        }
        title="Kanban"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          {/* Sprint goal */}
          {!!activeSprint?.goal && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
              <TargetIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Objetivo:</span>
              <span className="font-medium">{activeSprint.goal}</span>
            </div>
          )}

          {/* Kanban board or empty state */}
          {boardContent}
        </div>
      </div>
    </div>
  );
}

type ActiveSprint = { id: string; [key: string]: unknown } | null;
type StoryItem = {
  id: string;
  title: string;
  storyPoints: number;
  status: string;
  priority: string;
  assigneeUserId?: string | null;
};
type Member = { id: string; name: string; avatar: string | null };

function getBoardContent(
  activeSprint: ActiveSprint,
  stories: StoryItem[],
  teamId: string,
  members: Member[]
): ReactNode {
  if (!activeSprint) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhum sprint ativo no momento.
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          Ative um sprint na página de Sprints para ver o Kanban.
        </p>
        <Button asChild className="mt-4" size="sm" variant="outline">
          <Link href={`/teams/${teamId}/sprints`}>Ir para Sprints</Link>
        </Button>
      </div>
    );
  }
  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhuma story no sprint ativo.
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          Adicione stories ao sprint para visualizá-las no Kanban.
        </p>
      </div>
    );
  }
  return (
    <KanbanBoard
      members={members}
      sprintId={activeSprint.id as string}
      stories={stories.map((s) => ({
        id: s.id,
        title: s.title,
        storyPoints: s.storyPoints,
        status: s.status,
        priority: s.priority,
        assigneeUserId: s.assigneeUserId ?? null,
      }))}
    />
  );
}
