"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Progress } from "@repo/design-system/components/ui/progress";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useState, useTransition } from "react";
import {
  createKeyResultCheckIn,
  type OKRWithContext,
} from "@/app/actions/okrs";

type KeyResultSnapshotItem = {
  id: string;
  keyResultId: string;
  value: number;
  note: string | null;
  recordedAt: Date;
};

type KeyResultWithProgress = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  metric?: string | null;
  baseline?: number | null;
  measurementType?: string | null;
  dataSource?: string | null;
  dueDate?: Date | null;
  progress: number;
  snapshots?: KeyResultSnapshotItem[];
};

type OKRCheckInModalProps = {
  open: boolean;
  onClose: () => void;
  okr: OKRWithContext;
  onCheckInSuccess: (okrId: string, krId: string, newValue: number) => void;
};

export function OKRCheckInModal({
  open,
  onClose,
  okr,
  onCheckInSuccess,
}: OKRCheckInModalProps) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(okr.keyResults.map((kr) => [kr.id, String(kr.current)]))
  );

  function handleValueChange(krId: string, value: string) {
    setValues((prev) => ({ ...prev, [krId]: value }));
  }

  function computeProgress(current: number, target: number): number {
    if (target === 0) {
      return 0;
    }
    return Math.min(100, Math.round((current / target) * 100));
  }

  function hasChanges(): boolean {
    return okr.keyResults.some((kr) => {
      const newVal = Number.parseFloat(values[kr.id] ?? "");
      return !isNaN(newVal) && newVal !== kr.current;
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const promises = okr.keyResults
        .filter((kr) => {
          const newVal = Number.parseFloat(values[kr.id] ?? "");
          return !isNaN(newVal) && newVal !== kr.current;
        })
        .map(async (kr) => {
          const newVal = Number.parseFloat(values[kr.id] ?? "");
          await createKeyResultCheckIn({
            keyResultId: kr.id,
            value: newVal,
            note: note.trim() || null,
          });
          onCheckInSuccess(okr.id, kr.id, newVal);
        });

      await Promise.all(promises);
      setNote("");
      onClose();
    });
  }

  return (
    <Dialog
      onOpenChange={(o) => {
        if (!o) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle className="font-semibold text-base leading-tight">
            Registrar Check-in — {okr.title}
          </DialogTitle>
          <p className="mt-1 text-muted-foreground text-sm">
            Atualize o progresso de cada Key Result
          </p>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-2 pr-1">
          {okr.keyResults.map((kr) => {
            const currentVal = Number.parseFloat(
              values[kr.id] ?? String(kr.current)
            );
            const displayProgress = isNaN(currentVal)
              ? kr.progress
              : computeProgress(currentVal, kr.target);

            return (
              <div
                className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3"
                key={kr.id}
              >
                <p className="font-medium text-sm leading-snug">{kr.title}</p>
                <Progress className="h-1.5" value={displayProgress} />
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      className="h-8 text-sm"
                      disabled={isPending}
                      min={0}
                      onChange={(e) => handleValueChange(kr.id, e.target.value)}
                      step="any"
                      type="number"
                      value={values[kr.id] ?? ""}
                    />
                  </div>
                  <p className="whitespace-nowrap text-muted-foreground text-xs">
                    <span className="font-medium text-foreground">
                      {kr.current}
                    </span>
                    {" → "}
                    <span className="font-medium text-foreground">
                      {kr.target}
                    </span>{" "}
                    <span>{kr.unit}</span>
                  </p>
                  <span className="w-10 shrink-0 text-right font-semibold text-xs tabular-nums">
                    {displayProgress}%
                  </span>
                </div>
              </div>
            );
          })}

          <div className="space-y-1.5">
            <label className="font-medium text-foreground text-sm">
              Nota{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </label>
            <Textarea
              className="resize-none text-sm"
              disabled={isPending}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Descreva o contexto desta atualização…"
              rows={3}
              value={note}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button disabled={isPending} onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button disabled={isPending || !hasChanges()} onClick={handleSubmit}>
            {isPending ? "Salvando…" : "Registrar Check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
