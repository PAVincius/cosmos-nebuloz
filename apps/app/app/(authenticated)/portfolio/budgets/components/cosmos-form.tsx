"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// ─── Shared field chrome — mirrors prototype's .fld / .fld-row / modal.css ────

const FIELD_CONTROL_STYLE = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "var(--cosmos-r-md)",
  fontSize: 13.5,
  color: "var(--ink)",
  background: "var(--canvas)",
  border: "1px solid var(--hairline-strong)",
  outline: "none",
  boxShadow: "0 2px 6px -3px rgba(0,0,0,.7) inset",
} as const;

export function FormField({
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
        {required ? <span style={{ color: "var(--accent-text)" }}>*</span> : null}
      </label>
      {children}
      {hint ? (
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{hint}</span>
      ) : null}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {children}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...FIELD_CONTROL_STYLE, ...props.style }} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        ...FIELD_CONTROL_STYLE,
        minHeight: 66,
        lineHeight: 1.5,
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...FIELD_CONTROL_STYLE, ...props.style }} />;
}

// ─── Segmented toggle — mirrors .seg / .seg-b ─────────────────────────────────

export function SegToggle<Value extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: Value; label: string }>;
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: "var(--cosmos-r-md)",
        background: "var(--canvas)",
        border: "1px solid var(--hairline-strong)",
        gap: 2,
        boxShadow: "0 2px 6px -3px rgba(0,0,0,.7) inset",
      }}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: "7px 12px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-mono, monospace)",
              color: on ? "var(--accent-text)" : "var(--ink-subtle)",
              background: on
                ? "linear-gradient(180deg,var(--surface-3),var(--surface-2))"
                : "transparent",
              boxShadow: on
                ? "0 1px 0 rgba(255,255,255,.1) inset, 0 3px 8px -3px rgba(0,0,0,.8)"
                : undefined,
              transition: "all .15s",
            }}
            type="button"
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Modal footer action buttons — mirrors .btn / .btn-primary / .btn-secondary

export function ModalFooterActions({
  onCancel,
  onSubmit,
  submitLabel,
  submitDisabled,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
}) {
  return (
    <>
      <button
        className="rounded-cosmos-md border border-hairline bg-surface-2 px-3.5 py-2 font-semibold text-[13px] text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
        onClick={onCancel}
        type="button"
      >
        Cancelar
      </button>
      <button
        className="rounded-cosmos-md bg-accent-c px-3.5 py-2 font-semibold text-[13px] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={submitDisabled}
        onClick={onSubmit}
        type="button"
      >
        {submitLabel}
      </button>
    </>
  );
}
