"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useState, useTransition } from "react";
import {
  createKeyResultCheckIn,
  type OKRWithContext,
} from "@/app/actions/okrs";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import { toneForProgress } from "./okr-constants";

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
      return !Number.isNaN(newVal) && newVal !== kr.current;
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const promises = okr.keyResults
        .filter((kr) => {
          const newVal = Number.parseFloat(values[kr.id] ?? "");
          return !Number.isNaN(newVal) && newVal !== kr.current;
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
    <ModalShell
      eyebrow="Atualize os valores atuais e registre uma nota de contexto"
      footer={
        <>
          <Button disabled={isPending} onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button
            disabled={isPending || !hasChanges()}
            onClick={handleSubmit}
          >
            Registrar Check-in
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={`Check-in · ${okr.title}`}
    >
      <div className="space-y-4">
        {okr.keyResults.map((kr) => {
          const current = Number.parseFloat(values[kr.id] ?? String(kr.current));
          const progress = Number.isNaN(current)
            ? kr.progress
            : computeProgress(current, kr.target);
          const tone = toneForProgress(progress);
          return (
            <div className="space-y-1.5" key={kr.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[13px] text-[var(--ink-muted)]">
                  {kr.title}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Input
                    className="h-7 w-24 text-xs"
                    disabled={isPending}
                    onChange={(e) => handleValueChange(kr.id, e.target.value)}
                    step="any"
                    type="number"
                    value={values[kr.id] ?? ""}
                  />
                  <span className="font-mono text-[var(--ink-muted)] text-xs">
                    {kr.unit} / {kr.target}
                    {kr.unit}
                  </span>
                </div>
              </div>
              <div
                className="h-[7px] overflow-hidden rounded-full"
                style={{ background: "var(--surface-3)" }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.round(progress)}%`,
                    background: `var(--${tone})`,
                  }}
                />
              </div>
            </div>
          );
        })}

        <div className="space-y-1.5">
          <Label htmlFor="checkin-note">Nota (opcional)</Label>
          <Textarea
            disabled={isPending}
            id="checkin-note"
            onChange={(e) => setNote(e.target.value)}
            placeholder="O que mudou desde o último check-in?"
            rows={3}
            value={note}
          />
        </div>
      </div>
    </ModalShell>
  );
}
