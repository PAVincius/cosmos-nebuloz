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

  it("does not count actions with null dueDate as overdue", () => {
    const input = makeInput({
      openActions: [{ id: "a1", dueDate: null, status: "OPEN" }],
    });
    expect(
      runAllRules(input).find((r) => r.rule === "ImprovementActionOverdue")
    ).toBeUndefined();
  });

  it("does not count DONE actions as overdue", () => {
    const input = makeInput({
      openActions: [
        { id: "a1", dueDate: new Date("2026-05-01"), status: "DONE" },
      ],
    });
    expect(
      runAllRules(input).find((r) => r.rule === "ImprovementActionOverdue")
    ).toBeUndefined();
  });

  it("fires when IN_PROGRESS action is overdue", () => {
    const input = makeInput({
      openActions: [
        { id: "a1", dueDate: new Date("2026-05-01"), status: "IN_PROGRESS" },
      ],
    });
    const rule = runAllRules(input).find(
      (r) => r.rule === "ImprovementActionOverdue"
    );
    expect(rule?.severity).toBe("MEDIUM");
  });
});

describe("VelocityCliff R1 — edge cases", () => {
  it("does not fire when historical avg is zero", () => {
    const history = [
      { flowVelocityTotal: 0 },
      { flowVelocityTotal: 0 },
      { flowVelocityTotal: 0 },
      { flowVelocityTotal: 0 },
    ];
    const input = makeInput({
      current: { ...makeInput().current, flowVelocityTotal: 5 },
      history,
    });
    expect(
      runAllRules(input).find((r) => r.rule === "VelocityCliff")
    ).toBeUndefined();
  });

  it("does not fire when ratio >= 0.7 (only mild drop)", () => {
    const history = [
      { flowVelocityTotal: 40 },
      { flowVelocityTotal: 40 },
      { flowVelocityTotal: 40 },
      { flowVelocityTotal: 40 },
    ];
    const input = makeInput({
      current: { ...makeInput().current, flowVelocityTotal: 30 },
      history,
    });
    expect(
      runAllRules(input).find((r) => r.rule === "VelocityCliff")
    ).toBeUndefined();
  });
});

describe("WIPOverload R2 — edge cases", () => {
  it("does not fire when velocity is zero", () => {
    const input = makeInput({
      current: {
        ...makeInput().current,
        flowVelocityTotal: 0,
        flowLoadCurrent: 100,
      },
    });
    expect(
      runAllRules(input).find((r) => r.rule === "WIPOverload")
    ).toBeUndefined();
  });

  it("does not fire when load <= 2x velocity", () => {
    const input = makeInput({
      current: {
        ...makeInput().current,
        flowVelocityTotal: 10,
        flowLoadCurrent: 20,
      },
    });
    expect(
      runAllRules(input).find((r) => r.rule === "WIPOverload")
    ).toBeUndefined();
  });
});

describe("CycleTimeDegradation R4", () => {
  it("does not fire with fewer than 2 history items with flowTimeAvgDays", () => {
    const input = makeInput({
      history: [{ flowVelocityTotal: 40, flowTimeAvgDays: 5 }],
    });
    expect(
      runAllRules(input).find((r) => r.rule === "CycleTimeDegradation")
    ).toBeUndefined();
  });

  it("does not fire when current cycle time is not 1.5x historical avg", () => {
    const input = makeInput({
      current: { ...makeInput().current, flowTimeAvgDays: 6 },
      history: [
        { flowVelocityTotal: 40, flowTimeAvgDays: 5 },
        { flowVelocityTotal: 38, flowTimeAvgDays: 5 },
      ],
    });
    expect(
      runAllRules(input).find((r) => r.rule === "CycleTimeDegradation")
    ).toBeUndefined();
  });

  it("fires MEDIUM when current cycle time > 1.5x historical avg", () => {
    const input = makeInput({
      current: { ...makeInput().current, flowTimeAvgDays: 12 },
      history: [
        { flowVelocityTotal: 40, flowTimeAvgDays: 5 },
        { flowVelocityTotal: 38, flowTimeAvgDays: 5 },
      ],
    });
    const rule = runAllRules(input).find(
      (r) => r.rule === "CycleTimeDegradation"
    );
    expect(rule?.severity).toBe("MEDIUM");
    expect(rule?.rule).toBe("CycleTimeDegradation");
  });
});

describe("StaleCompetencyAssessment R7", () => {
  it("does not fire when latestAssessmentAt is null", () => {
    const input = makeInput({ latestAssessmentAt: null });
    expect(
      runAllRules(input).find((r) => r.rule === "StaleCompetencyAssessment")
    ).toBeUndefined();
  });

  it("does not fire when assessment is within 180 days", () => {
    const now = new Date("2026-05-22T10:00:00Z");
    const recent = new Date(now.getTime() - 90 * 86_400_000);
    const input = makeInput({ latestAssessmentAt: recent, now });
    expect(
      runAllRules(input).find((r) => r.rule === "StaleCompetencyAssessment")
    ).toBeUndefined();
  });

  it("fires LOW when assessment is older than 180 days", () => {
    const now = new Date("2026-05-22T10:00:00Z");
    const old = new Date(now.getTime() - 200 * 86_400_000);
    const input = makeInput({ latestAssessmentAt: old, now });
    const rule = runAllRules(input).find(
      (r) => r.rule === "StaleCompetencyAssessment"
    );
    expect(rule?.severity).toBe("LOW");
  });
});

describe("WorkTypeImbalance R6 — edge cases", () => {
  it("does not fire when total distribution is zero", () => {
    const input = makeInput({
      current: { ...makeInput().current, flowDistribution: {} },
    });
    expect(
      runAllRules(input).find((r) => r.rule === "WorkTypeImbalance")
    ).toBeUndefined();
  });

  it("does not fire when defect percentage is exactly 40%", () => {
    const input = makeInput({
      current: {
        ...makeInput().current,
        flowDistribution: { story: 60, defect: 40 },
      },
    });
    expect(
      runAllRules(input).find((r) => r.rule === "WorkTypeImbalance")
    ).toBeUndefined();
  });
});
