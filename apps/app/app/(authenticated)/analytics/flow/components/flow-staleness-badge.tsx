import { Badge } from "@repo/design-system/components/ui/badge";

const CONFIG = {
  FRESH: {
    label: "Atualizado",
    className: "border-emerald-500 text-emerald-600",
  },
  AGING: {
    label: "Envelhecendo",
    className: "border-amber-400 text-amber-600",
  },
  STALE: {
    label: "Desatualizado",
    className: "border-orange-500 text-orange-600",
  },
  CRITICAL: { label: "Crítico", className: "border-rose-500 text-rose-600" },
} as const;

type Props = {
  staleness: "FRESH" | "AGING" | "STALE" | "CRITICAL" | null;
};

export function FlowStalenessBadge({ staleness }: Props) {
  if (!staleness) {
    return null;
  }
  const c = CONFIG[staleness];
  return (
    <Badge className={c.className} variant="outline">
      {c.label}
    </Badge>
  );
}
