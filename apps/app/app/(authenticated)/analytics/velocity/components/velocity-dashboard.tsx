"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { motion, useReducedMotion } from "framer-motion";
import { GaugeIcon, TrendingUpIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import type { TeamVelocitySummary } from "@/app/actions/velocity/types";

const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_TRENDING = "M22 7l-8.5 8.5-5-5L1 18";
const ICON_USERS =
  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const ICON_GAUGE = "M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0";

// Series tone cycle — matches the app-wide tone palette (KpiCard/RelationChip)
const SERIES_TONES = [
  "green",
  "blue",
  "purple",
  "amber",
  "red",
  "accent",
] as const;
type SeriesTone = (typeof SERIES_TONES)[number];

const TONE_COLOR: Record<SeriesTone, string> = {
  green: "var(--green)",
  blue: "var(--blue)",
  purple: "var(--purple)",
  amber: "var(--amber)",
  red: "var(--red)",
  accent: "var(--accent-c)",
};

const EASE_STANDARD = [0.25, 0, 0.2, 1] as const;

function seriesTone(index: number): SeriesTone {
  return SERIES_TONES[index % SERIES_TONES.length];
}

/** Consistency = 100 minus the coefficient of variation across sprints. */
function consistencyScore(sprints: { sp: number }[]): number {
  const values = sprints.map((s) => s.sp);
  if (values.length === 0) {
    return 0;
  }
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg === 0) {
    return 0;
  }
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - (stdDev / avg) * 100)));
}

type Props = {
  teams: TeamVelocitySummary[];
  arts: { id: string; name: string }[];
};

