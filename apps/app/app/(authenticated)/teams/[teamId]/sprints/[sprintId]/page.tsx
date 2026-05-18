import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/design-system/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  CalendarIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";
import { getTeamById } from "../../../actions";
import { getSprintById } from "@/app/actions/sprints";
import { Progress } from "@repo/design-system/components/ui/progress";
import { SprintActionButtons } from "../components/sprint-action-buttons";
import { AddStoryToSprintDialog } from "../components/add-story-to-sprint-dialog";

interface SprintDetailPageProps {
  params: Promise<{ teamId: string; sprintId: string }>;
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

const STORY_STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "A Fazer",
  IN_PROGRESS: "Em Progresso",
  REVIEW: "Em Revisão",
  DONE: "Concluída",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
};

export async function generateMetadata({ params }: SprintDetailPageProps) {
  const { sprintId } = await params;
  const result = await getSprintById(sprintId);
  const sprint = result.ok ? result.data : null;
  return {
    title: sprint ? `${sprint.name} | COSMOS` : "Sprint | COSMOS",
  };
}

export default async function SprintDetailPage({ params }: SprintDetailPageProps) {
  const { teamId, sprintId } = await params;

  const [team, sprintResult] = await Promise.all([
    getTeamById(teamId),
    getSprintById(sprintId),
  ]);

  const sprint = sprintResult.ok ? sprintResult.data : null;

  if (!team || !sprint) notFound();

  function formatDate(d: Date) {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stories: any[] = sprint.stories ?? [];
  const totalSP = stories.reduce((s: number, st: any) => s + (st.storyPoints ?? 0), 0);
  const doneSP = stories
    .filter((st: any) => st.status === "DONE")
    .reduce((s: number, st: any) => s + (st.storyPoints ?? 0), 0);

  const retroWentWell = Array.isArray(sprint.retro?.wentWell)
    ? (sprint.retro.wentWell as string[])
    : [];
  const retroToImprove = Array.isArray(sprint.retro?.toImprove)
    ? (sprint.retro.toImprove as string[])
    : [];
  const retroActions = Array.isArray(sprint.retro?.actions)
    ? (sprint.retro.actions as string[])
    : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            <Link href={`/teams/${teamId}`} className="hover:underline">
              {team.name}
            </Link>
            {" / "}
            <Link href={`/teams/${teamId}/sprints`} className="hover:underline">
              Sprints
            </Link>
            {" / "}
            {sprint.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1 flex items-center gap-3">
            {sprint.name}
            <Badge variant={STATUS_VARIANTS[sprint.status] ?? "secondary"}>
              {STATUS_LABELS[sprint.status] ?? sprint.status}
            </Badge>
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
            </span>
            {sprint.capacity && (
              <span className="flex items-center gap-1">
                <ZapIcon className="h-3.5 w-3.5" />
                {sprint.capacity} SP de capacidade
              </span>
            )}
          </div>
          {sprint.goal && (
            <p className="flex items-center gap-1 text-sm mt-2">
              <TargetIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {sprint.goal}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SprintActionButtons sprintId={sprint.id} status={sprint.status} teamId={teamId} />
        </div>
      </div>

      {/* Progress bar */}
      {totalSP > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{doneSP} / {totalSP} SP concluídos</span>
            <span>{Math.round((doneSP / totalSP) * 100)}%</span>
          </div>
          <Progress value={totalSP > 0 ? (doneSP / totalSP) * 100 : 0} className="h-2" />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Stories</p>
          <p className="text-2xl font-semibold">{stories.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">SP Concluídos</p>
          <p className="text-2xl font-semibold">
            {doneSP}
            <span className="text-sm font-normal text-muted-foreground ml-1">/ {totalSP}</span>
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">
            {sprint.review ? "Velocidade Real" : "Progresso"}
          </p>
          <p className="text-2xl font-semibold">
            {sprint.review
              ? `${sprint.review.velocity ?? doneSP} SP`
              : `${totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0}%`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stories">
        <TabsList>
          <TabsTrigger value="stories">Stories ({stories.length})</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="retro">Retrospectiva</TabsTrigger>
        </TabsList>

        {/* Stories tab */}
        <TabsContent value="stories" className="mt-4">
          <div className="flex justify-end mb-3">
            <AddStoryToSprintDialog sprintId={sprintId} teamId={teamId} />
          </div>
          {stories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <p className="text-muted-foreground text-sm">Nenhuma story neste sprint.</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione stories usando o botão acima.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {stories.map((story: any) => (
                <div
                  key={story.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {story.status === "DONE" ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <CircleIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{story.title}</p>
                      <p className={`text-xs ${PRIORITY_COLORS[story.priority] ?? "text-muted-foreground"}`}>
                        {story.priority}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <Badge variant="secondary" className="text-xs">
                      {STORY_STATUS_LABELS[story.status] ?? story.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {story.storyPoints} SP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Sprint Review tab */}
        <TabsContent value="review" className="mt-4">
          {sprint.review ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sprint Review</CardTitle>
                <CardDescription>
                  Meta atingida:{" "}
                  <strong>{sprint.review.goalMet ? "Sim" : "Não"}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <ZapIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Velocidade real:{" "}
                    <strong>{sprint.review.velocity ?? doneSP} SP</strong>
                  </span>
                </div>
                {sprint.review.demoNotes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Notas da demo</p>
                      <p className="text-sm whitespace-pre-wrap">{sprint.review.demoNotes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <ClockIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">Sprint Review ainda não registrado.</p>
            </div>
          )}
        </TabsContent>

        {/* Retrospective tab */}
        <TabsContent value="retro" className="mt-4">
          {sprint.retro ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-600">O que foi bem</CardTitle>
                </CardHeader>
                <CardContent>
                  {retroWentWell.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum item.</p>
                  ) : (
                    <ul className="list-disc list-inside space-y-1">
                      {retroWentWell.map((item, i) => (
                        <li key={i} className="text-sm">{item}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-orange-600">A melhorar</CardTitle>
                </CardHeader>
                <CardContent>
                  {retroToImprove.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum item.</p>
                  ) : (
                    <ul className="list-disc list-inside space-y-1">
                      {retroToImprove.map((item, i) => (
                        <li key={i} className="text-sm">{item}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-600">Ações</CardTitle>
                </CardHeader>
                <CardContent>
                  {retroActions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma ação.</p>
                  ) : (
                    <ul className="list-disc list-inside space-y-1">
                      {retroActions.map((item, i) => (
                        <li key={i} className="text-sm">{item}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <ClockIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">Retrospectiva ainda não registrada.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
