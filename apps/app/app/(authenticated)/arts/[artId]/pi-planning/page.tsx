import { Badge } from "@repo/design-system/components/ui/badge";
import {
  CalendarIcon,
  LayersIcon,
  RefreshCwIcon,
  ShieldIcon,
  TargetIcon,
  ThumbsUpIcon,
  TrendingUpIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  getAllPISessions,
  getOrCreatePISession,
  getOrCreateVoteRound,
} from "../../../../actions/arts/confidence-vote";
import { getARTById } from "../../../../actions/arts/get-arts";
import {
  getPIPlanById,
  getPIPlanFullDetails,
} from "../../../../actions/arts/pi-plans";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import { NewRoundButton } from "./components/new-round-button";
import { NewSessionButton } from "./components/new-session-button";
import { PiBurnupChart } from "./components/pi-burnup-chart";
import { PiHeader, type PiTab } from "./components/pi-header";
import { PiKpiRow } from "./components/pi-kpi-row";

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-4">
      {[1, 2, 3].map((i) => (
        <div className="h-16 animate-pulse rounded-lg bg-muted/50" key={i} />
      ))}
    </div>
  );
}

const PiWorkspaceTabs = dynamic(
  () => import("./components/pi-workspace-tabs").then((m) => m.PiWorkspaceTabs),
  { loading: () => <div className="h-12 animate-pulse rounded-lg bg-muted/50" /> }
);

const ConfidenceVotePanel = dynamic(
  () =>
    import("./components/confidence-vote-panel").then(
      (m) => m.ConfidenceVotePanel
    ),
  {
    loading: () => (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
        A carregar painel de votação…
      </div>
    ),
  }
);

const PiObjectivesView = dynamic(
  () => import("./components/pi-objectives-view").then((m) => m.PiObjectivesView),
  { loading: () => <TabSkeleton /> }
);

const RiskRoamBoard = dynamic(
  () => import("./components/risk-roam-board").then((m) => m.RiskRoamBoard),
  { loading: () => <TabSkeleton /> }
);

type PIPlanningPageProps = {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{
    piId?: string;
    sessionId?: string;
    round?: string;
    tab?: string;
  }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: PIPlanningPageProps) {
  const { artId } = await params;
  const { piId } = await searchParams;
  const art = await getARTById(artId);
  const pi = piId ? await getPIPlanById(piId) : null;
  return {
    title: pi
      ? `${pi.name} — PI Planning | COSMOS`
      : `PI Planning | ${art?.name ?? "ART"} | COSMOS`,
  };
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  PLANNING: "PI Planning",
  REPLAN: "Replan",
};
const SESSION_TYPE_ICONS: Record<string, ReactNode> = {
  PLANNING: <CalendarIcon className="h-3 w-3" />,
  REPLAN: <RefreshCwIcon className="h-3 w-3" />,
};

const ROUND_STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Não Iniciada",
  OPEN: "Aberta",
  TALLYING: "Apuração",
  REWORK: "Retrabalho",
  APPROVED: "Aprovada",
};

const TAB_KEYS: PiTab[] = ["objectives", "burnup", "roam", "confidence"];

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function computeWeeks(
  startDate: Date | null,
  endDate: Date | null
): { currentWeek: number; totalWeeks: number } {
  if (!(startDate && endDate)) {
    return { currentWeek: 0, totalWeeks: 0 };
  }
  const totalWeeks = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_WEEK)
  );
  const elapsedWeeks =
    Math.floor((Date.now() - startDate.getTime()) / MS_PER_WEEK) + 1;
  const currentWeek = Math.min(totalWeeks, Math.max(1, elapsedWeeks));
  return { currentWeek, totalWeeks };
}

