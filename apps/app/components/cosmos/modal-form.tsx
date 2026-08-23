"use client";

// modal-form.tsx — primitivas de formulário dos modais, portadas do design
// de referência (Claude Design, cosmos-modal.jsx).
//
// Existiam como `const inputStyle` copiado em 15 telas, cada cópia com raio,
// padding e borda um pouco diferentes, nenhuma com foco visível nem validação.
// Aqui a aparência e o comportamento vivem num lugar só, com as medidas do
// design: 9px 11px de padding, 13.5px de corpo, `--r-md` no raio.
//
// O que o design não trazia e foi mantido daqui: foco visível, `aria-invalid`
// e erro anunciado por `role="alert"` — teclado e leitor de tela são parte da
// qualidade que estes modais precisavam ter.
import { Icon } from "@repo/design-system/cosmos/icons";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useId,
  useState,
} from "react";

/** Sinaliza "a pessoa já digitou" para o modal confirmar antes de descartar. */
const DirtyCtx = createContext<{ markDirty: () => void }>({
  markDirty: () => {
    // Fora de um modal, digitar não precisa avisar ninguém.
  },
});
export const DirtyProvider = DirtyCtx.Provider;
export const useDirty = () => useContext(DirtyCtx);

const campoBase: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-md)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
  padding: "9px 11px",
  width: "100%",
};

const estiloErro: CSSProperties = {
  borderColor: "var(--red-text)",
  boxShadow: "0 0 0 2px rgba(var(--red-rgb),.15)",
};

function anelDeFoco(el: HTMLElement, erro: boolean) {
  el.style.borderColor = erro
    ? "var(--red-text)"
    : "rgba(var(--accent-rgb),.7)";
  el.style.boxShadow = `0 0 0 3px rgba(var(--${erro ? "red" : "accent"}-rgb),.18)`;
}

function limpaAnel(el: HTMLElement, erro: boolean) {
  el.style.borderColor = erro ? "var(--red-text)" : "var(--hairline-strong)";
  el.style.boxShadow = erro ? (estiloErro.boxShadow ?? "none") : "none";
}

