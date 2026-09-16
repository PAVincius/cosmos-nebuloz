"use client";

// settings-confirm-role.tsx — confirmação de troca de papel de governança
// (extraído de settings.tsx para não estourar o teto de 800 linhas do
// size:guard). Um clique errado no Select de papel revoga acesso de alguém
// — inclusive do próprio ator, se for o único Compliance trocando a si
// mesmo — sem isto o Select chamava a action direto no onChange.

import type { CharterRole } from "@repo/database";
import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import {
  type PermissionMatrixRow,
  setMemberCharterRole,
} from "@/app/(charter)/actions/settings";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { ModalShell, useModal } from "../modal";

/** Deriva a consequência da troca a partir da matriz de permissões que a
 *  própria tela já busca (data.permissions) — não duplica CHARTER_MATRIX. */
function roleConsequence(
  permissions: PermissionMatrixRow[],
  oldRole: CharterRole | null,
  newRole: CharterRole
): string {
  const lost = oldRole
    ? permissions.filter(
        (p) => p.grants.includes(oldRole) && !p.grants.includes(newRole)
      )
    : [];
  const gained = permissions.filter(
    (p) =>
      !(oldRole && p.grants.includes(oldRole)) && p.grants.includes(newRole)
  );

  if (lost.length > 0) {
    return `Perde acesso a: ${lost.map((p) => p.label).join(", ")}.`;
  }
  if (gained.length > 0) {
    return `Ganha acesso a: ${gained.map((p) => p.label).join(", ")}.`;
  }
  return "Não muda o conjunto de permissões.";
}

export function RoleChangeModal({
  userId,
  memberName,
  oldRole,
  oldRoleLabel,
  newRole,
  newRoleLabel,
  isSelf,
  permissions,
  onChanged,
}: {
  userId: string;
  memberName: string;
  oldRole: CharterRole | null;
  oldRoleLabel: string;
  newRole: CharterRole;
  newRoleLabel: string;
  isSelf: boolean;
  permissions: PermissionMatrixRow[];
  onChanged: () => void;
}) {
  const { close } = useModal();
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    const res = await runWithToast(
      () => setMemberCharterRole({ userId, role: newRole }),
      { loading: "Trocando papel…", success: "Papel atualizado" }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onChanged();
    }
  };

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
          <Button onClick={close} size="md" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={saving} icon="check" onClick={confirm} size="md">
            {saving ? "Trocando…" : "Trocar papel"}
          </Button>
        </div>
      }
      icon="alert"
      onClose={close}
      subtitle={`${oldRoleLabel} → ${newRoleLabel}`}
      title={`Trocar papel de ${memberName}?`}
      tone="red"
      width={460}
    >
      <div
        style={{
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-muted)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {roleConsequence(permissions, oldRole, newRole)}
        </p>
        {isSelf && (
          <p
            style={{
              fontSize: 13,
              color: "var(--red-text)",
              margin: 0,
              fontWeight: 600,
              lineHeight: 1.6,
            }}
          >
            Você está alterando o seu próprio papel de governança.
          </p>
        )}
      </div>
    </ModalShell>
  );
}
