"use client";

// form-kit.tsx — port de `charter-modal.jsx` (primitivas de formulário).
//
// São do Charter, não do Cosmos, pelo motivo que o próprio handoff dá: os
// formulários de política não podem herdar campos específicos de SAFe.
//
// `useDirty` alimenta a confirmação de descarte do ModalHost: todo controle
// marca o formulário como sujo ao mudar, e fechar com campo preenchido pergunta
// antes de jogar fora — num produto onde o formulário é o registro de auditoria,
// perder digitação por clique no backdrop é caro.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import type { Tone } from "@repo/design-system/cosmos/kit";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useId,
} from "react";
import { FS } from "./type-scale";

export const DirtyCtx = createContext<{ markDirty: () => void }>({
  markDirty: () => {
    /* noop fora de um ModalHost */
  },
});
export const useDirty = () => useContext(DirtyCtx);

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: FS.base,
  fontFamily: "inherit",
};

// ── FormField ─────────────────────────────────────────────────────────────────

export function FormField({
  label,
  required,
  hint,
  children,
  error,
  variant = "field",
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  error?: string;
  /** "group": o filho é um conjunto de vários <button> (Segmented/RadioCards)
   *  — um <label> associaria o rótulo só ao primeiro botão, deixando o resto
   *  sem nome acessível. Renderiza role="group" + aria-labelledby em vez de
   *  <label> (evitamos <fieldset>: dentro do grid/flex dos modais ele tem o
   *  quirk de min-width que quebra colunas "1fr 1fr"). */
  variant?: "field" | "group";
}) {
  const groupLabelId = useId();
  const isGroup = variant === "group";

  const labelNode = (
    <span
      id={isGroup ? groupLabelId : undefined}
      style={{
        fontSize: FS.nota,
        fontWeight: 700,
        color: "var(--ink)",
        display: "flex",
        gap: 5,
        alignItems: "center",
      }}
    >
      {label}
      {required && <span style={{ color: "var(--red-text)" }}>*</span>}
    </span>
  );

  // Erro substitui a dica: quando os dois existem, o erro é o que importa.
  const footerNode = error ? (
    <span
      style={{
        fontSize: FS.nota,
        color: "var(--red-text)",
        display: "flex",
        gap: 5,
        alignItems: "center",
      }}
    >
      <Icon name="alert" size={12} />
      {error}
    </span>
  ) : (
    hint && (
      <span
        style={{
          fontSize: FS.nota,
          color: "var(--ink-faint)",
          lineHeight: 1.45,
        }}
      >
        {hint}
      </span>
    )
  );

  if (isGroup) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: <fieldset> tem quirk de min-width que quebra as colunas "1fr 1fr" dos modais quando ele é filho de grid/flex — mesma lógica do biome-ignore de CheckRow, mais abaixo neste arquivo
      <div
        aria-labelledby={groupLabelId}
        role="group"
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        {labelNode}
        {children}
        {footerNode}
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: o controle é o children — todo uso passa um input/select/textarea ou um grupo com aria-label próprio
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {labelNode}
      {children}
      {footerNode}
    </label>
  );
}

// ── Controles ─────────────────────────────────────────────────────────────────

export function TextInput({
  style,
  onChange,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const { markDirty } = useDirty();
  return (
    <input
      {...props}
      onChange={(e) => {
        markDirty();
        onChange?.(e);
      }}
      style={{ ...inputStyle, ...style }}
    />
  );
}

export function TextArea({
  style,
  onChange,
  rows = 3,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { markDirty } = useDirty();
  return (
    <textarea
      {...props}
      onChange={(e) => {
        markDirty();
        onChange?.(e);
      }}
      rows={rows}
      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55, ...style }}
    />
  );
}

export type SelectOption = { value: string; label: string } | string;

