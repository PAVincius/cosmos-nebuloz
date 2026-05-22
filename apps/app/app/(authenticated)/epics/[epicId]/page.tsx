import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Progress } from "@repo/design-system/components/ui/progress";
import { calculateWSJF } from "@repo/safe-engine";
import {
  ArrowLeftIcon,
  LayersIcon,
  LayoutGridIcon,
  TargetIcon,
  TrendingUpIcon,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeanBusinessCase } from "@/app/actions/lean-business-case";
import { appDesign } from "@/lib/app-design";
import { effectiveFeatureWsjf } from "@/lib/portfolio-aggregate";
import { EpicMetricCards } from "./components/epic-metric-cards";
import { LeanBusinessCasePanel } from "./components/lean-business-case-panel";

type EpicPageProps = {
  params: Promise<{ epicId: string }>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EPIC_STATUS: Record<string, { label: string; cls: string }> = {
  BACKLOG: { label: "Backlog", cls: "bg-muted text-muted-foreground" },
  REVIEW: {
    label: "Review",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  ANALYSIS: {
    label: "Analysis",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  IMPLEMENTING: {
    label: "Implementing",
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  DONE: {
    label: "Done",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
};

const FEATURE_STATUS: Record<string, { label: string; cls: string }> = {
  BACKLOG: { label: "Backlog", cls: "bg-muted text-muted-foreground" },
  REVIEW: {
    label: "Review",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  ANALYSIS: {
    label: "Analysis",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  IMPLEMENTING: {
    label: "Implementing",
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  DONE: {
    label: "Done",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
};

const STORY_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; order: number }
> = {
  BACKLOG: {
    label: "Backlog",
    color: "bg-zinc-300 dark:bg-zinc-600",
    order: 0,
  },
  TODO: { label: "A Fazer", color: "bg-blue-300 dark:bg-blue-700", order: 1 },
  IN_PROGRESS: {
    label: "Em Andamento",
    color: "bg-violet-400 dark:bg-violet-600",
    order: 2,
  },
  REVIEW: {
    label: "Review",
    color: "bg-amber-400 dark:bg-amber-500",
    order: 3,
  },
  DONE: {
    label: "Concluído",
    color: "bg-emerald-500 dark:bg-emerald-600",
    order: 4,
  },
};

const OKR_STATUS: Record<string, { label: string; cls: string }> = {
  ON_TRACK: {
    label: "No Prazo",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  AT_RISK: {
    label: "Em Risco",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  BEHIND: {
    label: "Atrasado",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  ACHIEVED: {
    label: "Alcançado",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
};

function WSJF_COLOR(score: number): string {
  if (score >= 10) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (score >= 5) {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  return "bg-muted text-muted-foreground";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function krProgress(
  baseline: number | null,
  current: number,
  target: number
): number {
  const base = baseline ?? 0;
  if (target === base) {
    return current >= target ? 100 : 0;
  }
  return Math.min(
    100,
    Math.max(0, Math.round(((current - base) / (target - base)) * 100))
  );
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: EpicPageProps) {
  const { epicId } = await params;
  const ctx = await requireTenantSession(await headers());
  const epic = await database.epic.findFirst({
    where: { id: epicId, tenantId: ctx.tenantId },
    select: { title: true },
  });
  return { title: epic ? `${epic.title} | COSMOS` : "Épico | COSMOS" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: epic detail aggregates many data dimensions
export default async function EpicDetailPage({ params }: EpicPageProps) {
  const { epicId } = await params;
  const ctx = await requireTenantSession(await headers());

  const epic = await database.epic.findFirst({
    where: { id: epicId, tenantId: ctx.tenantId },
    include: {
      features: {
        orderBy: { wsjfScore: "desc" },
        include: {
          stories: {
            select: { id: true, status: true, storyPoints: true },
          },
        },
      },
      strategicTheme: {
        include: {
          okrs: {
            where: { type: "portfolio_theme" },
            include: { keyResults: true },
          },
        },
      },
    },
  });

  if (!epic) {
    notFound();
  }

  // ─── Derived metrics ───────────────────────────────────────────────────────

  const totalSP = epic.features.reduce((s, f) => s + f.storyPoints, 0);

  const featureWsjfs = epic.features.map((f) =>
    effectiveFeatureWsjf({
      bv: f.bv,
      tc: f.tc,
      rr: f.rr,
      js: f.js,
      wsjfScore: f.wsjfScore,
    })
  );
  const avgWSJF =
    featureWsjfs.length > 0
      ? Math.round(
          (featureWsjfs.reduce((s, w) => s + w, 0) / featureWsjfs.length) * 100
        ) / 100
      : 0;
  const topFeature =
    epic.features.length > 0
      ? epic.features
          .map((f, i) => ({ title: f.title, wsjf: featureWsjfs[i] ?? 0 }))
          .sort((a, b) => b.wsjf - a.wsjf)[0]
      : null;
  const costOfDelay = epic.features.reduce((s, f) => s + f.bv + f.tc + f.rr, 0);
  const featuresDone = epic.features.filter(
    (f) => f.statusId === "DONE"
  ).length;
  const featuresInFlight = epic.features.filter((f) =>
    ["REVIEW", "ANALYSIS", "IMPLEMENTING"].includes(f.statusId)
  ).length;

  const allStories = epic.features.flatMap((f) => f.stories);
  const totalStories = allStories.length;

  const storiesByStatus = Object.fromEntries(
    Object.keys(STORY_STATUS_CONFIG).map((s) => [
      s,
      allStories.filter((st) => st.status === s).length,
    ])
  ) as Record<string, number>;

  const doneSP = epic.features
    .flatMap((f) => f.stories)
    .filter((s) => s.status === "DONE")
    .reduce((acc, s) => acc + s.storyPoints, 0);

  const inProgressSP = allStories
    .filter((s) => s.status === "IN_PROGRESS")
    .reduce((acc, s) => acc + s.storyPoints, 0);

  const spProgress = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0;
  const doneStories = storiesByStatus.DONE ?? 0;
  const storyProgress =
    totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0;

  const epicStatusInfo = EPIC_STATUS[epic.statusId] ?? {
    label: epic.statusId,
    cls: "bg-muted text-muted-foreground",
  };

  const okrs = epic.strategicTheme?.okrs ?? [];
  const okrOnTrack = okrs.filter(
    (o) => o.status === "ON_TRACK" || o.status === "ACHIEVED"
  ).length;
  const okrSummary =
    epic.strategicTheme && okrs.length > 0
      ? {
          onTrack: okrOnTrack,
          total: okrs.length,
          themeTitle: epic.strategicTheme.title,
        }
      : null;

  const lbc = await getLeanBusinessCase(epic.id);

  return (
    <div className={appDesign.shell}>
      {/* ── Header with breadcrumb + title ──────────────────────────────────── */}
      <div className={appDesign.pageHeader}>
        <Link
          className="mb-2 flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
          href="/portfolio"
        >
          <ArrowLeftIcon className="h-3 w-3" />
          Portfolio
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Badges row */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${epicStatusInfo.cls}`}
              >
                {epicStatusInfo.label}
              </span>

              {epic.strategicTheme !== null &&
                epic.strategicTheme !== undefined && (
                  <Link
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-xs transition-opacity hover:opacity-80"
                    href={`/portfolio/themes/${epic.strategicTheme.id}`}
                    style={{
                      backgroundColor: `${epic.strategicTheme.color ?? "#6366f1"}22`,
                      color: epic.strategicTheme.color ?? "#6366f1",
                    }}
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: epic.strategicTheme.color ?? "#6366f1",
                      }}
                    />
                    {epic.strategicTheme.title}
                  </Link>
                )}
            </div>

            <h1 className="font-semibold text-2xl text-foreground tracking-tight">
              {epic.title}
            </h1>
          </div>

          {/* Action links */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-medium text-xs transition-colors hover:bg-muted"
              href={`/epics/${epic.id}/features`}
            >
              <LayoutGridIcon className="h-3.5 w-3.5" />
              Kanban de Features
            </Link>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          <EpicMetricCards
            avgWSJF={avgWSJF}
            costOfDelay={costOfDelay}
            doneSP={doneSP}
            doneStories={doneStories}
            featuresCount={epic.features.length}
            featuresDone={featuresDone}
            featuresInFlight={featuresInFlight}
            inProgressSP={inProgressSP}
            okrSummary={okrSummary}
            spProgress={spProgress}
            storyProgress={storyProgress}
            topFeatureTitle={topFeature?.title ?? null}
            topWSJF={topFeature?.wsjf ?? 0}
            totalSP={totalSP}
            totalStories={totalStories}
          />

          {/* ── Progress section ─────────────────────────────────────────────────── */}
          {totalStories > 0 && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-medium text-sm">
                  <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
                  Progresso de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* SP progress */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">
                      Story Points concluídos
                    </span>
                    <span className="font-medium text-xs tabular-nums">
                      {doneSP} / {totalSP} SP ({spProgress}%)
                    </span>
                  </div>
                  <Progress className="h-2" value={spProgress} />
                </div>

                {/* Stories stacked bar */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">
                      Stories por status
                    </span>
                    <span className="font-medium text-xs tabular-nums">
                      {doneStories} / {totalStories} concluídas ({storyProgress}
                      %)
                    </span>
                  </div>
                  <div className="flex h-3 w-full gap-px overflow-hidden rounded-full">
                    {Object.entries(STORY_STATUS_CONFIG)
                      .sort(([, a], [, b]) => a.order - b.order)
                      .map(([status, cfg]) => {
                        const count = storiesByStatus[status] ?? 0;
                        if (count === 0) {
                          return null;
                        }
                        const pct = (count / totalStories) * 100;
                        return (
                          <div
                            className={`${cfg.color} transition-all`}
                            key={status}
                            style={{ width: `${pct}%` }}
                            title={`${cfg.label}: ${count}`}
                          />
                        );
                      })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(STORY_STATUS_CONFIG)
                      .sort(([, a], [, b]) => a.order - b.order)
                      .map(([status, cfg]) => {
                        const count = storiesByStatus[status] ?? 0;
                        if (count === 0) {
                          return null;
                        }
                        return (
                          <span
                            className="flex items-center gap-1 text-[11px] text-muted-foreground"
                            key={status}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${cfg.color}`}
                            />
                            {cfg.label} ({count})
                          </span>
                        );
                      })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── OKRs do tema estratégico ─────────────────────────────────────────── */}
          {epic.strategicTheme !== null &&
            epic.strategicTheme !== undefined &&
            epic.strategicTheme.okrs.length > 0 && (
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-medium text-sm">
                    <TargetIcon className="h-4 w-4 text-muted-foreground" />
                    OKRs do Tema —{" "}
                    <Link
                      className="text-primary hover:underline"
                      href={`/portfolio/themes/${epic.strategicTheme.id}`}
                    >
                      {epic.strategicTheme.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  {epic.strategicTheme.okrs.map((okr) => {
                    const okrStatusInfo = OKR_STATUS[okr.status] ?? {
                      label: okr.status,
                      cls: "bg-muted text-muted-foreground",
                    };
                    return (
                      <div className="flex flex-col gap-3" key={okr.id}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm leading-snug">
                            {okr.title}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-[11px] ${okrStatusInfo.cls}`}
                          >
                            {okrStatusInfo.label}
                          </span>
                        </div>

                        {okr.keyResults.length > 0 && (
                          <div className="flex flex-col gap-2.5 border-border border-l-2 pl-3">
                            {okr.keyResults.map((kr) => {
                              const progress = krProgress(
                                kr.baseline,
                                kr.current,
                                kr.target
                              );
                              return (
                                <div key={kr.id}>
                                  <div className="mb-1 flex items-center justify-between">
                                    <span className="text-foreground/80 text-xs leading-snug">
                                      {kr.title}
                                    </span>
                                    <span className="ml-2 shrink-0 text-muted-foreground text-xs tabular-nums">
                                      {kr.current}
                                      {kr.unit ? ` ${kr.unit}` : ""} /{" "}
                                      {kr.target}
                                      {kr.unit ? ` ${kr.unit}` : ""} ({progress}
                                      %)
                                    </span>
                                  </div>
                                  <Progress
                                    className="h-1.5"
                                    value={progress}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

          {/* ── Lean Business Case ───────────────────────────────────────────────── */}
          <LeanBusinessCasePanel epicId={epic.id} initial={lbc} />

          {/* ── Features ─────────────────────────────────────────────────────────── */}
          <Card className="gap-0 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between font-medium text-sm">
                <span className="flex items-center gap-2">
                  <LayersIcon className="h-4 w-4 text-muted-foreground" />
                  Features{" "}
                  <span className="font-normal text-muted-foreground">
                    — ordenadas por WSJF
                  </span>
                </span>
                <Link
                  className="font-normal text-[11px] text-primary hover:underline"
                  href={`/epics/${epic.id}/features`}
                >
                  Ver Kanban →
                </Link>
              </CardTitle>
            </CardHeader>

            {epic.features.length === 0 ? (
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <LayersIcon className="mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">
                  Nenhuma feature neste épico.
                </p>
                <Link
                  className="mt-3 text-primary text-xs hover:underline"
                  href={`/epics/${epic.id}/features`}
                >
                  Adicionar feature →
                </Link>
              </CardContent>
            ) : (
              <div className="divide-y border-t">
                {epic.features.map((f) => {
                  const wsjf =
                    f.wsjfScore > 0
                      ? f.wsjfScore
                      : calculateWSJF({
                          bv: f.bv,
                          tc: f.tc,
                          rr: f.rr,
                          js: f.js,
                        });
                  const featureStatusInfo = FEATURE_STATUS[f.statusId] ?? {
                    label: f.statusId,
                    cls: "bg-muted text-muted-foreground",
                  };
                  const featureStoriesTotal = f.stories.length;
                  const featureStoriesDone = f.stories.filter(
                    (s) => s.status === "DONE"
                  ).length;

                  return (
                    <div
                      className="flex items-start gap-3 px-6 py-3"
                      key={f.id}
                    >
                      {/* Status + Title */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium text-[11px] ${featureStatusInfo.cls}`}
                          >
                            {featureStatusInfo.label}
                          </span>
                        </div>
                        <p className="font-medium text-sm leading-snug">
                          {f.title}
                        </p>

                        {/* Sub-row: SP + WSJF params + stories */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {f.storyPoints} SP
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            BV:{f.bv} TC:{f.tc} RR:{f.rr} JS:{f.js}
                          </span>
                          {featureStoriesTotal > 0 && (
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {featureStoriesDone}/{featureStoriesTotal} stories
                            </span>
                          )}
                        </div>
                      </div>

                      {/* WSJF badge */}
                      <span
                        className={`mt-1 shrink-0 rounded px-2 py-0.5 font-medium font-mono text-xs ${WSJF_COLOR(wsjf)}`}
                      >
                        {wsjf.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
