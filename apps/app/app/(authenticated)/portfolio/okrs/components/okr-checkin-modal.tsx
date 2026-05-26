"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Progress } from "@repo/design-system/components/ui/progress";
import { createKeyResultCheckIn, type OKRWithContext } from "@/app/actions/okrs";

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


interface OKRCheckInModalProps {
  open: boolean;
  onClose: () => void;
  okr: OKRWithContext;
  onCheckInSuccess: (okrId: string, krId: string, newValue: number) => void;
}

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
    if (target === 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  }

  function hasChanges(): boolean {
    return okr.keyResults.some((kr) => {
      const newVal = parseFloat(values[kr.id] ?? "");
      return !isNaN(newVal) && newVal !== kr.current;
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const promises = okr.keyResults
        .filter((kr) => {
          const newVal = parseFloat(values[kr.id] ?? "");
          return !isNaN(newVal) && newVal !== kr.current;
        })
        .map(async (kr) => {
          const newVal = parseFloat(values[kr.id] ?? "");
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-tight">
            Registrar Check-in — {okr.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Atualize o progresso de cada Key Result
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
          {okr.keyResults.map((kr) => {
            const currentVal = parseFloat(values[kr.id] ?? String(kr.current));
            const displayProgress = isNaN(currentVal)
              ? kr.progress
              : computeProgress(currentVal, kr.target);

            return (
              <div key={kr.id} className="space-y-2 rounded-lg border border-border/60 p-3 bg-muted/30">
                <p className="text-sm font-medium leading-snug">{kr.title}</p>
                <Progress
                  value={displayProgress}
                  className="h-1.5"
                />
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={values[kr.id] ?? ""}
                      onChange={(e) => handleValueChange(kr.id, e.target.value)}
                      disabled={isPending}
                      className="h-8 text-sm"
                      min={0}
                      step="any"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    <span className="font-medium text-foreground">{kr.current}</span>
                    {" → "}
                    <span className="font-medium text-foreground">{kr.target}</span>
                    {" "}
                    <span>{kr.unit}</span>
                  </p>
                  <span className="text-xs font-semibold tabular-nums text-right w-10 shrink-0">
                    {displayProgress}%
                  </span>
                </div>
              </div>
            );
          })}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Nota <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Descreva o contexto desta atualização…"
              disabled={isPending}
              className="resize-none text-sm"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !hasChanges()}
          >
            {isPending ? "Salvando…" : "Registrar Check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
