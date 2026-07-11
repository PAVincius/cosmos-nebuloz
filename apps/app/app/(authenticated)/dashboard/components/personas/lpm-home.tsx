// LPM home — "Visão Geral do Portfolio" (cosmos.html design/components/screen-dashboard.jsx,
// DashboardScreen). Rewritten to match that mockup's layout 1:1 while sourcing every
// number from real tenant data (see actions/home/index.ts#getLpmHomeData).

"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  DollarSign,
  Layers,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import { AreaChart } from "../charts/area-chart";
import type { ChartTone } from "../charts/area-chart";
import { HBars } from "../charts/horizontal-bars";
import type { VBarDatum } from "../charts/vertical-bars";
import { VBars } from "../charts/vertical-bars";

// Icon watermark path strings (KpiCard.iconPath takes one combined `d`; see
// kpi-card.tsx's own ICON_* constants / global-home.tsx for the same pattern).
const ICON_LAYERS =
  "M12 2 2 7l10 5 10-5-10-5 M2 12l10 5 10-5 M2 17l10 5 10-5";
const ICON_TARGET = "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z";
const ICON_TRENDING = "M22 7 13.5 15.5 8.5 10.5 2 17 M16 7h6v6";
const ICON_DOLLAR =
  "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6";

type Epic = {
  id: string;
  title: string;
  dueDate: Date | null;
  featureCount: number;
  doneFeatureCount: number;
  investScore: number | null;
  strategicTheme: { title: string; color: string } | null;
};

type ThemeAllocationRow = {
  id: string;
  title: string;
  color: string;
  cloudCost: number;
};

type LpmHomeProps = {
  arts: Array<{ id: string; name: string }>;
  teamCount: number;
  activeEpicsCount: number;
  epicsInProgress: Epic[];
  currentPiName: string | null;
  predictabilityPct: number | null;
  sprintVelocities: Array<{ id: string; velocity: number | null; endDate: Date }>;
  throughputDeltaPct: number | null;
  themeAllocation: ThemeAllocationRow[];
  cloudCostMtd: number;
  activeView?: string;
};

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function predictabilityTone(value: number): ChartTone {
  if (value >= 85) return "green";
  if (value >= 70) return "amber";
  return "red";
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "24px 12px",
        textAlign: "center",
        fontSize: 12.5,
        color: "var(--ink-faint)",
      }}
    >
      {children}
    </div>
  );
}

