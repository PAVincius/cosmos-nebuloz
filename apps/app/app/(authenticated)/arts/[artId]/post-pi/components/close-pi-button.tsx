"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import { CheckCircle2Icon } from "lucide-react";
import { closePIPlan } from "../actions";

interface ClosePIButtonProps {
  piPlanId: string;
  artId: string;
  piName: string;
}

export function ClosePIButton({ piPlanId, artId, piName }: ClosePIButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setError(null);
    startTransition(async () => {
      try {
        await closePIPlan({ piPlanId, artId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao fechar PI.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={isPending}>
            <CheckCircle2Icon className="mr-2 h-4 w-4" />
            {isPending ? "Fechando…" : "Fechar PI"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar PI "{piName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marcará o PI como encerrado. Os dados serão preservados para análise
              histórica, mas não será possível reabrir automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose}>Confirmar Fechamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
