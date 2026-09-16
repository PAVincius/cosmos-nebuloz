"use client";

// modals/mitigation.tsx — MitigationModal. Movido de modals.tsx no split em
// um arquivo por modal; anatomia preservada 1:1.

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import { RISK_CATEGORY_LABEL } from "@/lib/charter/rules";
import {
  Callout,
  FooterHint,
  FormField,
  Kbd,
  Select,
  TextArea,
  TextInput,
} from "../form-kit";
import { ModalShell } from "../modal";
import { GatedAction } from "./_shared";

// ── 3. MitigationModal ────────────────────────────────────────────────────────

export function MitigationModal({
  cases,
  defaultCase,
  onClose,
  onSubmit,
  pending,
}: {
  cases: { code: string; title: string }[];
  defaultCase?: string;
  onClose: () => void;
  onSubmit: (input: {
    useCaseCode: string;
    category: keyof typeof RISK_CATEGORY_LABEL;
    action: string;
    ownerName: string;
    dueDate: string;
  }) => void;
  pending: boolean;
}) {
  const [useCaseCode, setUseCaseCode] = useState(
    defaultCase ?? cases[0]?.code ?? ""
  );
  const [category, setCategory] =
    useState<keyof typeof RISK_CATEGORY_LABEL>("PRIVACY");
  const [action, setAction] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [due, setDue] = useState("");
  const ready = action.trim().length > 8 && due !== "";

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> cancelar
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedAction
              ready={ready && !pending}
              reason="Descreva a ação e informe o prazo"
            >
              <Button
                icon="check"
                onClick={() =>
                  onSubmit({
                    useCaseCode,
                    category,
                    action: action.trim(),
                    ownerName: ownerName.trim(),
                    dueDate: due,
                  })
                }
                size="md"
              >
                {pending ? "Registrando…" : "Registrar"}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="shield"
      onClose={onClose}
      subtitle="Risco sem dono e prazo é risco aceito por omissão"
      title="Nova mitigação"
      tone="amber"
      width={640}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 15,
          padding: 22,
        }}
      >
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <FormField label="Caso de uso" required>
            <Select
              onChange={(e) => setUseCaseCode(e.target.value)}
              options={cases.map((c) => ({
                value: c.code,
                label: `${c.code} · ${c.title}`,
              }))}
              value={useCaseCode}
            />
          </FormField>
          <FormField label="Categoria de risco" required>
            <Select
              onChange={(e) =>
                setCategory(e.target.value as keyof typeof RISK_CATEGORY_LABEL)
              }
              options={Object.entries(RISK_CATEGORY_LABEL).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
              value={category}
            />
          </FormField>
        </div>
        <FormField
          hint="Verbo no infinitivo e resultado verificável"
          label="Ação de mitigação"
          required
        >
          <TextArea
            onChange={(e) => setAction(e.target.value)}
            placeholder="ex: Pseudonimizar identificadores antes do envio ao modelo"
            rows={2}
            value={action}
          />
        </FormField>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <FormField label="Dono" required>
            <TextInput
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Quem responde pela ação"
              value={ownerName}
            />
          </FormField>
          <FormField label="Prazo" required>
            <TextInput
              onChange={(e) => setDue(e.target.value)}
              type="date"
              value={due}
            />
          </FormField>
        </div>
        <Callout icon="clock" tone="amber">
          Prazo vencido sem conclusão gera alerta para o dono e para Compliance,
          e aparece como pendência no pacote de evidência.
        </Callout>
      </div>
    </ModalShell>
  );
}
