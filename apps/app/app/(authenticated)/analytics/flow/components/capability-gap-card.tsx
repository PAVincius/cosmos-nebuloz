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
  const sev = gap.overallScore > 0.4 ? "high" : gap.overallScore > 0.2 ? "medium" : "low";
  const borderColor =
    sev === "high"
      ? "border-rose-500"
      : sev === "medium"
        ? "border-amber-500"
        : "border-emerald-500";

  return (
    <div className={`rounded border-l-4 bg-card p-3 shadow-sm ${borderColor}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {gap.teamName} → {gap.initiativeTitle}
        </span>
        <span className="text-xs text-muted-foreground">gap {gap.overallScore.toFixed(2)}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Maior gap: <strong>{gap.topGap.category}</strong> ({gap.topGap.gap.toFixed(2)})
      </p>
      <p className="mt-1 text-xs">{gap.recommendation}</p>
    </div>
  );
}
