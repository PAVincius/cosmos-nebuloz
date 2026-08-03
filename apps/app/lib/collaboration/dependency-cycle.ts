// DFS-based cycle detection for dependency links (story-042 AC-003)

/**
 * Caminho que a nova aresta `newSource → newTarget` fecharia, ou `null` se ela
 * não fecha nada. O caminho volta na ordem em que o ciclo se lê — com A→B e
 * B→C já existentes, a nova aresta C→A devolve [A, B, C, A], que é exatamente
 * a mensagem que a story-042 AC-003 exige ("F-A → F-B → F-C → F-A").
 */
export function findCyclePath(
  existingLinks: Map<string, string[]>,
  newSource: string,
  newTarget: string
): string[] | null {
  const visited = new Set<string>();
  const path: string[] = [];

  const visit = (node: string): boolean => {
    path.push(node);
    if (node === newSource) {
      return true;
    }
    if (visited.has(node)) {
      path.pop();
      return false;
    }
    visited.add(node);
    for (const next of existingLinks.get(node) ?? []) {
      if (visit(next)) {
        return true;
      }
    }
    path.pop();
    return false;
  };

  if (!visit(newTarget)) {
    return null;
  }
  return [...path, newTarget];
}

export function wouldCreateCycle(
  existingLinks: Map<string, string[]>,
  newSource: string,
  newTarget: string
): boolean {
  return findCyclePath(existingLinks, newSource, newTarget) !== null;
}

export function buildAdjacency(
  links: Array<{ sourceFeatureId: string; targetFeatureId: string }>
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const link of links) {
    const neighbors = adj.get(link.sourceFeatureId) ?? [];
    neighbors.push(link.targetFeatureId);
    adj.set(link.sourceFeatureId, neighbors);
  }
  return adj;
}
