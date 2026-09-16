"use client";

// modals/decision.tsx — DecisionModal (FR-6). Movido de modals.tsx no split
// em um arquivo por modal; anatomia preservada 1:1 (RadioCards na decisão,
// CheckRow nas condições, Callout carregando a razão na tela).

import { Icon } from "@repo/design-system/cosmos/icons";
import { Button, IconButton } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import {
  DATA_CLASS_LABEL,
  DATA_CLASS_TONE,
  type Tone,
} from "@/lib/charter/rules";
import { Eyebrow, MetaCell } from "../base";
import {
  Callout,
  CheckRow,
  FooterHint,
  FormField,
  RadioCards,
  TextArea,
  TextInput,
} from "../form-kit";
import { ModalShell } from "../modal";
import { type DataClass, GatedAction } from "./_shared";

// ── 2. DecisionModal (FR-6) ───────────────────────────────────────────────────

export type DecisionSubmit = {
  outcome: "APPROVED" | "RESTRICTED" | "CHANGES" | "BLOCKED";
  rationale: string;
  conditions: string[];
  changeRequest?: string;
  blockReason?: string;
};

const DECISIONS = [
  {
    value: "APPROVED",
    label: "Aprovar",
    tone: "green" as Tone,
    icon: "check" as const,
    desc: "Caso liberado como declarado, sem condições adicionais.",
  },
  {
    value: "RESTRICTED",
    label: "Aprovar com restrições",
    tone: "green" as Tone,
    icon: "lock" as const,
    desc: "Liberado sob condições explícitas que acompanham o caso até serem levantadas.",
  },
  {
    value: "CHANGES",
    label: "Pedir ajustes",
    tone: "amber" as Tone,
    icon: "arrowLeft" as const,
    desc: "Falta informação para decidir. Volta ao requester com o que precisa mudar.",
  },
  {
    value: "BLOCKED",
    label: "Bloquear",
    tone: "red" as Tone,
    icon: "ban" as const,
    desc: "Incompatível com a política. Registrado no Decision Log com motivo.",
  },
];

const CONDITION_SUGGESTIONS = [
  "Somente ambiente dedicado com BAA",
  "Retenção zero verificada por trimestre",
  "Auditoria de paridade antes do rollout",
  "Divulgação explícita de IA ao usuário",
];

