// DFS-based cycle detection for dependency links (story-042 AC-003)

export function wouldCreateCycle(
  existingLinks: Map<string, string[]>,
  newSource: string,
  newTarget: string
): boolean {
  const visited = new Set<string>();
  const stack = [newTarget];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    if (current === newSource) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const targets = existingLinks.get(current) ?? [];
    for (const t of targets) {
      stack.push(t);
    }
  }

  return false;
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
