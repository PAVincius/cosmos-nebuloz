import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { ChevronRight, Gauge as GaugeIcon, Kanban, Target } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { Gauge } from "../../../../components/gauge";
import { KpiCard, KpiGrid } from "../../../../components/kpi-card";
import { SectionCard } from "../../../../components/section-card";
import {
  type BacklogFeatureRow,
  FeatureBacklogTable,
} from "./feature-backlog-table";
import { FeatureCtaButton } from "./feature-cta-button";

// ─── Icons (single-path, combined from the prototype's multi-element icons) ──

const ICON_KANBAN =
  "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18";
const ICON_CHECK = "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01L9 11.01";
const ICON_GAUGE =
  "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M12 2a10 10 0 0 0-10 10c0 2.5.9 4.8 2.4 6.5M22 12a10 10 0 0 0-3-7.1 M13.4 10.6L18 6";
const ICON_ALERT =
  "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z M12 9L12 13 M12 17L12.01 17";

// ─── Types ────────────────────────────────────────────────────────────────

type OkrForTrace = {
  id: string;
  title: string;
  epicId?: string | null;
  keyResults: Array<{ id: string; current: number; target: number }>;
};

export type PmHomeBodyProps = { okrs: OkrForTrace[] };

function investTone(score: number): "green" | "amber" | "red" {
  if (score >= 70) return "green";
  if (score >= 50) return "amber";
  return "red";
}

function okrProgress(okr: OkrForTrace): number {
  const { keyResults } = okr;
  if (keyResults.length === 0) return 0;
  const pct =
    keyResults.reduce((sum, kr) => {
      const ratio = kr.target > 0 ? kr.current / kr.target : 0;
      return sum + Math.min(Math.max(ratio, 0), 1);
    }, 0) / keyResults.length;
  return pct;
}

// ─── Data ─────────────────────────────────────────────────────────────────

async function loadPmHomeBodyData() {
  const { tenantId } = await requireTenantSession(await headers());

  const [
    backlogFeatures,
    backlogCount,
    doneCount,
    blockedCount,
    epicsToRefine,
    arts,
    epics,
    teams,
  ] = await Promise.all([
    database.feature.findMany({
      orderBy: { wsjfScore: "desc" },
      select: { id: true, storyPoints: true, title: true, wsjfScore: true },
      take: 8,
      where: { tenantId, NOT: { statusId: "DONE" } },
    }),
    database.feature.count({ where: { tenantId, NOT: { statusId: "DONE" } } }),
    database.feature.count({ where: { statusId: "DONE", tenantId } }),
    database.feature.count({
      where: { blockedBy: { some: { boardStatus: { not: "RESOLVED" } } }, tenantId },
    }),
    database.epic.findMany({
      orderBy: { investScore: "asc" },
      select: { id: true, investScore: true, title: true },
      take: 5,
      where: {
        investScore: { gt: 0 },
        lifecycleStatus: { in: ["ANALYZING", "PORTFOLIO_BACKLOG"] },
        tenantId,
      },
    }),
    database.aRT.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      where: { tenantId },
    }),
    database.epic.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      where: { tenantId },
    }),
    database.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      where: { tenantId },
    }),
  ]);

  return {
    arts,
    backlogCount,
    backlogFeatures,
    blockedCount,
    doneCount,
    // Epic has no `sequenceNumber` field; CreateFeatureModal falls back to
    // "EP-????" for the display id (pre-existing prop/schema mismatch).
    epics: epics.map((epic) => ({ ...epic, sequenceNumber: null })),
    epicsToRefine,
    teams,
  };
}

// ─── Component ────────────────────────────────────────────────────────────

/**
 * Server-fetched body of the PO dashboard (screenDashPO) — KPI row, Feature
 * Backlog Priorizado, INVEST épicos em refinamento, Meus Épicos × OKRs.
 * Rendered inside a `<Suspense>` in `pm-home.tsx`, with `PmHomeBodySkeleton`
 * as the loading fallback.
 */