export function DecisionModal({
  caseCode,
  caseTitle,
  approvalPath,
  dataClass,
  score,
  riskLabel,
  riskTone,
  vendorName,
  deciderName,
  deciderRole,
  onClose,
  onSubmit,
  pending,
}: {
  caseCode: string;
  caseTitle: string;
  approvalPath: string | null;
  dataClass: DataClass;
  score: number;
  riskLabel: string;
  riskTone: string;
  vendorName: string | null;
  deciderName: string;
  deciderRole: string;
  onClose: () => void;
  onSubmit: (input: DecisionSubmit) => void;
  pending: boolean;
}) {
  const [decision, setDecision] =
    useState<DecisionSubmit["outcome"]>("RESTRICTED");
  const [note, setNote] = useState("");
  const [conds, setConds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const sel = DECISIONS.find((d) => d.value === decision) ?? DECISIONS[0];
  const needsCond = decision === "RESTRICTED";
  const ready = note.trim().length >= 12 && (!needsCond || conds.length > 0);

  const cells = [
    {
      key: "dc",
      node: (
        <MetaCell
          label="Classe de dado"
          tone={DATA_CLASS_TONE[dataClass]}
          value={DATA_CLASS_LABEL[dataClass]}
        />
      ),
    },
    {
      key: "risk",
      node: (
        <MetaCell
          label="Risco composto"
          mono
          tone={riskTone as Tone}
          value={`${score} · ${riskLabel}`}
        />
      ),
    },
    {
      key: "vendor",
      node: <MetaCell label="Fornecedor" value={vendorName ?? "—"} />,
    },
  ];

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Icon name="userCheck" size={12} />
            {deciderName} · {deciderRole}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedAction
              ready={ready && !pending}
              reason={
                needsCond && conds.length === 0
                  ? "Aprovação com restrições exige ao menos uma condição"
                  : "Escreva a justificativa"
              }
            >
              <Button
                icon={sel.icon}
                onClick={() =>
                  onSubmit({
                    outcome: decision,
                    rationale: note.trim(),
                    conditions: needsCond ? conds : [],
                    changeRequest:
                      decision === "CHANGES" ? note.trim() : undefined,
                    blockReason:
                      decision === "BLOCKED" ? note.trim() : undefined,
                  })
                }
                size="md"
                style={{
                  background: `var(--${sel.tone})`,
                  borderColor: `var(--${sel.tone})`,
                }}
              >
                {pending ? "Registrando…" : sel.label}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="gavel"
      onClose={onClose}
      subtitle={`${caseTitle}${approvalPath ? ` · ${approvalPath}` : ""}`}
      title={`Decisão · ${caseCode}`}
      tone={sel.tone}
      width={760}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 22,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 10,
          }}
        >
          {cells.map((c) => (
            <div
              key={c.key}
              style={{
                padding: "10px 12px",
                borderRadius: 9,
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
              }}
            >
              {c.node}
            </div>
          ))}
        </div>

        <FormField label="Decisão" required>
          <RadioCards
            onChange={(v) => setDecision(v as DecisionSubmit["outcome"])}
            options={DECISIONS}
            value={decision}
          />
        </FormField>

        {needsCond && (
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>
              Condições da aprovação · obrigatório ao menos uma
            </Eyebrow>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginBottom: 10,
              }}
            >
              {conds.map((c) => (
                <CheckRow
                  checked
                  key={c}
                  label={c}
                  right={
                    <IconButton
                      name="x"
                      onClick={() =>
                        setConds((cs) => cs.filter((x) => x !== c))
                      }
                      size={26}
                      title="Remover condição"
                    />
                  }
                  tone="green"
                />
              ))}
              {conds.length === 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--red-text)",
                    padding: "8px 4px",
                  }}
                >
                  Nenhuma condição — uma aprovação restrita sem condição é
                  apenas uma aprovação.
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <TextInput
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) {
                    e.preventDefault();
                    setConds((cs) => [...cs, draft.trim()]);
                    setDraft("");
                  }
                }}
                placeholder="ex: Saída sempre revisada por profissional de saúde"
                value={draft}
              />
              <Button
                icon="plus"
                onClick={() => {
                  if (draft.trim()) {
                    setConds((cs) => [...cs, draft.trim()]);
                    setDraft("");
                  }
                }}
                size="md"
                variant="secondary"
              >
                Adicionar
              </Button>
            </div>
            <div
              style={{
                display: "flex",
                gap: 7,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              {CONDITION_SUGGESTIONS.filter((s) => !conds.includes(s)).map(
                (s) => (
                  <button
                    className="btn"
                    key={s}
                    onClick={() => setConds((cs) => [...cs, s])}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 99,
                      fontSize: 11.5,
                      fontWeight: 600,
                      border: "1px dashed var(--hairline-strong)",
                      background: "transparent",
                      color: "var(--ink-muted)",
                      cursor: "pointer",
                    }}
                    type="button"
                  >
                    + {s}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        <FormField
          hint="Vai para a trilha de auditoria e para o pacote de evidência. Sem justificativa, não há decisão."
          label="Justificativa da decisão"
          required
        >
          <TextArea
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: Uso compatível com a seção 4 desde que o processamento ocorra no ambiente dedicado com BAA; risco de viés endereçado por MIT-30."
            rows={3}
            value={note}
          />
        </FormField>

        {decision === "BLOCKED" && (
          <Callout icon="ban" tone="red">
            O requester é notificado com o motivo e pode reabrir apenas com
            mudança material no caso — novo fornecedor, nova classe de dado ou
            novo desenho de revisão humana.
          </Callout>
        )}
        {decision === "CHANGES" && (
          <Callout icon="arrowLeft" tone="amber">
            O caso volta ao requester com a descrição acima e sai da fila de
            decisão até ser reenviado.
          </Callout>
        )}
      </div>
    </ModalShell>
  );
}
