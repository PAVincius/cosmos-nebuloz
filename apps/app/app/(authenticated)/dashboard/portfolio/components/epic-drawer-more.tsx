"use client";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";

type Props = { epic: AggregatedPortfolioEpic };
export function EpicDrawerMore({ epic }: Props) {
  return (
    <div className="space-y-3 p-6 text-sm">
      <div>
        <span className="text-muted-foreground">Status: </span>
        {epic.statusId}
      </div>
      <div>
        <span className="text-muted-foreground">Features: </span>
        {epic.featureCount}
      </div>
      <div>
        <span className="text-muted-foreground">OKRs: </span>
        {epic.linkedOKRCount}
      </div>
    </div>
  );
}
