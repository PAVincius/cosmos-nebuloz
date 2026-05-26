"use client";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";

type Props = { epic: AggregatedPortfolioEpic };
export function EpicDrawerDescription({ epic }: Props) {
  return (
    <div className="p-6">
      <p className="text-muted-foreground text-sm">
        {epic.descriptionMd ?? "Sem descrição. Clique para editar."}
      </p>
    </div>
  );
}
