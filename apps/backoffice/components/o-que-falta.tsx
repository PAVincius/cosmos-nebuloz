/**
 * "Para criar: código, nome e cliente." — a frase ao lado do submit cinza.
 *
 * Um botão desabilitado sem dizer por quê faz a pessoa reler o formulário
 * procurando o que esqueceu. O gerador de propostas já dizia o que falta
 * (`gerador-envio.tsx`); isto é a mesma frase, com os itens que ainda faltam
 * — só eles, para a lista encurtar conforme o formulário se completa.
 */
export function OQueFalta({
  verbo,
  itens,
}: {
  /** O verbo do botão: "criar", "cadastrar". */
  verbo: string;
  /** Só o que ainda falta; vazio não renderiza nada. */
  itens: string[];
}) {
  if (itens.length === 0) {
    return null;
  }
  return (
    <span style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>
      Para {verbo}: {listar(itens)}.
    </span>
  );
}

function listar(itens: string[]): string {
  if (itens.length === 1) {
    return itens[0];
  }
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}
