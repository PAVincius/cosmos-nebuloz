"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { NewAssessmentModal } from "./new-assessment-modal";

type ScopeOption = {
  id: string;
  label: string;
  type: string;
};

type MeasureGrowHeaderActionsProps = {
  scopes: ScopeOption[];
};

export function MeasureGrowHeaderActions({
  scopes,
}: MeasureGrowHeaderActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        <PlusIcon className="h-3.5 w-3.5" />
        Nova avaliação
      </Button>
      <NewAssessmentModal onOpenChange={setOpen} open={open} scopes={scopes} />
    </>
  );
}
