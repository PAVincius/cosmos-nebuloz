"use client";

// modals/new-vendor.tsx — NewVendorModal (FR-8.4). Movido de modals.tsx no
// split em um arquivo por modal; anatomia preservada 1:1.

import { Button } from "@repo/design-system/cosmos/kit";
import { useMemo, useState } from "react";
import { DATA_CLASS_LABEL, VENDOR_CATEGORIES } from "@/lib/charter/rules";
import { Eyebrow, GatedButton } from "../base";
import {
  Callout,
  CheckRow,
  FooterHint,
  FormField,
  Kbd,
  Select,
  TextArea,
  TextInput,
} from "../form-kit";
import { ModalShell } from "../modal";
import type { DataClass } from "./_shared";

// ── 8. NewVendorModal (FR-8.4) ────────────────────────────────────────────────

// Região e retenção nascem "Não declarada" (valor vazio → undefined → null
// no banco). Um registro contratual não pode nascer com a melhor postura
// — "UE (Frankfurt)", retenção "Zero" — sem ninguém declarar.
const UNDECLARED = { value: "", label: "Não declarada" };
const REGIONS = [
  UNDECLARED,
  "UE (Frankfurt)",
  "UE (Dublin)",
  "UE (Amsterdã)",
  "BR (São Paulo)",
  "EUA (Virgínia)",
  "EUA (Oregon)",
];
const RETENTIONS = [
  UNDECLARED,
  "Zero",
  "14 dias",
  "30 dias",
  "90 dias",
  "Indefinida",
];

export function NewVendorModal({
  clauses,
  onClose,
  onSubmit,
  pending,
}: {
  clauses: { code: string; name: string; critical: boolean }[];
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    category: string;
    /** Vazio no formulário vira `undefined`, que a action grava como null. */
    region?: string;
    retention?: string;
    dpa: boolean;
    notes: string;
    clauseCodes: string[];
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(VENDOR_CATEGORIES[0]);
  const [region, setRegion] = useState("");
  const [retention, setRetention] = useState("");
  const [dpa, setDpa] = useState(false);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  // Motivo do gate como texto no rodapé; null quando está pronto.
  const gateReason = name.trim().length > 2 ? null : "Informe o nome";

  // Prévia da mesma escada que o servidor aplica (ADR-0003).
  const derived = useMemo<DataClass>(() => {
    if (!(dpa && selected.includes("CL-01"))) {
      return "PUBLIC";
    }
    if (!["CL-02", "CL-03", "CL-04"].every((c) => selected.includes(c))) {
      return "INTERNAL";
    }
    return selected.includes("CL-08") ? "RESTRICTED" : "CONFIDENTIAL";
  }, [dpa, selected]);

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> cancelar ·{" "}
            {gateReason ?? "Entra como Em revisão até a avaliação de Segurança"}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedButton
              allowed={gateReason === null && !pending}
              icon="check"
              onClick={() =>
                onSubmit({
                  name: name.trim(),
                  category,
                  region: region || undefined,
                  retention: retention || undefined,
                  dpa,
                  notes: notes.trim(),
                  clauseCodes: selected,
                })
              }
              reason={gateReason ?? ""}
            >
              {pending ? "Adicionando…" : "Adicionar"}
            </GatedButton>
          </div>
        </>
      }
      icon="plus"
      onClose={onClose}
      subtitle="A classe máxima de dado é derivada da postura declarada, não escolhida livremente"
      title="Adicionar fornecedor de IA"
      tone="blue"
      width={720}
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
          style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}
        >
          <FormField label="Nome do fornecedor" required>
            <TextInput
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Corpus Legal Review"
              value={name}
            />
          </FormField>
          <FormField label="Categoria" required>
            <Select
              onChange={(e) => setCategory(e.target.value)}
              options={[...VENDOR_CATEGORIES]}
              value={category}
            />
          </FormField>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <FormField
            hint="Região não declarada bloqueia qualquer dado não-público"
            label="Região de processamento"
            required
          >
            <Select
              onChange={(e) => setRegion(e.target.value)}
              options={REGIONS}
              value={region}
            />
          </FormField>
          <FormField label="Retenção declarada" required>
            <Select
              onChange={(e) => setRetention(e.target.value)}
              options={RETENTIONS}
              value={retention}
            />
          </FormField>
        </div>

        <div>
          <Eyebrow style={{ marginBottom: 8 }}>
            Cláusulas contratuais presentes
          </Eyebrow>
          <div
            className="scroll"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {clauses.map((c) => (
              <CheckRow
                checked={selected.includes(c.code)}
                hint={
                  c.critical ? "Crítica — define o teto de classe" : undefined
                }
                key={c.code}
                label={`${c.code} · ${c.name}`}
                onToggle={() =>
                  setSelected((prev) =>
                    prev.includes(c.code)
                      ? prev.filter((x) => x !== c.code)
                      : [...prev, c.code]
                  )
                }
                tone={c.critical ? "red" : "accent"}
              />
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
          <CheckRow
            checked={dpa}
            hint="Sem DPA, o fornecedor fica limitado a dado Público independentemente do resto"
            label="DPA assinado e arquivado"
            onToggle={() => setDpa((v) => !v)}
            tone="green"
          />
        </div>

        <Callout icon="scale" tone={derived === "PUBLIC" ? "amber" : "green"}>
          Classe máxima resultante: <strong>{DATA_CLASS_LABEL[derived]}</strong>
          . Derivada de DPA + cláusulas — não é campo digitado.
        </Callout>

        <FormField
          hint="Aparece na mensagem de bloqueio do intake quando o fornecedor é inelegível"
          label="Observações contratuais"
        >
          <TextArea
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ex: DPA pendente e 11 sub-processadores não mapeados."
            rows={2}
            value={notes}
          />
        </FormField>
      </div>
    </ModalShell>
  );
}