export default async function PIPlanningPage({
  params,
  searchParams,
}: PIPlanningPageProps) {
  const { artId } = await params;
  const { piId, sessionId, round, tab } = await searchParams;

  const art = await getARTById(artId);
  if (!art) {
    notFound();
  }

  // ── Empty state: ART has no PI Plans yet ──
  if (art.piPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--surface-3)", color: "var(--ink-faint)" }}
        >
          <LayersIcon className="h-5 w-5" />
        </div>
        <p className="font-semibold text-[15px]" style={{ color: "var(--ink)" }}>
          Nenhum PI Plan criado ainda
        </p>
        <p className="max-w-sm text-[13px]" style={{ color: "var(--ink-muted)" }}>
          Este ART ainda não tem um Program Increment. Crie o primeiro PI a
          partir da página do ART.
        </p>
        <Link
          className="mt-1 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-[13px] transition-opacity hover:opacity-90"
          href={`/arts/${artId}`}
          style={{ background: "var(--accent-c)", color: "var(--on-accent)" }}
        >
          Ir para o ART
        </Link>
      </div>
    );
  }

  if (!piId) {
    redirect(`/arts/${artId}/pi-planning?piId=${art.piPlans[0].id}`);
  }

  const pi = await getPIPlanById(piId);
  if (!pi) {
    notFound();
  }

  const piDetails = await getPIPlanFullDetails(piId);
  if (!piDetails) {
    notFound();
  }

  // Ensure default PLANNING session exists
  const defaultSession = await getOrCreatePISession(piId);
  const allSessions = await getAllPISessions(piId);

  // Active session: from URL or default
  const activeSession = sessionId
    ? (allSessions.find((s) => s.id === sessionId) ?? defaultSession)
    : defaultSession;

  // Ensure round 1 exists for active session
  await getOrCreateVoteRound(activeSession.id);

  // Refresh sessions after potential creation
  const freshSessions = await getAllPISessions(piId);
  const currentSession =
    freshSessions.find((s) => s.id === activeSession.id) ?? freshSessions[0];
  const rounds = currentSession?.confidenceSessions ?? [];

  const requestedRound = round
    ? Number.parseInt(round, 10)
    : (rounds.at(-1)?.roundNumber ?? 1);
  const activeRound =
    rounds.find((r) => r.roundNumber === requestedRound) ?? rounds.at(-1);

  const latestRound = rounds.at(-1);
  const canAddRound =
    latestRound && ["REWORK", "APPROVED"].includes(latestRound.xStateStatus);

  const activeTab: PiTab = TAB_KEYS.includes(tab as PiTab)
    ? (tab as PiTab)
    : "objectives";

  const { currentWeek, totalWeeks } = computeWeeks(pi.startDate, pi.endDate);

  const objectivesTotal = piDetails.objectives.length;
  const objectivesAchieved = piDetails.objectives.filter(
    (o) => o.status === "ACHIEVED"
  ).length;
  const risksTotal = piDetails.risks.length;
  const risksOpen = piDetails.risks.filter(
    (r) => r.status.toLowerCase() !== "resolved"
  ).length;

  return (
    <div className="flex flex-col">
      <PiHeader
        activeTab={activeTab}
        artId={artId}
        artName={art.name}
        objectivesCount={objectivesTotal}
        otherPis={art.piPlans
          .filter((p) => p.id !== piId)
          .map((p) => ({ id: p.id, name: p.name }))}
        piId={piId}
        piName={pi.name}
        piStatus={pi.status}
        risksCount={risksTotal}
        sessionId={currentSession?.id}
        totalWeeks={totalWeeks}
        currentWeek={currentWeek}
      />

      <div className="flex flex-col gap-5 p-6">
        <PiKpiRow
          completionPct={pi.completionPct}
          currentWeek={currentWeek}
          objectivesAchieved={objectivesAchieved}
          objectivesTotal={objectivesTotal}
          ppm={pi.ppm}
          risksOpen={risksOpen}
          risksTotal={risksTotal}
          totalWeeks={totalWeeks}
        />

        {activeTab === "objectives" && (
          <SectionCard
            icon={TargetIcon}
            subtitle="Business value planejado vs. entregue por objetivo"
            title="PI Objectives"
          >
            <PiObjectivesView
              objectives={piDetails.objectives}
              piPlanId={piId}
              teams={piDetails.teams}
            />
          </SectionCard>
        )}

        {activeTab === "burnup" && (
          <SectionCard
            icon={TrendingUpIcon}
            subtitle={`Semana ${currentWeek} de ${totalWeeks} — escopo vs. entregue`}
            title="Burnup"
          >
            <PiBurnupChart
              currentWeek={currentWeek}
              objectives={piDetails.objectives}
              totalWeeks={totalWeeks}
            />
          </SectionCard>
        )}

        {activeTab === "roam" && (
          <SectionCard
            icon={ShieldIcon}
            subtitle="Resolved · Owned · Accepted · Mitigated"
            title="ROAM Risks"
          >
            <RiskRoamBoard piPlanId={piId} risks={piDetails.risks} />
          </SectionCard>
        )}

        {activeTab === "confidence" && (
          <SectionCard
            actions={<NewSessionButton artId={artId} piPlanId={piId} />}
            icon={ThumbsUpIcon}
            subtitle="Sessões e rodadas de votação de confiança"
            title="Confidence Vote"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1.5">
                {freshSessions.map((s) => {
                  const isActive = s.id === currentSession?.id;
                  const lastRound = s.confidenceSessions.at(-1);
                  return (
                    <Link
                      href={`/arts/${artId}/pi-planning?piId=${piId}&tab=confidence&sessionId=${s.id}`}
                      key={s.id}
                    >
                      <button
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                        ].join(" ")}
                        type="button"
                      >
                        {SESSION_TYPE_ICONS[s.type]}
                        {SESSION_TYPE_LABELS[s.type] ?? s.type}
                        {lastRound && (
                          <Badge
                            className="h-4 border-current px-1 text-[10px]"
                            variant="outline"
                          >
                            {ROUND_STATE_LABELS[lastRound.xStateStatus] ??
                              lastRound.xStateStatus}
                          </Badge>
                        )}
                      </button>
                    </Link>
                  );
                })}
              </div>

              {rounds.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Rodadas — {SESSION_TYPE_LABELS[currentSession?.type ?? "PLANNING"]}
                    </p>
                    {canAddRound && (
                      <NewRoundButton
                        artId={artId}
                        piId={piId}
                        piSessionId={currentSession!.id}
                      />
                    )}
                  </div>

                  {rounds.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {rounds.map((r) => (
                        <Link
                          href={`/arts/${artId}/pi-planning?piId=${piId}&tab=confidence&sessionId=${currentSession?.id}&round=${r.roundNumber}`}
                          key={r.id}
                        >
                          <button
                            className={[
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                              r.roundNumber === requestedRound
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-muted-foreground/50",
                            ].join(" ")}
                            type="button"
                          >
                            Rodada {r.roundNumber}
                          </button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeRound && (
                <ConfidenceVotePanel
                  roundNumber={activeRound.roundNumber}
                  sessionId={activeRound.id}
                  votes={activeRound.votes as number[]}
                  xStateStatus={activeRound.xStateStatus}
                />
              )}
            </div>
          </SectionCard>
        )}

        {/* Extra workspace — program board + team breakout (no prototype equivalent, preserved as-is) */}
        {piDetails && (
          <SectionCard
            icon={LayersIcon}
            subtitle="Program Board · Team Breakout"
            title="Workspace de PI Planning"
          >
            <PiWorkspaceTabs piPlan={piDetails} />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
