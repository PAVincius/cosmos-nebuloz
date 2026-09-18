"use client";

// policy-confirm-reopen.tsx — confirmação de "Reabrir para revisão" (extraído
// de `policy.tsx`, na baseline do size:guard). Reabrir uma seção publicada
// rebaixava o status com um clique só, sem nomear a consequência antes.
// Modelo: `settings-confirm-role.tsx` (PR #209).

import { Button } from "@repo/design-system/cosmos/kit";
import { ModalShell } from "../modal";
import { FS } from "../type-scale";

export function ReopenSectionModal({
  sectionName,
  onClose,
  onConfirm,
}: {
  sectionName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell
      footer={
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <Button onClick={onClose} size="md" variant="secondary">
            Cancelar
          </Button>
          <Button icon="fileText" onClick={onConfirm} size="md">
            Reabrir seção
          </Button>
        </div>
      }
      icon="fileText"
      onClose={onClose}
      title="Reabrir esta seção para revisão?"
      tone="amber"
      width={460}
    >
      <div style={{ padding: 20 }}>
        <p
          style={{
            fontSize: FS.base,
            color: "var(--ink-muted)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          A seção <strong>{sectionName}</strong> volta para revisão e deixa de
          contar para a próxima publicação.
        </p>
      </div>
    </ModalShell>
  );
}
