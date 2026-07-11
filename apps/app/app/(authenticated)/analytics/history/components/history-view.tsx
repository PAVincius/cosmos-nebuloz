"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Archive } from "lucide-react";
import { KpiCard, KpiGrid } from "../../../components/kpi-card";
import { SectionCard } from "../../../components/section-card";
import type { HistoryOverview } from "@/app/actions/analytics/history";
import { HISTORY_ICONS } from "./history-icons";

type HistoryViewProps = {
  overview: HistoryOverview;
};

const revealVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.0, 0.0, 0.2, 1] as const },
  },
};

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function HistoryView({ overview }: HistoryViewProps) {
  const { filterArt, pastPis, retiredArts } = overview;

  const predValues = pastPis
    .map((p) => p.predictability)
    .filter((v): v is number => v !== null);
  const avgPredictability =
    predValues.length > 0
      ? predValues.reduce((a, b) => a + b, 0) / predValues.length
      : null;
  const objAchievedSum = pastPis.reduce((sum, p) => sum + p.objAchieved, 0);
  const objTotalSum = pastPis.reduce((sum, p) => sum + p.objTotal, 0);

  // Group past PIs by quarter, preserving desc order already applied upstream.
  const quarters: string[] = [];
  const byQuarter = new Map<string, typeof pastPis>();
  for (const pi of pastPis) {
    if (!byQuarter.has(pi.quarter)) {
      byQuarter.set(pi.quarter, []);
      quarters.push(pi.quarter);
    }
    byQuarter.get(pi.quarter)?.push(pi);
  }

  return (
    <div className="flex flex-col gap-8">
      <KpiGrid cols={4}>
        <KpiCard
          badge={filterArt ? `— ${filterArt.name}` : "— No arquivo"}
          iconPath={HISTORY_ICONS.calendar}
          label="PIs finalizados"
          tone="blue"
          value={pastPis.length}
        />
        <KpiCard
          badge="↗ Histórica"
          iconPath={HISTORY_ICONS.target}
          label="Predictability média"
          tone="green"
          unit={avgPredictability === null ? undefined : "%"}
          value={
            avgPredictability === null
              ? "—"
              : Math.round(avgPredictability * 100)
          }
        />
        <KpiCard
          badge="— Comprometidos"
          iconPath={HISTORY_ICONS.check}
          label="Objetivos entregues"
          tone="accent"
          value={`${objAchievedSum}/${objTotalSum}`}
        />
        <KpiCard
          badge="— Consolidados"
          iconPath={HISTORY_ICONS.archive}
          label="ARTs arquivados"
          tone="amber"
          value={retiredArts.length}
        />
      </KpiGrid>

      <motion.section
        initial="hidden"
        variants={revealVariants}
        viewport={{ once: true, margin: "-40px" }}
        whileInView="visible"
      >
        {pastPis.length === 0 ? (
          <div
            className="rounded-cosmos-md border border-hairline p-8 text-center text-sm"
            style={{ color: "var(--ink-subtle)" }}
          >
            {filterArt
              ? `Nenhum PI encerrado ainda para o ART ${filterArt.name}.`
              : "Nenhum PI encerrado ainda."}
          </div>
        ) : (
          <div className="flex flex-col">
            {quarters.map((quarter, qIndex) => (
              <div
                className="grid gap-4"
                key={quarter}
                style={{ gridTemplateColumns: "96px 1fr" }}
              >
                <div
                  className="relative pt-4 font-mono text-xs font-bold"
                  style={{ color: "var(--ink-subtle)" }}
                >
                  {quarter}
                  {qIndex < quarters.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-11 w-px"
                      style={{
                        bottom: -4,
                        background: "var(--hairline)",
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-3 py-3">
                  {byQuarter.get(quarter)?.map((pi) => (
                    <Link
                      className="block"
                      href={`/analytics/pi-retro/${pi.id}`}
                      key={pi.id}
                    >
                      <motion.div
                        className="rounded-cosmos-md border border-hairline p-3.5 px-4"
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: `rgb(var(--${pi.tone}-rgb))`,
                          background: "var(--surface)",
                        }}
                        whileHover={{
                          x: 3,
                          boxShadow: "0 12px 26px -16px rgba(0,0,0,.8)",
                        }}
                      >
                        <div className="mb-2.5 flex items-center gap-2.5">
                          <span className="font-mono text-[13px] font-bold">
                            {pi.name}
                          </span>
                          <span
                            className="rounded-cosmos-pill px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
                            style={{
                              color: `rgb(var(--${pi.tone}-text))`,
                              background: `rgba(var(--${pi.tone}-rgb),.13)`,
                            }}
                          >
                            {pi.artName}
                          </span>
                          <span
                            className="ml-auto text-right text-xs"
                            style={{ color: "var(--ink-muted)" }}
                          >
                            {pi.delivered}
                          </span>
                        </div>
                        <div className="mb-2.5 grid grid-cols-4 gap-2.5">
                          <HistMetric
                            label="PPM"
                            value={pct(pi.ppm)}
                          />
                          <HistMetric
                            label="PREDICT."
                            value={pct(pi.predictability)}
                          />
                          <HistMetric
                            label="OBJ."
                            value={`${pi.objAchieved}/${pi.objTotal}`}
                          />
                          <HistMetric
                            label="CONF."
                            value={
                              pi.confidence === null
                                ? "—"
                                : pi.confidence.toFixed(1)
                            }
                          />
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      <motion.section
        initial="hidden"
        variants={revealVariants}
        viewport={{ once: true, margin: "-40px" }}
        whileInView="visible"
      >
        <SectionCard
          accentRgb="245,158,11"
          icon={Archive}
          subtitle="ARTs desativados, preservados apenas para consulta histórica."
          title="ARTs arquivados"
        >
          {retiredArts.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-subtle)" }}>
              Nenhum ART arquivado.
            </p>
          ) : (
            <div
              className="grid gap-3.5"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              {retiredArts.map((art) => (
                <div
                  className="rounded-cosmos-lg p-4 px-4.5"
                  key={art.id}
                  style={{
                    border: "1px dashed var(--hairline-strong)",
                    background: "var(--surface)",
                    opacity: 0.88,
                  }}
                >
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span className="text-sm font-bold">{art.name}</span>
                    <span
                      className="ml-auto rounded-cosmos-pill px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
                      style={{
                        color: "var(--ink-faint)",
                        background: "var(--surface-2)",
                      }}
                    >
                      {art.retiredOn}
                    </span>
                  </div>
                  <div
                    className="grid grid-cols-3 gap-2.5 text-center text-xs"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    <div>
                      <div className="font-mono text-sm font-bold">
                        {art.pisRun}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase">PIs</div>
                    </div>
                    <div>
                      <div className="font-mono text-sm font-bold">
                        {art.members}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase">
                        Membros
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-sm font-bold">
                        {pct(art.finalPredictability)}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase">
                        Predict.
                      </div>
                    </div>
                  </div>
                  <p
                    className="mt-2.5 pt-2.5 text-xs"
                    style={{
                      borderTop: "1px solid var(--hairline)",
                      color: "var(--ink-muted)",
                    }}
                  >
                    Equipes: {art.teamNames}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </motion.section>
    </div>
  );
}

function HistMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-cosmos-sm border border-hairline py-1.5 px-1 text-center"
      style={{ background: "var(--surface-2)" }}
    >
      <div className="font-mono text-[15px] font-bold">{value}</div>
      <div
        className="mt-0.5 font-mono text-[8px] uppercase tracking-wide"
        style={{ color: "var(--ink-faint)" }}
      >
        {label}
      </div>
    </div>
  );
}
