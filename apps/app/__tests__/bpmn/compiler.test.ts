import { describe, expect, it } from "vitest";
import { compileBpmnToXState } from "../../lib/bpmn/compiler";

// ─── AC-005 XML fixture ───────────────────────────────────────────────────────
// StartEvent → Task(Review) → ExclusiveGateway → [Approved: Task(Implement)] → EndEvent
//                                               → [Rejected: Task(Revise)]   → EndEvent
const AC005_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="Start" name="Start"/>
    <bpmn:task id="Review" name="Review"/>
    <bpmn:exclusiveGateway id="GW" name="Decision"/>
    <bpmn:task id="Implement" name="Implement"/>
    <bpmn:task id="Revise" name="Revise"/>
    <bpmn:endEvent id="End" name="End"/>
    <bpmn:sequenceFlow id="f1" sourceRef="Start" targetRef="Review"/>
    <bpmn:sequenceFlow id="f2" sourceRef="Review" targetRef="GW"/>
    <bpmn:sequenceFlow id="f3" sourceRef="GW" targetRef="Implement">
      <bpmn:conditionExpression>approved</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f4" sourceRef="GW" targetRef="Revise">
      <bpmn:conditionExpression>rejected</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f5" sourceRef="Implement" targetRef="End"/>
    <bpmn:sequenceFlow id="f6" sourceRef="Revise" targetRef="End"/>
  </bpmn:process>
</bpmn:definitions>`;

const WAIT_EVENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="Start" name="Start"/>
    <bpmn:task id="Wait_PR" name="Await_PR" cosmos:waitEvent="github.pr.merged" cosmos:slaHours="48"/>
    <bpmn:endEvent id="End" name="End"/>
    <bpmn:sequenceFlow id="f1" sourceRef="Start" targetRef="Wait_PR"/>
    <bpmn:sequenceFlow id="f2" sourceRef="Wait_PR" targetRef="End"/>
  </bpmn:process>
</bpmn:definitions>`;

const UNSUPPORTED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="Start" name="Start"/>
    <bpmn:subProcess id="Sub" name="SubProcess"/>
    <bpmn:endEvent id="End" name="End"/>
  </bpmn:process>
</bpmn:definitions>`;

describe("compileBpmnToXState (AC-005)", () => {
  it("produces valid XState config with initial=Review and 5+ named states", () => {
    const result = compileBpmnToXState(AC005_XML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.machine.initial).toBe("Review");
    expect(result.machine.id).toBe("custom-workflow");

    const stateNames = Object.keys(result.machine.states);
    // Start, Review, Decision, Implement, Revise, End = 6 states
    expect(stateNames.length).toBeGreaterThanOrEqual(5);
    expect(stateNames).toContain("Review");
    expect(stateNames).toContain("Implement");
    expect(stateNames).toContain("Revise");
    expect(stateNames).toContain("End");
  });

  it("gateway conditions appear as guard strings", () => {
    const result = compileBpmnToXState(AC005_XML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const gwState = result.machine.states.Decision;
    expect(gwState).toBeDefined();
    expect(gwState.on).toBeDefined();
    const transitions = Object.values(gwState.on ?? {});
    const guards = transitions.map((t) => t.guard).filter(Boolean);
    expect(guards).toContain("approved");
    expect(guards).toContain("rejected");
  });

  it("EndEvent becomes final state", () => {
    const result = compileBpmnToXState(AC005_XML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.machine.states.End?.type).toBe("final");
  });

  it("cosmos:WaitEvent properties stored in meta", () => {
    const result = compileBpmnToXState(WAIT_EVENT_XML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const waitState = result.machine.states.Await_PR;
    expect(waitState).toBeDefined();
    expect(waitState.meta?.waitEvent).toBe("github.pr.merged");
    expect(waitState.meta?.slaHours).toBe(48);
  });

  it("returns error for unsupported bpmn: elements", () => {
    const result = compileBpmnToXState(UNSUPPORTED_XML);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors.some((e) => e.code === "UNSUPPORTED_ELEMENT")).toBe(
      true
    );
  });

  it("returns error when no StartEvent present", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="P"><bpmn:task id="T1" name="Task"/></bpmn:process>
</bpmn:definitions>`;
    const result = compileBpmnToXState(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe("NO_START_EVENT");
  });
});
