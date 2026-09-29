"use client";

// Adicionar pessoa ao Signal — P1-c da QA. Só quem administra papéis vê o card:
// a lista vem de uma action que exige `signal.member.write`, e a recusa esconde
// o card em vez de mostrar botão que o servidor negaria.

import { Button, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  type AddableMember,
  addSignalMember,
  listAddableMembers,
} from "@/app/(signal)/actions/settings";
import { Field, Select, useSignalData } from "./base";

type Role = "VIEWER" | "OWNER" | "ANALYST" | "ADMIN";

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "VIEWER", label: "Leitor" },
  { value: "OWNER", label: "Dono de iniciativa" },
  { value: "ANALYST", label: "Analista" },
  { value: "ADMIN", label: "Administrador" },
];

export function AddMemberCard({ onAdded }: { onAdded: () => void }) {
  const fetcher = useCallback(() => listAddableMembers(), []);
  const { data, error, reload } = useSignalData<AddableMember[]>(fetcher);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("VIEWER");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (error || !data) {
    return null;
  }

  const add = async () => {
    setBusy(true);
    setFailure(null);
    const res = await addSignalMember({ userId, role });
    setBusy(false);
    if (res.ok) {
      setUserId("");
      reload();
      onAdded();
      return;
    }
    setFailure(res.error);
  };

  return (
    <SectionCard
      subtitle="Só entra no Signal quem já é da organização. Sem papel, a pessoa vê “Signal indisponível” mesmo com o módulo contratado."
      title="Adicionar pessoa"
    >
      {data.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-faint)" }}>
          Todas as pessoas da organização já têm papel no Signal.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "end",
            flexWrap: "wrap",
          }}
        >
          <Field label="Pessoa">
            <Select
              ariaLabel="Pessoa da organização"
              onChange={setUserId}
              options={[
                { value: "", label: "Escolha a pessoa" },
                ...data.map((p) => ({
                  value: p.userId,
                  label: `${p.name} · ${p.email}`,
                })),
              ]}
              value={userId}
            />
          </Field>
          <Field label="Papel">
            <Select
              ariaLabel="Papel no Signal"
              onChange={(v) => setRole(v as Role)}
              options={ROLE_OPTIONS}
              value={role}
            />
          </Field>
          <Button disabled={busy || userId === ""} onClick={add}>
            {busy ? "Adicionando…" : "Adicionar ao Signal"}
          </Button>
        </div>
      )}
      {failure ? (
        <p
          role="alert"
          style={{ margin: "10px 0 0", fontSize: 12, color: "var(--red-text)" }}
        >
          {failure}
        </p>
      ) : null}
    </SectionCard>
  );
}
