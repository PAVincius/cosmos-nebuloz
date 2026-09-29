"use client";

// Entregável fora do template (SC-PO-05, Norte). Quem adiciona escolhe se ele é
// obrigatório para o gate da fase: nasce opcional, e marcar é decisão explícita,
// porque obrigatório novo trava o gate de quem já estava pronto.

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import { addDeliverable } from "@/app/(scaffold)/actions/deliverables";
import {
  type DeliverableKindCode,
  type DeliverableProducerCode,
  KIND_LABEL,
  KINDS,
  PRODUCER_LABEL,
  PRODUCERS,
} from "@/lib/scaffold/deliverable-labels";
import { Field, Input, ModalShell, Select, Textarea } from "./base";

const KIND_OPTIONS = KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }));
const PRODUCER_OPTIONS = PRODUCERS.map((p) => ({
  value: p,
  label: PRODUCER_LABEL[p],
}));

export function AddDeliverableModal({
  trackId,
  phase,
  phaseLabel,
  onCreated,
  onClose,
}: {
  trackId: string;
  phase: "ASSESS" | "PILOT" | "SCALE" | "EMBED";
  phaseLabel: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<DeliverableKindCode>("DOCUMENT");
  const [producer, setProducer] = useState<DeliverableProducerCode>("OWNER");
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await addDeliverable({
      trackId,
      phase,
      title: title.trim(),
      description: description.trim(),
      kind,
      producer,
      required,
    });
    setBusy(false);
    if (res.ok) {
      onCreated();
    } else {
      // Mantém o que foi digitado: a pessoa corrige, não redigita.
      setError(res.error);
    }
  };

  return (
    <ModalShell
      actions={
        <>
          <Button disabled={busy} onClick={onClose} variant="secondary">
            Voltar
          </Button>
          <Button
            disabled={busy || title.trim().length === 0}
            icon="plus"
            onClick={submit}
          >
            Adicionar
          </Button>
        </>
      }
      icon="plus"
      onClose={onClose}
      subtitle="Fora do template desta trilha. Fica só nela, não altera o método."
      title={`Adicionar entregável — ${phaseLabel}`}
      tone="accent"
      width={560}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field htmlFor="ad-title" label="Título" required>
          <Input
            autoFocus
            disabled={busy}
            id="ad-title"
            onChange={(e) => setTitle(e.target.value)}
            value={title}
          />
        </Field>
        <Field htmlFor="ad-desc" label="Descrição">
          <Textarea
            disabled={busy}
            id="ad-desc"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
          />
        </Field>
        <Field htmlFor="ad-kind" label="Tipo">
          <Select
            id="ad-kind"
            onChange={setKind}
            options={KIND_OPTIONS}
            value={kind}
          />
        </Field>
        <Field htmlFor="ad-producer" label="Produzido por">
          <Select
            id="ad-producer"
            onChange={setProducer}
            options={PRODUCER_OPTIONS}
            value={producer}
          />
        </Field>
        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 12.5,
          }}
        >
          <input
            checked={required}
            disabled={busy}
            onChange={(e) => setRequired(e.target.checked)}
            type="checkbox"
          />
          Obrigatório para o gate: a fase só fecha com ele aprovado
        </label>
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
