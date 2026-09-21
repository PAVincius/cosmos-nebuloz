import Link from "next/link";
import type { CSSProperties } from "react";
import { TETO_DA_LISTA } from "@/lib/paginacao";

/**
 * Página anterior e próxima em `<Link href="?pagina=N">`, para as telas que
 * leem a página no servidor (Saúde e renovação, Benchmark, Audit Explorer).
 *
 * Link, não `<button onClick={router.push}>`: meio-clique abre em nova aba,
 * a seta de voltar desfaz, e a URL se cola num ticket — três coisas que o
 * botão com push só imitava pela metade. Os outros params da URL ficam como
 * estão; só `pagina` muda.
 *
 * Na borda (primeira página sem anterior, última sem próxima) o link não
 * existe — não vira botão desabilitado nem link para a mesma página. Com uma
 * página só e sem legenda, nada é montado; com legenda (o total do Audit),
 * ela fica mesmo sem link, porque é informação.
 */
function hrefDaPagina(
  caminho: string,
  params: Record<string, string | undefined>,
  pagina: number
): string {
  const proximos = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor && chave !== "pagina") {
      proximos.set(chave, valor);
    }
  }
  proximos.set("pagina", String(pagina));
  return `${caminho}?${proximos.toString()}`;
}

const LINK: CSSProperties = {
  padding: "6px 12px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "var(--fs-base)",
  fontWeight: 600,
  textDecoration: "none",
};

export function PaginacaoEmLinks({
  caminho,
  pagina,
  temMais,
  params = {},
  legenda,
  porPagina = TETO_DA_LISTA,
}: {
  /** O pathname da tela — `/contas`, `/audit`. */
  caminho: string;
  pagina: number;
  temMais: boolean;
  /** Os params atuais, para os links preservarem filtro e afins. */
  params?: Record<string, string | undefined>;
  /** Texto do meio; sem ele, "página N". */
  legenda?: string;
  porPagina?: number;
}) {
  if (pagina <= 1 && !temMais && legenda === undefined) {
    return null;
  }
  return (
    <nav
      aria-label="Páginas"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        paddingTop: 12,
        borderTop: "1px solid var(--hairline)",
      }}
    >
      {pagina > 1 ? (
        <Link href={hrefDaPagina(caminho, params, pagina - 1)} style={LINK}>
          ← Anterior
        </Link>
      ) : null}
      <span
        className="mono"
        style={{
          flex: 1,
          fontSize: "var(--fs-nota)",
          color: "var(--ink-faint)",
        }}
      >
        {legenda ?? `página ${pagina}`}
      </span>
      {temMais ? (
        <Link href={hrefDaPagina(caminho, params, pagina + 1)} style={LINK}>
          Próxima · {porPagina} →
        </Link>
      ) : null}
    </nav>
  );
}
