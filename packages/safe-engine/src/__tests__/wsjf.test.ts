import { describe, expect, it } from "vitest";
import { calculateWSJF } from "../wsjf";

describe("WSJF Calculation", () => {
  it("calculates correct WSJF score", () => {
    // bv: 8, tc: 5, rr: 2 => Cost of Delay = 15
    // js: 3
    // WSJF = 15 / 3 = 5.0
    const score = calculateWSJF({ bv: 8, tc: 5, rr: 2, js: 3 });
    expect(score).toBe(5.0);
  });

  it("rounds to 2 decimal places", () => {
    // 8 + 5 + 2 = 15
    // 15 / 7 = 2.1428...
    const score = calculateWSJF({ bv: 8, tc: 5, rr: 2, js: 7 });
    expect(score).toBe(2.14);
  });

  it("returns 0 when job size is zero", () => {
    const score = calculateWSJF({ bv: 8, tc: 5, rr: 2, js: 0 });
    expect(score).toBe(0);
  });

  it("returns 0 when job size is negative", () => {
    const score = calculateWSJF({ bv: 8, tc: 5, rr: 2, js: -5 });
    expect(score).toBe(0);
  });
});
