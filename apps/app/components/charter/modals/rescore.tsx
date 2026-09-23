"use client";

// modals/rescore.tsx — RescoreModal, a tela de reavaliação de risco (FR-5,
// FR-7). Escreve os sete eixos por `rescoreCase`, que existia sem tela.
//
// Anatomia do intake: eixos à esquerda, com a regra escrita antes da escala,
// e consequência ao vivo à direita (ModalSplit). Duas escolhas que vêm do SRD
// (§7, "cuidado com valor padrão"):
//  1. Caso que ninguém pontuou abre sem eixo marcado. Abrir com os sete em 1
//     era o default do schema posando de avaliação — o erro que esta tela
//     existe para fechar.
//  2. Justificativa obrigatória, como na decisão: vira a nota da trilha.

import { Button } from "@repo/design-system/cosmos/kit";
import { useId, useState } from "react";
import {
  RISK_CATEGORY_DESC,
  RISK_CATEGORY_LABEL,
  type RiskProfile,
  riskAxisTone,
  riskScore,
  SEM_PONTUACAO,
} from "@/lib/charter/rules";
import { Eyebrow, GatedButton, MetaCell } from "../base";
import {
  Callout,
  FooterHint,
  FormField,
  Kbd,
  Segmented,
  TextArea,
} from "../form-kit";
import { ModalShell, ModalSplit } from "../modal";
import { RiskMiniMatrix } from "../parts";
import { FS } from "../type-scale";

type Axis = keyof RiskProfile;
type Draft = Record<Axis, number | null>;

export type RescoreSubmit = { risks: RiskProfile; note: string };

const AXES = (
  Object.keys(RISK_CATEGORY_LABEL) as (keyof typeof RISK_CATEGORY_LABEL)[]
).map((id) => ({ id, key: id.toLowerCase() as Axis }));

const SCALE = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  tone: riskAxisTone(n),
}));

const EMPTY: Draft = {
  privacy: null,
  regulatory: null,
  security: null,
  bias: null,
  ip: null,
  operational: null,
  reputational: null,
};

function filled(draft: Draft): RiskProfile | null {
  return Object.values(draft).every((v) => v !== null)
    ? (draft as RiskProfile)
    : null;
}

/** Um eixo: nome e o que ele mede à esquerda, escala de 1 a 5 à direita e,
 *  na reavaliação, o "antes → depois" do eixo que mudou. */
function AxisRow({
  label,
  hint,
  value,
  before,
  showDelta,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  before: number | null;
  showDelta: boolean;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  const changed = before !== null && value !== null && value !== before;
  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> tem o quirk de min-width que quebra a grade da linha — mesma escolha do FormField variant="group" em form-kit.tsx
    <div
      aria-labelledby={labelId}
      role="group"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        alignItems: "center",
        gap: 14,
        padding: "10px 0",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          id={labelId}
          style={{ fontSize: FS.base, fontWeight: 700, color: "var(--ink)" }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: FS.nota,
            color: "var(--ink-faint)",
            lineHeight: 1.45,
            marginTop: 2,
          }}
        >
          {hint}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Largura fixa: o "antes → depois" aparece sem empurrar a escala. */}
        {showDelta && (
          <span
            className="mono"
            style={{
              width: 44,
              textAlign: "right",
              fontSize: FS.nota,
              fontWeight: 700,
              color: "var(--ink-muted)",
            }}
          >
            {changed ? (
              <>
                {before} → {value}
              </>
            ) : null}
          </span>
        )}
        <Segmented
          onChange={(v) => onChange(Number(v))}
          options={SCALE}
          value={value === null ? "" : String(value)}
        />
      </div>
    </div>
  );
}

