type AnomalyMeta = { narrative?: string; actions?: string[]; recurrence?: string };

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
    <div className="rounded border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
        <span className="text-xs font-semibold">{anomaly.rule}</span>
        <span className="text-xs text-muted-foreground">{anomaly.severity}</span>
        {meta.recurrence && meta.recurrence !== "new" && (
          <span className="text-xs text-amber-600">[{meta.recurrence}]</span>
        )}
      </div>
      {meta.narrative && <p className="mt-2 text-sm">{meta.narrative}</p>}
      {meta.actions && meta.actions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {meta.actions.map((a, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              {"→"} {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
