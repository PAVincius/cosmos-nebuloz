import { Badge } from "@repo/design-system/components/cosmos/badge";
import { CosmosButton } from "@repo/design-system/components/cosmos/cosmos-button";
import { SectionCard } from "@repo/design-system/components/cosmos/section-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  LayoutGridIcon,
  TargetIcon,
  TrendingUpIcon,
  UsersIcon,
  VoteIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { getARTById } from "../../../actions/arts/get-arts";
import { getARTObservability } from "../../../actions/arts/observability";
import {
  getBacklogFeatures,
  getTeamsForART,
} from "../../../actions/arts/pi-plans";
import { ARTEventTimeline } from "./components/art-event-timeline";
import { ARTHealthIndicatorsPanel } from "./components/art-health-indicators";
import type { CreatePIWizardProps } from "./components/create-pi-wizard";

const CreatePIWizard = dynamic(
  () => import("./components/create-pi-wizard").then((m) => m.CreatePIWizard),
  {
    loading: () => (
      <div
        aria-hidden
        className="h-9 w-22 shrink-0 animate-pulse rounded-md bg-muted"
        title="A carregar…"
      />
    ),
  }
);

type ARTPageProps = {
  params: Promise<{ artId: string }>;
};

const STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Não Iniciado",
  OPEN: "Votação Aberta",
  TALLYING: "Apuração",
  REWORK: "Retrabalho",
  APPROVED: "Aprovado",
};

const STATE_TONES: Record<
  string,
  "neutral" | "accent" | "amber" | "red" | "green"
> = {
  NOT_STARTED: "neutral",
  OPEN: "accent",
  TALLYING: "amber",
  REWORK: "red",
  APPROVED: "green",
};

export async function generateMetadata({ params }: ARTPageProps) {
  const { artId } = await params;
  const art = await getARTById(artId);
  return {
    title: art ? `${art.name} | COSMOS` : "ART | COSMOS",
  };
}

export default async function ARTDetailPage({ params }: ARTPageProps) {
  const { artId } = await params;

  const [art, teams, features, observability] = await Promise.all([
    getARTById(artId),
    getTeamsForART(artId),
    getBacklogFeatures(),
    getARTObservability(artId),
  ]);

  if (!art) {
    notFound();
  }

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <CreatePIWizard
            artId={artId}
            artName={art.name}
            cadence={art.cadence}
            features={features as CreatePIWizardProps["features"]}
            nextPINumber={art.piPlans.length + 1}
            teams={teams}
          />
        }
        breadcrumb={[{ label: "ART Board", href: "/arts" }]}
        stats={[
          { label: "Times", value: teams.length, icon: UsersIcon },
          { label: "Semanas por PI", value: art.cadence, icon: ClockIcon },
        ]}
        subtitle={`Cadência: ${art.cadence} semanas por PI`}
        title={art.name}
      />

      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          {/* Quick navigation */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/arts/${artId}/impediments`}>
              <CosmosButton className="gap-1.5" size="sm" variant="ghost">
                <AlertTriangleIcon className="h-3.5 w-3.5" />
                Impedimentos
              </CosmosButton>
            </Link>
            <Link href={`/analytics/flow?scope=art&scopeId=${artId}`}>
              <CosmosButton className="gap-1.5" size="sm" variant="ghost">
                <TrendingUpIcon className="h-3.5 w-3.5" />
                Flow Metrics
              </CosmosButton>
            </Link>
            <Link href={`/portfolio/okrs?artId=${artId}`}>
              <CosmosButton className="gap-1.5" size="sm" variant="ghost">
                <TargetIcon className="h-3.5 w-3.5" />
                OKRs do ART
              </CosmosButton>
            </Link>
            {art.piPlans.length > 0 &&
              (() => {
                const latestPi = art.piPlans[0];
                return (
                  <>
                    <Link
                      href={`/arts/${artId}/pi-planning?piId=${latestPi.id}`}
                    >
                      <CosmosButton
                        className="gap-1.5"
                        size="sm"
                        variant="ghost"
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        PI Workspace
                      </CosmosButton>
                    </Link>
                    <Link
                      href={`/arts/${artId}/program-board?piPlanId=${latestPi.id}`}
                    >
                      <CosmosButton
                        className="gap-1.5"
                        size="sm"
                        variant="ghost"
                      >
                        <LayoutGridIcon className="h-3.5 w-3.5" />
                        Program Board
                      </CosmosButton>
                    </Link>
                    <Link
                      href={`/arts/${artId}/post-pi?piPlanId=${latestPi.id}`}
                    >
                      <CosmosButton
                        className="gap-1.5"
                        size="sm"
                        variant="ghost"
                      >
                        <ActivityIcon className="h-3.5 w-3.5" />
                        Inspect &amp; Adapt
                      </CosmosButton>
                    </Link>
                  </>
                );
              })()}
          </div>

          {art.piPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <CalendarIcon className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                Nenhum Program Increment criado ainda.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {art.piPlans.map((pi) => {
                const latestRound = pi.piSessions[0]?.confidenceSessions.at(-1);
                const state = latestRound?.xStateStatus ?? "NOT_STARTED";
                return (
                  <Card
                    className="transition-colors hover:border-primary/50"
                    key={pi.id}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <VoteIcon className="h-5 w-5 text-primary" />
                        <Badge tone={STATE_TONES[state] ?? "neutral"}>
                          {STATE_LABELS[state] ?? state}
                        </Badge>
                      </div>
                      <CardTitle className="text-base">{pi.name}</CardTitle>
                      <CardDescription>
                        {latestRound
                          ? `${(latestRound.votes as number[]).length} voto(s) registrado(s)`
                          : "Votação não iniciada"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={`/arts/${artId}/pi-planning?piId=${pi.id}`}>
                        <CosmosButton className="w-full" size="sm">
                          PI Planning
                          <ChevronRightIcon className="ml-auto h-4 w-4" />
                        </CosmosButton>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <SectionCard
            description="PI Planning, System Demo e Inspect & Adapt por PI"
            icon={<CalendarIcon className="h-4 w-4" />}
            title="Timeline de Eventos"
          >
            <ARTEventTimeline events={observability.events} />
          </SectionCard>

          <SectionCard
            description="Riscos ativos, predictability e objetivos por PI"
            icon={<ActivityIcon className="h-4 w-4" />}
            title="Saúde do ART"
          >
            <ARTHealthIndicatorsPanel health={observability.health} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
