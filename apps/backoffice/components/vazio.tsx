import type { ReactNode } from "react";

/**
 * "Não há nada aqui", dizendo **por que** — nunca só a ausência.
 *
 * Três lugares do detalhe do tenant precisavam disto e cada um tinha a sua
 * cópia em Tailwind. Três cópias divergem, e divergiram: mesma moldura, três
 * paddings e dois tons de texto diferentes.
 *
 * O tracejado é o mesmo do `Pendente` do shell, e por escolha: ele já significa
 * "moldura sem conteúdo" no resto do painel. Reusar o sinal custa menos que
 * ensinar um novo.
 */
export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        padding: 24,
        textAlign: "center",
        borderRadius: "var(--r-md)",
        border: "1px dashed var(--hairline-strong)",
        color: "var(--ink-subtle)",
        fontSize: "var(--fs-base)",
        fontWeight: 500,
        lineHeight: 1.6,
      }}
    >
      {children}
    </p>
  );
}
