import { Icon } from "@repo/design-system/cosmos/icons";
import type { CSSProperties } from "react";

/**
 * "Exportar CSV" — um link, não um botão com `fetch`.
 *
 * A rota de exportação responde `Content-Disposition: attachment`, então o
 * navegador baixa sozinho: funciona sem JS, o filtro vai na própria URL, e
 * ctrl+clique ou "copiar link" dão o mesmo arquivo. `<a>` e não o `<Link>` do
 * Next de propósito: o destino é uma rota de dados, não uma tela — o
 * roteador tentaria pré-carregá-la como página.
 */
const ESTILO: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "6px 11px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface-2)",
  color: "var(--ink-muted)",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export function LinkExportarCsv({ href }: { href: string }) {
  return (
    <a className="btn" download href={href} style={ESTILO}>
      <Icon name="download" size={14} />
      Exportar CSV
    </a>
  );
}
