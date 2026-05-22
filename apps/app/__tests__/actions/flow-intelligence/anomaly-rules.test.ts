import { describe, expect, it } from "vitest";
import {
  type AnomalyRuleInput,
  runAllRules,
} from "@/app/actions/flow-intelligence/anomaly-rules";

function makeInput(
  overrides: Partial<AnomalyRuleInput> = {}
): AnomalyRuleInput {
  return {
    current: {
      flowVelocityTotal: 40,
      flowTimeAvgDays: 5,
      flowEfficiency: 0.8,
      flowPredictability: 0.85,
      flowLoadCurrent: 15,
      flowDistribution: { story: 70, defect: 15, enabler: 15 },
    },
    history: [],
    openActions: [],
    latestAssessmentAt: null,
    now: new Date("2026-05-22T10:00:00Z"),
    ...overrides,
  };
}

describe("runAllRules — healthy input", () => {
  it("returns empty array when all metrics healthy", () => {
    expect(runAllRules(makeInput())).toHaveLength(0);
  });
});

describe("VelocityCliff R1", () => {
  it("fires HIGH when current < 70% of 4-sprint avg", () => {
    const history = [
      { flowVelocityTotal: 40 },
      { flowVelocityTotal: 42 },
      { flowVelocityTotal: 38 },
      { flowVelocityTotal: 40 },
    ];
    const input = makeInput({
      current: { ...makeInput().current, flowVelocityTotal: 25 },
      history,
    });
    const results = runAllRules(input);
    const rule = results.find((r) => r.rule === "VelocityCliff");
    expect(rule).toBeDefined();
    expect(rule?.severity).toBe("HIGH");
  });

  it("does not fire with < 4 history snapshots", () => {
    const input = makeInput({
      current: { ...makeInput().current, flowVelocityTotal: 1 },
      history: [],
    });
    expect(
      runAllRules(input).find((r) => r.rule === "VelocityCliff")
    ).toBeUndefined();
  });
});

describe("WIPOverload R2", () => {
  it("fires CRITICAL when load > 2x velocity", () => {
    const input = makeInput({
      current: {
        ...makeInput().current,
        flowVelocityTotal: 5,
        flowLoadCurrent: 15,
      },
    });
    const rule = runAllRules(input).find((r) => r.rule === "WIPOverload");
    expect(rule).toBeDefined();
    expect(rule?.severity).toBe("CRITICAL");
  });
});

describe("PredictabilityCollapse R3", () => {
  it("fires HIGH when predictability < 0.65", () => {
    const input = makeInput({
      current: { ...makeInput().current, flowPredictability: 0.6 },
    });
    const rule = runAllRules(input).find(
      (r) => r.rule === "PredictabilityCollapse"
    );
    expect(rule).toBeDefined();
    expect(rule?.severity).toBe("HIGH");
  });
});

describe("EfficiencyNosedive R5", () => {
  it("fires MEDIUM when efficiency < 0.45", () => {
    const input = makeInput({
      current: { ...makeInput().current, flowEfficiency: 0.4 },
    });
    const rule = runAllRules(input).find(
      (r) => r.rule === "EfficiencyNosedive"
    );
    expect(rule?.severity).toBe("MEDIUM");
  });
});

describe("WorkTypeImbalance R6", () => {
  it("fires MEDIUM when defects > 40%", () => {
    const input = makeInput({
      current: {
        ...makeInput().current,
        flowDistribution: { story: 55, defect: 42, enabler: 3 },
      },
    });
    const rule = runAllRules(input).find((r) => r.rule === "WorkTypeImbalance");
    expect(rule?.severity).toBe("MEDIUM");
  });
});

describe("ImprovementActionOverdue R8", () => {
  it("fires MEDIUM when action past dueDate", () => {
    const input = makeInput({
      openActions: [
        { id: "a1", dueDate: new Date("2026-05-01"), status: "OPEN" },
      ],
    });
    const rule = runAllRules(input).find(
      (r) => r.rule === "ImprovementActionOverdue"
    );
    expect(rule?.severity).toBe("MEDIUM");
  });

  it("does not fire when no overdue actions", () => {
    const input = makeInput({
      openActions: [
        { id: "a1", dueDate: new Date("2026-12-01"), status: "OPEN" },
      ],
    });
    expect(
      runAllRules(input).find((r) => r.rule === "ImprovementActionOverdue")
    ).toBeUndefined();
  });
});
