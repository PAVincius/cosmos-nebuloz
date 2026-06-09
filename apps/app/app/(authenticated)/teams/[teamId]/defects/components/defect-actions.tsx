"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { CheckIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { deleteDefect, updateDefect } from "@/app/actions/defects";

type DefectActionsProps = {
  defectId: string;
  currentStatus: string;
};

const NEXT_STATUS: Record<string, string | undefined> = {
  OPEN: "IN_PROGRESS",
  IN_PROGRESS: "RESOLVED",
  RESOLVED: "CLOSED",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em Progresso",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado",
};

export function DefectActions({ defectId, currentStatus }: DefectActionsProps) {
  const [isPending, startTransition] = useTransition();
  const nextStatus = NEXT_STATUS[currentStatus];

  function handleStatusUpdate() {
    if (!nextStatus) {
      return;
    }
    startTransition(async () => {
      await updateDefect(defectId, {
        status: nextStatus as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
      });
    });
  }

  function handleDelete() {
    if (!confirm("Confirmar exclusão do defect?")) {
      return;
    }
    startTransition(async () => {
      await deleteDefect(defectId);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-8 w-8 p-0"
          disabled={isPending}
          size="sm"
          variant="ghost"
        >
          <MoreHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {nextStatus && (
          <DropdownMenuItem onClick={handleStatusUpdate}>
            <CheckIcon className="mr-2 h-4 w-4" />
            Mover para {STATUS_LABELS[nextStatus]}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleDelete}
        >
          <Trash2Icon className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