function MensagemErro({ id, texto }: { id: string; texto: string }) {
  return (
    <span
      id={id}
      role="alert"
      style={{
        alignItems: "center",
        color: "var(--red-text)",
        display: "flex",
        fontSize: 11,
        fontWeight: 600,
        gap: 4,
        marginTop: -2,
      }}
    >
      <Icon name="alert" size={11} strokeWidth={2.4} />
      {texto}
    </span>
  );
}

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
    // O label envolve o controle: dispensa casar id com htmlFor em cada uso,
    // que é de onde vinham os campos sem rótulo associado.
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{ color: "var(--ink-subtle)", fontSize: 12.5, fontWeight: 700 }}
      >
        {label}
        {required && <span style={{ color: "var(--red-text)" }}> *</span>}
      </span>
      {children}
      {hint && (
        <span
          style={{
            color: "var(--ink-faint)",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

type CampoTextoProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  type?: "text" | "number" | "password" | "email";
  style?: CSSProperties;
};

export function TextInput({
  value,
  onChange,
  placeholder,
  required,
  disabled,
  type = "text",
  style,
}: CampoTextoProps) {
  const { markDirty } = useDirty();
  const [erro, setErro] = useState("");
  const erroId = useId();
  return (
    <>
      <input
        aria-describedby={erro ? erroId : undefined}
        aria-invalid={erro ? true : undefined}
        disabled={disabled}
        onBlur={(e) => {
          const vazio = required && !e.target.value.trim();
          setErro(vazio ? "Campo obrigatório" : "");
          limpaAnel(e.currentTarget, Boolean(vazio));
        }}
        onChange={(e) => {
          markDirty();
          setErro("");
          onChange(e.target.value);
        }}
        onFocus={(e) => anelDeFoco(e.currentTarget, Boolean(erro))}
        placeholder={placeholder}
        style={{
          ...campoBase,
          ...(erro ? estiloErro : {}),
          ...(disabled ? { cursor: "not-allowed", opacity: 0.6 } : {}),
          ...style,
        }}
        type={type}
        value={value}
      />
      {erro && <MensagemErro id={erroId} texto={erro} />}
    </>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  required,
  rows = 3,
}: CampoTextoProps & { rows?: number }) {
  const { markDirty } = useDirty();
  const [erro, setErro] = useState("");
  const erroId = useId();
  return (
    <>
      <textarea
        aria-describedby={erro ? erroId : undefined}
        aria-invalid={erro ? true : undefined}
        onBlur={(e) => {
          const vazio = required && !e.target.value.trim();
          setErro(vazio ? "Campo obrigatório" : "");
          limpaAnel(e.currentTarget, Boolean(vazio));
        }}
        onChange={(e) => {
          markDirty();
          setErro("");
          onChange(e.target.value);
        }}
        onFocus={(e) => anelDeFoco(e.currentTarget, Boolean(erro))}
        placeholder={placeholder}
        rows={rows}
        style={{
          ...campoBase,
          lineHeight: 1.5,
          resize: "vertical",
          ...(erro ? estiloErro : {}),
        }}
        value={value}
      />
      {erro && <MensagemErro id={erroId} texto={erro} />}
    </>
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const { markDirty } = useDirty();
  return (
    <select
      onBlur={(e) => limpaAnel(e.currentTarget, false)}
      onChange={(e) => {
        markDirty();
        onChange(e.target.value);
      }}
      onFocus={(e) => anelDeFoco(e.currentTarget, false)}
      style={campoBase}
      value={value}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Enum curto — Size (S/M/L/XL), story points, horizonte. */
export function Segmented({
  options,
  value,
  onChange,
  tone = "accent",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  tone?: string;
}) {
  return (
    <fieldset
      style={{ border: "none", display: "flex", gap: 6, margin: 0, padding: 0 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            aria-pressed={on}
            className="btn"
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              background: on ? `var(--${tone}-soft)` : "var(--surface)",
              border: `1px solid ${on ? `rgba(var(--${tone}-rgb),.4)` : "var(--hairline-strong)"}`,
              borderRadius: "var(--r-md)",
              color: on ? `var(--${tone}-text)` : "var(--ink-muted)",
              flex: 1,
              fontSize: 12.5,
              fontWeight: 700,
              padding: "8px 6px",
            }}
            type="button"
          >
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

/** Dimensão de WSJF — valor à direita do rótulo, como no design. */
export function MiniSlider({
  label,
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          color: "var(--ink-subtle)",
          display: "flex",
          fontSize: 11.5,
          fontWeight: 600,
          justifyContent: "space-between",
        }}
      >
        <span>{label}</span>
        <span className="mono" style={{ color: "var(--ink)", fontWeight: 700 }}>
          {value}
        </span>
      </span>
      <input
        max={max}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: "var(--accent)", width: "100%" }}
        type="range"
        value={value}
      />
    </label>
  );
}

const TONES = ["accent", "blue", "purple", "green", "amber", "red"] as const;

/** Cor/tone da entidade — os seis do design, com estado selecionado visível. */
export function TonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset
      style={{ border: "none", display: "flex", gap: 8, margin: 0, padding: 0 }}
    >
      {TONES.map((t) => {
        const on = t === value;
        return (
          <button
            aria-label={`Cor ${t}`}
            aria-pressed={on}
            key={t}
            onClick={() => onChange(t)}
            style={{
              background: `var(--${t})`,
              border: on ? "2px solid var(--ink)" : "2px solid transparent",
              borderRadius: "50%",
              cursor: "pointer",
              height: 26,
              outline: on ? "1px solid var(--hairline-strong)" : "none",
              outlineOffset: 2,
              width: 26,
            }}
            type="button"
          />
        );
      })}
    </fieldset>
  );
}
