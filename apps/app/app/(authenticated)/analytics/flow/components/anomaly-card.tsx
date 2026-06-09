type AnomalyMeta = {
  narrative?: string;
  actions?: string[];
  recurrence?: string;
};

type Props = {
  anomaly: {
    id: string;
    rule: string;
    severity: string;
    metadata: AnomalyMeta | null;
  };
};

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "bg-rose-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-slate-400",
};

export function AnomalyCard({ anomaly }: Props) {
  const color = SEV_COLOR[anomaly.severity] ?? "bg-slate-400";
  const meta = anomaly.metadata ?? {};
  return (
    <div className="rounded-xl border border-hairline bg-surface p-3 shadow-[var(--card-shadow)]">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
        <span className="font-semibold text-xs">{anomaly.rule}</span>
        <span className="text-muted-foreground text-xs">
          {anomaly.severity}
        </span>
        {meta.recurrence && meta.recurrence !== "new" && (
          <span className="text-amber-600 text-xs">[{meta.recurrence}]</span>
        )}
      </div>
      {meta.narrative && <p className="mt-2 text-sm">{meta.narrative}</p>}
      {meta.actions && meta.actions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {meta.actions.map((a, i) => (
            <li className="text-muted-foreground text-xs" key={i}>
              {"→"} {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
