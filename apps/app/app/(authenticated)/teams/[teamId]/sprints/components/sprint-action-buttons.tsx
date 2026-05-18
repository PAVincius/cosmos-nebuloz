"use client";

import { useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { PlayIcon, CheckIcon } from "lucide-react";
import { activateSprint, completeSprint } from "@/app/actions/sprints";

interface SprintActionButtonsProps {
  sprintId: string;
  status: string;
  teamId: string;
}

export function SprintActionButtons({ sprintId, status, teamId }: SprintActionButtonsProps) {
  const [isPending, startTransition] = useTransition();

  function handleActivate() {
    startTransition(async () => {
      const result = await activateSprint(sprintId);
      if (!result.ok) alert(result.error);
    });
  }

  function handleComplete() {
    if (!confirm("Concluir este sprint?")) return;
    startTransition(async () => {
      const result = await completeSprint(sprintId);
      if (!result.ok) alert(result.error);
    });
  }

  if (status === "PLANNING") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleActivate}
        className="h-7 px-2 text-xs"
      >
        <PlayIcon className="h-3 w-3 mr-1" />
        Ativar
      </Button>
    );
  }

  if (status === "ACTIVE") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleComplete}
        className="h-7 px-2 text-xs"
      >
        <CheckIcon className="h-3 w-3 mr-1" />
        Concluir
      </Button>
    );
  }

  return null;
}
