"use client";

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
import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { closePIPlan } from "../actions";

type ClosePIButtonProps = {
  piPlanId: string;
  artId: string;
  piName: string;
};

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
          <Button disabled={isPending} size="sm" variant="destructive">
            <CheckCircle2Icon className="mr-2 h-4 w-4" />
            {isPending ? "Fechando…" : "Fechar PI"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar PI "{piName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marcará o PI como encerrado. Os dados serão preservados
              para análise histórica, mas não será possível reabrir
              automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose}>
              Confirmar Fechamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
