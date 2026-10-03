import type { RespondentErrorCopy } from "@/lib/meridian/respondent-error-copy";

// Cartão de aviso da superfície do respondente: link inválido, coleta encerrada,
// teto de tentativas. Sem sessão, então só texto seguro, nunca detalhe interno.
export function RespondentNotice({ title, body }: RespondentErrorCopy) {
  return (
    <div className="meridian-root" style={{ minHeight: "100dvh" }}>
      <main
        style={{
          maxWidth: 520,
          margin: "16vh auto",
          padding: 28,
          borderRadius: 18,
          border: "1px solid var(--hairline)",
          background: "var(--surface)",
          color: "var(--ink)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
            marginBottom: 10,
          }}
        >
          Meridian · Bateria de prontidão
        </div>
        <h1
          className="display"
          style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: "var(--ink-muted)",
            margin: 0,
          }}
        >
          {body}
        </p>
      </main>
    </div>
  );
}
