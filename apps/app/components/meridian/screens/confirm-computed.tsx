"use client";

import { Button, type Tone } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import type {
  AssessmentDetail,
  AxisScoreView,
} from "@/app/(meridian)/actions/assessments";
import { confirmComputed } from "@/app/(meridian)/actions/confirm";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { RATIONALE_MIN } from "./rationale-hint";

// Confirmar o computado (D-29, FR-029a): decisão do revisor sobre um eixo
// CONTESTADO que mantém o score. Ato distinto do override; usa a mesma
// justificativa (20+). Sem `override.write` o botão fica `disabled` com o
// motivo escrito (DESIGN.md do Meridian), e o servidor segue recusando.

const STATUS_META: Record<string, [Tone, string]> = {
  COMPUTED: ["accent", "Computado"],
  CONTESTED: ["amber", "Contestado"],
  OVERRIDDEN: ["purple", "Override"],
};

/** Tom e rótulo do eixo no card. Confirmado pelo revisor aparece assim — nunca
 *  como "Computado" nem como "Override"; um override posterior vence. */
export function axisStatusMeta(
  s: Pick<AxisScoreView, "status" | "confirmed">
): [Tone, string] {
  if (s.confirmed && s.status !== "OVERRIDDEN") {
    return ["accent", "Confirmado pelo revisor"];
  }
  return STATUS_META[s.status] ?? ["accent", s.status];
}

export function ConfirmComputedButton({
  a,
  score,
  rationale,
  onClose,
  onDone,
}: {
  a: Pick<AssessmentDetail, "id" | "permissions">;
  score: Pick<AxisScoreView, "axis" | "status">;
  rationale: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (score.status !== "CONTESTED") {
    return null;
  }
  const allowed = a.permissions.override;
  const valid = rationale.trim().length >= RATIONALE_MIN;

  const confirm = async () => {
    setBusy(true);
    const res = await runWithToast(
      () =>
        confirmComputed({ assessmentId: a.id, axis: score.axis, rationale }),
      {
        loading: "Confirmando o computado…",
        success: "Computado confirmado — o eixo saiu da fila de revisão.",
      }
    );
    setBusy(false);
    if (res.ok) {
      onDone();
      onClose();
    }
  };

  return (
    <>
      {!allowed && (
        <span
          style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}
        >
          Só a consultora ou a revisora confirmam o computado.
        </span>
      )}
      <Button
        disabled={!(allowed && valid) || busy}
        icon="check"
        onClick={confirm}
        variant="secondary"
      >
        Confirmar o computado
      </Button>
    </>
  );
}
