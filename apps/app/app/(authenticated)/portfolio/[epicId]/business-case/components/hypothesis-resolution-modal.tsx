"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useState } from "react";

const OPTIONS = [
  { value: "VALIDATED", label: "Validada" },
  { value: "PARTIALLY_VALIDATED", label: "Parcialmente Validada" },
  { value: "INVALIDATED", label: "Invalidada" },
] as const;

type Resolution = (typeof OPTIONS)[number]["value"];

type Props = {
  epicId: string;
  onClose: () => void;
  onSaved: (resolution: Resolution) => void;
};

export function HypothesisResolutionModal({ onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<Resolution | null>(null);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolução da hipótese</DialogTitle>
          <DialogDescription>
            Antes de fechar, indique a resolução da hipótese deste épico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {OPTIONS.map((opt) => (
            <button
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                selected === opt.value
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border hover:bg-muted"
              }`}
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button
            disabled={selected === null}
            onClick={() => {
              if (selected) {
                onSaved(selected);
              }
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
