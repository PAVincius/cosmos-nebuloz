"use client";

// modals/publish-version.tsx — PublishVersionModal (FR-2.3, FR-2.4). Movido
// de modals.tsx no split em um arquivo por modal; anatomia preservada 1:1.

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import { Eyebrow, GatedButton } from "../base";
import {
  Callout,
  CheckRow,
  FooterHint,
  FormField,
  Kbd,
  TextArea,
} from "../form-kit";
import { ModalShell } from "../modal";

// ── 4. PublishVersionModal (FR-2.3, FR-2.4) ───────────────────────────────────

export function PublishVersionModal({
  policyName,
  currentVersion,
  nextVersion,
  blockers,
  trackCount,
  peopleCount,
  onClose,
  onSubmit,
  pending,
}: {
  policyName: string;
  currentVersion: string | null;
  nextVersion: string;
  blockers: {
    id: string;
    ordinal: number;
    name: string;
    statusLabel: string;
  }[];
  trackCount: number;
  peopleCount: number;
  onClose: () => void;
  onSubmit: (summary: string) => void;
  pending: boolean;
}) {
  const [summary, setSummary] = useState("");
  const [notify, setNotify] = useState(true);
  const [recert, setRecert] = useState(true);
  const blocked = blockers.length > 0;
  // Motivo do gate como texto no rodapé; null quando está pronto.
  const gateReason = blocked
    ? "Aprove todas as seções antes de publicar"
    : summary.trim().length < 12
      ? "Escreva um resumo de mudança"
      : null;

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> cancelar ·{" "}
            {gateReason ?? "publicação entra na auditoria"}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedButton
              allowed={gateReason === null && !pending}
              icon="check"
              onClick={() => onSubmit(summary.trim())}
              reason={gateReason ?? ""}
            >
              {pending ? "Publicando…" : `Publicar ${nextVersion}`}
            </GatedButton>
          </div>
        </>
      }
      icon="upload"
      onClose={onClose}
      subtitle={`${currentVersion ?? "—"} → ${nextVersion} · a versão vigente só muda ao confirmar`}
      title={`Publicar ${policyName}`}
      tone="accent"
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
        {blocked && (
          <>
            <Callout icon="alert" tone="amber">
              {blockers.length}{" "}
              {blockers.length === 1
                ? "seção não está aprovada"
                : "seções não estão aprovadas"}
              . Publicar uma política com seção em rascunho cria regra que
              ninguém leu — o Charter bloqueia.
            </Callout>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {blockers.map((b) => (
                <CheckRow
                  checked={false}
                  disabled
                  hint={b.statusLabel}
                  key={b.id}
                  label={`${String(b.ordinal).padStart(2, "0")} · ${b.name}`}
                  tone="amber"
                />
              ))}
            </div>
          </>
        )}

        <FormField
          hint="Aparece na trilha de auditoria e no aviso de re-aceite. Sem resumo, não há publicação."
          label="Resumo de mudança"
          required
        >
          <TextArea
            onChange={(e) => setSummary(e.target.value)}
            placeholder="ex: Seção 4 passa a exigir retenção zero para dado Confidencial; seção 6 define divulgação obrigatória em IA voltada ao cliente."
            rows={3}
            value={summary}
          />
        </FormField>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
          <Eyebrow style={{ marginBottom: 8 }}>Efeitos ao publicar</Eyebrow>
          <CheckRow
            checked={notify}
            hint="E-mail e Slack com o resumo de mudança"
            label="Notificar todos os colaboradores"
            onToggle={() => setNotify((v) => !v)}
            tone="accent"
          />
          <CheckRow
            checked={recert}
            hint={`${trackCount} trilhas · ${peopleCount.toLocaleString("pt-BR")} pessoas`}
            label="Exigir re-aceite nas trilhas vinculadas"
            onToggle={() => setRecert((v) => !v)}
            tone="accent"
          />
          {/* Honestidade sobre o V1: a invalidação acontece; o envio não (ADR-0011). */}
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            A invalidação dos aceites acontece de imediato. O envio de
            notificação ainda não está ligado nesta versão.
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
