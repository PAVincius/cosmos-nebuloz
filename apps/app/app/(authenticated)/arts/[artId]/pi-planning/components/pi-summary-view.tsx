"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import {
  AlertTriangleIcon,
  LayoutGridIcon,
  StarIcon,
  TargetIcon,
} from "lucide-react";
import type { PIPlanFullDetails } from "@/app/actions/arts/pi-plans";

const ROAM_CONFIG: Record<string, { label: string; className: string }> = {
  IDENTIFIED: {
    label: "Identificado",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  RESOLVED: {
    label: "Resolvido",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  OWNED: {
    label: "Responsável",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  ACCEPTED: {
    label: "Aceito",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  MITIGATED: {
    label: "Mitigado",
    className:
      "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  },
};

const OBJ_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  NOT_STARTED: { label: "Não Iniciado", variant: "outline" },
  IN_PROGRESS: { label: "Em Progresso", variant: "secondary" },
  ACHIEVED: { label: "Atingido", variant: "default" },
  MISSED: { label: "Não Atingido", variant: "destructive" },
  COMPLETED: { label: "Concluído", variant: "default" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
};

const VOTE_STATE_CONFIG: Record<string, { label: string; className: string }> =
  {
    NOT_STARTED: {
      label: "Não Iniciada",
      className: "bg-muted text-muted-foreground",
    },
    OPEN: { label: "Aberta", className: "bg-blue-100 text-blue-800" },
    TALLYING: { label: "Apuração", className: "bg-yellow-100 text-yellow-800" },
    REWORK: { label: "Retrabalho", className: "bg-red-100 text-red-800" },
    APPROVED: { label: "Aprovado ✓", className: "bg-green-100 text-green-800" },
  };

type PISummaryViewProps = {
  piPlan: PIPlanFullDetails;
  voteState?: string;
  voteAvg?: number | null;
};

export function PISummaryView({
  piPlan,
  voteState,
  voteAvg,
}: PISummaryViewProps) {
  const committed = piPlan.objectives.filter((o) => !o.isStretch);
  const stretch = piPlan.objectives.filter((o) => o.isStretch);
  const achieved = committed.filter(
    (o) => o.status === "ACHIEVED" || o.status === "COMPLETED"
  );
  const predictability =
    committed.length > 0
      ? Math.round((achieved.length / committed.length) * 100)
      : null;

  const roamCounts = piPlan.risks.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalFeatures = piPlan.features.length;
  const doneFeatures = piPlan.features.filter(
    (f) => f.statusId === "DONE"
  ).length;
  const inProgFeatures = piPlan.features.filter((f) =>
    ["IN_PROGRESS", "REVIEW"].includes(f.statusId)
  ).length;
  const featurePct =
    totalFeatures > 0 ? Math.round((doneFeatures / totalFeatures) * 100) : 0;

  const voteCfg =
    VOTE_STATE_CONFIG[voteState ?? "NOT_STARTED"] ??
    VOTE_STATE_CONFIG.NOT_STARTED;

  return (
    <div className="flex flex-col gap-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Predictability</p>
            <p
              className={`font-bold text-2xl tabular-nums ${
                predictability == null
                  ? ""
                  : predictability >= 80
                    ? "text-green-600"
                    : predictability >= 50
                      ? "text-amber-600"
                      : "text-red-600"
              }`}
            >
              {predictability != null ? `${predictability}%` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {achieved.length}/{committed.length} obj. committed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Features</p>
            <p className="font-bold text-2xl tabular-nums">{featurePct}%</p>
            <p className="text-[10px] text-muted-foreground">
              {doneFeatures} done · {inProgFeatures} em progresso
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Riscos ROAM</p>
            <p className="font-bold text-2xl tabular-nums">
              {piPlan.risks.length}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {roamCounts.RESOLVED ?? 0} resolvidos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Confidence Vote</p>
            <span
              className={`inline-flex rounded px-1.5 py-0.5 font-medium text-xs ${voteCfg.className}`}
            >
              {voteCfg.label}
            </span>
            {voteAvg != null && (
              <p className="mt-1 font-semibold text-xs tabular-nums">
                Média: {voteAvg.toFixed(1)} / 5
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PI Objectives */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-sm">
          <TargetIcon className="h-4 w-4 text-muted-foreground" />
          PI Objectives
          <Badge className="text-[10px]" variant="outline">
            {committed.length} committed · {stretch.length} stretch
          </Badge>
        </h3>

        {piPlan.teams.length > 0 ? (
          <div className="flex flex-col gap-3">
            {piPlan.teams.map((team) => {
              const teamObjs = piPlan.objectives.filter(
                (o) => o.teamId === team.id
              );
              if (teamObjs.length === 0) {
                return null;
              }
              return (
                <div className="rounded-lg border p-3" key={team.id}>
                  <p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    {team.name}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {teamObjs.map((o) => {
                      const statusCfg =
                        OBJ_STATUS_CONFIG[o.status] ??
                        OBJ_STATUS_CONFIG.NOT_STARTED;
                      return (
                        <div
                          className="flex items-center gap-2 text-sm"
                          key={o.id}
                        >
                          {o.isStretch ? (
                            <StarIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          ) : (
                            <TargetIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                          <span className="flex-1 truncate">{o.title}</span>
                          <Badge
                            className="h-4 shrink-0 px-1 text-[10px]"
                            variant={statusCfg.variant}
                          >
                            {statusCfg.label}
                          </Badge>
                          {o.businessValue > 0 && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              BV {o.businessValue}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : piPlan.objectives.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum objetivo definido.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {piPlan.objectives.map((o) => {
              const statusCfg =
                OBJ_STATUS_CONFIG[o.status] ?? OBJ_STATUS_CONFIG.NOT_STARTED;
              return (
                <div className="flex items-center gap-2 text-sm" key={o.id}>
                  {o.isStretch ? (
                    <StarIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  ) : (
                    <TargetIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                  <span className="flex-1 truncate">{o.title}</span>
                  <Badge
                    className="h-4 px-1 text-[10px]"
                    variant={statusCfg.variant}
                  >
                    {statusCfg.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ROAM Summary */}
      {piPlan.risks.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-sm">
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
            Riscos ROAM
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {Object.entries(ROAM_CONFIG).map(([status, cfg]) => {
              const count = roamCounts[status] ?? 0;
              return (
                <div
                  className={`flex flex-col items-center rounded-lg p-2 text-center text-xs ${cfg.className}`}
                  key={status}
                >
                  <span className="font-bold text-xl tabular-nums">
                    {count}
                  </span>
                  <span>{cfg.label}</span>
                </div>
              );
            })}
          </div>

          {piPlan.risks.filter((r) => r.status === "IDENTIFIED").length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              <p className="font-medium text-amber-700 text-xs">
                Riscos ainda não categorizados:
              </p>
              {piPlan.risks
                .filter((r) => r.status === "IDENTIFIED")
                .map((r) => (
                  <div
                    className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50/60 px-2 py-1 text-xs dark:border-amber-800 dark:bg-amber-950/20"
                    key={r.id}
                  >
                    <AlertTriangleIcon className="h-3 w-3 shrink-0 text-amber-600" />
                    <span className="flex-1 truncate">{r.title}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Feature progress */}
      {totalFeatures > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-sm">
            <LayoutGridIcon className="h-4 w-4 text-muted-foreground" />
            Features comprometidas
            <span className="font-normal text-muted-foreground text-xs">
              ({totalFeatures} total)
            </span>
          </h3>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${featurePct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{doneFeatures} concluídas</span>
            <span>{inProgFeatures} em progresso</span>
            <span>
              {totalFeatures - doneFeatures - inProgFeatures} restantes
            </span>
          </div>
        </div>
      )}

      {/* Print hint */}
      <p className="text-[10px] text-muted-foreground">
        PI Summary — gerado em{" "}
        {new Date().toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
