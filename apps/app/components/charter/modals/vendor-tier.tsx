"use client";

// modals/vendor-tier.tsx — VendorTierModal (FR-8.5). Movido de modals.tsx no
// split em um arquivo por modal; anatomia preservada 1:1.

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import { DATA_CLASS_LABEL, type Tone } from "@/lib/charter/rules";
import { GatedButton } from "../base";
import {
  Callout,
  FooterHint,
  FormField,
  Kbd,
  RadioCards,
  TextArea,
} from "../form-kit";
import { ModalShell } from "../modal";
import type { DataClass } from "./_shared";

type VendorTier = "APPROVED" | "RESTRICTED" | "REVIEW" | "BLOCKED";

// ── 7. VendorTierModal (FR-8.5) ───────────────────────────────────────────────

const TIER_OPTS = [
  {
    value: "APPROVED",
    label: "Aprovado",
    tone: "green" as Tone,
    icon: "check" as const,
    desc: "Elegível dentro da classe máxima derivada da postura contratual.",
  },
  {
    value: "RESTRICTED",
    label: "Restrito",
    tone: "amber" as Tone,
    icon: "lock" as const,
    desc: "Uso permitido apenas em casos específicos e com mitigação.",
  },
  {
    value: "REVIEW",
    label: "Em revisão",
    tone: "accent" as Tone,
    icon: "eye" as const,
    desc: "Novos casos suspensos até conclusão da avaliação.",
  },
  {
    value: "BLOCKED",
    label: "Bloqueado",
    tone: "red" as Tone,
    icon: "ban" as const,
    desc: "Nenhum uso permitido. Casos existentes precisam migrar.",
  },
];

export function VendorTierModal({
  vendor,
  onClose,
  onSubmit,
  pending,
}: {
  vendor: {
    name: string;
    tier: string;
    cases: number;
    maxClass: DataClass | null;
  };
  onClose: () => void;
  onSubmit: (input: { tier: VendorTier; rationale: string }) => void;
  pending: boolean;
}) {
  const [tier, setTier] = useState<VendorTier>(vendor.tier as VendorTier);
  const [note, setNote] = useState("");
  const meta = TIER_OPTS.find((t) => t.value === tier) ?? TIER_OPTS[0];
  // Aplicar o mesmo tier registraria uma alteração sem alteração na
  // auditoria. Motivo do gate como texto no rodapé; null quando pronto.
  const gateReason =
    tier === vendor.tier
      ? "Escolha um tier diferente do atual"
      : note.trim().length < 12
        ? "Escreva a justificativa"
        : null;

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> cancelar ·{" "}
            {gateReason ?? "Alteração entra na trilha de auditoria"}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedButton
              allowed={gateReason === null && !pending}
              icon="check"
              onClick={() => onSubmit({ tier, rationale: note.trim() })}
              reason={gateReason ?? ""}
            >
              {pending ? "Aplicando…" : "Aplicar"}
            </GatedButton>
          </div>
        </>
      }
      icon="shield"
      onClose={onClose}
      subtitle="A mudança afeta todos os casos de uso vinculados"
      title={`Situação · ${vendor.name}`}
      tone={meta.tone}
      width={680}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 15,
          padding: 22,
        }}
      >
        <FormField label="Situação" required variant="group">
          <RadioCards
            cols={2}
            onChange={(v) => setTier(v as VendorTier)}
            options={TIER_OPTS}
            value={tier}
          />
        </FormField>

        {/* Divergência deliberada do protótipo (ADR-0003): a classe máxima é
            derivada das cláusulas, não escolhida aqui. Escolher livremente
            tornaria FR-9.3 ("recalcular ao marcar cláusula") sem sentido. */}
        <Callout icon="scale" tone="accent">
          Classe máxima atual:{" "}
          <strong>
            {vendor.maxClass ? DATA_CLASS_LABEL[vendor.maxClass] : "nenhuma"}
          </strong>
          . Ela é derivada da postura contratual — para mudá-la, ajuste as
          cláusulas em “Gerir cláusulas”. Mudar o tier para Bloqueado zera a
          classe permitida.
        </Callout>

        <FormField
          hint="Fica visível a quem tentar usar este fornecedor fora do permitido"
          label="Justificativa"
          required
        >
          <TextArea
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: Retenção de 14 dias incompatível com a seção 4 para dado Confidencial; renegociação em curso."
            rows={3}
            value={note}
          />
        </FormField>

        {tier === "BLOCKED" && (
          <Callout icon="ban" tone="red">
            {vendor.cases} caso(s) de uso vinculado(s) entram em estado de
            exceção e são sinalizados para migração de fornecedor.
          </Callout>
        )}
      </div>
    </ModalShell>
  );
}
