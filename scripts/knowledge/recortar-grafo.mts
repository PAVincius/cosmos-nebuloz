import type { Aresta, Grafo, No } from "./tipos.mts";

export function pertence(
  sourceFile: string,
  prefixos: string[],
  exclusoes: string[] = []
): boolean {
  if (exclusoes.some((e) => sourceFile.startsWith(e))) {
    return false;
  }
  return prefixos.some((p) => sourceFile.startsWith(p));
}

/** Índice de adjacência, não-direcionado: o graph.json é `directed: false`
 *  e uma aresta liga as duas pontas nos dois sentidos. */
function adjacencia(links: Aresta[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) {
      adj.set(a, new Set());
    }
    adj.get(a)?.add(b);
  };
  for (const l of links) {
    add(l.source, l.target);
    add(l.target, l.source);
  }
  return adj;
}

/**
 * Subgrafo induzido pelos nós cujo `source_file` casa um prefixo, expandido
 * `hops` níveis pelas arestas. Puro: não muta a entrada.
 *
 * `packages/*` não listados entram aqui por hop, nunca por prefixo — é o que
 * faz o recorte de um produto conter só o compartilhado que ele de fato toca.
 */
export function recortar(
  grafo: Grafo,
  prefixos: string[],
  opts: { hops?: number; exclusoes?: string[] } = {}
): Grafo {
  const hops = opts.hops ?? 2;
  const selecionados = new Set(
    grafo.nodes
      .filter((n) => pertence(n.source_file, prefixos, opts.exclusoes))
      .map((n) => n.id)
  );

  const adj = adjacencia(grafo.links);
  let fronteira = new Set(selecionados);
  for (let i = 0; i < hops; i++) {
    const proxima = new Set<string>();
    for (const id of fronteira) {
      for (const v of adj.get(id) ?? []) {
        if (!selecionados.has(v)) {
          selecionados.add(v);
          proxima.add(v);
        }
      }
    }
    if (proxima.size === 0) {
      break;
    }
    fronteira = proxima;
  }

  const nodes: No[] = grafo.nodes.filter((n) => selecionados.has(n.id));
  const links: Aresta[] = grafo.links.filter(
    (l) => selecionados.has(l.source) && selecionados.has(l.target)
  );

  const { nodes: _n, links: _l, ...topo } = grafo;
  return { ...topo, nodes, links };
}
