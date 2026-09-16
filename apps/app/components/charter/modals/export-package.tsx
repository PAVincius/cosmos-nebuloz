"use client";

// modals/export-package.tsx — ExportPackageModal (FR-11.5, FR-11.6). Movido
// de modals.tsx no split em um arquivo por modal; anatomia preservada 1:1.

import { Icon } from "@repo/design-system/cosmos/icons";
import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import { Eyebrow, GatedButton } from "../base";
import {
  Callout,
  CheckRow,
  FooterHint,
  FormField,
  Select,
  TextInput,
} from "../form-kit";
import { ModalShell } from "../modal";

// ── 11. ExportPackageModal (FR-11.5, FR-11.6) ─────────────────────────────────

const ARTIFACTS = [
  { id: "policy", label: "Política e seções" },
  { id: "decision", label: "Casos e decisões" },
  { id: "risk", label: "Risco e mitigações" },
  { id: "vendor", label: "Fornecedores e cláusulas" },
  { id: "onboarding", label: "Onboarding e aceites" },
  { id: "export", label: "Exportações anteriores" },
];

export function ExportPackageModal({
  onClose,
  onSubmit,
  pending,
  result,
}: {
  onClose: () => void;
  onSubmit: (input: {
    from: string;
    to: string;
    categories: string[];
    format: "csv" | "json";
  }) => void;
  pending: boolean;
  result: string | null;
}) {
  const [from, setFrom] = useState("2026-04-01");
  const [to, setTo] = useState("2026-06-30");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [arts, setArts] = useState<string[]>([
    "policy",
    "decision",
    "risk",
    "vendor",
  ]);
  const toggle = (id: string) =>
    setArts((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  // Motivo do gate como texto no rodapé; null quando está pronto.
  const gateReason =
    arts.length > 0 && from !== "" && to !== ""
      ? null
      : "Informe o período e ao menos um artefato";

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            {gateReason ?? (
              <>
                <Icon name="lock" size={12} />
                {result ?? "Referências imutáveis aos registros de origem"}
              </>
            )}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Fechar
            </Button>
            <GatedButton
              allowed={gateReason === null && !pending}
              icon="download"
              onClick={() => onSubmit({ from, to, categories: arts, format })}
              reason={gateReason ?? ""}
            >
              {pending ? "Gerando…" : "Gerar pacote"}
            </GatedButton>
          </div>
        </>
      }
      icon="download"
      onClose={onClose}
      subtitle="Período, artefatos e formato — a exportação também é registrada"
      title="Montar pacote de evidência"
      tone="accent"
      width={760}
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
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
          }}
        >
          <FormField label="De" required>
            <TextInput
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              value={from}
            />
          </FormField>
          <FormField label="Até" required>
            <TextInput
              onChange={(e) => setTo(e.target.value)}
              type="date"
              value={to}
            />
          </FormField>
          <FormField label="Formato" required>
            <Select
              onChange={(e) => setFormat(e.target.value as "csv" | "json")}
              options={[
                { value: "csv", label: "CSV" },
                { value: "json", label: "JSON" },
              ]}
              value={format}
            />
          </FormField>
        </div>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Artefatos incluídos</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {ARTIFACTS.map((a) => (
              <CheckRow
                checked={arts.includes(a.id)}
                key={a.id}
                label={a.label}
                onToggle={() => toggle(a.id)}
                tone="accent"
              />
            ))}
          </div>
        </div>
        <Callout icon="history" tone="accent">
          A exportação grava a si mesma na trilha: quem exportou, período e
          escopo. Sem isso, o momento em que dado de governança sai do sistema
          seria a única ação sem rastro.
        </Callout>
      </div>
    </ModalShell>
  );
}