export async function PmHomeBody({ okrs }: PmHomeBodyProps) {
  const {
    arts,
    backlogCount,
    backlogFeatures,
    blockedCount,
    doneCount,
    epics,
    epicsToRefine,
    teams,
  } = await loadPmHomeBodyData();

  const backlogRows: BacklogFeatureRow[] = backlogFeatures.map((feature) => ({
    id: feature.id,
    storyPoints: feature.storyPoints,
    title: feature.title,
    wsjfScore: feature.wsjfScore,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <KpiGrid>
        <KpiCard
          badge="— Ordenadas por WSJF"
          iconPath={ICON_KANBAN}
          label="Features no backlog"
          tone="accent"
          value={backlogCount}
        />
        <KpiCard
          badge="↗ No PI atual"
          iconPath={ICON_CHECK}
          label="Features entregues"
          tone="green"
          value={doneCount}
        />
        <KpiCard
          badge="— INVEST incompleto"
          iconPath={ICON_GAUGE}
          label="Épicos para refinar"
          tone="amber"
          value={epicsToRefine.length}
        />
        <KpiCard
          badge="— Em espera"
          iconPath={ICON_ALERT}
          label="Bloqueios"
          tone="blue"
          value={blockedCount}
        />
      </KpiGrid>

      <div
        style={{
          display: "grid",
          gap: "var(--cosmos-gap,16px)",
          gridTemplateColumns: "1.3fr 1fr",
        }}
      >
        <SectionCard
          accentRgb="124,135,255"
          actions={<FeatureCtaButton arts={arts} epics={epics} teams={teams} />}
          icon={Kanban}
          noPadding
          subtitle={`${backlogCount} features abertas · ordenado por WSJF`}
          title="Feature Backlog Priorizado"
        >
          {backlogRows.length === 0 ? (
            <div style={{ color: "var(--ink-faint)", padding: 20, textAlign: "center" }}>
              Nenhuma feature aberta
            </div>
          ) : (
            <FeatureBacklogTable rows={backlogRows} />
          )}
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard
            icon={GaugeIcon}
            subtitle={`${epicsToRefine.length} para detalhar`}
            title="INVEST · Épicos em refinamento"
          >
            {epicsToRefine.length === 0 ? (
              <div style={{ color: "var(--ink-faint)", padding: "8px 0", textAlign: "center" }}>
                Nenhum épico em refinamento
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {epicsToRefine.map((epic) => {
                  const score = epic.investScore ?? 0;
                  const tone = investTone(score);
                  return (
                    <Link
                      href={`/epics/${epic.id}`}
                      key={epic.id}
                      style={{
                        alignItems: "center",
                        borderBottom: "1px solid var(--hairline)",
                        display: "flex",
                        gap: 12,
                        padding: "10px 0",
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: "var(--ink)",
                            fontSize: 12.5,
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {epic.title}
                        </div>
                        <div
                          style={{
                            background: "var(--hairline)",
                            borderRadius: 999,
                            height: 4,
                            marginTop: 6,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              background: `var(--${tone})`,
                              borderRadius: 999,
                              height: "100%",
                              width: `${score}%`,
                            }}
                          />
                        </div>
                      </div>
                      <Gauge size={44} tone={tone} value={score} />
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            actions={
              <Link
                href="/portfolio/okrs"
                style={{ alignItems: "center", color: "var(--ink-faint)", display: "flex" }}
              >
                <ChevronRight aria-hidden size={14} />
              </Link>
            }
            icon={Target}
            subtitle="Rastreabilidade direta"
            title="Meus Épicos × OKRs"
          >
            {okrs.length === 0 ? (
              <div style={{ color: "var(--ink-faint)", padding: "8px 0", textAlign: "center" }}>
                Nenhum OKR configurado
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {okrs.map((okr) => {
                  const progress = okrProgress(okr);
                  const tone = progress >= 0.7 ? "green" : progress >= 0.5 ? "amber" : "red";
                  return (
                    <div
                      key={okr.id}
                      style={{ borderBottom: "1px solid var(--hairline)", padding: "10px 0" }}
                    >
                      <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                        <Gauge size={36} tone={tone} value={Math.round(progress * 100)} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                          {okr.title}
                        </span>
                      </div>
                      {okr.epicId && (
                        <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                          <Link
                            className="font-mono"
                            href={`/epics/${okr.epicId}`}
                            style={{
                              background: "var(--accent-soft)",
                              border: "1px solid rgba(var(--accent-rgb),.25)",
                              borderRadius: 6,
                              color: "var(--accent-text)",
                              fontSize: 10.5,
                              padding: "2px 8px",
                              textDecoration: "none",
                            }}
                          >
                            {okr.epicId.slice(0, 8)}
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
