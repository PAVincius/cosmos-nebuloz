"use client";
import { Button } from "@repo/design-system/components/ui/button";
import { useState } from "react";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
import { PromptDeliveryDialog } from "./prompt-delivery-dialog";

type Props = { epic: AggregatedPortfolioEpic };
export function EpicDrawerMore({ epic }: Props) {
  const [showPromptDialog, setShowPromptDialog] = useState(false);

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

      <div className="pt-2">
        <Button
          onClick={() => setShowPromptDialog(true)}
          size="sm"
          variant="outline"
        >
          Gerar Prompt de Implementação
        </Button>
      </div>

      {showPromptDialog && (
        <PromptDeliveryDialog
          epicId={epic.id}
          epicTitle={epic.title}
          onClose={() => setShowPromptDialog(false)}
        />
      )}
    </div>
  );
}
