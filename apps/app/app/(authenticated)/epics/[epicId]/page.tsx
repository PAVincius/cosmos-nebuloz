import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { calculateWSJF } from "@repo/safe-engine";
import {
  LayoutGridIcon,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PiRelationChip, RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { ConfidenceBadge } from "@/app/(authenticated)/analytics/executive/components/confidence-badge";
import { getEpicConfidence } from "@/app/actions/analytics/epic-confidence";
import { getHomeConfig } from "@/app/actions/home";
import { getStrategicThemes } from "@/app/actions/strategic-themes";
import { appDesign } from "@/lib/app-design";
import { effectiveFeatureWsjf } from "@/lib/portfolio-aggregate";
import { EditEpicButton } from "./components/edit-epic-button";
import { EpicKpiRow } from "./components/epic-kpi-row";
import { FeaturesSection } from "./components/features-section";
import { HypothesisSection } from "./components/hypothesis-section";
import { InvestSection } from "./components/invest-section";
import { LifecycleSection } from "./components/lifecycle-section";

type EpicPageProps = {
  params: Promise<{ epicId: string }>;
};

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

export async function generateMetadata({ params }: EpicPageProps) {
  const { epicId } = await params;
  const ctx = await requireTenantSession(await headers());
  const epic = await database.epic.findFirst({
    where: { id: epicId, tenantId: ctx.tenantId },
    select: { title: true },
  });
  return { title: epic ? `${epic.title} | COSMOS` : "Épico | COSMOS" };
}

export default async function EpicDetailPage({ params }: EpicPageProps) {
  const { epicId } = await params;
  const ctx = await requireTenantSession(await headers());

  const [epic, configResult, confidenceResult, themes] = await Promise.all([
    database.epic.findFirst({
      where: { id: epicId, tenantId: ctx.tenantId },
      include: {
        features: {
          orderBy: { wsjfScore: "desc" },
          include: {
            blockedBy: { select: { id: true } },
            piPlan: { select: { id: true, name: true, status: true, artId: true } },
          },
        },
        strategicTheme: true,
      },
    }),
    getHomeConfig(),
    getEpicConfidence({ id: epicId }),
    getStrategicThemes(),
  ]);

  if (!epic) {
    notFound();
  }

  const persona = configResult.ok ? configResult.data.persona : "global";

  // ── Derived metrics ─────────────────────────────────────────────────────────

  const featureWsjfs = epic.features.map((f) =>
    effectiveFeatureWsjf({ bv: f.bv, tc: f.tc, rr: f.rr, js: f.js, wsjfScore: f.wsjfScore })
  );
  const avgWSJF =
    featureWsjfs.length > 0
      ? Math.round((featureWsjfs.reduce((s, w) => s + w, 0) / featureWsjfs.length) * 100) / 100
      : 0;

  const featuresDone = epic.features.filter((f) => f.statusId === "DONE").length;

  // ── Team names ──────────────────────────────────────────────────────────────

  const teamIds = [
    ...new Set(epic.features.map((f) => f.assignedTeamId).filter((id): id is string => !!id)),
  ];
  const teams =
    teamIds.length > 0
      ? await database.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true, artId: true },
        })
      : [];
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));

  // ── Relation chips: primary ART + PI plans ──────────────────────

  const artIdCounts = new Map<string, number>();
  for (const t of teams) {
    if (t.artId) artIdCounts.set(t.artId, (artIdCounts.get(t.artId) ?? 0) + 1);
  }
  const primaryArtId =
    [...artIdCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const primaryArt = primaryArtId
    ? await database.aRT.findFirst({
        where: { id: primaryArtId, tenantId: ctx.tenantId },
        select: { id: true, name: true },
      })
    : null;

  const PI_STATUS_TONE: Record<string, "green" | "amber" | "neutral"> = {
    EXECUTING: "green",
    PLANNING: "amber",
    CLOSED: "neutral",
  };
  const piPlansMap = new Map<
    string,
    { id: string; label: string; href: string; tone: "green" | "amber" | "neutral" }
  >();
  for (const f of epic.features) {
    const plan = f.piPlan;
    if (plan?.artId && !piPlansMap.has(plan.id)) {
      piPlansMap.set(plan.id, {
        id: plan.id,
        label: plan.name,
        href: `/arts/${plan.artId}/pi-planning`,
        tone: PI_STATUS_TONE[plan.status] ?? "neutral",
      });
    }
  }
  const piPlans = [...piPlansMap.values()];
  const themeOptions = themes.map((t) => ({ id: t.id, title: t.title }));

  // ── Feature rows for table ──────────────────────────────────────────────────

  const featureRows = epic.features.map((f) => ({
    id: f.id,
    artScopedId: f.artScopedId,
    title: f.title,
    teamName: f.assignedTeamId ? (teamMap.get(f.assignedTeamId) ?? null) : null,
    statusId: f.statusId,
    progressPct: f.progressPct,
    wsjfScore:
      f.wsjfScore > 0
        ? f.wsjfScore
        : calculateWSJF({ bv: f.bv, tc: f.tc, rr: f.rr, js: f.js }),
    depsCount: f.blockedBy.length,
  }));

  // ── Status badge ────────────────────────────────────────────────────────────

  const epicStatusInfo = EPIC_STATUS[epic.statusId] ?? {
    label: epic.statusId,
    cls: "bg-muted text-muted-foreground",
  };

  // ── Persona section flags ───────────────────────────────────────────────────
  // lpm: invest + hypothesis + lifecycle (no features)
  // rte + team (sm): features only
  // pm + global + spc: all sections

  const showInvest =
    persona === "lpm" || persona === "pm" || persona === "global" || persona === "spc";
  const showFeatures =
    persona === "rte" ||
    persona === "team" ||
    persona === "pm" ||
    persona === "global" ||
    persona === "spc";

  return (
    <div className={appDesign.shell}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={appDesign.pageHeader}>
        {epic.strategicTheme && (
          <p className="mb-1.5 font-medium text-[11px] text-ink-muted uppercase tracking-[0.07em]">
            {epic.strategicTheme.title}
          </p>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded border border-hairline px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                EP-{epicId.slice(-4).toUpperCase()}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${epicStatusInfo.cls}`}
              >
                ● {epicStatusInfo.label}
              </span>
              {confidenceResult.ok ? (
                <ConfidenceBadge confidence={confidenceResult.data} />
              ) : null}
            </div>

            <h1 className="font-semibold text-2xl text-foreground tracking-tight">
              {epic.title}
            </h1>

            {(epic.strategicTheme || primaryArt || piPlans.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {epic.strategicTheme && (
                  <RelationChip
                    eyebrow="Strategic Theme"
                    href={`/portfolio/themes/${epic.strategicTheme.id}`}
                    label={epic.strategicTheme.title}
                    tone="purple"
                  />
                )}
                {primaryArt && (
                  <RelationChip
                    eyebrow="ART"
                    href={`/arts/${primaryArt.id}`}
                    label={primaryArt.name}
                    tone="blue"
                  />
                )}
                {piPlans.length > 0 && (
                  <PiRelationChip entityName={epic.title} pis={piPlans} />
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <EditEpicButton
              dueDate={epic.dueDate ? epic.dueDate.toISOString().slice(0, 10) : null}
              epicId={epic.id}
              statusId={epic.statusId}
              strategicThemeId={epic.strategicThemeId}
              themes={themeOptions}
              title={epic.title}
            />
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
          {/* KPI row — all personas */}
          <EpicKpiRow
            avgWSJF={avgWSJF}
            featuresDone={featuresDone}
            featuresCount={epic.features.length}
            investScore={epic.investScore ?? 0}
            leanBudgetAllocation={epic.leanBudgetAllocation ?? null}
          />

          {/* LPM / PM / global: INVEST Score + Hipótese + Lifecycle */}
          {showInvest && (
            <>
              <InvestSection
                investBreakdown={epic.investBreakdown}
                investScore={epic.investScore ?? 0}
              />
              <HypothesisSection
                businessOutcomes={epic.businessOutcomes}
                hypothesis={epic.hypothesis ?? null}
                leadingIndicators={epic.leadingIndicators}
              />
              <LifecycleSection lifecycleStatus={epic.lifecycleStatus} />
            </>
          )}

          {/* RTE / SM / PM / global: Features table */}
          {showFeatures && (
            <FeaturesSection epicId={epic.id} features={featureRows} />
          )}
        </div>
      </div>
    </div>
  );
}
