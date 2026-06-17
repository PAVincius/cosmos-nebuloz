import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import type { EpicConfidence } from "@/lib/analytics/release-forecast";

const DOT_COLOR: Record<EpicConfidence["rag"], string> = {
  GREEN: "bg-emerald-500",
  AMBER: "bg-amber-500",
  RED: "bg-rose-500",
  GRAY: "bg-slate-400",
};

function fmt(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
}

type ConfidenceBadgeProps = {
  confidence: EpicConfidence;
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const { rag, confidenceLabel, p50Date, p85Date, reason } = confidence;

  // Business-language primary copy; statistics stay in the tooltip footnote.
  const tooltip =
    rag === "GRAY"
      ? (reason ?? "Not enough data to forecast")
      : `85% confident this ships by ${fmt(p85Date)}. Coin-flip date: ${fmt(p50Date)}.`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLOR[rag]}`}
              data-rag={rag}
              data-testid="confidence-dot"
            />
            <span className="text-muted-foreground">{confidenceLabel}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
