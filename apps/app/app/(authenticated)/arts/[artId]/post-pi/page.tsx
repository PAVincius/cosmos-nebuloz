import { notFound } from "next/navigation";
import Link from "next/link";
import { getARTById } from "@/app/actions/arts/get-arts";
import { database } from "@repo/database";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  TrendingUpIcon,
  TargetIcon,
  ShieldAlertIcon,
  BarChart3Icon,
} from "lucide-react";
import { LessonsLearnedForm } from "./components/lessons-learned-form";
import { ClosePIButton } from "./components/close-pi-button";
import type { Metadata } from "next";

interface PostPIPageProps {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ piPlanId?: string }>;
}

export async function generateMetadata({ params }: PostPIPageProps): Promise<Metadata> {
  const { artId } = await params;
  const art = await getARTById(artId);
  return {
    title: art ? `Post-PI / I&A – ${art.name} | COSMOS` : "Post-PI | COSMOS",
    description: "Inspect & Adapt — retrospectiva do PI SAFe 6.0",
  };
}

const OBJ_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Não Iniciado",
  IN_PROGRESS: "Em Progresso",
  ACHIEVED: "Atingido",
  MISSED: "Não Atingido",
};

const OBJ_STATUS_VARIANT: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ACHIEVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  MISSED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const ROAM_LABELS: Record<string, string> = {
  IDENTIFIED: "Identificado",
  RESOLVED: "Resolvido",
  OWNED: "Responsável",
  ACCEPTED: "Aceito",
  MITIGATED: "Mitigado",
};

