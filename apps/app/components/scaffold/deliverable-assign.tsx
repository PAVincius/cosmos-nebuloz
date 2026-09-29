"use client";

// Responsável e aprovador do entregável (Norte, SC-PO-04). Só entra quem tem
// papel no Scaffold e pode trabalhar (responsável) ou revisar (aprovador), pela
// matriz, e ninguém é as duas coisas no mesmo entregável: "ninguém aprova o que é
// seu". O servidor confere tudo de novo (`assignDeliverable`).

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import {
  type Assignee,
  assignDeliverable,
} from "@/app/(scaffold)/actions/deliverables";
import { Field, ModalShell, Select } from "./base";

const KEEP = "";

export function DeliverableAssign({
  deliverableId,
  code,
  ownerId,
  approverId,
  assignees,
  onChanged,
  onClose,
}: {
  deliverableId: string;
  code: string;
  ownerId: string | null;
  approverId: string | null;
  /** Nulo = não deu para carregar as pessoas. */
  assignees: Assignee[] | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  const owners = (assignees ?? []).filter((a) => a.canOwn);
  const reviewers = (assignees ?? []).filter((a) => a.canReview);

  const initial = (id: string | null, pool: Assignee[]) =>
    id && pool.some((a) => a.userId === id) ? id : KEEP;
  const [owner, setOwner] = useState(initial(ownerId, owners));
  const [approver, setApprover] = useState(initial(approverId, reviewers));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // O que valerá depois de salvar, para a regra "responsável ≠ aprovador".
  const finalOwner = owner || ownerId;
  const finalApprover = approver || approverId;
  const clash = Boolean(finalOwner && finalOwner === finalApprover);
  const changed =
    (owner !== KEEP && owner !== ownerId) ||
    (approver !== KEEP && approver !== approverId);

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await assignDeliverable({
      deliverableId,
      ...(owner !== KEEP && owner !== ownerId ? { ownerId: owner } : {}),
      ...(approver !== KEEP && approver !== approverId
        ? { approverId: approver }
        : {}),
    });
    setBusy(false);
    if (res.ok) {
      onChanged();
      onClose();
    } else {
      // Mantém a escolha: a pessoa ajusta, não refaz.
      setError(res.error);
    }
  };

  const options = (pool: Assignee[], other: string | null) => [
    { value: KEEP, label: "Manter atual" },
    ...pool.map((a) => ({
      value: a.userId,
      label: a.name,
      // O outro papel já é dessa pessoa: escolher os dois é o que a regra barra.
      disabled: a.userId === other,
    })),
  ];

  return (
    <ModalShell
      actions={
        <>
          <Button disabled={busy} onClick={onClose} variant="secondary">
            Voltar
          </Button>
          <Button
            disabled={busy || assignees === null || !changed || clash}
            icon="check"
            onClick={save}
          >
            Salvar
          </Button>
        </>
      }
      icon="users"
      onClose={onClose}
      subtitle="Quem elabora e quem aprova. Só quem tem papel no Scaffold, e nunca a mesma pessoa nos dois."
      title={`Responsável e aprovador — ${code}`}
      tone="accent"
      width={520}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {assignees === null ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-muted)" }}>
            Não foi possível carregar as pessoas com papel no Scaffold. Feche e
            tente de novo.
          </p>
        ) : null}
        <Field
          hint="Precisa de um papel que trabalhe no entregável."
          htmlFor="da-owner"
          label="Responsável"
        >
          <Select
            id="da-owner"
            onChange={setOwner}
            options={options(owners, finalApprover)}
            value={owner}
          />
        </Field>
        <Field
          hint="Precisa de um papel que revise, e não pode ser o responsável."
          htmlFor="da-approver"
          label="Aprovador"
        >
          <Select
            id="da-approver"
            onChange={setApprover}
            options={options(reviewers, finalOwner)}
            value={approver}
          />
        </Field>
        {error && (
          <div
            role="alert"
            style={{
              padding: "8px 12px",
              borderRadius: "var(--r-sm)",
              background: "var(--red-soft)",
              color: "var(--red-text)",
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
