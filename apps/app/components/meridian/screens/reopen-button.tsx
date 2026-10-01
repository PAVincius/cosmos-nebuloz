"use client";

import { Button } from "@repo/design-system/cosmos/kit";
import { useId, useState } from "react";
import type { AssessmentDetail } from "@/app/(meridian)/actions/assessments";
import { reopenAssessment } from "@/app/(meridian)/actions/reopen";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { Field, ModalShell, Textarea, useModal } from "../base";
import { RationaleHint } from "./rationale-hint";

// Reabrir assessment finalizado (D-29, FR-029e): FINALISED → REVIEW, nunca
// COLLECTING. Só aparece com a permissão `assessment.manage` e com o assessment
// finalizado; exige motivo de 20+ caracteres (a tela diz quantos faltam).

const REASON_MIN = 20;

function ReopenConfirm({
  assessmentId,
  onClose,
  onDone,
}: {
  assessmentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = reason.trim().length >= REASON_MIN;

  const confirm = async () => {
    setBusy(true);
    const res = await runWithToast(
      () => reopenAssessment({ assessmentId, reason }),
      {
        loading: "Reabrindo…",
        success: "Assessment reaberto — de volta a Em revisão.",
      }
    );
    setBusy(false);
    if (res.ok) {
      onDone();
      onClose();
    }
  };

  return (
    <ModalShell
      footer={
        <>
          <Button disabled={busy} onClick={onClose} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={!valid || busy} icon="refresh" onClick={confirm}>
            Confirmar reabertura
          </Button>
        </>
      }
      icon="refresh"
      onClose={onClose}
      subtitle="Volta a Em revisão, nunca a Coleta: as respostas continuam travadas."
      title="Reabrir assessment"
      tone="amber"
      width={560}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 22,
        }}
      >
        <Field
          hint="Fica na trilha de auditoria."
          htmlFor={reasonId}
          label={`Motivo (obrigatório, ≥ ${REASON_MIN} caracteres)`}
        >
          <Textarea
            id={reasonId}
            onChange={(e) => setReason(e.target.value)}
            placeholder="O que precisa ser corrigido e por quê?"
            rows={3}
            value={reason}
          />
          <RationaleHint length={reason.trim().length} min={REASON_MIN} />
        </Field>
      </div>
    </ModalShell>
  );
}

export function ReopenAssessmentButton({
  a,
  onChanged,
}: {
  a: AssessmentDetail;
  onChanged: () => void;
}) {
  const modal = useModal();
  if (a.status !== "FINALISED") {
    return null;
  }
  // Sem `assessment.manage` o botão fica `disabled`, com o motivo escrito (não
  // escondido: DESIGN.md do Meridian). O servidor segue recusando.
  const allowed = a.permissions.manage;
  const button = (
    <Button
      disabled={!allowed}
      icon="refresh"
      onClick={() =>
        modal.open(
          <ReopenConfirm
            assessmentId={a.id}
            onClose={modal.close}
            onDone={onChanged}
          />
        )
      }
      size="sm"
      variant="secondary"
    >
      Reabrir assessment
    </Button>
  );
  if (allowed) {
    return button;
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {button}
      <span
        style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}
      >
        Só a consultora reabre o assessment.
      </span>
    </div>
  );
}
