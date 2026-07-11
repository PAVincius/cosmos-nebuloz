import { CompassIcon } from "lucide-react";

export function ThemesEmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "64px 24px",
        border: "1px dashed var(--hairline)",
        borderRadius: "var(--cosmos-r-lg)",
        color: "var(--ink-subtle)",
        textAlign: "center",
      }}
    >
      <CompassIcon color="var(--ink-faint)" size={28} strokeWidth={1.5} />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink-muted)" }}>
        Nenhum tema estratégico ainda
      </p>
      <p style={{ margin: 0, fontSize: 12.5, maxWidth: 320 }}>
        Use o botão "Novo tema" no topo da página para criar o primeiro e começar a alocar
        investimento do portfolio.
      </p>
    </div>
  );
}
