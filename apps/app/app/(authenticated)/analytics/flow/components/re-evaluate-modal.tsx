"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { reEvaluateSnapshot } from "@/app/actions/flow-intelligence/re-evaluate-snapshot";

type MetricComparison = {
  label: string;
  old: string;
  current: string;
  worse: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  snapshotId: string;
  comparisons?: MetricComparison[];
};

export function ReEvaluateModal({
  open,
  onClose,
  snapshotId,
  comparisons = [],
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await reEvaluateSnapshot(snapshotId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog onOpenChange={(v) => !v && onClose()} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Re-avaliar Snapshot de Flow</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Um novo snapshot será criado com os dados atuais. O snapshot
            anterior será arquivado.
          </p>

          {comparisons.length > 0 && (
            <div className="rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium">Métrica</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Anterior
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Atual</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((c) => (
                    <tr className="border-b last:border-0" key={c.label}>
                      <td className="px-3 py-2 text-muted-foreground">
                        {c.label}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.old}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium tabular-nums ${
                          c.worse
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {c.current}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!!error && (
            <p className="text-red-600 text-xs dark:text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button disabled={loading} onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button disabled={loading} onClick={handleConfirm}>
            {loading ? "Criando novo snapshot..." : "Confirmar re-avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
