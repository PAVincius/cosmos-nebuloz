import { SectionCard } from "@repo/design-system/components/cosmos/section-card";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CalendarIcon,
  DollarSignIcon,
  FlagIcon,
  LayersIcon,
  LayoutGridIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHomeConfig } from "@/app/actions/home/index";
import { appDesign } from "@/lib/app-design";
import { getARTById } from "../../../actions/arts/get-arts";
import { getARTObservability } from "../../../actions/arts/observability";
import { getTeamsForART } from "../../../actions/arts/pi-plans";
import { ArtKpiRow } from "./components/art-kpi-row";
import { ARTEventTimeline } from "./components/art-event-timeline";
import { ARTHealthIndicatorsPanel } from "./components/art-health-indicators";
import { LeanBudgetSection } from "./components/lean-budget-section";
import { StrategicThemesSection } from "./components/strategic-themes-section";
import { TeamHealthGrid } from "./components/team-health-grid";
import { PiRelationChip } from "./components/pi-relation-chip";

const CreatePIWizard = dynamic(
  () => import("./components/create-pi-wizard-v2").then((m) => m.CreatePIWizardV2),
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

export async function generateMetadata({ params }: ARTPageProps) {
  const { artId } = await params;
  const art = await getARTById(artId);
  return {
    title: art ? `${art.name} | COSMOS` : "ART | COSMOS",
  };
}

export default async function ARTDetailPage({ params }: ARTPageProps) {
  const { artId } = await params;

  const [art, teams, observability, configResult] = await Promise.all([
    getARTById(artId),
    getTeamsForART(artId),
    getARTObservability(artId),
    getHomeConfig(),
  ]);

  if (!art) {
    notFound();
  }

  const persona = configResult.ok ? configResult.data.persona : "global";
  const isLpm = persona === "lpm";
  const accentRgb = isLpm ? "251,191,36" : "124,135,255";

  const latestPi = art.piPlans[0];
  const pastPiCount = art.piPlans.filter((pi) => pi.status === "CLOSED").length;
  const historicalPiHealth = observability.health.piHealth.slice(1);
  const historicalPpm =
    historicalPiHealth.length > 0
      ? Math.round(
          historicalPiHealth.reduce((sum, pi) => sum + pi.predictability, 0) /
            historicalPiHealth.length
        )
      : observability.health.latestFlowPredictability;

  return (
    <div className={appDesign.shell}>
      {/* ── Custom page header ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          padding: "22px 32px 20px",
          background:
            "linear-gradient(180deg, var(--surface-3) 0%, var(--surface-2) 45%, var(--surface) 100%)",
          borderBottom: "1px solid var(--hairline)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,.08) inset, 0 18px 34px -20px rgba(0,0,0,.95), 0 3px 0 -1px rgba(0,0,0,.5)",
          zIndex: 5,
          flexShrink: 0,
        }}
      >
        {/* Top highlight */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent 8%, rgba(255,255,255,.14), transparent 92%)",
            pointerEvents: "none",
          }}
        />
        {/* Accent glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -1,
            height: 48,
            background: `radial-gradient(120% 100% at 18% 0%, rgba(${accentRgb},.14), transparent 60%)`,
            pointerEvents: "none",
            zIndex: -1,
          }}
        />

        {/* Breadcrumb */}
        <div
          style={{
            marginBottom: 10,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Link href="/arts" style={{ color: "var(--ink-subtle)", textDecoration: "none" }}>
            Agile Release Train
          </Link>
        </div>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Title + inline badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1
                style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: "var(--ink)",
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                {art.name}
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background:
                    art.status === "ACTIVE"
                      ? "rgba(52,211,153,.15)"
                      : art.status === "RETIRED"
                        ? "rgba(251,113,133,.15)"
                        : "var(--surface-3)",
                  border:
                    art.status === "ACTIVE"
                      ? "1px solid rgba(52,211,153,.3)"
                      : art.status === "RETIRED"
                        ? "1px solid rgba(251,113,133,.3)"
                        : "1px solid var(--hairline)",
                  color:
                    art.status === "ACTIVE"
                      ? "var(--green)"
                      : art.status === "RETIRED"
                        ? "var(--red)"
                        : "var(--ink-muted)",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background:
                      art.status === "ACTIVE"
                        ? "var(--green)"
                        : art.status === "RETIRED"
                          ? "var(--red)"
                          : "var(--ink-faint)",
                  }}
                />
                {art.status}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  background: "var(--surface-3)",
                  border: "1px solid var(--hairline)",
                  color: "var(--ink-muted)",
                }}
              >
                {art.cadence} sem · {art.ipSprintEnabled ? "IP on" : "IP off"}
              </span>
            </div>

            {/* Context links */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <PiRelationChip artId={artId} piPlans={art.piPlans} />
              {[
                { label: "ROADMAP", value: "Multi-PI", href: "/portfolio/roadmap" },
                { label: "BUDGET FLOW", value: "Lean Budget", href: `/portfolio/budgets?artId=${artId}` },
                {
                  label: "PIS ANTERIORES",
                  value: `${pastPiCount} finalizados`,
                  href: undefined,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{ display: "flex", alignItems: "center", gap: 7 }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--ink-faint)",
                    }}
                  >
                    {item.label}
                  </span>
                  <span style={{ width: 1, height: 12, background: "var(--hairline-strong)" }} />
                  {item.href ? (
                    <Link
                      href={item.href}
                      style={{ fontSize: 12, color: "var(--ink-subtle)", textDecoration: "none", fontWeight: 500 }}
                    >
                      {item.value}
                    </Link>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--ink-subtle)", fontWeight: 500 }}>
                      {item.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Link
              href={latestPi ? `/arts/${artId}/program-board?piPlanId=${latestPi.id}` : `/arts/${artId}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: "var(--surface-3)",
                border: "1px solid var(--hairline)",
                color: "var(--ink-muted)",
                textDecoration: "none",
              }}
            >
              <LayoutGridIcon style={{ width: 14, height: 14 }} />
              Program Board
            </Link>
            <CreatePIWizard
              artId={artId}
              artName={art.name}
              cadence={art.cadence}
              teams={teams}
            />
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          {/* KPI row */}
          <ArtKpiRow
            budgetAllocatedM={observability.health.budgetAllocatedM ?? undefined}
            budgetSpentM={observability.health.budgetSpentM ?? undefined}
            confidenceAvg={observability.health.confidenceAvg ?? undefined}
            historicalPpm={historicalPpm}
            ppm={observability.health.latestFlowPredictability}
          />

          {/* Persona-specific */}
          {isLpm ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SectionCard
                description="Alocado vs consumido"
                icon={<DollarSignIcon className="h-4 w-4" />}
                title="Lean Budget da ART"
              >
                <LeanBudgetSection
                  allocatedM={observability.health.budgetAllocatedM ?? 2.4}
                  spentM={observability.health.budgetSpentM ?? 1.62}
                />
              </SectionCard>

              <SectionCard
                description="Épicos linkados por tema"
                icon={<FlagIcon className="h-4 w-4" />}
                title="Strategic Themes"
              >
                <StrategicThemesSection artId={artId} />
              </SectionCard>
            </div>
          ) : (
            <SectionCard
              description="Flow metrics · PI atual"
              icon={<UsersIcon className="h-4 w-4" />}
              title="Saúde dos Times"
            >
              <TeamHealthGrid teams={teams} />
            </SectionCard>
          )}

          {/* Quick nav */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/arts/${artId}/impediments`}>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors"
                type="button"
              >
                <AlertTriangleIcon className="h-3.5 w-3.5" />
                Impedimentos
              </button>
            </Link>
            <Link href={`/analytics/flow?scope=art&scopeId=${artId}`}>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors"
                type="button"
              >
                <TrendingUpIcon className="h-3.5 w-3.5" />
                Flow Metrics
              </button>
            </Link>
            <Link href={`/portfolio/okrs?artId=${artId}`}>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors"
                type="button"
              >
                <LayersIcon className="h-3.5 w-3.5" />
                OKRs do ART
              </button>
            </Link>
            {latestPi && (
              <>
                <Link href={`/arts/${artId}/pi-planning?piId=${latestPi.id}`}>
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors"
                    type="button"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    PI Workspace
                  </button>
                </Link>
                <Link href={`/arts/${artId}/post-pi?piPlanId=${latestPi.id}`}>
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors"
                    type="button"
                  >
                    <ActivityIcon className="h-3.5 w-3.5" />
                    Inspect &amp; Adapt
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* Retained sections */}
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
