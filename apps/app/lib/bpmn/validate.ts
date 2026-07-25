// BPMN graph validation — story-028 pure logic

export const ALLOWED_BPMN_ELEMENTS = [
  "bpmn:StartEvent",
  "bpmn:EndEvent",
  "bpmn:Task",
  "bpmn:ExclusiveGateway",
  "bpmn:SequenceFlow",
] as const;

export type BpmnNode = {
  id: string;
  type: string;
};

export type BpmnFlow = {
  sourceId: string;
  targetId: string;
};

export type ValidationError = {
  code: "DISCONNECTED_GATEWAY" | "UNREACHABLE_STATE" | "UNSUPPORTED_ELEMENT";
  nodeId?: string;
  message: string;
};

export function isAllowedElement(type: string): boolean {
  return (
    ALLOWED_BPMN_ELEMENTS.includes(
      type as (typeof ALLOWED_BPMN_ELEMENTS)[number]
    ) || type.startsWith("cosmos:")
  );
}

export function findDisconnectedGateways(
  nodes: BpmnNode[],
  flows: BpmnFlow[]
): string[] {
  const gateways = nodes.filter((n) => n.type === "bpmn:ExclusiveGateway");
  return gateways
    .filter((g) => {
      const incoming = flows.some((f) => f.targetId === g.id);
      const outgoing = flows.some((f) => f.sourceId === g.id);
      return !(incoming && outgoing);
    })
    .map((g) => g.id);
}

export function findUnreachableStates(
  nodes: BpmnNode[],
  flows: BpmnFlow[],
  startId: string
): string[] {
  const reachable = new Set<string>([startId]);
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const flow of flows) {
      if (flow.sourceId === current && !reachable.has(flow.targetId)) {
        reachable.add(flow.targetId);
        queue.push(flow.targetId);
      }
    }
  }

  return nodes
    .filter((n) => n.type !== "bpmn:SequenceFlow" && !reachable.has(n.id))
    .map((n) => n.id);
}

export function validateBpmnGraph(
  nodes: BpmnNode[],
  flows: BpmnFlow[],
  startId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of nodes) {
    if (!isAllowedElement(node.type)) {
      errors.push({
        code: "UNSUPPORTED_ELEMENT",
        nodeId: node.id,
        message: `Unsupported element: ${node.type}`,
      });
    }
  }

  for (const id of findDisconnectedGateways(nodes, flows)) {
    errors.push({
      code: "DISCONNECTED_GATEWAY",
      nodeId: id,
      message: `Gateway ${id} is missing incoming or outgoing flows`,
    });
  }

  for (const id of findUnreachableStates(nodes, flows, startId)) {
    errors.push({
      code: "UNREACHABLE_STATE",
      nodeId: id,
      message: `State ${id} is unreachable from start`,
    });
  }

  return errors;
}