export function RescoreModal({
  caseCode,
  caseTitle,
  current,
  actorName,
  actorRole,
  onClose,
  onSubmit,
  pending,
}: {
  caseCode: string;
  caseTitle: string;
  /** Eixos pontuados hoje; null quando ninguém pontuou. */
  current: RiskProfile | null;
  actorName: string;
  actorRole: string;
  onClose: () => void;
  onSubmit: (input: RescoreSubmit) => void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(current ?? EMPTY);
  const [note, setNote] = useState("");

  const risks = filled(draft);
  const after = risks ? riskScore(risks) : null;
  const before = current ? riskScore(current) : null;
  const tone = after?.tone ?? "accent";
  const missing = Object.values(draft).filter((v) => v === null).length;
  // Motivo do gate como texto no rodapé; null quando está pronto.
  const gateReason =
    missing > 0
      ? `Marque todos os eixos — ${missing === 1 ? "falta 1" : `faltam ${missing}`}`
      : note.trim().length < 12
        ? "Escreva a justificativa"
        : null;
  // O detalhe passa "—" quando getSettings falhou; sem papel, só o nome.
  const role = actorRole && actorRole !== "—" ? actorRole : null;

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> cancelar ·{" "}
            {gateReason ?? `${actorName}${role ? ` · ${role}` : ""}`}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedButton
              allowed={gateReason === null && !pending}
              icon="target"
              onClick={() => risks && onSubmit({ risks, note: note.trim() })}
              reason={gateReason ?? ""}
            >
              {pending
                ? "Registrando…"
                : `Registrar ${current ? "reavaliação" : "pontuação"}`}
            </GatedButton>
          </div>
        </>
      }
      icon="target"
      onClose={onClose}
      subtitle={caseTitle}
      title={`${current ? "Reavaliar" : "Pontuar"} risco · ${caseCode}`}
      tone={tone}
      width={920}
    >
      <ModalSplit
        aside={
          <>
            <Eyebrow tone={tone}>Avaliação ao vivo</Eyebrow>
            {/* Região "status": o composto é anunciado quando muda, sem
                roubar o foco da escala. */}
            {/* biome-ignore lint/a11y/useSemanticElements: <output> só aceita conteúdo de frase, e o painel tem blocos (Eyebrow e MetaCell são <div>) */}
            <div
              aria-live="polite"
              role="status"
              style={{
                padding: "14px 15px",
                borderRadius: 10,
                background: `rgba(var(--${tone}-rgb),.09)`,
                border: `1px solid rgba(var(--${tone}-rgb),.24)`,
              }}
            >
              <Eyebrow>Risco composto</Eyebrow>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: FS.display,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: `var(--${tone}-text)`,
                  }}
                >
                  {after?.score ?? "—"}
                </span>
                <span
                  style={{
                    fontSize: FS.base,
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  {after?.label ?? SEM_PONTUACAO}
                </span>
              </div>
              <div
                className={after ? "mono" : undefined}
                style={{
                  fontSize: FS.nota,
                  color: "var(--ink-muted)",
                  marginTop: 8,
                  lineHeight: 1.5,
                }}
              >
                {after
                  ? `sev ${after.severity} × prob ${after.likelihood}`
                  : "Aparece quando os sete eixos tiverem valor."}
              </div>
              {before && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 11,
                    borderTop: `1px solid rgba(var(--${tone}-rgb),.2)`,
                  }}
                >
                  <MetaCell
                    label="Antes"
                    mono
                    value={`${before.score} · ${before.label}`}
                  />
                </div>
              )}
            </div>

            <RiskMiniMatrix
              lik={after?.likelihood ?? 0}
              sev={after?.severity ?? 0}
            />

            <div
              style={{
                marginTop: "auto",
                fontSize: FS.nota,
                color: "var(--ink-faint)",
                lineHeight: 1.5,
              }}
            >
              Fica na trilha com o que mudou e o seu papel. Caminho e SLA não
              mudam: foram congelados na submissão.
            </div>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* A regra antes da escala: quem pontua precisa saber que um único
              5 move o caso inteiro. Os limiares estão na legenda da matriz. */}
          <Callout icon="gauge" tone="accent">
            Severidade é o maior eixo — um 5 não se dilui em seis 1.
            Probabilidade é a média arredondada dos sete.
          </Callout>
          <div>
            {AXES.map(({ id, key }) => (
              <AxisRow
                before={current?.[key] ?? null}
                hint={RISK_CATEGORY_DESC[id]}
                key={id}
                label={RISK_CATEGORY_LABEL[id]}
                onChange={(value) => setDraft((d) => ({ ...d, [key]: value }))}
                showDelta={current !== null}
                value={draft[key]}
              />
            ))}
          </div>
          <FormField
            hint="Sem o porquê, a pontuação não sustenta auditoria."
            label="Justificativa"
            required
          >
            <TextArea
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex: Fornecedor passou a reter prompts por 30 dias; privacidade sobe de 3 para 4."
              rows={3}
              value={note}
            />
          </FormField>
        </div>
      </ModalSplit>
    </ModalShell>
  );
}
