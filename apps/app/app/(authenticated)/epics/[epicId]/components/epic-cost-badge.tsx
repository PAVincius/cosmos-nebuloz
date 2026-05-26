import { getEpicCost } from "@/app/actions/billing/epic-cost";

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `$${(n / 1_000).toFixed(1)}k`;
  }
  return `$${n.toFixed(0)}`;
}

type Props = { epicId: string };

export async function EpicCostBadge({ epicId }: Props) {
  const result = await getEpicCost(epicId).catch(() => null);

  if (!result?.hasMapping) {
    return (
      <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        $ —
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded border border-emerald-500 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
      {formatCompact(result.totalCost)}
    </span>
  );
}
