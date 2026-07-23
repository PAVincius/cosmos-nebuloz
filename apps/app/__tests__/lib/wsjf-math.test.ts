import { describe, expect, it } from "vitest";
import { computeWeightedWsjfScore } from "../../lib/wsjf-math";

describe("computeWeightedWsjfScore", () => {
  it("reproduces the unweighted classic formula with 1.0/1.0/1.0 defaults", () => {
    const score = computeWeightedWsjfScore(
      { bv: 8, tc: 5, rr: 3, js: 5 },
      { weightBv: 1, weightTc: 1, weightRr: 1 }
    );
    // (8+5+3)/5 = 3.2
    expect(score).toBe(3.2);
  });

  it("applies non-default weights to each component before summing", () => {
    const score = computeWeightedWsjfScore(
      { bv: 8, tc: 5, rr: 3, js: 5 },
      { weightBv: 1.5, weightTc: 1, weightRr: 0.5 }
    );
    // (8*1.5 + 5*1 + 3*0.5)/5 = (12+5+1.5)/5 = 3.7
    expect(score).toBe(3.7);
  });

  it("rounds to 2 decimal places", () => {
    const score = computeWeightedWsjfScore(
      { bv: 5, tc: 5, rr: 5, js: 3 },
      { weightBv: 1, weightTc: 1, weightRr: 1 }
    );
    // 15/3 = 5 exactly, no rounding artifacts
    expect(score).toBe(5);

    const uneven = computeWeightedWsjfScore(
      { bv: 5, tc: 3, rr: 2, js: 3 },
      { weightBv: 1, weightTc: 1, weightRr: 1 }
    );
    // 10/3 = 3.3333... -> rounds to 3.33
    expect(uneven).toBe(3.33);
  });
});
