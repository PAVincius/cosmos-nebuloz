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
  fontSize: "var(--fs-base)",
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
          fontSize: "var(--fs-micro)",
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
          style={{
            fontSize: "var(--fs-nota)",
            color: "var(--ink-faint)",
            fontWeight: 500,
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Rótulo do botão de gravar, nos três estados que ele tem.
 *
 * Compartilhado entre os dois editores porque a regra é a mesma: "Sem
 * alterações" não é enfeite, é o que impede alguém de clicar esperando criar
 * revisão quando não há nada para versionar.
 */
export function rotuloSalvar(salvando: boolean, sujo: boolean): string {
  if (salvando) {
    return "Salvando…";
  }
  return sujo ? "Salvar revisão" : "Sem alterações";
}

/**
 * Mensagem legível de um erro desconhecido.
 *
 * Preserva o texto original de propósito. Tanto o bpmn-js quanto o Mermaid
 * apontam a linha do problema na mensagem; trocar por "erro ao carregar"
 * removeria exatamente o que faz a pessoa consertar.
 */
export function mensagemDeErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
        fontSize: "var(--fs-base)",
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
        fontSize: "var(--fs-forte)",
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

/**
 * Ação secundária, em linha — o par do `BotaoPrimario` para escolhas que não
 * são a principal da tela.
 *
 * Aceita `rotulo` pelo mesmo motivo que o primário: quando o texto visível é um
 * enum curto ("ACTIVE", "TRIAL"), ele se repete em cada linha da tabela e
 * sozinho não diz qual módulo será alterado. `title` não resolveria — com texto
 * dentro do botão, o conteúdo vence o title no nome acessível.
 */
export function BotaoSecundario({
  children,
  disabled,
  onClick,
  rotulo,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
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
        gap: 6,
        padding: "6px 11px",
        fontSize: "var(--fs-nota)",
        fontWeight: 700,
        fontFamily: "inherit",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--hairline-strong)",
        background: "var(--surface-2)",
        color: "var(--ink-muted)",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      type="button"
    >
      {children}
    </button>
  );
}