export function VelocityDashboard({ teams, arts }: Props) {
  const [filterArt, setFilterArt] = useState("ALL");
  const shouldReduceMotion = useReducedMotion();

  const revealVariants = {
    hidden: shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : { duration: 0.6, ease: EASE_STANDARD },
    },
  };

  const filtered =
    filterArt === "ALL" ? teams : teams.filter((t) => t.artId === filterArt);

  const allPoints = filtered.flatMap((t) => t.sprints.map((s) => s.sp));
  const sprintLabels = filtered[0]?.sprints.map((s) => s.label) ?? [];
  const max = Math.max(1, ...allPoints);

  const lastThroughput = filtered.reduce(
    (sum, t) => sum + (t.sprints.at(-1)?.sp ?? 0),
    0
  );
  const prevThroughput = filtered.reduce(
    (sum, t) => sum + (t.sprints.at(-2)?.sp ?? 0),
    0
  );
  const avgVelocity =
    allPoints.length > 0
      ? Math.round(allPoints.reduce((a, b) => a + b, 0) / allPoints.length)
      : 0;
  const variability =
    allPoints.length > 0
      ? Math.round((Math.max(...allPoints) - Math.min(...allPoints)) / 2)
      : 0;
  const throughputDelta = lastThroughput - prevThroughput;

  const teamsWithConsistency = filtered
    .map((t, i) => ({
      ...t,
      tone: seriesTone(i),
      consistency: consistencyScore(t.sprints),
    }))
    .sort((a, b) => b.consistency - a.consistency)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Filter */}
      {arts.length > 1 && (
        <div className="flex items-center gap-3">
          <Select onValueChange={setFilterArt} value={filterArt}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Filtrar ART" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os ARTs</SelectItem>
              {arts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs">
            {filtered.length} time(s)
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <ZapIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Nenhum time encontrado
          </p>
          <Link
            className="text-primary text-xs underline underline-offset-4"
            href="/teams"
          >
            Ver times
          </Link>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <motion.div
            animate="visible"
            initial="hidden"
            variants={revealVariants}
          >
            <KpiGrid>
              <KpiCard
                badge="— Por sprint"
                iconPath={ICON_ACTIVITY}
                label="Velocity média / time"
                tone="blue"
                unit="SP"
                value={avgVelocity}
              />
              <KpiCard
                badge={`${throughputDelta >= 0 ? "↗ +" : "↘ "}${throughputDelta} vs anterior`}
                iconPath={ICON_TRENDING}
                label="Throughput (último sprint)"
                tone="green"
                unit="SP"
                value={lastThroughput}
              />
              <KpiCard
                badge={`— ${sprintLabels.length} sprints`}
                iconPath={ICON_USERS}
                label="Times medidos"
                tone="accent"
                value={filtered.length}
              />
              <KpiCard
                badge="— Amplitude"
                iconPath={ICON_GAUGE}
                label="Variabilidade"
                tone="amber"
                unit="SP"
                value={`±${variability}`}
              />
            </KpiGrid>
          </motion.div>

          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: "1.6fr 1fr" }}
          >
            <motion.div
              initial="hidden"
              variants={revealVariants}
              viewport={{ once: true, margin: "-40px" }}
              whileInView="visible"
            >
              <SectionCard
                icon={TrendingUpIcon}
                subtitle="Empilhado por time, por sprint"
                title="Story Points por Sprint"
              >
                <div
                  className="flex items-end gap-3.5"
                  style={{ height: 200, padding: "0 2px" }}
                >
                  {sprintLabels.map((label, si) => (
                    <div
                      className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                      key={label}
                    >
                      <div className="flex h-full w-full max-w-[46px] items-end justify-center gap-0.5">
                        {filtered.map((t, i) => {
                          const sp = t.sprints[si]?.sp ?? 0;
                          const tone = seriesTone(i);
                          return (
                            <div
                              className="group/seg relative h-full w-full"
                              key={t.teamId}
                            >
                              <motion.div
                                animate={{ height: `${(sp / max) * 100}%` }}
                                className="absolute bottom-0 w-full rounded-t-[3px]"
                                initial={
                                  shouldReduceMotion
                                    ? false
                                    : { height: 0 }
                                }
                                style={{
                                  minHeight: sp > 0 ? 3 : 0,
                                  background: TONE_COLOR[tone],
                                }}
                                transition={{
                                  duration: shouldReduceMotion ? 0 : 0.5,
                                  delay: shouldReduceMotion
                                    ? 0
                                    : si * 0.04 + i * 0.02,
                                  ease: EASE_STANDARD,
                                }}
                                whileHover={{
                                  filter: "brightness(1.15)",
                                }}
                              >
                                <span
                                  className="-translate-x-1/2 pointer-events-none absolute bottom-full left-1/2 mb-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 font-bold font-mono text-[10px] opacity-0 shadow-lg transition-opacity duration-150 group-hover/seg:opacity-100"
                                  style={{
                                    background: "var(--surface-4)",
                                    color: TONE_COLOR[tone],
                                  }}
                                >
                                  {t.teamName}: {sp} SP
                                </span>
                              </motion.div>
                            </div>
                          );
                        })}
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-4">
                  {filtered.map((t, i) => (
                    <div
                      className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"
                      key={t.teamId}
                    >
                      <span
                        className="h-[3px] w-3.5 rounded-sm"
                        style={{ background: TONE_COLOR[seriesTone(i)] }}
                      />
                      {t.teamName}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </motion.div>

            <motion.div
              initial="hidden"
              variants={revealVariants}
              viewport={{ once: true, margin: "-40px" }}
              whileInView="visible"
            >
              <SectionCard
                icon={GaugeIcon}
                subtitle="Estabilidade da entrega no período"
                title="Consistência por Time"
              >
                <div className="flex flex-col gap-4">
                  {teamsWithConsistency.map((t, idx) => {
                    const tone = t.consistency >= 90 ? "green" : "amber";
                    return (
                      <div key={t.teamId}>
                        <div className="mb-1.5 flex justify-between text-[12.5px]">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                            <span
                              className="h-[7px] w-[7px] rounded-full"
                              style={{ background: TONE_COLOR[t.tone] }}
                            />
                            {t.teamName}
                          </span>
                          <span
                            className="font-bold font-mono"
                            style={{
                              color:
                                tone === "green"
                                  ? "var(--green-text)"
                                  : "var(--amber-text)",
                            }}
                          >
                            {t.consistency}%
                          </span>
                        </div>
                        <div
                          className="w-full overflow-hidden rounded-full"
                          style={{
                            height: 7,
                            background: "var(--surface-3)",
                          }}
                        >
                          <motion.div
                            animate={{ width: `${t.consistency}%` }}
                            initial={
                              shouldReduceMotion ? false : { width: 0 }
                            }
                            style={{
                              height: "100%",
                              borderRadius: 999,
                              background:
                                tone === "green"
                                  ? "var(--green)"
                                  : "var(--amber)",
                            }}
                            transition={{
                              duration: shouldReduceMotion ? 0 : 0.6,
                              delay: shouldReduceMotion ? 0 : idx * 0.08,
                              ease: EASE_STANDARD,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </motion.div>
          </div>

          {/* Capacity note */}
          <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-amber-400 text-xs">
            <strong>Nota:</strong> Consistência mede a estabilidade da entrega
            ao longo do período, não a aderência a um plano de commitment. Use
            junto com Flow Metrics para um panorama completo de fluxo de
            valor.
          </div>
        </>
      )}
    </div>
  );
}