const ROAM_VARIANT: Record<string, string> = {
  IDENTIFIED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  RESOLVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  OWNED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ACCEPTED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  MITIGATED: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

export default async function PostPIPage({ params, searchParams }: PostPIPageProps) {
  const { artId } = await params;
  const { piPlanId } = await searchParams;

  const ctx = await requireTenantSession(await headers());
  const art = await getARTById(artId);
  if (!art) notFound();

  // Get PI Plans for this ART ordered by newest first.
  const piPlans = await database.pIPlan.findMany({
    where: { artId, tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  const selectedPiId = piPlanId ?? piPlans[0]?.id;
  const selectedPi = piPlans.find((p) => p.id === selectedPiId) ?? null;

  if (!selectedPi) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href={`/arts/${artId}`}>
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            {art.name}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Post-PI / Inspect & Adapt</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum PI Plan encontrado. Crie um PI Plan para usar o Inspect & Adapt.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch all data for the selected PI.
  const [objectives, risks, sessions] = await Promise.all([
    database.pIObjective.findMany({
      where: { piPlanId: selectedPi.id, tenantId: ctx.tenantId },
      orderBy: [{ isStretch: "asc" }, { businessValue: "desc" }],
    }),
    database.risk.findMany({
      where: { piPlanId: selectedPi.id, tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    }),
    database.pISession.findMany({
      where: { piPlanId: selectedPi.id, tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // PI Predictability: committed (non-stretch) achieved / total committed.
  const committed = objectives.filter((o) => !o.isStretch);
  const achieved = committed.filter((o) => o.status === "ACHIEVED");
  const predictability =
    committed.length > 0 ? Math.round((achieved.length / committed.length) * 100) : null;

  // Velocity average across sessions (mock: using storyPoints if available).
  // Since velocity per session isn't tracked, we show team velocity averages.
  const teams = await database.team.findMany({
    where: { artId, tenantId: ctx.tenantId },
    select: { id: true, name: true, velocity: true },
  });
  const velocityAvg =
    teams.filter((t) => t.velocity != null).length > 0
      ? Math.round(
          teams.reduce((s, t) => s + (t.velocity ?? 0), 0) /
            teams.filter((t) => t.velocity != null).length
        )
      : null;

  // ROAM summary.
  const roamSummary = {
    RESOLVED: risks.filter((r) => r.status === "RESOLVED").length,
    OWNED: risks.filter((r) => r.status === "OWNED").length,
    ACCEPTED: risks.filter((r) => r.status === "ACCEPTED").length,
    MITIGATED: risks.filter((r) => r.status === "MITIGATED").length,
    IDENTIFIED: risks.filter((r) => r.status === "IDENTIFIED").length,
  };

  // Latest session with notes for Lessons Learned.
  const latestSession = sessions.find((s) => s.notes) ?? sessions[0] ?? null;
  const initialNotes = latestSession?.notes ?? "";

  const isPiClosed = !!selectedPi.endDate;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href={`/arts/${artId}`}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          {art.name}
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3Icon className="h-6 w-6 text-muted-foreground" />
            Post-PI / Inspect & Adapt
          </h1>
          <p className="text-sm text-muted-foreground">
            Retrospectiva do PI — {art.name}
          </p>
        </div>

        {/* PI selector & close button */}
        <div className="flex flex-col items-end gap-2">
          {piPlans.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {piPlans.map((pi) => (
                <Link key={pi.id} href={`/arts/${artId}/post-pi?piPlanId=${pi.id}`}>
                  <Badge
                    variant={pi.id === selectedPi.id ? "default" : "outline"}
                    className="cursor-pointer"
                  >
                    {pi.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
          {!isPiClosed && (
            <ClosePIButton
              piPlanId={selectedPi.id}
              artId={artId}
              piName={selectedPi.name}
            />
          )}
          {isPiClosed && (
            <Badge variant="secondary" className="text-xs">
              PI Encerrado em{" "}
              {selectedPi.endDate
                ? new Date(selectedPi.endDate).toLocaleDateString("pt-BR")
                : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TargetIcon className="h-4 w-4" />
              PI Predictability
            </CardDescription>
            <CardTitle className="text-4xl font-bold tabular-nums">
              {predictability !== null ? `${predictability}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {achieved.length}/{committed.length} objetivos commitados atingidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUpIcon className="h-4 w-4" />
              Velocity Média
            </CardDescription>
            <CardTitle className="text-4xl font-bold tabular-nums">
              {velocityAvg !== null ? `${velocityAvg} SP` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Média dos times com velocity cadastrada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ShieldAlertIcon className="h-4 w-4" />
              Riscos ROAM
            </CardDescription>
            <CardTitle className="text-4xl font-bold tabular-nums">{risks.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {roamSummary.RESOLVED + roamSummary.MITIGATED} resolvidos/mitigados ·{" "}
              {roamSummary.ACCEPTED} aceitos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PI Objectives */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">PI Objectives — Status Final</CardTitle>
              <CardDescription>
                Resultado dos objetivos comprometidos e stretch
              </CardDescription>
            </div>
            <Badge variant="secondary">{objectives.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {objectives.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum PI Objective registrado para este PI.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {objectives.map((obj) => (
                <div
                  key={obj.id}
                  className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{obj.title}</span>
                      {obj.isStretch && (
                        <Badge variant="outline" className="text-[10px]">
                          Stretch
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      BV: {obj.businessValue}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      OBJ_STATUS_VARIANT[obj.status] ?? ""
                    }`}
                  >
                    {OBJ_STATUS_LABELS[obj.status] ?? obj.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROAM Risks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riscos ROAM — Resumo</CardTitle>
          <CardDescription>Distribuição por status ao final do PI</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* ROAM summary boxes */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(roamSummary).map(([status, count]) => (
              <div
                key={status}
                className={`flex flex-col items-center rounded-lg p-2 text-center ${
                  ROAM_VARIANT[status] ?? "bg-muted text-muted-foreground"
                }`}
              >
                <span className="text-xl font-bold tabular-nums">{count}</span>
                <span className="text-xs">{ROAM_LABELS[status] ?? status}</span>
              </div>
            ))}
          </div>

          {/* Risk list */}
          {risks.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {risks.map((risk) => (
                <div
                  key={risk.id}
                  className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{risk.title}</span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      ROAM_VARIANT[risk.status] ?? ""
                    }`}
                  >
                    {ROAM_LABELS[risk.status] ?? risk.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {risks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum risco registrado para este PI.{" "}
              <Link href="/risks" className="underline">
                Registre riscos
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lessons learned */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lições Aprendidas</CardTitle>
          <CardDescription>
            Notas da cerimônia Inspect & Adapt — salvas na sessão do PI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LessonsLearnedForm
            piSessionId={latestSession?.id ?? null}
            piPlanId={selectedPi.id}
            artId={artId}
            initialNotes={initialNotes}
          />
        </CardContent>
      </Card>
    </div>
  );
}
