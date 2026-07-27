"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useState } from "react";
import { ModalShell } from "../../components/modal-shell";

export type TransitionDialogState =
  | { kind: "invest-confirm"; epicTitle: string; investScore: number }
  | { kind: "wip-reason"; epicTitle: string; columnLabel: string };

type EpicTransitionDialogProps = {
  state: TransitionDialogState | null;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
  submitting: boolean;
};

/** Confirmação de gate INVEST (50-69) ou motivo de override de WIP — reusa ModalShell. */
export function EpicTransitionDialog({
  state,
  onCancel,
  onConfirm,
  submitting,
}: EpicTransitionDialogProps) {
  const [reason, setReason] = useState("");

  if (!state) {
    return null;
  }

  const isWipReason = state.kind === "wip-reason";
  const canSubmit = !isWipReason || reason.trim().length >= 5;

  return (
    <ModalShell
      eyebrow={isWipReason ? "Limite WIP atingido" : "Gate INVEST"}
      footer={
        <>
          <Button
            disabled={submitting}
            onClick={onCancel}
            type="button"
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            disabled={submitting || !canSubmit}
            onClick={() => onConfirm(isWipReason ? reason.trim() : undefined)}
            type="button"
          >
            Confirmar
          </Button>
        </>
      }
      loading={submitting}
      onClose={onCancel}
      open
      size="md"
      title={isWipReason ? "Justificar override de WIP" : "Confirmar transição"}
    >
      {state.kind === "invest-confirm" ? (
        <p className="text-[13px] text-ink-muted leading-relaxed">
          O épico <strong className="text-ink">{state.epicTitle}</strong> tem
          score INVEST de{" "}
          <strong className="text-ink">{state.investScore}</strong> (em
          refinamento, 50–69). Mover para Implementing mesmo assim?
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-muted leading-relaxed">
            A coluna <strong className="text-ink">{state.columnLabel}</strong>{" "}
            atingiu o limite de WIP. Descreva a justificativa para o override
            (mín. 5 caracteres):
          </p>
          <Textarea
            aria-label="Justificativa do override de WIP"
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: prioridade aprovada em comitê de portfólio…"
            rows={3}
            value={reason}
          />
        </div>
      )}
    </ModalShell>
  );
}
