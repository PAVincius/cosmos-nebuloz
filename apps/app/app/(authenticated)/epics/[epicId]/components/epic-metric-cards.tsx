import { appDesign } from "@/lib/app-design";
import { cn } from "@repo/design-system/lib/utils";
import { Progress } from "@repo/design-system/components/ui/progress";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  LayersIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";

export type EpicMetricCardsProps = {
  featuresCount: number;
  featuresDone: number;
  featuresInFlight: number;
  totalStories: number;
  doneStories: number;
  storyProgress: number;
  totalSP: number;
  doneSP: number;
  spProgress: number;
  inProgressSP: number;
  avgWSJF: number;
  topFeatureTitle: string | null;
  topWSJF: number;
  costOfDelay: number;
  okrSummary?: { onTrack: number; total: number; themeTitle: string } | null;
};

const WSJF_VALUE_CLASS = (score: number) =>
  score >= 10
    ? "text-emerald-600 dark:text-emerald-400"
    : score >= 5
      ? "text-amber-600 dark:text-amber-400"
      : "text-foreground";

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  hint,
  progress,
  iconClassName,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  hint?: string;
  progress?: number;
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        appDesign.statCard,
        "relative flex flex-col gap-2.5 overflow-hidden p-4"
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#5e6ad2]/[0.06] via-transparent to-transparent"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-2">
        <div
          className={cn(
            "rounded-lg p-2 ring-1 ring-border/60",
            iconClassName ?? "bg-muted/80 text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        {progress !== undefined && (
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            {progress}%
          </span>
        )}
      </div>
      <div className="relative min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl",
            valueClassName
          )}
        >
          {value}
        </p>
        {subValue ? (
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {subValue}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground line-clamp-2">
            {hint}
          </p>
        ) : null}
      </div>
      {progress !== undefined ? (
        <Progress value={progress} className="relative h-1.5" />
      ) : null}
    </div>
  );
}

export function EpicMetricCards({
  featuresCount,
  featuresDone,
  featuresInFlight,
  totalStories,
  doneStories,
  storyProgress,
  totalSP,
  doneSP,
  spProgress,
  inProgressSP,
  avgWSJF,
  topFeatureTitle,
  topWSJF,
  costOfDelay,
  okrSummary,
}: EpicMetricCardsProps) {
  const featureHint =
    featuresCount === 0
      ? "Adicione features no kanban"
      : [
          featuresDone > 0 ? `${featuresDone} concluída${featuresDone > 1 ? "s" : ""}` : null,
          featuresInFlight > 0
            ? `${featuresInFlight} em fluxo`
            : featuresDone < featuresCount
              ? `${featuresCount - featuresDone} no backlog`
              : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const storyHint =
    totalStories === 0
      ? "Sem stories ligadas às features"
      : `${doneStories} de ${totalStories} concluídas`;

  const spHint =
    totalSP === 0
      ? "Sem story points estimados"
      : inProgressSP > 0
        ? `${inProgressSP} SP em andamento · CoD ${costOfDelay}`
        : `Cost of Delay (Σ BV+TC+RR): ${costOfDelay}`;

  const wsjfHint =
    topFeatureTitle && topWSJF > 0
      ? `Prioridade: ${topFeatureTitle} (${topWSJF.toFixed(1)})`
      : "Priorize com WSJF nas features";

  return (
    <div
      className={cn(
        "grid gap-3",
        okrSummary ? "sm:grid-cols-2 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4"
      )}
    >
      <MetricCard
        icon={LayersIcon}
        label="Features"
        value={featuresCount}
        hint={featureHint}
        iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400"
      />

      <MetricCard
        icon={BookOpenIcon}
        label="Stories"
        value={totalStories}
        hint={storyHint}
        progress={totalStories > 0 ? storyProgress : undefined}
        iconClassName="bg-sky-500/10 text-sky-600 dark:text-sky-400"
      />

      <MetricCard
        icon={CheckCircle2Icon}
        label="Story points"
        value={doneSP}
        subValue={totalSP > 0 ? `/ ${totalSP} SP` : undefined}
        hint={spHint}
        progress={totalSP > 0 ? spProgress : undefined}
        iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      />

      <MetricCard
        icon={ZapIcon}
        label="WSJF médio"
        value={avgWSJF > 0 ? avgWSJF.toFixed(1) : "—"}
        hint={wsjfHint}
        valueClassName={cn("font-mono", avgWSJF > 0 && WSJF_VALUE_CLASS(avgWSJF))}
        iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
      />

      {okrSummary ? (
        <MetricCard
          icon={TargetIcon}
          label="OKRs do tema"
          value={`${okrSummary.onTrack}/${okrSummary.total}`}
          hint={`${okrSummary.themeTitle} — no prazo`}
          progress={
            okrSummary.total > 0
              ? Math.round((okrSummary.onTrack / okrSummary.total) * 100)
              : undefined
          }
          iconClassName="bg-[#5e6ad2]/10 text-[#5e6ad2]"
        />
      ) : null}
    </div>
  );
}
