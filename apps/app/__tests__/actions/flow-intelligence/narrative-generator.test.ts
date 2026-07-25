// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RULE_PROMPTS } from "@/app/actions/flow-intelligence/anomaly-prompts";

describe("RULE_PROMPTS", () => {
  it("builds VelocityCliff prompt with delta", () => {
    const prompt = RULE_PROMPTS.VelocityCliff?.({
      scope: "team",
      scopeId: "tm_1",
      delta: 0.35,
      before: 40,
      after: 26,
    });
    expect(prompt).toContain("35%");
    expect(prompt).toContain("tm_1");
  });

  it("builds WIPOverload prompt", () => {
    const prompt = RULE_PROMPTS.WIPOverload?.({
      scope: "team",
      scopeId: "tm_2",
      value: 15,
      threshold: 10,
    });
    expect(prompt).toContain("15");
    expect(prompt).toContain("10");
  });

  it("covers all 8 rule types", () => {
    const rules = [
      "VelocityCliff",
      "WIPOverload",
      "PredictabilityCollapse",
      "CycleTimeDegradation",
      "EfficiencyNosedive",
      "WorkTypeImbalance",
      "StaleCompetencyAssessment",
      "ImprovementActionOverdue",
    ];
    for (const r of rules) {
      expect(RULE_PROMPTS[r]).toBeDefined();
    }
  });
});