export function Select({
  options,
  style,
  onChange,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: SelectOption[];
}) {
  const { markDirty } = useDirty();
  return (
    <select
      {...props}
      onChange={(e) => {
        markDirty();
        onChange?.(e);
      }}
      style={{
        ...inputStyle,
        cursor: "pointer",
        appearance: "none",
        // Seta desenhada em CSS: appearance:none remove a nativa, e um ícone
        // absoluto exigiria um wrapper que quebraria o <label> do FormField.
        backgroundImage:
          "linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%)",
        backgroundPosition: "calc(100% - 16px) 52%,calc(100% - 11px) 52%",
        backgroundSize: "5px 5px,5px 5px",
        backgroundRepeat: "no-repeat",
        paddingRight: 30,
        ...style,
      }}
    >
      {options.map((o) => {
        const value = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

export type SegmentedOption =
  | { value: string; label?: string; tone?: Tone }
  | string;

/** 2–5 opções de enum curtas, sempre visíveis. Nunca para lista longa —
 *  esconder alternativa esconde consequência. */
export function Segmented({
  options,
  value,
  onChange,
  tone = "accent",
  full,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
  tone?: Tone;
  full?: boolean;
}) {
  const { markDirty } = useDirty();
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lab = typeof o === "string" ? o : (o.label ?? o.value);
        const t = typeof o === "string" ? tone : (o.tone ?? tone);
        const on = val === value;
        return (
          <button
            aria-pressed={on}
            className="btn"
            key={val}
            onClick={() => {
              markDirty();
              onChange(val);
            }}
            style={{
              flex: full ? 1 : "none",
              padding: "7px 13px",
              borderRadius: "var(--r-sm)",
              fontSize: FS.base,
              fontWeight: 700,
              cursor: "pointer",
              border: `1px solid ${on ? `rgba(var(--${t}-rgb),.4)` : "var(--hairline-strong)"}`,
              background: on ? `var(--${t}-soft)` : "var(--surface)",
              color: on ? `var(--${t}-text)` : "var(--ink-muted)",
              boxShadow: on ? `0 0 0 3px rgba(var(--${t}-rgb),.10)` : "none",
            }}
            type="button"
          >
            {lab}
          </button>
        );
      })}
    </div>
  );
}

export type RadioCardOption = {
  value: string;
  label: string;
  desc?: string;
  tone?: Tone;
  icon?: IconName;
};

/** Opção com título + razão. Para decisão que precisa ser explicada — é o
 *  controle da tela de decisão, onde escolher errado tem consequência. */
export function RadioCards({
  options,
  value,
  onChange,
  cols = 1,
}: {
  options: RadioCardOption[];
  value: string;
  onChange: (v: string) => void;
  cols?: number;
}) {
  const { markDirty } = useDirty();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
        gap: 9,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        const t = o.tone ?? "accent";
        return (
          <button
            aria-pressed={on}
            key={o.value}
            onClick={() => {
              markDirty();
              onChange(o.value);
            }}
            style={{
              display: "flex",
              gap: 11,
              alignItems: "flex-start",
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              border: `1.5px solid ${on ? `var(--${t})` : "var(--hairline)"}`,
              background: on ? `rgba(var(--${t}-rgb),.09)` : "var(--surface-2)",
              boxShadow: on ? `0 0 0 3px rgba(var(--${t}-rgb),.12)` : "none",
              transition: "all .16s ease",
            }}
            type="button"
          >
            {o.icon && (
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 99,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  background: on ? `var(--${t})` : "var(--surface-3)",
                  color: on ? "var(--accent-fg)" : "var(--ink-faint)",
                }}
              >
                <Icon name={o.icon} size={13} strokeWidth={2.3} />
              </span>
            )}
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: FS.base,
                  fontWeight: 700,
                  color: on ? `var(--${t}-text)` : "var(--ink)",
                }}
              >
                {o.label}
              </span>
              {o.desc && (
                <span
                  style={{
                    display: "block",
                    fontSize: FS.nota,
                    color: "var(--ink-muted)",
                    marginTop: 3,
                    lineHeight: 1.5,
                  }}
                >
                  {o.desc}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Critério / cláusula / artefato. O burro de carga da UI de governança. */
export function CheckRow({
  checked,
  onToggle,
  label,
  hint,
  tone = "green",
  disabled,
  right,
}: {
  checked: boolean;
  onToggle?: () => void;
  label: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  disabled?: boolean;
  right?: ReactNode;
}) {
  // `label` pode ser ReactNode (ex.: trecho em negrito) — aria-label só
  // aceita string, então o nome acessível vem de aria-labelledby apontando
  // pro elemento que já renderiza `label` visivelmente, seja qual for o tipo.
  const labelId = useId();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "9px 4px",
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: <input type="checkbox"> não dá pro visual (ícone de check + borda por tone) que o resto do form-kit usa em <button> — mesmo padrão de Segmented/RadioCards */}
      <button
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => !disabled && onToggle?.()}
        role="checkbox"
        style={{
          width: 18,
          height: 18,
          marginTop: 1,
          flexShrink: 0,
          borderRadius: 5,
          padding: 0,
          display: "grid",
          placeItems: "center",
          cursor: disabled ? "default" : "pointer",
          border: `1.5px solid ${checked ? `var(--${tone})` : "var(--hairline-strong)"}`,
          background: checked ? `var(--${tone})` : "transparent",
          opacity: disabled && !checked ? 0.5 : 1,
        }}
        type="button"
      >
        {checked && (
          <Icon
            name="check"
            size={11}
            strokeWidth={3}
            style={{ color: "var(--accent-fg)" }}
          />
        )}
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          id={labelId}
          style={{
            fontSize: FS.base,
            fontWeight: 600,
            color: checked ? "var(--ink-muted)" : "var(--ink)",
            lineHeight: 1.45,
          }}
        >
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontSize: FS.nota,
              color: "var(--ink-faint)",
              marginTop: 2,
              lineHeight: 1.45,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

/** A faixa de "por que isso importa". Mantém a razão fora de tooltip — num
 *  produto de governança, a justificativa precisa estar na tela, não no hover. */
export function Callout({
  tone = "accent",
  icon = "target",
  children,
  style,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        fontSize: FS.base,
        lineHeight: 1.6,
        color: "var(--ink-muted)",
        padding: "11px 13px",
        borderRadius: 9,
        background: `rgba(var(--${tone}-rgb),.07)`,
        border: `1px solid rgba(var(--${tone}-rgb),.2)`,
        ...style,
      }}
    >
      <Icon
        name={icon}
        size={14}
        style={{
          color: `var(--${tone}-text)`,
          marginTop: 2,
          flexShrink: 0,
        }}
      />
      <span>{children}</span>
    </div>
  );
}

export function FooterHint({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: FS.nota,
        color: "var(--ink-faint)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
    </span>
  );
}

/** Tecla renderizada em dica de rodapé (`<kbd>esc</kbd> cancelar`). */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="mono"
      style={{
        fontSize: FS.micro,
        fontWeight: 700,
        padding: "1px 5px",
        borderRadius: 4,
        background: "var(--chip-bg)",
        border: "1px solid var(--hairline)",
        color: "var(--ink-muted)",
      }}
    >
      {children}
    </kbd>
  );
}
