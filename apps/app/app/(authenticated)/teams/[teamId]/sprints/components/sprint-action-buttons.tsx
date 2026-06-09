"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon, PlayIcon } from "lucide-react";
import { useTransition } from "react";
import { activateSprint, completeSprint } from "@/app/actions/sprints";

type SprintActionButtonsProps = {
  sprintId: string;
  status: string;
  teamId: string;
};

export function SprintActionButtons({
  sprintId,
  status,
  teamId,
}: SprintActionButtonsProps) {
  const [isPending, startTransition] = useTransition();

  function handleActivate() {
    startTransition(async () => {
      const result = await activateSprint(sprintId);
      if (!result.ok) {
        alert(result.error);
      }
    });
  }

  function handleComplete() {
    if (!confirm("Concluir este sprint?")) {
      return;
    }
    startTransition(async () => {
      const result = await completeSprint(sprintId);
      if (!result.ok) {
        alert(result.error);
      }
    });
  }

  if (status === "PLANNING") {
    return (
      <Button
        className="h-7 px-2 text-xs"
        disabled={isPending}
        onClick={handleActivate}
        size="sm"
        variant="outline"
      >
        <PlayIcon className="mr-1 h-3 w-3" />
        Ativar
      </Button>
    );
  }

  if (status === "ACTIVE") {
    return (
      <Button
        className="h-7 px-2 text-xs"
        disabled={isPending}
        onClick={handleComplete}
        size="sm"
        variant="outline"
      >
        <CheckIcon className="mr-1 h-3 w-3" />
        Concluir
      </Button>
    );
  }

  return null;
}
