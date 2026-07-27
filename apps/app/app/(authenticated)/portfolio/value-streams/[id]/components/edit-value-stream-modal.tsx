"use client";

// M6 — port of prototype `openNewValueStreamModal(existingId)`
// (design_handoff_cosmos_platform/prototype/budget-modal.js). Same
// two-column preview+form layout as the sibling `EditHorizonModal`
// (../../horizons/[id]/components/edit-horizon-modal.tsx).
//
// No Prisma model for ValueStream exists yet (GAP — see ../data.ts), so
// this validates the form and shows a confirmation toast only; it does not
// persist. Swap the `handleSubmit` body for a real server action once the
// model lands.

import { ActivityIcon } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import type { ValueStreamTone } from "../types";

const HORIZON_OPTIONS = ["H1", "H2", "H3"] as const;
const TONE_OPTIONS: ValueStreamTone[] = [
  "blue",
  "green",
  "amber",
  "purple",
  "red",
  "accent",
];

type ArtOption = {
  id: string;
  name: string;
};

type EditValueStreamModalProps = {
  existingId: string;
  /** Options for the "ARTs contribuintes" multi-select — empty while the
   * real backend doesn't exist yet. */
  artOptions?: ArtOption[];
};

type FormState = {
  vsId: string;
  tone: ValueStreamTone;
  name: string;
  type: "development" | "operational";
  mission: string;
  owner: string;
  horizonId: (typeof HORIZON_OPTIONS)[number];
  budgetAlloc: number;
  budgetSpent: number;
  cycleTimeDays: number;
  flowEfficiency: number;
  artIds: string[];
};

