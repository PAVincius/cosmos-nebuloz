// Strategy Map DAG construction — story-031 pure logic

export type DagNode = {
  id: string;
  type: "THEME" | "OKR" | "EPIC" | "FEATURE";
  parentId: string | null;
};

export type AlignmentGap = {
  entityId: string;
  entityType: string;
  type: "UNLINKED_EPIC" | "OKR_AT_RISK";
};

export function findOrphans(nodes: DagNode[]): DagNode[] {
  const ids = new Set(nodes.map((n) => n.id));
  return nodes.filter((n) => n.parentId !== null && !ids.has(n.parentId));
}

export function findUnlinkedEpics(nodes: DagNode[]): string[] {
  return nodes
    .filter((n) => n.type === "EPIC" && n.parentId === null)
    .map((n) => n.id);
}

export function detectAlignmentGaps(
  nodes: DagNode[],
  atRiskOkrIds: string[]
): AlignmentGap[] {
  const gaps: AlignmentGap[] = [];

  for (const epicId of findUnlinkedEpics(nodes)) {
    gaps.push({ entityId: epicId, entityType: "EPIC", type: "UNLINKED_EPIC" });
  }

  for (const okrId of atRiskOkrIds) {
    gaps.push({ entityId: okrId, entityType: "OKR", type: "OKR_AT_RISK" });
  }

  return gaps;
}

export function buildAncestorBreadcrumb(
  nodes: DagNode[],
  nodeId: string
): string[] {
  const index = new Map(nodes.map((n) => [n.id, n]));
  const breadcrumb: string[] = [];
  let current = index.get(nodeId);

  while (current) {
    breadcrumb.unshift(current.id);
    current = current.parentId ? index.get(current.parentId) : undefined;
  }

  return breadcrumb;
}
