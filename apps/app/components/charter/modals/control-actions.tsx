"use client";

// Ações do controle no modal — CH-DEV-04/05.
//
// Quais ações existem no estado e quem pode vêm de `controlActionsFor` (a mesma
// resposta que os testes leem); a permissão de verdade é do backend
// (`case.submit` / `case.decide`). Ação que o papel não faz aparece desabilitada
// com o motivo escrito ao lado, nunca escondida.

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import {
  acceptControl,
  attachControlEvidence,
  dispenseControl,
  editControl,
  reopenControl,
  requestControlAdjustment,
  submitControl,
} from "@/app/(charter)/actions/case-controls";
import type { CaseControlView } from "@/app/(charter)/actions/controls-read";
import { EDITABLE_STATES } from "@/lib/charter/case-controls";
import {
  type ControlActionView,
  controlActionsFor,
} from "@/lib/charter/controls-view";
import { uploadEvidenceFile } from "../controls-upload";
import { FormField, TextArea, TextInput } from "../form-kit";
import { GatedFooterAction } from "../screens/gated-footer-action";
import { FS } from "../type-scale";

type Mode = ControlActionView["action"] | "EDIT" | null;
type Outcome = { ok: boolean; error?: string };

const ICON = {
  ATTACH: "upload",
  SUBMIT: "send",
  ACCEPT: "check",
  REQUEST_ADJUSTMENT: "arrowLeft",
  DISPENSE: "ban",
  REOPEN: "history",
} as const;

const MIN_COMMENT = 3;
const todayIso = () => new Date().toISOString().slice(0, 10);

export function ControlActions({
  caseCode,
  control,
  can,
  onDone,
}: {
  caseCode: string;
  control: CaseControlView;
  can: { submit: boolean; decide: boolean };
  onDone: () => void;
}) {
  const ref = { code: caseCode, controlCode: control.code };
  const [mode, setMode] = useState<Mode>(null);
  const [comment, setComment] = useState("");
  const [until, setUntil] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState(control.summary ?? "");
  const [produced, setProduced] = useState("");
  const [ownerName, setOwnerName] = useState(control.ownerName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions = controlActionsFor(
    control.state as Parameters<typeof controlActionsFor>[0],
    can,
    control.dispensable
  );
  const canEdit =
    can.submit &&
    EDITABLE_STATES.includes(control.state as (typeof EDITABLE_STATES)[number]);

  const run = async (fn: () => Promise<Outcome>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      onDone();
      return;
    }
    setError(res.error ?? "Não foi possível concluir.");
  };

  const attach = () =>
    run(async () => {
      if (!file) {
        return { ok: false, error: "Escolha o arquivo da evidência." };
      }
      const up = await uploadEvidenceFile(file, ref);
      if (!up.ok) {
        return up;
      }
      return attachControlEvidence({
        ...ref,
        ...up.data,
        summary: summary || undefined,
        evidenceProducedAt: produced || undefined,
      });
    });

  const confirm = () => {
    if (mode === "ATTACH") {
      return attach();
    }
    if (mode === "EDIT") {
      return run(() =>
        editControl({ ...ref, summary, ownerName: ownerName || null })
      );
    }
    if (mode === "REQUEST_ADJUSTMENT") {
      return run(() => requestControlAdjustment({ ...ref, comment }));
    }
    if (mode === "REOPEN") {
      return run(() => reopenControl({ ...ref, comment }));
    }
    return run(() =>
      dispenseControl({ ...ref, comment, dispensedUntil: until })
    );
  };

  const click = (a: ControlActionView) => {
    setError(null);
    if (a.action === "SUBMIT") {
      return run(() => submitControl(ref));
    }
    if (a.action === "ACCEPT") {
      return run(() => acceptControl(ref));
    }
    setMode(a.action);
  };

  const needsComment =
    mode === "REQUEST_ADJUSTMENT" || mode === "REOPEN" || mode === "DISPENSE";
  const ready =
    (mode === "ATTACH" && file !== null) ||
    mode === "EDIT" ||
    (needsComment &&
      comment.trim().length >= MIN_COMMENT &&
      (mode !== "DISPENSE" || until !== ""));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {actions.map((a) => (
          <GatedFooterAction
            allowed={a.allowed && !busy}
            icon={ICON[a.action]}
            key={a.action}
            onClick={() => click(a)}
            reason={a.reason}
            variant={a.action === "ACCEPT" ? "primary" : "secondary"}
          >
            {a.label}
          </GatedFooterAction>
        ))}
        {canEdit ? (
          <GatedFooterAction
            allowed={!busy}
            icon="edit"
            onClick={() => setMode("EDIT")}
            reason=""
            variant="secondary"
          >
            Editar
          </GatedFooterAction>
        ) : null}
      </div>

      {mode ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 12,
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
          }}
        >
          {mode === "ATTACH" ? (
            <>
              <FormField label="Arquivo da evidência" required>
                <input
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  type="file"
                />
              </FormField>
              <FormField
                hint="O que a evidência mostra, em uma frase."
                label="Resumo"
              >
                <TextArea
                  onChange={(e) => setSummary(e.target.value)}
                  value={summary}
                />
              </FormField>
              <FormField label="Data em que a evidência foi produzida">
                <TextInput
                  max={todayIso()}
                  onChange={(e) => setProduced(e.target.value)}
                  type="date"
                  value={produced}
                />
              </FormField>
            </>
          ) : null}
          {mode === "EDIT" ? (
            <>
              <FormField label="Resumo da evidência">
                <TextArea
                  onChange={(e) => setSummary(e.target.value)}
                  value={summary}
                />
              </FormField>
              <FormField label="Responsável (nome)">
                <TextInput
                  onChange={(e) => setOwnerName(e.target.value)}
                  value={ownerName}
                />
              </FormField>
            </>
          ) : null}
          {needsComment ? (
            <FormField
              hint="Fica no histórico do controle, com o seu nome."
              label="Comentário"
              required
            >
              <TextArea
                onChange={(e) => setComment(e.target.value)}
                value={comment}
              />
            </FormField>
          ) : null}
          {mode === "DISPENSE" ? (
            <FormField
              hint="Dispensa tem prazo de revisão (no máximo 6 meses); no prazo, o controle volta a Reaberto."
              label="Dispensado até"
              required
            >
              <TextInput
                min={todayIso()}
                onChange={(e) => setUntil(e.target.value)}
                type="date"
                value={until}
              />
            </FormField>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Button disabled={busy || !ready} onClick={confirm}>
              {busy ? "Enviando…" : "Confirmar"}
            </Button>
            <Button onClick={() => setMode(null)} variant="ghost">
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            padding: "9px 11px",
            borderRadius: "var(--r-sm)",
            background: "var(--red-soft)",
            color: "var(--red-text)",
            fontSize: FS.base,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
