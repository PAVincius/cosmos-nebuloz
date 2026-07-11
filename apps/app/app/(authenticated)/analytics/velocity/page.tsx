import { GitBranch, History, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getVelocityOverview } from "@/app/actions/velocity";
import { appDesign } from "@/lib/app-design";
import { VelocityDashboard } from "./components/velocity-dashboard";

export const metadata = {
  title: "Velocity | COSMOS",
  description: "Histórico de velocity por time e ART",
};

type Trend = "up" | "down" | "neutral";

const TREND_META: Record<
  Trend,
  { label: string; rgb: string; text: string; Icon: typeof TrendingUp }
> = {
  up: {
    label: "tendência de alta",
    rgb: "52,211,153",
    text: "var(--green-text)",
    Icon: TrendingUp,
  },
  down: {
    label: "tendência de queda",
    rgb: "251,113,133",
    text: "var(--red-text)",
    Icon: TrendingDown,
  },
  neutral: {
    label: "tendência estável",
    rgb: "148,163,184",
    text: "var(--ink-muted)",
    Icon: Minus,
  },
};

function dominantTrend(teams: { trend: Trend }[]): Trend {
  const counts = teams.reduce(
    (acc, t) => {
      acc[t.trend] += 1;
      return acc;
    },
    { up: 0, down: 0, neutral: 0 } as Record<Trend, number>
  );
  if (counts.up > counts.down && counts.up > counts.neutral) {
    return "up";
  }
  if (counts.down > counts.up && counts.down > counts.neutral) {
    return "down";
  }
  return "neutral";
}

export default async function VelocityPage() {
  const teams = await getVelocityOverview();

  const arts = Array.from(
    new Map(
      teams
        .filter((t) => t.artId && t.artName)
        .map((t) => [t.artId!, t.artName!])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const sprintCount = teams[0]?.sprints.length ?? 0;
  const trend = TREND_META[dominantTrend(teams)];
  const TrendIcon = trend.Icon;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        badge={
          teams.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-cosmos-pill border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: `rgba(${trend.rgb},.14)`,
                  borderColor: `rgba(${trend.rgb},.3)`,
                  color: trend.text,
                }}
              >
                <TrendIcon size={12} />
                {trend.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-cosmos-pill border border-hairline-strong px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
                {sprintCount} sprints
              </span>
              <RelationChip
                eyebrow="Analytics"
                href="/analytics/flow"
                icon={<GitBranch />}
                label="Flow Metrics"
                tone="purple"
              />
              <RelationChip
                eyebrow="Analytics"
                href="/analytics/history"
                icon={<History />}
                label="Histórico"
                tone="accent"
              />
            </div>
          ) : undefined
        }
        breadcrumb={[{ label: "Analytics", href: "/analytics" }]}
        subtitle="Story points entregues por time ao longo dos últimos sprints. Base para previsibilidade e planejamento de capacidade."
        title="Velocity"
      />
      <div className={appDesign.bodyScroll}>
        <VelocityDashboard arts={arts} teams={teams} />
      </div>
    </div>
  );
}
