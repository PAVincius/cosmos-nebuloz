type GapCardProps = {
  gap: {
    teamName: string;
    initiativeTitle: string;
    overallScore: number;
    topGap: { category: string; gap: number };
    recommendation: string;
  };
};

export function CapabilityGapCard({ gap }: GapCardProps) {
  const sev =
    gap.overallScore > 0.4 ? "high" : gap.overallScore > 0.2 ? "medium" : "low";
  const borderColor =
    sev === "high"
      ? "border-rose-500"
      : sev === "medium"
        ? "border-amber-500"
        : "border-emerald-500";

  return (
    <div
      className={`rounded-xl border border-hairline border-l-4 bg-surface p-3 shadow-[var(--card-shadow)] ${borderColor}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">
          {gap.teamName} → {gap.initiativeTitle}
        </span>
        <span className="text-muted-foreground text-xs">
          gap {gap.overallScore.toFixed(2)}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground text-xs">
        Maior gap: <strong>{gap.topGap.category}</strong> (
        {gap.topGap.gap.toFixed(2)})
      </p>
      <p className="mt-1 text-xs">{gap.recommendation}</p>
    </div>
  );
}
