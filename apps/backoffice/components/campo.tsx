import type { CSSProperties, ReactNode } from "react";

/**
 * Campo, input e mensagem de erro do handoff (BoField / boInputStyle do
 * `backoffice-shell.jsx`).
 *
 * Compartilhados porque o back-office tem dois formulários — entrar e
 * provisionar cliente — e uma segunda cópia destes estilos seria a primeira a
 * divergir. O kit do Cosmos não expõe Field, então é aqui que ele mora.
 */

export const INPUT: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-md)",
  padding: "10px 12px",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
  outline: "none",
  width: "100%",
};

export function Campo({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        className="mono"
        htmlFor={htmlFor}
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <span
          style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 500 }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Erro({ children }: { children: string }) {
  return (
    <p
      role="alert"
      style={{
        margin: 0,
        padding: "9px 11px",
        borderRadius: "var(--r-md)",
        background: "var(--red-soft)",
        border: "1px solid rgba(var(--red-rgb),.3)",
        color: "var(--red-text)",
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  );
}

/**
 * Botão de ação primária.
 *
 * `<button>` nativo com o visual da variante primary do kit, não o `Button` do
 * kit: aquele não aceita `type` nem `disabled`, então num formulário ele não
 * submete e não trava durante o envio.
 */
export function BotaoPrimario({
  children,
  disabled,
  onClick,
  type = "submit",
  full = true,
  rotulo,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "submit" | "button";
  full?: boolean;
  /** Nome acessível, quando o texto visível não basta. */
  rotulo?: string;
}) {
  return (
    <button
      aria-label={rotulo}
      className="btn"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "9px 15px",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "inherit",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--accent)",
        background: "var(--accent)",
        color: "var(--accent-fg)",
        width: full ? "100%" : "auto",
        boxShadow:
          "0 1px 2px rgba(var(--accent-rgb),.4), 0 6px 16px -8px rgba(var(--accent-rgb),.6)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      type={type === "submit" ? "submit" : "button"}
    >
      {children}
    </button>
  );
}
