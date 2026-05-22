type Props = {
  totalExpected: number;
  totalMin: number;
  totalMax: number;
  memberCount: number;
};

export function CapacitySummaryCard({
  totalExpected,
  totalMin,
  totalMax,
  memberCount,
}: Props) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-5">
      <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
        Capacidade Estimada — Próximo Sprint
      </p>
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-4xl tabular-nums">{totalExpected}</span>
        <span className="text-muted-foreground text-sm">SP</span>
      </div>
      <p className="text-muted-foreground text-xs">
        Intervalo: {totalMin}–{totalMax} SP · {memberCount} membros
      </p>
    </div>
  );
}
