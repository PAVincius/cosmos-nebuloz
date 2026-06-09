import { Progress } from "@repo/design-system/components/ui/progress";
import { cn } from "@repo/design-system/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  LayersIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";
import { appDesign } from "@/lib/app-design";

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
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#5e6ad2]/[0.06] via-transparent to-transparent"
      />
      <div className="relative flex items-start justify-between gap-2">
        <div
          className={cn(
            "rounded-lg p-2 ring-1 ring-border/60",
            iconClassName ?? "bg-muted/80 text-muted-foreground"
          )}
        >
          <Icon aria-hidden className="h-4 w-4" />
        </div>
        {progress !== undefined && (
          <span className="font-semibold text-[11px] text-muted-foreground tabular-nums">
            {progress}%
          </span>
        )}
      </div>
      <div className="relative min-w-0">
        <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 font-bold text-2xl tabular-nums tracking-tight sm:text-3xl",
            valueClassName
          )}
        >
          {value}
        </p>
        {subValue ? (
          <p className="mt-0.5 text-muted-foreground text-sm tabular-nums">
            {subValue}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-1.5 line-clamp-2 text-muted-foreground text-xs leading-snug">
            {hint}
          </p>
        ) : null}
      </div>
      {progress !== undefined ? (
        <Progress className="relative h-1.5" value={progress} />
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
          featuresDone > 0
            ? `${featuresDone} concluída${featuresDone > 1 ? "s" : ""}`
            : null,
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
        okrSummary
          ? "sm:grid-cols-2 lg:grid-cols-5"
          : "grid-cols-2 lg:grid-cols-4"
      )}
    >
      <MetricCard
        hint={featureHint}
        icon={LayersIcon}
        iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        label="Features"
        value={featuresCount}
      />

      <MetricCard
        hint={storyHint}
        icon={BookOpenIcon}
        iconClassName="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        label="Stories"
        progress={totalStories > 0 ? storyProgress : undefined}
        value={totalStories}
      />

      <MetricCard
        hint={spHint}
        icon={CheckCircle2Icon}
        iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        label="Story points"
        progress={totalSP > 0 ? spProgress : undefined}
        subValue={totalSP > 0 ? `/ ${totalSP} SP` : undefined}
        value={doneSP}
      />

      <MetricCard
        hint={wsjfHint}
        icon={ZapIcon}
        iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        label="WSJF médio"
        value={avgWSJF > 0 ? avgWSJF.toFixed(1) : "—"}
        valueClassName={cn(
          "font-mono",
          avgWSJF > 0 && WSJF_VALUE_CLASS(avgWSJF)
        )}
      />

      {okrSummary ? (
        <MetricCard
          hint={`${okrSummary.themeTitle} — no prazo`}
          icon={TargetIcon}
          iconClassName="bg-[#5e6ad2]/10 text-[#5e6ad2]"
          label="OKRs do tema"
          progress={
            okrSummary.total > 0
              ? Math.round((okrSummary.onTrack / okrSummary.total) * 100)
              : undefined
          }
          value={`${okrSummary.onTrack}/${okrSummary.total}`}
        />
      ) : null}
    </div>
  );
}
