import type { CSSProperties, ReactNode } from "react";

/**
 * "Deu certo", dito em texto e no lugar da ação.
 *
 * O painel repetia o mesmo `<output>` verde em cinco telas, cada uma com a sua
 * cópia dos estilos — e cópias divergem. `<output>` já traz `role="status"`
 * de fábrica; o `aria-live="polite"` explícito é o que garante o anúncio
 * também onde o navegador não infere o papel do elemento.
 *
 * Renderize junto do controle que agiu (a linha, o botão, o cartão), não no
 * topo da página: quem clicou está olhando para o botão, e o leitor de tela
 * lê o status onde ele nasce.
 */
const TONS: Record<"ok" | "neutro", CSSProperties> = {
  ok: {
    background: "var(--green-soft)",
    border: "1px solid rgba(var(--green-rgb),.3)",
    color: "var(--green-text)",
  },
  neutro: {
    background: "var(--surface-2)",
    border: "1px solid var(--hairline-strong)",
    color: "var(--ink-muted)",
  },
};

export function Confirmacao({
  children,
  tom = "ok",
}: {
  children: ReactNode;
  /** `ok` é o verde de sucesso; `neutro` para "nada mudou" ou aviso brando. */
  tom?: "ok" | "neutro";
}) {
  return (
    <output
      aria-live="polite"
      style={{
        display: "block",
        padding: "9px 11px",
        borderRadius: "var(--r-md)",
        fontSize: "var(--fs-base)",
        fontWeight: 600,
        lineHeight: 1.5,
        ...TONS[tom],
      }}
    >
      {children}
    </output>
  );
}
