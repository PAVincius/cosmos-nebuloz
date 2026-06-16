import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Progress } from "@repo/design-system/components/ui/progress";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import {
  CalendarIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  ZapIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getSprintById } from "@/app/actions/sprints";
import { appDesign } from "@/lib/app-design";
import { getTeamById } from "../../../actions";
import { AddStoryToSprintDialog } from "../components/add-story-to-sprint-dialog";
import { SprintActionButtons } from "../components/sprint-action-buttons";

type SprintDetailPageProps = {
  params: Promise<{ teamId: string; sprintId: string }>;
};

type SprintStory = {
  id: string;
  title: string;
  storyPoints: number | null;
  status: string;
  priority: string;
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

export default async function SprintDetailPage({
  params,
}: SprintDetailPageProps) {
  const { teamId, sprintId } = await params;

  const [team, sprintResult] = await Promise.all([
    getTeamById(teamId),
    getSprintById(sprintId),
  ]);

  const sprint = sprintResult.ok ? sprintResult.data : null;

  if (!(team && sprint)) {
    notFound();
  }

  function formatDate(d: Date) {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const stories = (sprint.stories ?? []) as SprintStory[];
  const totalSP = stories.reduce((s, st) => s + (st.storyPoints ?? 0), 0);
  const doneSP = stories
    .filter((st) => st.status === "DONE")
    .reduce((s, st) => s + (st.storyPoints ?? 0), 0);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <SprintActionButtons
            sprintId={sprint.id}
            status={sprint.status}
            teamId={teamId}
          />
        }
        badge={
          <Badge variant={STATUS_VARIANTS[sprint.status] ?? "secondary"}>
            {STATUS_LABELS[sprint.status] ?? sprint.status}
          </Badge>
        }
        breadcrumb={[
          { label: team.name, href: `/teams/${teamId}` },
          { label: "Sprints", href: `/teams/${teamId}/sprints` },
          { label: sprint.name },
        ]}
        stats={[
          {
            label: "Período",
            value: `${formatDate(sprint.startDate)} — ${formatDate(sprint.endDate)}`,
            icon: CalendarIcon,
          },
          ...(sprint.capacity
            ? [
                {
                  label: "Capacidade",
                  value: `${sprint.capacity} SP`,
                  icon: ZapIcon,
                },
              ]
            : []),
        ]}
        subtitle={sprint.goal ?? undefined}
        title={sprint.name}
      />
      <div className={appDesign.bodyScroll}>
        <SprintBodyContent
          doneSP={doneSP}
          sprint={sprint}
          sprintId={sprintId}
          stories={stories}
          teamId={teamId}
          totalSP={totalSP}
        />
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SprintData = any;

function SprintBodyContent({
  sprint,
  stories,
  teamId,
  sprintId,
  doneSP,
  totalSP,
}: {
  sprint: SprintData;
  stories: SprintStory[];
  teamId: string;
  sprintId: string;
  doneSP: number;
  totalSP: number;
}) {
  const retroWentWell = (sprint.retro?.wentWell as string[] | undefined) ?? [];
  const retroToImprove =
    (sprint.retro?.toImprove as string[] | undefined) ?? [];
  const retroActions = (sprint.retro?.actions as string[] | undefined) ?? [];
  const progressPct = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0;
  const velocityLabel = sprint.review ? "Velocidade Real" : "Progresso";
  const velocityValue = sprint.review
    ? `${sprint.review.velocity ?? doneSP} SP`
    : `${progressPct}%`;

  return (
    <div className="flex flex-col gap-6">
      {totalSP > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>
              {doneSP} / {totalSP} SP concluídos
            </span>
            <span>{progressPct}%</span>
          </div>
          <Progress className="h-2" value={(doneSP / totalSP) * 100} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-4">
          <p className="mb-1 text-muted-foreground text-xs">Stories</p>
          <p className="font-semibold text-2xl">{stories.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="mb-1 text-muted-foreground text-xs">SP Concluídos</p>
          <p className="font-semibold text-2xl">
            {doneSP}
            <span className="ml-1 font-normal text-muted-foreground text-sm">
              / {totalSP}
            </span>
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="mb-1 text-muted-foreground text-xs">{velocityLabel}</p>
          <p className="font-semibold text-2xl">{velocityValue}</p>
        </div>
      </div>

      <Tabs defaultValue="stories">
        <TabsList>
          <TabsTrigger value="stories">Stories ({stories.length})</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="retro">Retrospectiva</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-4" value="stories">
          <div className="mb-3 flex justify-end">
            <AddStoryToSprintDialog sprintId={sprintId} teamId={teamId} />
          </div>
          <SprintStoriesList stories={stories} />
        </TabsContent>

        <TabsContent className="mt-4" value="review">
          <SprintReviewContent doneSP={doneSP} review={sprint.review} />
        </TabsContent>

        <TabsContent className="mt-4" value="retro">
          <SprintRetroContent
            actions={retroActions}
            hasRetro={!!sprint.retro}
            toImprove={retroToImprove}
            wentWell={retroWentWell}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SprintStoriesList({ stories }: { stories: SprintStory[] }) {
  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhuma story neste sprint.
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          Adicione stories usando o botão acima.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {stories.map((story) => (
        <StoryListItem key={story.id} story={story} />
      ))}
    </div>
  );
}

function StoryListItem({ story }: { story: SprintStory }) {
  const priorityColor =
    PRIORITY_COLORS[story.priority] ?? "text-muted-foreground";
  const statusLabel = STORY_STATUS_LABELS[story.status] ?? story.status;
  const isDone = story.status === "DONE";

  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {isDone ? (
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-500" />
        ) : (
          <CircleIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{story.title}</p>
          <p className={`text-xs ${priorityColor}`}>{story.priority}</p>
        </div>
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-3">
        <Badge className="text-xs" variant="secondary">
          {statusLabel}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {story.storyPoints} SP
        </span>
      </div>
    </div>
  );
}

type SprintReview = {
  goalMet?: boolean;
  velocity?: number | null;
  demoNotes?: string | null;
} | null;

function SprintReviewContent({
  review,
  doneSP,
}: {
  review: SprintReview;
  doneSP: number;
}) {
  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <ClockIcon className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Sprint Review ainda não registrado.
        </p>
      </div>
    );
  }

  const goalText = review.goalMet ? "Sim" : "Não";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sprint Review</CardTitle>
        <p className="text-muted-foreground text-sm">
          Meta atingida: <strong>{goalText}</strong>
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ZapIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            Velocidade real: <strong>{review.velocity ?? doneSP} SP</strong>
          </span>
        </div>
        {!!review.demoNotes && (
          <>
            <Separator />
            <div>
              <p className="mb-1 text-muted-foreground text-xs">
                Notas da demo
              </p>
              <p className="whitespace-pre-wrap text-sm">{review.demoNotes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SprintRetroContent({
  hasRetro,
  wentWell,
  toImprove,
  actions,
}: {
  hasRetro: boolean;
  wentWell: string[];
  toImprove: string[];
  actions: string[];
}) {
  if (!hasRetro) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <ClockIcon className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Retrospectiva ainda não registrada.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <RetroCard
        color="text-green-600"
        items={wentWell}
        title="O que foi bem"
      />
      <RetroCard color="text-orange-600" items={toImprove} title="A melhorar" />
      <RetroCard color="text-blue-600" items={actions} title="Ações" />
    </div>
  );
}

function RetroCard({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: string[];
}) {
  const emptyText = title === "Ações" ? "Nenhuma ação." : "Nenhum item.";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`${color} text-sm`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-xs">{emptyText}</p>
        ) : (
          <ul className="list-inside list-disc space-y-1">
            {items.map((item) => (
              <li className="text-sm" key={item}>
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
