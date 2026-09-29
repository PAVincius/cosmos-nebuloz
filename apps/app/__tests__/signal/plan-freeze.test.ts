import { describe, expect, it } from "vitest";
import { resolveBaselineValue } from "@/lib/signal/plan-freeze";

// O valor de baseline que uma métrica leva para FROZEN. O congelamento não pode
// apagar um valor que já estava lá: valor assinado ?? valor anterior.
const dims = [
  { key: "TIME", numericValue: "46" },
  { key: "COST", numericValue: "64.5" },
  { key: "QUALITY", numericValue: null },
];

describe("resolveBaselineValue", () => {
  it("usa o valor da dimensão assinada", () => {
    expect(resolveBaselineValue(dims, "TIME", null)).toBe("46");
  });

  it("a dimensão assinada vence o valor anterior", () => {
    expect(resolveBaselineValue(dims, "TIME", "12")).toBe("46");
  });

  it("dimensão sem valor numérico mantém o anterior em vez de sobrescrever com nulo", () => {
    expect(resolveBaselineValue(dims, "QUALITY", "12")).toBe("12");
  });

  it("métrica sem chave de dimensão mantém o anterior", () => {
    expect(resolveBaselineValue(dims, null, "12")).toBe("12");
  });

  it("chave que não existe no baseline mantém o anterior", () => {
    expect(resolveBaselineValue(dims, "OUTRA", "12")).toBe("12");
  });

  it("sem valor assinado e sem anterior, fica nulo", () => {
    expect(resolveBaselineValue(dims, "QUALITY", null)).toBeNull();
    expect(resolveBaselineValue(dims, null, null)).toBeNull();
  });

  it("converte Decimal do Prisma para texto", () => {
    expect(
      resolveBaselineValue(
        [{ key: "TIME", numericValue: 46 as never }],
        "TIME",
        null
      )
    ).toBe("46");
  });
});
