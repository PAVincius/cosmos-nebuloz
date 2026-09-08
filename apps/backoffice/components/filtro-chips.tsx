"use client";

/**
 * Filtro por pílulas — o `FilterChips` do handoff.
 *
 * `aria-pressed` e não `role="tab"`: isto filtra uma lista no lugar, não troca
 * de painel. Anunciar como aba faria o leitor de tela prometer uma navegação
 * que não acontece.
 */
export function FiltroChips({
  opcoes,
  valor,
  onMudar,
  rotuloTodas = "Todas",
}: {
  opcoes: { id: string; label: string }[];
  valor: string;
  onMudar: (id: string) => void;
  rotuloTodas?: string;
}) {
  const todas = [{ id: "all", label: rotuloTodas }, ...opcoes];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {todas.map((o) => {
        const ativo = valor === o.id;
        return (
          <button
            aria-pressed={ativo}
            className="btn"
            key={o.id}
            onClick={() => onMudar(o.id)}
            style={{
              padding: "5px 11px",
              borderRadius: 99,
              fontSize: "var(--fs-nota)",
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              background: ativo ? "var(--accent-soft)" : "var(--surface-2)",
              border: `1px solid ${ativo ? "rgba(var(--accent-rgb),.45)" : "var(--hairline)"}`,
              color: ativo ? "var(--accent-text)" : "var(--ink-muted)",
            }}
            type="button"
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
