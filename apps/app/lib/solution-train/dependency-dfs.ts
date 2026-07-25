type DependencyEdge = { from: string; to: string };

export type DfsResult =
  | { hasCycle: false }
  | { hasCycle: true; cycle: string[] };

export function detectCycleDfs(
  nodes: string[],
  edges: DependencyEdge[]
): DfsResult {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node, []);
  }
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from);
    if (neighbors) {
      neighbors.push(edge.to);
    }
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) {
    color.set(node, WHITE);
  }

  const path: string[] = [];

  function dfs(node: string): string[] | null {
    color.set(node, GRAY);
    path.push(node);
    const neighbors = adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      const c = color.get(neighbor) ?? WHITE;
      if (c === GRAY) {
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart);
      }
      if (c === WHITE) {
        const result = dfs(neighbor);
        if (result) {
          return result;
        }
      }
    }
    path.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const node of nodes) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const cycle = dfs(node);
      if (cycle) {
        return { hasCycle: true, cycle };
      }
    }
  }

  return { hasCycle: false };
}
