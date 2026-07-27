"use client";

// M7 — Editar Investment Horizon (port of `openNewHorizonModal`,
// budget-modal.js:149). Fields, preview-rail and validation mirror the
// prototype 1:1; GAP: no InvestmentHorizon/ValueStream backend yet (see
// ../data.ts), so `valueStreamOptions` defaults to empty and submit only
// gives toast feedback, same as the prototype's own `submitHorizon`.

import { ActivityIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import type { HorizonTone, InvestmentHorizonValueStream } from "../types";

const HORIZON_IDS: readonly string[] = ["H1", "H2", "H3"];
const TONE_OPTIONS: HorizonTone[] = [
  "blue",
  "green",
  "amber",
  "purple",
  "red",
  "accent",
];

type ValueStreamOption = Pick<InvestmentHorizonValueStream, "id" | "name">;

type EditHorizonModalProps = {
  existingId: string;
  /** Options for the "Value Streams vinculados" multi-select — empty while
   * the real backend doesn't exist yet. */
  valueStreamOptions?: ValueStreamOption[];
};

type FormState = {
  hId: string;
  tone: HorizonTone;
  label: string;
  desc: string;
  returnProfile: string;
  pct: number;
  min: number;
  max: number;
  valueStreamIds: string[];
};

function defaultForm(existingId: string): FormState {
  return {
    hId: HORIZON_IDS.includes(existingId) ? existingId : HORIZON_IDS[0],
    tone: "blue",
    label: "",
    desc: "",
    returnProfile: "",
    pct: 30,
    min: 20,
    max: 50,
    valueStreamIds: [],
  };
}

const FIELD_STYLE: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "var(--cosmos-r-md)",
  fontSize: 13.5,
  color: "var(--ink)",
  background: "var(--canvas)",
  border: "1px solid var(--hairline-strong)",
  outline: "none",
};

