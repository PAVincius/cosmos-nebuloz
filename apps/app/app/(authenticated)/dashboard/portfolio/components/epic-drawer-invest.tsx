"use client";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";

type Props = { epic: AggregatedPortfolioEpic };
export function EpicDrawerInvest({ epic }: Props) {
  return (
    <div className="p-6">
      {epic.investScore !== null ? (
        <p className="text-sm">INVEST Score: {Math.round(epic.investScore)}</p>
      ) : (
        <p className="text-muted-foreground text-sm">Análise IA pendente.</p>
      )}
    </div>
  );
}
