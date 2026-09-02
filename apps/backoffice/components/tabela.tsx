import type { CSSProperties, ReactNode } from "react";

/**
 * Tabela do handoff (`TableHead` / `TableRow`).
 *
 * O protótipo usa `div` com `display: grid` e `grid-template-columns`. Aqui é
 * `<table>` de verdade: a marcação em grid perde a semântica, e sem ela leitor
 * de tela não anuncia "coluna 3 de 5" nem deixa navegar por célula — que é
 * exatamente o que uma tabela de usuários e de auditoria precisa dar.
 *
 * As larguras vêm por `<colgroup>` com `table-layout: fixed`, que é o
 * equivalente honesto do `grid-template-columns` do desenho: uma declaração por
 * tabela, e as células herdam.
 */

const CELULA: CSSProperties = {
  padding: "10px 16px",
  verticalAlign: "middle",
  borderBottom: "1px solid var(--hairline)",
  fontSize: "var(--fs-base)",
};

export function Tabela({
  larguras,
  children,
}: {
  /** Uma por coluna: `{ id, largura }`. O id é a chave do `<col>` — usar o
   *  índice seria mais curto, mas a regra que o proíbe existe para não depender
   *  de "esta lista nunca reordena". */
  larguras: { id: string; largura: string }[];
  children: ReactNode;
}) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
      }}
    >
      <colgroup>
        {larguras.map((c) => (
          <col key={c.id} style={{ width: c.largura }} />
        ))}
      </colgroup>
      {children}
    </table>
  );
}

export function TableHead({ labels }: { labels: string[] }) {
  return (
    <thead>
      <tr>
        {labels.map((l) => (
          <th
            className="mono"
            key={l}
            scope="col"
            style={{
              ...CELULA,
              textAlign: "left",
              background: "var(--surface-2)",
              fontSize: "var(--fs-micro)",
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            {l}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** A linha é só `<tr>`. A borda mora na célula, porque `border-bottom` em
 *  `<tr>` não pinta com `border-collapse` em todos os navegadores — e é a
 *  célula que sabe se é da última linha. */
export function TableRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

export function Celula({
  children,
  last,
  style,
}: {
  children: ReactNode;
  last?: boolean;
  style?: CSSProperties;
}) {
  return (
    <td
      style={{
        ...CELULA,
        borderBottom: last ? "none" : CELULA.borderBottom,
        ...style,
      }}
    >
      {children}
    </td>
  );
}