export function EditHorizonModal({
  existingId,
  valueStreamOptions = [],
}: EditHorizonModalProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => defaultForm(existingId));
  const [labelError, setLabelError] = useState(false);

  function handleSubmit() {
    if (!form.label.trim()) {
      setLabelError(true);
      toast.error("Label obrigatório.");
      return;
    }
    toast.success("Horizon atualizado.", { description: form.label });
    setOpen(false);
  }

  // handleSubmit is redeclared every render, so depending on it re-attached the
  // listener on every render. A ref keeps the shortcut pointing at the current
  // closure while the effect only re-runs when the modal opens or closes.
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submitRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleOpen() {
    setForm(defaultForm(existingId));
    setLabelError(false);
    setOpen(true);
  }

  const selectedValueStreams = valueStreamOptions.filter((vs) =>
    form.valueStreamIds.includes(vs.id)
  );

  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 rounded-cosmos-md bg-accent-c px-3.5 py-2 font-semibold text-[12.5px] text-[color:var(--on-accent)] transition-opacity hover:opacity-90"
        onClick={handleOpen}
        type="button"
      >
        <ActivityIcon aria-hidden size={13} />
        Editar Horizon
      </button>

      <ModalShell
        eyebrow="Aloca budget do portfolio entre run, grow e transform · SAFe LPM"
        footer={
          <>
            <button
              className="rounded-cosmos-md border border-hairline bg-surface-2 px-3.5 py-2 font-semibold text-[13px] text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="rounded-cosmos-md bg-accent-c px-3.5 py-2 font-semibold text-[13px] text-[color:var(--on-accent)] transition-opacity hover:opacity-90"
              onClick={handleSubmit}
              type="button"
            >
              Salvar alterações
            </button>
          </>
        }
        onClose={() => setOpen(false)}
        open={open}
        title="Editar Investment Horizon"
      >
        <div
          style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 22 }}
        >
          {/* Preview rail — mirrors prototype `.mprev` / `.pvcard` */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 10,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--ink-faint)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--green)",
                }}
              />
              Preview ao vivo
            </div>
            <div
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: 12,
                padding: 16,
                background: "var(--surface-2)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".06em",
                  color: `var(--${form.tone}-text)`,
                }}
              >
                {form.hId}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginTop: 4,
                }}
              >
                {form.label || "Label do Horizonte"}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  lineHeight: 1.6,
                  marginTop: 8,
                  marginBottom: 12,
                }}
              >
                {form.desc || "Descrição do horizonte..."}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span
                  style={{
                    padding: "3px 9px",
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: `rgba(var(--${form.tone}-rgb),.16)`,
                    color: `var(--${form.tone}-text)`,
                  }}
                >
                  {form.pct}% portfolio
                </span>
                <span
                  style={{
                    padding: "3px 9px",
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: "rgba(var(--accent-rgb),.16)",
                    color: "var(--accent-text)",
                  }}
                >
                  {form.returnProfile || "Retorno..."}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--ink-faint)",
                      letterSpacing: ".06em",
                    }}
                  >
                    GUARDRAIL MIN
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {form.min}%
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--ink-faint)",
                      letterSpacing: ".06em",
                    }}
                  >
                    GUARDRAIL MAX
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {form.max}%
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                  marginBottom: 8,
                }}
              >
                Value Streams
              </div>
              <div
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: 12,
                  padding: 14,
                  background: "var(--surface-2)",
                  fontSize: 12,
                  color: "var(--ink-muted)",
                }}
              >
                {selectedValueStreams.length > 0 ? (
                  selectedValueStreams.map((vs) => (
                    <div key={vs.id} style={{ marginBottom: 4 }}>
                      • {vs.name}
                    </div>
                  ))
                ) : (
                  <span style={{ color: "var(--ink-faint)" }}>
                    Nenhum selecionado
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={(event) => event.preventDefault()}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <Field label="ID do Horizon" required>
                <select
                  onChange={(event) =>
                    setForm((f) => ({ ...f, hId: event.target.value }))
                  }
                  style={FIELD_STYLE}
                  value={form.hId}
                >
                  {HORIZON_IDS.map((hid) => (
                    <option key={hid} value={hid}>
                      {hid}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cor / Tone">
                <select
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      tone: TONE_OPTIONS.includes(
                        event.target.value as HorizonTone
                      )
                        ? (event.target.value as HorizonTone)
                        : f.tone,
                    }))
                  }
                  style={FIELD_STYLE}
                  value={form.tone}
                >
                  {TONE_OPTIONS.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Label" required>
              <input
                onChange={(event) => {
                  setForm((f) => ({ ...f, label: event.target.value }));
                  setLabelError(false);
                }}
                placeholder="ex: Run the Business"
                style={{
                  ...FIELD_STYLE,
                  borderColor: labelError
                    ? "var(--red)"
                    : FIELD_STYLE.border?.toString(),
                }}
                value={form.label}
              />
            </Field>

            <Field label="Descrição">
              <textarea
                onChange={(event) =>
                  setForm((f) => ({ ...f, desc: event.target.value }))
                }
                placeholder="Objetivo e perfil de risco deste horizonte..."
                style={{
                  ...FIELD_STYLE,
                  minHeight: 66,
                  lineHeight: 1.5,
                  resize: "vertical",
                }}
                value={form.desc}
              />
            </Field>

            <Field label="Perfil de retorno">
              <input
                onChange={(event) =>
                  setForm((f) => ({ ...f, returnProfile: event.target.value }))
                }
                placeholder="ex: Imediato — 0–12 meses"
                style={FIELD_STYLE}
                value={form.returnProfile}
              />
            </Field>

            <Field label="% do portfolio budget" required>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  max={80}
                  min={5}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, pct: Number(event.target.value) }))
                  }
                  step={5}
                  style={{ flex: 1, accentColor: "var(--accent)" }}
                  type="range"
                  value={form.pct}
                />
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 16,
                    fontWeight: 700,
                    minWidth: 40,
                    color: "var(--accent-text)",
                  }}
                >
                  {form.pct}%
                </div>
              </div>
            </Field>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <Field label="Guardrail mínimo (%)">
                <input
                  max={100}
                  min={0}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, min: Number(event.target.value) }))
                  }
                  style={FIELD_STYLE}
                  type="number"
                  value={form.min}
                />
              </Field>
              <Field label="Guardrail máximo (%)">
                <input
                  max={100}
                  min={0}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, max: Number(event.target.value) }))
                  }
                  style={FIELD_STYLE}
                  type="number"
                  value={form.max}
                />
              </Field>
            </div>

            <Field
              hint={
                valueStreamOptions.length === 0
                  ? "Nenhum value stream cadastrado ainda (GAP: sem backend)."
                  : "Ctrl/Cmd para selecionar múltiplos"
              }
              label="Value Streams vinculados"
            >
              <select
                multiple
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    valueStreamIds: Array.from(
                      event.target.selectedOptions,
                      (opt) => opt.value
                    ),
                  }))
                }
                size={4}
                style={{ ...FIELD_STYLE, padding: 6 }}
                value={form.valueStreamIds}
              >
                {valueStreamOptions.map((vs) => (
                  <option key={vs.id} value={vs.id}>
                    {vs.name}
                  </option>
                ))}
              </select>
            </Field>
          </form>
        </div>
      </ModalShell>
    </>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {label}
        {required ? (
          <span style={{ color: "var(--accent-text)" }}>*</span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{hint}</span>
      ) : null}
    </div>
  );
}
