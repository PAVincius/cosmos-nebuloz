import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClipboardListIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getARTById } from "@/app/actions/arts/get-arts";
import {
  getBacklogFeatures,
  getTeamsForART,
} from "@/app/actions/arts/pi-plans";
import { getRisks } from "@/app/actions/risks";

type PrePIPageProps = {
  params: Promise<{ artId: string }>;
};

export async function generateMetadata({
  params,
}: PrePIPageProps): Promise<Metadata> {
  const { artId } = await params;
  const art = await getARTById(artId);
  return {
    title: art
      ? `Pre-PI Planning – ${art.name} | COSMOS`
      : "Pre-PI Planning | COSMOS",
    description: "Checklist de readiness para PI Planning SAFe 6.0",
  };
}

const IMPACT_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

const IMPACT_VARIANTS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default async function PrePIPage({ params }: PrePIPageProps) {
  const { artId } = await params;

  const ctx = await requireTenantSession(await headers());

  const [art, teams, backlogFeatures, allRisks] = await Promise.all([
    getARTById(artId),
    getTeamsForART(artId),
    getBacklogFeatures(),
    getRisks(),
  ]);

  if (!art) {
    notFound();
  }

  // Features ready for PI (statusId REVIEW or IMPLEMENTING means refined)
  const readyFeatures = backlogFeatures.filter((f) =>
    ["REVIEW", "IMPLEMENTING"].includes(f.statusId)
  );

  // Teams with velocity informed
  const teamsWithCapacity = teams.filter((t) => t.velocity != null);

  // PI Objectives count for latest PI
  const latestPi = art.piPlans?.[0] ?? null;
  const objectivesCount = latestPi
    ? await database.pIObjective.count({
        where: { piPlanId: latestPi.id, tenantId: ctx.tenantId },
      })
    : 0;

  // Risks identified before PI (no piPlan or in latest PI)
  const preRisks = allRisks.filter(
    (r) =>
      r.status === "IDENTIFIED" && (!r.piPlanId || r.piPlanId === latestPi?.id)
  );

  const totalCapacity = teamsWithCapacity.reduce(
    (sum, t) => sum + (t.velocity ?? 0),
    0
  );

  // Readiness checklist items
  const checklist = [
    {
      id: "ready-features",
      label: "Features prontas (status REVIEW/IMPLEMENTING)",
      done: readyFeatures.length >= 5,
      detail: `${readyFeatures.length} features refinadas`,
    },
    {
      id: "capacity",
      label: "Capacity informada para todos os times",
      done: teams.length > 0 && teamsWithCapacity.length === teams.length,
      detail:
        teams.length === 0
          ? "Nenhum time cadastrado"
          : `${teamsWithCapacity.length}/${teams.length} times com velocity`,
    },
    {
      id: "objectives",
      label: "PI Objectives em draft",
      done: objectivesCount > 0,
      detail: `${objectivesCount} objetivos rascunhados no último PI`,
    },
    {
      id: "risks",
      label: "Riscos identificados e registrados",
      done: preRisks.length > 0,
      detail: `${preRisks.length} riscos identificados`,
    },
    {
      id: "teams",
      label: "Times do ART cadastrados",
      done: teams.length > 0,
      detail: `${teams.length} times`,
    },
  ];

  const doneCount = checklist.filter((c) => c.done).length;
  const readinessPercent = Math.round((doneCount / checklist.length) * 100);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back */}
      <Button asChild className="-ml-2 w-fit" size="sm" variant="ghost">
        <Link href={`/arts/${artId}`}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          {art.name}
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
          <ClipboardListIcon className="h-6 w-6 text-muted-foreground" />
          Pre-PI Planning
        </h1>
        <p className="text-muted-foreground text-sm">
          Checklist de readiness antes do PI Planning — {art.name}
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CheckCircle2Icon className="h-4 w-4" />
              Readiness
            </CardDescription>
            <CardTitle className="font-bold text-3xl tabular-nums">
              {readinessPercent}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              {doneCount}/{checklist.length} critérios atendidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ZapIcon className="h-4 w-4" />
              Features Prontas
            </CardDescription>
            <CardTitle className="font-bold text-3xl tabular-nums">
              {readyFeatures.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Features refinadas no backlog
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <UsersIcon className="h-4 w-4" />
              Times
            </CardDescription>
            <CardTitle className="font-bold text-3xl tabular-nums">
              {teams.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Times registrados no ART
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Capacity Total Estimada</CardDescription>
            <CardTitle className="font-bold text-3xl tabular-nums">
              {totalCapacity}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Story points por sprint (soma)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Readiness checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de Readiness</CardTitle>
          <CardDescription>
            Critérios para iniciar o PI Planning com qualidade
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {checklist.map((item) => (
            <div
              className="flex items-start gap-3 rounded-lg border p-3"
              key={item.id}
            >
              {item.done ? (
                <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              ) : (
                <CircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex flex-col gap-0.5">
                <span
                  className={`font-medium text-sm ${item.done ? "" : "text-muted-foreground"}`}
                >
                  {item.label}
                </span>
                <span className="text-muted-foreground text-xs">
                  {item.detail}
                </span>
              </div>
              <div className="ml-auto shrink-0">
                <Badge variant={item.done ? "default" : "outline"}>
                  {item.done ? "OK" : "Pendente"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Backlog não comprometido */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Backlog Não Comprometido
              </CardTitle>
              <CardDescription>
                Features sem PI Plan — candidatas para o próximo PI
              </CardDescription>
            </div>
            <Badge variant="secondary">{backlogFeatures.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {backlogFeatures.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma feature no backlog sem PI Plan.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {backlogFeatures.slice(0, 10).map((f) => (
                <div
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  key={f.id}
                >
                  <Link
                    className="font-medium hover:underline"
                    href={`/features/${f.id}`}
                  >
                    {f.title}
                  </Link>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span>WSJF {f.wsjfScore.toFixed(1)}</span>
                    <span>·</span>
                    <span>{f.storyPoints} SP</span>
                    <Badge className="text-[10px]" variant="outline">
                      {f.statusId}
                    </Badge>
                  </div>
                </div>
              ))}
              {backlogFeatures.length > 10 && (
                <p className="text-center text-muted-foreground text-xs">
                  +{backlogFeatures.length - 10} features…
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riscos identificados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                Riscos Identificados
              </CardTitle>
              <CardDescription>
                Riscos registrados antes do PI Planning
              </CardDescription>
            </div>
            <Badge variant="secondary">{preRisks.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {preRisks.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum risco identificado.{" "}
              <Link className="underline" href="/risks">
                Registre riscos
              </Link>{" "}
              antes do PI Planning.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {preRisks.map((risk) => (
                <div
                  className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  key={risk.id}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{risk.title}</span>
                    {risk.category && (
                      <span className="text-muted-foreground text-xs capitalize">
                        {risk.category}
                      </span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 font-medium text-xs ${
                      IMPACT_VARIANTS[risk.impact] ?? ""
                    }`}
                  >
                    {IMPACT_LABELS[risk.impact] ?? risk.impact}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teams capacity */}
      {teams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capacity dos Times</CardTitle>
            <CardDescription>
              Velocity histórica por time (story points/sprint)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {teams.map((team) => (
                <div
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  key={team.id}
                >
                  <span className="font-medium">{team.name}</span>
                  <div className="flex items-center gap-2">
                    {team.velocity != null ? (
                      <Badge variant="default">{team.velocity} SP</Badge>
                    ) : (
                      <Badge
                        className="text-muted-foreground"
                        variant="outline"
                      >
                        Não informado
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
