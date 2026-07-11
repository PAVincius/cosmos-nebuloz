import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import { SAFE_COMPETENCIES } from "@/app/actions/measure-grow/schema";
import { CompetencyRadar } from "./competency-radar";
import { computeCompetencyMaturity, formatDelta } from "./maturity-utils";

// SVG path data (24x24 viewBox) — mirrors the icon set used by KpiCard
// across the other re-skinned analytics dashboards (see velocity-dashboard).
const ICON_GAUGE = "M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0";
const ICON_CHECK = "M20 6 9 17l-5-5";
const ICON_ALERT =
  "M21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01";
const ICON_STAR =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";

type MaturityTone = "green" | "amber" | "red";

const TONE_FILL: Record<MaturityTone, string> = {
  green: "var(--green)",
  amber: "var(--amber)",
  red: "var(--red)",
};

const TONE_TEXT: Record<MaturityTone, string> = {
  green: "var(--green-text)",
  amber: "var(--amber-text)",
  red: "var(--red-text)",
};

function toneFor(score: number): MaturityTone {
  if (score >= 3.5) return "green";
  if (score >= 3) return "amber";
  return "red";
}

type Assessment = {
  competency: string;
  score: number;
  assessedAt: Date;
};

type MaturityOverviewProps = {
  assessments: Assessment[];
};

/**
 * Re-skin of the prototype's `screenMaturity` (screen-measure.jsx): 4-KPI
 * row (média / evoluindo / mais forte / oportunidade) + radar-vs-anterior
 * chart + per-competency detail list, scored live from the real assessment
 * records. "Ciclo anterior" is derived from each competency's two most
 * recent distinct assessment dates (see maturity-utils.ts) since the schema
 * has no explicit PI/quarter field — there is no fabricated data here, only
 * a real-data-derived comparison window.
 */
export function MaturityOverview({ assessments }: MaturityOverviewProps) {
  if (assessments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhuma avaliação de maturidade registrada ainda.
        </p>
        <p className="max-w-sm text-muted-foreground/70 text-xs">
          Realize o auto-assessment das 7 competências SAFe na aba
          “Assessments” abaixo para ver o mapa de maturidade.
        </p>
      </div>
    );
  }

  const keys = SAFE_COMPETENCIES.map((c) => c.key);
  const maturity = computeCompetencyMaturity(keys, assessments);
  const dimensions = SAFE_COMPETENCIES.map((c) => ({
    name: c.label,
    ...maturity[c.key],
  }));

  const assessed = dimensions.filter((d) => d.score > 0);
  const avg =
    assessed.length > 0
      ? assessed.reduce((s, d) => s + d.score, 0) / assessed.length
      : 0;
  const avgPrev =
    assessed.length > 0
      ? assessed.reduce((s, d) => s + d.prevScore, 0) / assessed.length
      : 0;
  const improved = dimensions.filter((d) => d.delta > 0).length;
  const top = [...assessed].sort((a, b) => b.score - a.score)[0];
  const low = [...assessed].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="flex flex-col gap-6">
      <KpiGrid>
        <KpiCard
          badge={`${formatDelta(Math.round((avg - avgPrev) * 10) / 10)} vs. ciclo anterior`}
          iconPath={ICON_GAUGE}
          label="Maturidade média"
          tone="accent"
          unit="/5"
          value={avg.toFixed(1)}
        />
        <KpiCard
          badge="— desde o ciclo anterior"
          iconPath={ICON_CHECK}
          label="Competências evoluindo"
          tone="green"
          unit={`/${SAFE_COMPETENCIES.length}`}
          value={improved}
        />
        <KpiCard
          badge={top ? `— ${top.name}` : "— sem dados"}
          iconPath={ICON_STAR}
          label="Mais forte"
          tone="purple"
          unit="/5"
          value={top ? top.score.toFixed(1) : "—"}
        />
        <KpiCard
          badge={low ? `— ${low.name}` : "— sem dados"}
          iconPath={ICON_ALERT}
          label="Maior oportunidade"
          tone="amber"
          unit="/5"
          value={low ? low.score.toFixed(1) : "—"}
        />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          subtitle="Ciclo atual (sólido) vs. anterior (tracejado)"
          title="Radar de competências"
        >
          <CompetencyRadar assessments={assessments} height={320} />
        </SectionCard>

        <SectionCard
          subtitle="Nota e variação desde o ciclo anterior"
          title="Detalhe por competência"
        >
          <div className="flex flex-col gap-3">
            {dimensions.map((d) => {
              const tone = toneFor(d.score);
              return (
                <div className="flex items-center gap-3" key={d.key}>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: TONE_FILL[tone] }}
                  />
                  <span className="w-40 shrink-0 truncate text-sm">
                    {d.name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(d.score / 5) * 100}%`,
                        background: TONE_FILL[tone],
                      }}
                    />
                  </div>
                  <span
                    className="w-10 shrink-0 text-right font-semibold text-sm tabular-nums"
                    style={{ color: TONE_TEXT[tone] }}
                  >
                    {d.score.toFixed(1)}
                  </span>
                  <span
                    className={`w-12 shrink-0 text-right text-xs tabular-nums ${
                      d.delta > 0
                        ? "text-emerald-400"
                        : d.delta < 0
                          ? "text-rose-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {formatDelta(d.delta)}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
