import type { FlowMetricsResult } from "@/app/actions/flow-metrics";

type Props = {
  flowTime: FlowMetricsResult["flowTime"];
  overall: number;
};

export function FlowTimeCard({ flowTime, overall }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-3xl">{overall}</span>
        <span className="text-muted-foreground text-sm">
          dias (média geral)
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {flowTime.map((t) => (
          <div className="rounded-lg border p-3 text-center" key={t.type}>
            <div className="font-semibold text-lg">{t.avgDays}d</div>
            <div className="text-muted-foreground text-xs">{t.type}</div>
            <div className="text-muted-foreground text-xs">
              ({t.count} itens)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
