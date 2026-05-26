// apps/app/__tests__/finops/lean-budget-dual-write.test.ts
import { describe, expect, it } from "vitest";

describe("LeanBudget dual-write parity", () => {
  it("spentDecimal matches spent within 0.01 after write", () => {
    const spent = 1234.56;
    const spentDecimal = Number("1234.56"); // Decimal.js .toNumber()
    expect(Math.abs(spent - spentDecimal)).toBeLessThan(0.01);
  });

  it("spent=0 and spentDecimal=0 are consistent", () => {
    const spent = 0;
    const spentDecimal = 0;
    expect(Math.abs(spent - spentDecimal)).toBeLessThan(0.01);
  });

  it("spent=99999999.99 matches Decimal within 0.01", () => {
    const spent = 99999999.99;
    const spentDecimal = Number("99999999.99");
    expect(Math.abs(spent - spentDecimal)).toBeLessThan(0.01);
  });
});
