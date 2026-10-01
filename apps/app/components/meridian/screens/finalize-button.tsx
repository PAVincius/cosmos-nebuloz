"use client";

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import type { AssessmentDetail } from "@/app/(meridian)/actions/assessments";
import { finalizeAssessment } from "@/app/(meridian)/actions/finalize";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { ModalShell, useModal } from "../base";

// Finalizar assessment (decisão do Norte, 30/09): REVIEW → FINALISED. Ação sem
// volta, então pede confirmação. Sem poder finalizar, o botão fica `disabled`
// de verdade e o motivo está escrito ao lado (DESIGN.md do Meridian).

/** Por que ainda não dá para finalizar; `null` quando dá. */
function blockedReason(a: AssessmentDetail): string | null {
  if (a.status !== "REVIEW") {
    return "Feche a coleta e rode o scoring para poder finalizar.";
  }
  const scores = a.scores ?? [];
  if (AXIS_IDS.some((axis) => !scores.some((s) => s.axis === axis))) {
    return "Há eixo sem score — rode o scoring para finalizar.";
  }
  const contested = AXIS_IDS.filter((axis) =>
    scores.some((s) => s.axis === axis && s.status === "CONTESTED")
  ).map((axis) => AXES[axis].label);
  if (contested.length > 0) {
    return `Decida o eixo contestado (${contested.join(", ")}) na fila de revisão para finalizar.`;
  }
  return null;
}

function FinalizeConfirm({
  assessmentId,
  onClose,
  onDone,
}: {
  assessmentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const res = await runWithToast(() => finalizeAssessment({ assessmentId }), {
      loading: "Finalizando…",
      success: "Assessment finalizado — gaps ranqueados liberados.",
    });
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
          <Button disabled={busy} icon="check" onClick={confirm}>
            Confirmar finalização
          </Button>
        </>
      }
      icon="check"
      onClose={onClose}
      title="Finalizar assessment"
      width={520}
    >
      <p
        style={{
          margin: 0,
          padding: 22,
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--ink-muted)",
        }}
      >
        Finalizar libera o diagnóstico como final e os gaps ranqueados para o
        Scaffold. O assessment não volta para Em revisão.
      </p>
    </ModalShell>
  );
}

export function FinalizeAssessmentButton({
  a,
  onChanged,
}: {
  a: AssessmentDetail;
  onChanged: () => void;
}) {
  const modal = useModal();
  if (a.status === "FINALISED") {
    return null;
  }
  // Sem `assessment.manage` (REVIEWER, VIEWER) o botão fica `disabled` de
  // verdade, com o motivo do papel escrito: a tela não promete o que o
  // servidor não entrega (achado do Crivo no #334) e não esconde o controle
  // (DESIGN.md do Meridian). O servidor segue recusando por conta própria. O
  // motivo do papel vem antes do de estado: quem não pode finalizar não precisa
  // saber o que falta.
  const reason = a.permissions.manage
    ? blockedReason(a)
    : "Só a consultora finaliza o assessment.";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <Button
        disabled={reason !== null}
        icon="check"
        onClick={() =>
          modal.open(
            <FinalizeConfirm
              assessmentId={a.id}
              onClose={modal.close}
              onDone={onChanged}
            />
          )
        }
        size="sm"
      >
        Finalizar assessment
      </Button>
      {reason && (
        <span
          style={{
            fontSize: 12,
            color: "var(--ink-muted)",
            fontWeight: 500,
          }}
        >
          {reason}
        </span>
      )}
    </div>
  );
}
