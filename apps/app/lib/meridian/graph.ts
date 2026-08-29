// DAG de gaps.
//
// Uma aresta `from → to` significa "from depende de to": `to` é pré-requisito.
// Ciclo é recusado na escrita, dentro da mesma transação da inserção. Aceitar
// o ciclo e falhar depois, na geração do plano, transformaria um erro de
// modelagem de dez segundos atrás num bug de meses depois.

export type GraphEdge = { from: string; to: string };
export type GraphGap = { code: string; costOfDelay: number };

/**
 * Devolve o ciclo encontrado como lista de códigos (fechando no primeiro), ou
 * `null` se o grafo é acíclico. DFS tri-estado — branco (não visitado), cinza
 * (na pilha atual), preto (fechado): reencontrar um cinza é o ciclo, e a pilha
 * atual é o caminho que a mensagem de erro precisa nomear.
 */
export function detectCycle(edges: GraphEdge[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const list = adjacency.get(e.from);
    if (list) {
      list.push(e.to);
    } else {
      adjacency.set(e.from, [e.to]);
    }
  }

  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  let found: string[] | null = null;

  const visit = (node: string): boolean => {
    color.set(node, GREY);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GREY) {
        found = [...stack.slice(stack.indexOf(next)), next];
        return true;
      }
      if (c === WHITE && visit(next)) {
        return true;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return false;
  };

  const nodes = [...new Set(edges.flatMap((e) => [e.from, e.to]))].sort();
  for (const node of nodes) {
    if ((color.get(node) ?? WHITE) === WHITE && visit(node)) {
      return found;
    }
  }
  return null;
}

/**
 * Ordenação topológica por Kahn, com desempate explícito: custo de atraso
 * decrescente e, empatando, código crescente. O desempate não é cosmético — sem
 * ele a ordem depende da ordem de leitura do banco, e dois planos gerados da
 * mesma base sairiam diferentes.
 *
 * Aresta que aponta para fora do conjunto é ignorada: quando o consultor gera
 * o plano de um assessment, gaps de outro run não entram no sequenciamento.
 */
export function topologicalOrder(
  gaps: GraphGap[],
  edges: GraphEdge[]
): string[] {
  const present = new Set(gaps.map((g) => g.code));
  const internal = edges.filter(
    (e) => present.has(e.from) && present.has(e.to)
  );

  const cycle = detectCycle(internal);
  if (cycle) {
    throw new Error(`Ciclo de dependências: ${cycle.join(" → ")}`);
  }

  const indegree = new Map<string, number>(gaps.map((g) => [g.code, 0]));
  const dependents = new Map<string, string[]>();
  for (const e of internal) {
    // `from` depende de `to`, então `to` precede: a aresta de ordenação é to → from.
    indegree.set(e.from, (indegree.get(e.from) ?? 0) + 1);
    const list = dependents.get(e.to);
    if (list) {
      list.push(e.from);
    } else {
      dependents.set(e.to, [e.from]);
    }
  }

  const byCode = new Map(gaps.map((g) => [g.code, g]));
  const rank = (code: string): [number, string] => [
    -(byCode.get(code)?.costOfDelay ?? 0),
    code,
  ];
  const pick = (ready: string[]): string => {
    let best = ready[0] as string;
    for (const c of ready) {
      const [rc, cc] = rank(c);
      const [rb, cb] = rank(best);
      if (rc < rb || (rc === rb && cc < cb)) {
        best = c;
      }
    }
    return best;
  };

  const ready = gaps
    .filter((g) => indegree.get(g.code) === 0)
    .map((g) => g.code);
  const order: string[] = [];
  while (ready.length > 0) {
    const next = pick(ready);
    ready.splice(ready.indexOf(next), 1);
    order.push(next);
    for (const dep of dependents.get(next) ?? []) {
      const left = (indegree.get(dep) ?? 0) - 1;
      indegree.set(dep, left);
      if (left === 0) {
        ready.push(dep);
      }
    }
  }

  if (order.length !== gaps.length) {
    throw new Error("Ciclo de dependências detectado durante a ordenação.");
  }
  return order;
}

/** Profundidade topológica de cada gap — usada pelo grafo em colunas da UI. */
export function depthOf(
  gaps: GraphGap[],
  edges: GraphEdge[]
): Map<string, number> {
  const present = new Set(gaps.map((g) => g.code));
  const prereqs = new Map<string, string[]>();
  for (const e of edges) {
    if (!(present.has(e.from) && present.has(e.to))) {
      continue;
    }
    const list = prereqs.get(e.from);
    if (list) {
      list.push(e.to);
    } else {
      prereqs.set(e.from, [e.to]);
    }
  }
  const depth = new Map<string, number>();
  const walk = (code: string, seen: Set<string>): number => {
    const cached = depth.get(code);
    if (cached !== undefined) {
      return cached;
    }
    if (seen.has(code)) {
      throw new Error(`Ciclo de dependências em ${code}`);
    }
    seen.add(code);
    const parents = prereqs.get(code) ?? [];
    const d = parents.length
      ? 1 + Math.max(...parents.map((p) => walk(p, seen)))
      : 0;
    seen.delete(code);
    depth.set(code, d);
    return d;
  };
  for (const g of gaps) {
    walk(g.code, new Set());
  }
  return depth;
}
