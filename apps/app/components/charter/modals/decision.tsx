"use client";

// modals/decision.tsx — DecisionModal (FR-6). Movido de modals.tsx no split
// em um arquivo por modal; anatomia preservada 1:1 (RadioCards na decisão,
// CheckRow nas condições, Callout carregando a razão na tela).

import { Button, IconButton } from "@repo/design-system/cosmos/kit";
import { type CSSProperties, useState } from "react";
import {
  DATA_CLASS_LABEL,
  DATA_CLASS_TONE,
  type Tone,
} from "@/lib/charter/rules";
import { Eyebrow, GatedButton, MetaCell } from "../base";
import {
  Callout,
  CheckRow,
  FooterHint,
  FormField,
  Kbd,
  RadioCards,
  TextArea,
  TextInput,
} from "../form-kit";
import { ModalShell } from "../modal";
import { FS } from "../type-scale";
import type { DataClass } from "./_shared";

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
  controlBlockers = [],
  onClose,
  onSubmit,
  pending,
}: {
  caseCode: string;
  caseTitle: string;
  approvalPath: string | null;
  dataClass: DataClass;
  /** Null = ninguém pontuou; a célula mostra só `riskLabel`. */
  score: number | null;
  riskLabel: string;
  riskTone: string;
  vendorName: string | null;
  deciderName: string;
  deciderRole: string;
  /** Controles sem evidência, com ajuste pedido ou vencidos (CH-DEV-06). Barram
   *  aprovar e aprovar com restrições; pedir ajustes e bloquear seguem livres. */
  controlBlockers?: string[];
  onClose: () => void;
  onSubmit: (input: DecisionSubmit) => void;
  pending: boolean;
}) {
  // Sem veredito pré-selecionado: pré-marcar "Aprovar com restrições" fazia
  // o revisor confirmar um veredito que não escolheu.
  const [decision, setDecision] = useState<DecisionSubmit["outcome"] | null>(
    null
  );
  const [note, setNote] = useState("");
  const [conds, setConds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const sel = DECISIONS.find((d) => d.value === decision) ?? null;
  const needsCond = decision === "RESTRICTED";
  const approving = decision === "APPROVED" || decision === "RESTRICTED";
  const controlsBlock = approving && controlBlockers.length > 0;
  // Motivo do gate como texto no rodapé; null quando está pronto.
  const gateReason =
    decision === null
      ? "Escolha o veredito"
      : controlsBlock
        ? `${controlBlockers.length} controle(s) impedem aprovar`
        : needsCond && conds.length === 0
          ? "Aprovação com restrições exige ao menos uma condição"
          : note.trim().length < 12
            ? "Escreva a justificativa"
            : null;
  // O detalhe do caso passa "—" quando getSettings falhou; sem papel, o rodapé
  // mostra só o nome, sem o separador.
  const role = deciderRole && deciderRole !== "—" ? deciderRole : null;

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
          value={score === null ? riskLabel : `${score} · ${riskLabel}`}
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
            <Kbd>esc</Kbd> cancelar ·{" "}
            {gateReason ?? `${deciderName}${role ? ` · ${role}` : ""}`}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            {/* O botão leva a cor do veredito: GatedButton pinta com
                `--accent`, então basta redefinir a variável no escopo dele. */}
            <span
              style={
                sel
                  ? ({ "--accent": `var(--${sel.tone})` } as CSSProperties)
                  : undefined
              }
            >
              <GatedButton
                allowed={gateReason === null && !pending}
                icon={sel?.icon}
                onClick={() =>
                  decision &&
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
                reason={gateReason ?? ""}
              >
                {pending ? "Registrando…" : (sel?.label ?? "Registrar decisão")}
              </GatedButton>
            </span>
          </div>
        </>
      }
      icon="gavel"
      onClose={onClose}
      subtitle={`${caseTitle}${approvalPath ? ` · ${approvalPath}` : ""}`}
      title={`Decisão · ${caseCode}`}
      tone={sel?.tone ?? "accent"}
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

        <FormField label="Decisão" required variant="group">
          <RadioCards
            onChange={(v) => setDecision(v as DecisionSubmit["outcome"])}
            options={DECISIONS}
            value={decision ?? ""}
          />
        </FormField>

        {controlsBlock && (
          <Callout icon="ban" tone="red">
            <strong>
              {controlBlockers.length} controle(s) impedem aprovar.
            </strong>{" "}
            Aceite, dispense com prazo ou peça ajuste antes:
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {controlBlockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Callout>
        )}

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
                    fontSize: FS.nota,
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
                      fontSize: FS.nota,
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
