import type { ReactNode } from "react";

/**
 * Rótulo em cima, valor embaixo — o `MetaCell` do handoff.
 *
 * É a unidade de leitura das telas de detalhe do Big Bang: o rótulo em mono
 * maiúsculo diz o que é, o valor abaixo diz quanto. Existe como componente
 * porque as telas de tenant e de serviço usam dezenas deles, e uma cópia por
 * uso divergiria no tamanho da entreletra antes da segunda tela.
 */
export function MetaCell({
  label,
  children,
  tone,
  mono,
}: {
  label: string;
  children: ReactNode;
  /** Pinta o valor. Sempre acompanhado da palavra — cor não carrega estado
   *  sozinha (NFR-2.2). */
  tone?: "green" | "amber" | "red" | "blue" | "purple" | "accent";
  /** Números, ids e datas em mono: é o que faz um valor parecer um valor. */
  mono?: boolean;
}) {
  // Fora do JSX: inline, o ternário com undefined é lido pelo lint como valor
  // vazando para o render — mesma regra do `aria-current` do menu lateral.
  const classe: string | undefined = mono ? "mono" : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        className="mono"
        style={{
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        {label}
      </span>
      <span
        className={classe}
        style={{
          fontSize: "var(--fs-base)",
          fontWeight: 700,
          color: tone ? `var(--${tone}-text)` : "var(--ink)",
        }}
      >
        {children}
      </span>
    </div>
  );
}
