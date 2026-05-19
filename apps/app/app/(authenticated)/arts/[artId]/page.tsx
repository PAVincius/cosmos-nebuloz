import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { database } from "@repo/database";
import { getARTById } from "../../../actions/arts/get-arts";
import { getBacklogFeatures, getTeamsForART } from "../../../actions/arts/pi-plans";
import { getARTObservability } from "../../../actions/arts/observability";
import { ARTEventTimeline } from "./components/art-event-timeline";
import { ARTHealthIndicatorsPanel } from "./components/art-health-indicators";
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
  ActivityIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ChevronRightIcon,
  LayoutGridIcon,
  TargetIcon,
  TrendingUpIcon,
  VoteIcon,
  UsersIcon,
  ClockIcon,
} from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import type { CreatePIWizardProps } from "./components/create-pi-wizard";
const CreatePIWizard = dynamic(
  () => import("./components/create-pi-wizard").then((m) => m.CreatePIWizard),
  {
    loading: () => (
      <div className="h-9 w-22 shrink-0 animate-pulse rounded-md bg-muted" aria-hidden title="A carregar…" />
    ),
  }
);

interface ARTPageProps {
  params: Promise<{ artId: string }>;
}

const STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Não Iniciado",
  OPEN: "Votação Aberta",
  TALLYING: "Apuração",
  REWORK: "Retrabalho",
  APPROVED: "Aprovado",
};

const STATE_COLORS: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  NOT_STARTED: "secondary",
  OPEN: "default",
  TALLYING: "outline",
  REWORK: "destructive",
  APPROVED: "default",
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

  if (!art) notFound();

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[{ label: "ART Board", href: "/arts" }]}
        title={art.name}
        subtitle={`Cadência: ${art.cadence} semanas por PI`}
        stats={[
          { label: "Times", value: teams.length, icon: UsersIcon },
          { label: "Semanas por PI", value: art.cadence, icon: ClockIcon },
        ]}
        actions={
          <CreatePIWizard
            artId={artId}
            artName={art.name}
            cadence={art.cadence}
            nextPINumber={art.piPlans.length + 1}
            teams={teams}
            features={features as CreatePIWizardProps["features"]}
          />
        }
      />

      <div className={appDesign.bodyScroll}>
      <div className="flex flex-col gap-6">

        {/* Quick navigation */}
        {art.piPlans.length > 0 && (() => {
          const latestPi = art.piPlans[0];
          return (
            <div className="flex flex-wrap gap-2">
              <Link href={`/arts/${artId}/pi-planning?piId=${latestPi.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  PI Workspace
                </Button>
              </Link>
              <Link href={`/arts/${artId}/program-board?piPlanId=${latestPi.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <LayoutGridIcon className="h-3.5 w-3.5" />
                  Program Board
                </Button>
              </Link>
              <Link href={`/analytics/flow?artId=${artId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <TrendingUpIcon className="h-3.5 w-3.5" />
                  Flow Metrics
                </Button>
              </Link>
              <Link href={`/portfolio/okrs?artId=${artId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <TargetIcon className="h-3.5 w-3.5" />
                  OKRs do ART
                </Button>
              </Link>
              <Link href={`/arts/${artId}/post-pi?piPlanId=${latestPi.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ActivityIcon className="h-3.5 w-3.5" />
                  Inspect &amp; Adapt
                </Button>
              </Link>
              <Link href={`/arts/${artId}/impediments`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <AlertTriangleIcon className="h-3.5 w-3.5" />
                  Impedimentos
                </Button>
              </Link>
            </div>
          );
        })()}

      {art.piPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <CalendarIcon className="text-muted-foreground mb-4 h-10 w-10" />
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
              <Card key={pi.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <VoteIcon className="text-primary h-5 w-5" />
                    <Badge variant={STATE_COLORS[state] ?? "secondary"}>
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
                    <Button className="w-full" size="sm" variant="outline">
                      PI Planning
                      <ChevronRightIcon className="ml-auto h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

        {/* Observability: Event Timeline */}
        <div className={appDesign.section}>
          <div className={appDesign.sectionHeader}>
            <h3 className={appDesign.sectionTitle}>Timeline de Eventos</h3>
            <p className={appDesign.sectionDesc}>
              PI Planning, System Demo e Inspect &amp; Adapt por PI
            </p>
          </div>
          <div className="p-5">
            <ARTEventTimeline events={observability.events} />
          </div>
        </div>

        {/* Observability: Health Indicators */}
        <div className={appDesign.section}>
          <div className={appDesign.sectionHeader}>
            <h3 className={appDesign.sectionTitle}>Saúde do ART</h3>
            <p className={appDesign.sectionDesc}>
              Riscos ativos, predictability e objetivos por PI
            </p>
          </div>
          <div className="p-5">
            <ARTHealthIndicatorsPanel health={observability.health} />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