function defaultForm(existingId: string): FormState {
  return {
    vsId: existingId,
    tone: "blue",
    name: "",
    type: "development",
    mission: "",
    owner: "",
    horizonId: "H1",
    budgetAlloc: 1,
    budgetSpent: 0,
    cycleTimeDays: 14,
    flowEfficiency: 60,
    artIds: [],
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

export function EditValueStreamModal({
  existingId,
  artOptions = [],
}: EditValueStreamModalProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => defaultForm(existingId));
  const [nameError, setNameError] = useState(false);

  function handleSubmit() {
    if (!form.name.trim()) {
      setNameError(true);
      toast.error("Nome obrigatório.");
      return;
    }
    toast.success("Value Stream atualizado.", { description: form.name });
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
    setNameError(false);
    setOpen(true);
  }

  const utilPct =
    form.budgetAlloc > 0
      ? Math.round((form.budgetSpent / form.budgetAlloc) * 100)
      : 0;
  const utilTone: ValueStreamTone =
    utilPct >= 90 ? "red" : utilPct >= 75 ? "amber" : "green";
  const selectedArts = artOptions.filter((art) => form.artIds.includes(art.id));

  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 rounded-cosmos-md bg-accent-c px-3.5 py-2 font-semibold text-[12.5px] text-[color:var(--on-accent)] transition-opacity hover:opacity-90"
        onClick={handleOpen}
        type="button"
      >
        <ActivityIcon aria-hidden size={13} />
        Editar VS
      </button>

      <ModalShell
        eyebrow="Mission, budget e ARTs deste Value Stream · SAFe Lean Budget"
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
        title="Editar Value Stream"
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
                {form.vsId}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginTop: 4,
                }}
              >
                {form.name || "Nome do Value Stream"}
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
                {form.mission || "Missão do value stream..."}
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
                  {form.type === "development"
                    ? "Development VS"
                    : "Operational VS"}
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
                  {form.horizonId}
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
                    UTILIZAÇÃO
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: `var(--${utilTone}-text)`,
                    }}
                  >
                    {utilPct}%
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
                    CYCLE TIME
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {form.cycleTimeDays}d
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
                ARTs contribuintes
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
                {selectedArts.length > 0 ? (
                  selectedArts.map((art) => (
                    <div key={art.id} style={{ marginBottom: 4 }}>
                      • {art.name}
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
              <Field label="Nome" required>
                <input
                  onChange={(event) => {
                    setForm((f) => ({ ...f, name: event.target.value }));
                    setNameError(false);
                  }}
                  placeholder="ex: Payments Platform"
                  style={{
                    ...FIELD_STYLE,
                    borderColor: nameError
                      ? "var(--red)"
                      : FIELD_STYLE.border?.toString(),
                  }}
                  value={form.name}
                />
              </Field>

              <Field label="Tipo">
                <div
                  style={{
                    display: "flex",
                    borderRadius: "var(--cosmos-r-md)",
                    border: "1px solid var(--hairline-strong)",
                    overflow: "hidden",
                  }}
                >
                  {(["development", "operational"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm((f) => ({ ...f, type }))}
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        fontSize: 12.5,
                        fontWeight: 600,
                        background:
                          form.type === type
                            ? "var(--accent-c)"
                            : "var(--canvas)",
                        color:
                          form.type === type
                            ? "var(--on-accent)"
                            : "var(--ink-muted)",
                        border: "none",
                        cursor: "pointer",
                      }}
                      type="button"
                    >
                      {type === "development" ? "Development" : "Operational"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="Missão">
              <textarea
                onChange={(event) =>
                  setForm((f) => ({ ...f, mission: event.target.value }))
                }
                placeholder="Objetivo e escopo deste value stream..."
                style={{
                  ...FIELD_STYLE,
                  minHeight: 66,
                  lineHeight: 1.5,
                  resize: "vertical",
                }}
                value={form.mission}
              />
            </Field>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <Field label="Owner">
                <input
                  onChange={(event) =>
                    setForm((f) => ({ ...f, owner: event.target.value }))
                  }
                  placeholder="ex: Ana Ribeiro"
                  style={FIELD_STYLE}
                  value={form.owner}
                />
              </Field>

              <Field label="Investment Horizon">
                <select
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      horizonId: HORIZON_OPTIONS.includes(
                        event.target.value as (typeof HORIZON_OPTIONS)[number]
                      )
                        ? (event.target
                            .value as (typeof HORIZON_OPTIONS)[number])
                        : f.horizonId,
                    }))
                  }
                  style={FIELD_STYLE}
                  value={form.horizonId}
                >
                  {HORIZON_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <Field
                hint={`Utilização atual: ${utilPct}%`}
                label="Alocado (US$M)"
              >
                <input
                  min={0}
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      budgetAlloc: Number(event.target.value),
                    }))
                  }
                  step={0.1}
                  style={FIELD_STYLE}
                  type="number"
                  value={form.budgetAlloc}
                />
              </Field>

              <Field label="Consumido (US$M)">
                <input
                  min={0}
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      budgetSpent: Number(event.target.value),
                    }))
                  }
                  step={0.1}
                  style={FIELD_STYLE}
                  type="number"
                  value={form.budgetSpent}
                />
              </Field>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <Field label="Cycle Time (dias)">
                <input
                  min={0}
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      cycleTimeDays: Number(event.target.value),
                    }))
                  }
                  style={FIELD_STYLE}
                  type="number"
                  value={form.cycleTimeDays}
                />
              </Field>

              <Field label="Flow Efficiency (%)">
                <input
                  max={100}
                  min={0}
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      flowEfficiency: Number(event.target.value),
                    }))
                  }
                  style={FIELD_STYLE}
                  type="number"
                  value={form.flowEfficiency}
                />
              </Field>
            </div>

            <Field label="Cor / Tone">
              <select
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    tone: TONE_OPTIONS.includes(
                      event.target.value as ValueStreamTone
                    )
                      ? (event.target.value as ValueStreamTone)
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

            <Field
              hint="Selecione múltiplos com Ctrl/Cmd — vazio enquanto o backend de ARTs não está integrado."
              label="ARTs contribuintes"
            >
              <select
                disabled={artOptions.length === 0}
                multiple
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    artIds: Array.from(
                      event.target.selectedOptions,
                      (o) => o.value
                    ),
                  }))
                }
                size={4}
                style={{ ...FIELD_STYLE, height: "auto" }}
                value={form.artIds}
              >
                {artOptions.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.name}
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
