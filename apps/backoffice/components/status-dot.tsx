export type Tom =
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "purple"
  | "accent"
  | "neutral";

/**
 * Ponto colorido mais palavra — o `StatusDot` do handoff.
 *
 * Difere do `Badge` de propósito: o badge é uma pílula com fundo, usada quando
 * o estado é o assunto da célula; o ponto é discreto, para quando o estado
 * acompanha um nome e a pílula competiria com ele.
 *
 * A palavra nunca é opcional. Cor sozinha não carrega estado (NFR-2.2) — quem
 * não distingue verde de âmbar continua lendo "Ativo" e "Convidado".
 */
export function StatusDot({ tom, children }: { tom: Tom; children: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: "var(--fs-nota)",
        fontWeight: 600,
        color: "var(--ink-muted)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: 99,
          flexShrink: 0,
          background: tom === "neutral" ? "var(--ink-faint)" : `var(--${tom})`,
          boxShadow:
            tom === "neutral"
              ? "none"
              : `0 0 7px 1px rgba(var(--${tom}-rgb),.5)`,
        }}
      />
      {children}
    </span>
  );
}
