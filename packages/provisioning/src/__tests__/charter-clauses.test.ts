import { describe, expect, it } from "vitest";
import { CHARTER_CLAUSES } from "../charter-clauses";

describe("CHARTER_CLAUSES", () => {
  it("tem 8 entradas", () => {
    expect(CHARTER_CLAUSES).toHaveLength(8);
  });

  it("tem códigos únicos no formato CL-0N", () => {
    const codes = CHARTER_CLAUSES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^CL-0\d$/);
    }
  });

  it("os 8 códigos esperados estão presentes com a criticidade documentada", () => {
    const byCode = Object.fromEntries(
      CHARTER_CLAUSES.map((c) => [c.code, c.critical])
    );
    expect(byCode).toEqual({
      "CL-01": true,
      "CL-02": true,
      "CL-03": true,
      "CL-04": true,
      "CL-05": false,
      "CL-06": false,
      "CL-07": false,
      "CL-08": true,
    });
  });

  it("os códigos batem com os usados historicamente pelo seed de demonstração", () => {
    expect(CHARTER_CLAUSES.map((c) => c.code)).toEqual([
      "CL-01",
      "CL-02",
      "CL-03",
      "CL-04",
      "CL-05",
      "CL-06",
      "CL-07",
      "CL-08",
    ]);
  });
});
