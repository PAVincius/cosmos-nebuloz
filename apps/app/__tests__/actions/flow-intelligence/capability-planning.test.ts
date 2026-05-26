// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeCapabilityGap } from "@/app/actions/flow-intelligence/capability-planning/compute-gaps";

const makeTeam = (overrides: object = {}): any => ({
  teamId: "team-1",
  artId: null,
  windowSprints: 5,
  capabilities: {
    backend: { deliveredSp: 100, avgCycleTimeHours: 8, confidenceLevel: 0.8 },
    ml: { deliveredSp: 5, avgCycleTimeHours: 24, confidenceLevel: 0.2 },
  },
  ...overrides,
});

const makeInitiative = (demand: Record<string, number>): any => ({
  initiativeId: "epic-1",
  initiativeType: "epic" as const,
  demand,
});

describe("computeCapabilityGap", () => {
  it("returns higher gap for weaker capability", () => {
    const result = computeCapabilityGap(makeTeam(), makeInitiative({ backend: 0.4, ml: 0.6 }));
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.gapsByCategory.ml.gap).toBeGreaterThan(result.gapsByCategory.backend.gap);
  });

  it("returns zero gap when team has high capability", () => {
    const result = computeCapabilityGap(
      makeTeam({
        capabilities: { backend: { deliveredSp: 200, avgCycleTimeHours: 4, confidenceLevel: 1 } },
      }),
      makeInitiative({ backend: 0.5 }),
    );
    expect(result.gapsByCategory.backend.gap).toBe(0);
  });

  it("recommendation mentions top gap category when gap > 0.3", () => {
    const result = computeCapabilityGap(makeTeam(), makeInitiative({ ml: 0.9 }));
    expect(result.recommendation).toMatch(/ml/i);
  });

  it("does not expose member or person data in output", () => {
    const result = computeCapabilityGap(makeTeam(), makeInitiative({ backend: 0.5 }));
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/member|person|user_id|assignee/i);
  });

  it("overallScore is weighted sum of gaps", () => {
    const result = computeCapabilityGap(
      makeTeam({ capabilities: { backend: { deliveredSp: 0, avgCycleTimeHours: 0, confidenceLevel: 0 } } }),
      makeInitiative({ backend: 0.8 }),
    );
    // gap = 0.8 - 0 = 0.8, weight = 0.8, overallScore = 0.64
    expect(result.overallScore).toBeCloseTo(0.64, 5);
  });
});
