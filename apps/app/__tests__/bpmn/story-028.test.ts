import { describe, expect, it } from "vitest";
import {
  ALLOWED_BPMN_ELEMENTS,
  type BpmnFlow,
  type BpmnNode,
  findDisconnectedGateways,
  findUnreachableStates,
  isAllowedElement,
  validateBpmnGraph,
} from "../../lib/bpmn/validate";

const mkNode = (id: string, type: string): BpmnNode => ({ id, type });
const mkFlow = (sourceId: string, targetId: string): BpmnFlow => ({
  sourceId,
  targetId,
});

describe("isAllowedElement (AC-001)", () => {
  it("allows all standard BPMN elements", () => {
    for (const el of ALLOWED_BPMN_ELEMENTS) {
      expect(isAllowedElement(el)).toBe(true);
    }
  });

  it("allows cosmos:* extension elements", () => {
    expect(isAllowedElement("cosmos:WaitEvent")).toBe(true);
    expect(isAllowedElement("cosmos:CustomTask")).toBe(true);
  });

  it("rejects unknown bpmn: elements", () => {
    expect(isAllowedElement("bpmn:SubProcess")).toBe(false);
    expect(isAllowedElement("bpmn:CallActivity")).toBe(false);
  });
});

describe("findDisconnectedGateways (AC-002)", () => {
  it("returns empty when all gateways properly connected", () => {
    const nodes = [
      mkNode("start", "bpmn:StartEvent"),
      mkNode("gw1", "bpmn:ExclusiveGateway"),
      mkNode("end", "bpmn:EndEvent"),
    ];
    const flows = [mkFlow("start", "gw1"), mkFlow("gw1", "end")];
    expect(findDisconnectedGateways(nodes, flows)).toEqual([]);
  });

  it("detects gateway with no incoming", () => {
    const nodes = [mkNode("gw1", "bpmn:ExclusiveGateway")];
    const flows = [mkFlow("gw1", "end")];
    expect(findDisconnectedGateways(nodes, flows)).toContain("gw1");
  });

  it("detects gateway with no outgoing", () => {
    const nodes = [mkNode("gw1", "bpmn:ExclusiveGateway")];
    const flows = [mkFlow("start", "gw1")];
    expect(findDisconnectedGateways(nodes, flows)).toContain("gw1");
  });

  it("ignores non-gateway nodes", () => {
    const nodes = [mkNode("t1", "bpmn:Task")];
    const flows: { sourceId: string; targetId: string }[] = [];
    expect(findDisconnectedGateways(nodes, flows)).toEqual([]);
  });
});

describe("findUnreachableStates (AC-002)", () => {
  it("returns empty when all reachable", () => {
    const nodes = [
      mkNode("start", "bpmn:StartEvent"),
      mkNode("t1", "bpmn:Task"),
      mkNode("end", "bpmn:EndEvent"),
    ];
    const flows = [mkFlow("start", "t1"), mkFlow("t1", "end")];
    expect(findUnreachableStates(nodes, flows, "start")).toEqual([]);
  });

  it("detects unreachable state", () => {
    const nodes = [
      mkNode("start", "bpmn:StartEvent"),
      mkNode("t1", "bpmn:Task"),
      mkNode("orphan", "bpmn:Task"),
    ];
    const flows = [mkFlow("start", "t1")];
    expect(findUnreachableStates(nodes, flows, "start")).toContain("orphan");
  });

  it("start node is always reachable", () => {
    const nodes = [mkNode("start", "bpmn:StartEvent")];
    expect(findUnreachableStates(nodes, [], "start")).toEqual([]);
  });
});

describe("validateBpmnGraph (AC-002)", () => {
  it("returns no errors for valid graph", () => {
    const nodes = [
      mkNode("start", "bpmn:StartEvent"),
      mkNode("t1", "bpmn:Task"),
      mkNode("gw1", "bpmn:ExclusiveGateway"),
      mkNode("end", "bpmn:EndEvent"),
    ];
    const flows = [
      mkFlow("start", "t1"),
      mkFlow("t1", "gw1"),
      mkFlow("gw1", "end"),
    ];
    expect(validateBpmnGraph(nodes, flows, "start")).toEqual([]);
  });

  it("returns UNSUPPORTED_ELEMENT for unknown element", () => {
    const nodes = [mkNode("sub", "bpmn:SubProcess")];
    const errors = validateBpmnGraph(nodes, [], "start");
    expect(
      errors.some((e) => e.code === "UNSUPPORTED_ELEMENT" && e.nodeId === "sub")
    ).toBe(true);
  });

  it("returns DISCONNECTED_GATEWAY for isolated gateway", () => {
    const nodes = [
      mkNode("start", "bpmn:StartEvent"),
      mkNode("gw1", "bpmn:ExclusiveGateway"),
    ];
    const flows = [mkFlow("start", "gw1")];
    const errors = validateBpmnGraph(nodes, flows, "start");
    expect(errors.some((e) => e.code === "DISCONNECTED_GATEWAY")).toBe(true);
  });

  it("returns UNREACHABLE_STATE for orphan node", () => {
    const nodes = [
      mkNode("start", "bpmn:StartEvent"),
      mkNode("orphan", "bpmn:Task"),
    ];
    const errors = validateBpmnGraph(nodes, [], "start");
    expect(
      errors.some(
        (e) => e.code === "UNREACHABLE_STATE" && e.nodeId === "orphan"
      )
    ).toBe(true);
  });
});