export default function LpmHome({
  arts,
  teamCount,
  activeEpicsCount,
  epicsInProgress,
  currentPiName,
  predictabilityPct,
  sprintVelocities,
  throughputDeltaPct,
  themeAllocation,
  cloudCostMtd,
}: LpmHomeProps) {
  const prefersReducedMotion = useReducedMotion();
  const velocityValues = sprintVelocities.map((s) => s.velocity ?? 0);
  const lastVelocity = velocityValues.at(-1) ?? null;
  const velocityLabels = sprintVelocities.map((_, i) => `S${i + 1}`);

  const predictBars: VBarDatum[] = [
    ...(predictabilityPct !== null
      ? [
          {
            label: currentPiName ?? "PI atual",
            value: predictabilityPct,
            tone: predictabilityTone(predictabilityPct),
          },
        ]
      : []),
  ];

  const hbarData = themeAllocation.map((row) => ({
    id: row.id,
    label: row.title,
    value: row.cloudCost,
    color: row.color,
  }));

  return (
    <motion.div
      animate="visible"
      initial={prefersReducedMotion ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0, 0, 0.2, 1] },
        },
      }}
    >
      <PageHeader
        badge={
          <>
            <RelationChip
              eyebrow="PI ativo"
              href="/pi-planning"
              icon={<Calendar />}
              label={currentPiName ?? "Nenhum"}
              tone="accent"
            />
            <RelationChip
              eyebrow="ARTs"
              href="/arts"
              icon={<Layers />}
              label={String(arts.length)}
              tone="blue"
            />
            <RelationChip
              eyebrow="Times"
              href="/teams"
              icon={<Users />}
              label={String(teamCount)}
              tone="purple"
            />
          </>
        }
        subtitle="Saúde do portfólio SAFe em tempo real — fluxo, predictability, custo e governança consolidados por ART."
        title="Visão Geral do Portfolio"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/portfolio">Ver Portfolio →</Link>
          </Button>
        }
      />

      <div
        style={{
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <KpiGrid cols={4}>
          <KpiCard
            badge={activeEpicsCount > 0 ? "Em execução" : "Nenhum ativo"}
            iconPath={ICON_LAYERS}
            label="Épicos ativos no portfólio"
            tone="accent"
            value={activeEpicsCount}
          />
          <KpiCard
            badge={currentPiName ? `PI ${currentPiName}` : "Sem PI ativo"}
            iconPath={ICON_TARGET}
            label="PI Predictability"
            tone={
              predictabilityPct !== null
                ? predictabilityTone(predictabilityPct)
                : "blue"
            }
            unit={predictabilityPct !== null ? "%" : undefined}
            value={predictabilityPct ?? "—"}
          />
          <KpiCard
            badge={
              throughputDeltaPct !== null
                ? `${throughputDeltaPct >= 0 ? "+" : ""}${throughputDeltaPct}% vs. sprint anterior`
                : "Sem histórico"
            }
            iconPath={ICON_TRENDING}
            label="Throughput médio"
            tone="blue"
            unit={lastVelocity !== null ? "SP" : undefined}
            value={lastVelocity ?? "—"}
          />
          <KpiCard
            badge="Mês atual"
            iconPath={ICON_DOLLAR}
            label="Custo de nuvem · MTD"
            tone="amber"
            value={compactCurrency.format(cloudCostMtd)}
          />
        </KpiGrid>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.55fr 1fr",
            gap: 16,
          }}
        >
          <SectionCard
            icon={TrendingUp}
            subtitle="Story points concluídos · sprints fechadas"
            title="Throughput por sprint"
          >
            {velocityValues.length > 0 ? (
              <AreaChart data={velocityValues} labels={velocityLabels} tone="accent" />
            ) : (
              <EmptyState>Nenhuma sprint fechada ainda.</EmptyState>
            )}
          </SectionCard>
          <SectionCard
            icon={Target}
            subtitle="Objetivos entregues no PI em execução"
            title="Predictability por PI"
          >
            {predictBars.length > 0 ? (
              <VBars data={predictBars} />
            ) : (
              <EmptyState>Nenhum PI em execução.</EmptyState>
            )}
          </SectionCard>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.35fr",
            gap: 16,
          }}
        >
          <SectionCard
            icon={DollarSign}
            subtitle="Custo de nuvem no mês, por tema"
            title="Alocação por Tema Estratégico"
          >
            <HBars data={hbarData} />
          </SectionCard>

          <SectionCard
            icon={Zap}
            subtitle="Progresso por épico ativo"
            title="Épicos em implementação"
            actions={
              <Link
                href="/portfolio"
                style={{ fontSize: 11.5, color: "var(--accent-c)" }}
              >
                ver todos →
              </Link>
            }
          >
            {epicsInProgress.length === 0 ? (
              <EmptyState>Nenhum épico em implementação no momento.</EmptyState>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {epicsInProgress.map((epic) => {
                  const progressPct =
                    epic.featureCount > 0
                      ? Math.round(
                          (epic.doneFeatureCount / epic.featureCount) * 100
                        )
                      : 0;
                  const overdue = epic.dueDate
                    ? new Date(epic.dueDate).getTime() < Date.now()
                    : false;

                  return (
                    <Link
                      className="transition-transform duration-150 hover:-translate-y-0.5"
                      href={`/epics/${epic.id}`}
                      key={epic.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "11px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--hairline)",
                        background: "var(--surface-2)",
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 8 }}
                        >
                          {overdue && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: "var(--red-text)",
                                background: "rgba(var(--red-rgb),.14)",
                                border: "1px solid rgba(var(--red-rgb),.25)",
                                borderRadius: 999,
                                padding: "1px 7px",
                              }}
                            >
                              <AlertTriangle size={10} strokeWidth={2.4} />
                              atrasado
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: "var(--ink)",
                            marginTop: 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {epic.title}
                        </div>
                      </div>

                      {epic.strategicTheme && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: epic.strategicTheme.color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: epic.strategicTheme.color,
                            }}
                          />
                          {epic.strategicTheme.title}
                        </span>
                      )}

                      <div style={{ width: 96 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ color: "var(--ink-faint)" }}>
                            {progressPct}%
                          </span>
                          <span
                            className="font-mono"
                            style={{ color: "var(--ink-faint)" }}
                          >
                            {epic.investScore !== null
                              ? `INVEST ${Math.round(epic.investScore)}`
                              : "—"}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 99,
                            background: "var(--surface-3)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${progressPct}%`,
                              height: "100%",
                              borderRadius: 99,
                              background: "var(--accent-c)",
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </motion.div>
  );
}
