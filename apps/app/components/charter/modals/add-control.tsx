"use client";

// Adicionar controle ao caso — CH-DEV-04. De outro perfil (copia o texto do
// controle) ou próprio. Entra SEM evidência e passa a bloquear a decisão de
// aprovar: quem adiciona precisa saber disso antes de confirmar.

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import { addExtraControl } from "@/app/(charter)/actions/case-controls";
import type { CaseControlsView } from "@/app/(charter)/actions/controls-read";
import { RISK_CATEGORY_LABEL } from "@/lib/charter/rules";
import {
  Callout,
  FormField,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from "../form-kit";
import { ModalShell, useModal } from "../modal";
import { FS } from "../type-scale";

type Source = "profile" | "own";
type Category = keyof typeof RISK_CATEGORY_LABEL;
type Role = "COMPLIANCE" | "LEGAL" | "SECURITY";
type Cadence =
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "PER_CYCLE";

const ROLES: { value: Role; label: string }[] = [
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "LEGAL", label: "Jurídico" },
  { value: "SECURITY", label: "Segurança" },
];
const CADENCES: { value: Cadence; label: string }[] = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
  { value: "PER_CYCLE", label: "A cada ciclo" },
];
const CATEGORIES = (Object.keys(RISK_CATEGORY_LABEL) as Category[]).map(
  (c) => ({
    value: c,
    label: RISK_CATEGORY_LABEL[c],
  })
);

type Draft = {
  name: string;
  category: Category;
  evidence: string;
  acceptanceCriteria: string;
  role: Role;
  cadence: Cadence;
};

const EMPTY: Draft = {
  name: "",
  category: "PRIVACY",
  evidence: "",
  acceptanceCriteria: "",
  role: "COMPLIANCE",
  cadence: "ANNUAL",
};

export function AddControlModal({
  caseCode,
  addable,
  onChanged,
}: {
  caseCode: string;
  addable: CaseControlsView["addable"];
  onChanged: () => void;
}) {
  const { close } = useModal();
  const [source, setSource] = useState<Source>(
    addable.length > 0 ? "profile" : "own"
  );
  const [pick, setPick] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = addable.flatMap((p) =>
    p.controls.map((c) => ({
      value: `${p.profileName}|${c.code}`,
      label: `${c.code} · ${c.name} (${p.profileName})`,
      control: c,
    }))
  );

  const choose = (value: string) => {
    setPick(value);
    const c = options.find((o) => o.value === value)?.control;
    if (c) {
      setDraft({
        name: c.name,
        category: c.category as Category,
        evidence: c.evidence,
        acceptanceCriteria: c.acceptanceCriteria,
        role: (["COMPLIANCE", "LEGAL", "SECURITY"].includes(c.role)
          ? c.role
          : "COMPLIANCE") as Role,
        cadence: c.cadence as Cadence,
      });
    }
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const ready =
    draft.name.trim() !== "" &&
    draft.evidence.trim() !== "" &&
    (source === "own" || pick !== "");

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await addExtraControl({
      code: caseCode,
      ...draft,
      acceptanceCriteria: draft.acceptanceCriteria || undefined,
    });
    setBusy(false);
    if (res.ok) {
      close();
      onChanged();
      return;
    }
    setError(res.error);
  };

  return (
    <ModalShell
      actions={
        <>
          <Button onClick={close} variant="secondary">
            Cancelar
          </Button>
          <Button disabled={!ready || busy} onClick={submit}>
            {busy ? "Adicionando…" : "Adicionar ao caso"}
          </Button>
        </>
      }
      icon="plus"
      onClose={close}
      subtitle={`Caso ${caseCode}`}
      title="Adicionar controle"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Callout icon="alert" tone="amber">
          O controle entra <strong>sem evidência</strong> e passa a bloquear a
          decisão de aprovar o caso até ter evidência aceita ou dispensa com
          prazo.
        </Callout>

        <FormField label="Origem" variant="group">
          <Segmented
            onChange={(v) => setSource(v as Source)}
            options={[
              { value: "profile", label: "De outro perfil" },
              { value: "own", label: "Próprio" },
            ]}
            value={source}
          />
        </FormField>

        {source === "profile" ? (
          <FormField label="Controle do perfil" required>
            <Select
              onChange={(e) => choose(e.target.value)}
              options={[
                { value: "", label: "Escolha um controle" },
                ...options.map(({ value, label }) => ({ value, label })),
              ]}
              value={pick}
            />
          </FormField>
        ) : null}

        <FormField label="Nome" required>
          <TextInput
            onChange={(e) => set("name", e.target.value)}
            value={draft.name}
          />
        </FormField>
        <FormField
          hint="Arquivo, data de produção e quem produziu."
          label="Evidência que conta"
          required
        >
          <TextArea
            onChange={(e) => set("evidence", e.target.value)}
            value={draft.evidence}
          />
        </FormField>
        <FormField label="Critério de aceite">
          <TextArea
            onChange={(e) => set("acceptanceCriteria", e.target.value)}
            value={draft.acceptanceCriteria}
          />
        </FormField>
        <FormField label="Categoria de risco">
          <Select
            onChange={(e) => set("category", e.target.value as Category)}
            options={CATEGORIES}
            value={draft.category}
          />
        </FormField>
        <FormField label="Papel que revisa">
          <Select
            onChange={(e) => set("role", e.target.value as Role)}
            options={ROLES}
            value={draft.role}
          />
        </FormField>
        <FormField label="Cadência">
          <Select
            onChange={(e) => set("cadence", e.target.value as Cadence)}
            options={CADENCES}
            value={draft.cadence}
          />
        </FormField>

        {error ? (
          <div
            role="alert"
            style={{ color: "var(--red-text)", fontSize: FS.base }}
          >
            {error}
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
