import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { ArrowLeftIcon, CalendarIcon, RefreshCwIcon } from "lucide-react";
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
import { NewRoundButton } from "./components/new-round-button";
import { NewSessionButton } from "./components/new-session-button";

const PiWorkspaceTabs = dynamic(
  () => import("./components/pi-workspace-tabs").then((m) => m.PiWorkspaceTabs),
  {
    loading: () => (
      <div className="h-12 animate-pulse rounded-lg bg-muted/50" />
    ),
  }
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

type PIPlanningPageProps = {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ piId?: string; sessionId?: string; round?: string }>;
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

export default async function PIPlanningPage({
  params,
  searchParams,
}: PIPlanningPageProps) {
  const { artId } = await params;
  const { piId, sessionId, round } = await searchParams;

  const art = await getARTById(artId);
  if (!art) {
    notFound();
  }

  if (!piId) {
    const firstPi = art.piPlans[0];
    if (firstPi) {
      redirect(`/arts/${artId}/pi-planning?piId=${firstPi.id}`);
    }
    redirect(`/arts/${artId}`);
  }

  const pi = await getPIPlanById(piId);
  if (!pi) {
    notFound();
  }

  const piDetails = await getPIPlanFullDetails(piId);

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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2 text-sm">
        <Link
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          href={`/arts/${artId}`}
        >
          <ArrowLeftIcon className="h-3 w-3" />
          {art.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{pi.name} — PI Planning</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: PI Info */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{pi.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-muted-foreground text-sm">
                <div>
                  <p className="mb-1 font-medium text-xs uppercase tracking-wide">
                    ART
                  </p>
                  <p className="text-foreground">{art.name}</p>
                </div>
                <div>
                  <p className="mb-1 font-medium text-xs uppercase tracking-wide">
                    Cadência
                  </p>
                  <p className="text-foreground">{art.cadence} semanas</p>
                </div>
                {pi.startDate && (
                  <div>
                    <p className="mb-1 font-medium text-xs uppercase tracking-wide">
                      Início
                    </p>
                    <p className="text-foreground">
                      {new Date(pi.startDate).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                )}
                {pi.endDate && (
                  <div>
                    <p className="mb-1 font-medium text-xs uppercase tracking-wide">
                      Fim
                    </p>
                    <p className="text-foreground">
                      {new Date(pi.endDate).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {art.piPlans.length > 1 && (
            <div>
              <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Outros PIs neste ART
              </p>
              <div className="flex flex-wrap gap-2">
                {art.piPlans
                  .filter((p) => p.id !== piId)
                  .map((p) => (
                    <Link
                      href={`/arts/${artId}/pi-planning?piId=${p.id}`}
                      key={p.id}
                    >
                      <Button size="sm" variant="outline">
                        {p.name}
                      </Button>
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Sessions + Vote */}
        <div className="flex flex-col gap-3">
          {/* Session selector */}
          <div className="flex items-center justify-between">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Sessões
            </p>
            <NewSessionButton artId={artId} piPlanId={piId} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {freshSessions.map((s) => {
              const isActive = s.id === currentSession?.id;
              const lastRound = s.confidenceSessions.at(-1);
              return (
                <Link
                  href={`/arts/${artId}/pi-planning?piId=${piId}&sessionId=${s.id}`}
                  key={s.id}
                >
                  <button
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                    ].join(" ")}
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

          {/* Round selector */}
          {rounds.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Rodadas —{" "}
                  {SESSION_TYPE_LABELS[currentSession?.type ?? "PLANNING"]}
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
                      href={`/arts/${artId}/pi-planning?piId=${piId}&sessionId=${currentSession?.id}&round=${r.roundNumber}`}
                      key={r.id}
                    >
                      <button
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                          r.roundNumber === requestedRound
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-muted-foreground/50",
                        ].join(" ")}
                      >
                        Rodada {r.roundNumber}
                        <Badge
                          className="h-4 border-current px-1 text-[10px]"
                          variant="outline"
                        >
                          {ROUND_STATE_LABELS[r.xStateStatus] ?? r.xStateStatus}
                        </Badge>
                      </button>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {activeRound && (
            <ConfidenceVotePanel
              roundNumber={activeRound.roundNumber}
              sessionId={activeRound.id}
              votes={(activeRound.votes as number[]) ?? []}
              xStateStatus={activeRound.xStateStatus}
            />
          )}
        </div>
      </div>

      {/* ── Workspace Tabs: Program Board · Team Breakout · Objetivos · ROAM ── */}
      {piDetails && (
        <div>
          <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Workspace de PI Planning
          </h2>
          <PiWorkspaceTabs piPlan={piDetails} />
        </div>
      )}
    </div>
  );
}
