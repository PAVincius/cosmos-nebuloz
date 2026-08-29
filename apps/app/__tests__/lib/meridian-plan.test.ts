import { describe, expect, it } from "vitest";
import { buildPlan } from "@/lib/meridian/plan";

// A invariante que o produto vende: nenhum item do plano vem antes de um
// pré-requisito. Testada sobre grafos gerados, não sobre um exemplo feliz.

const gaps = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    code: `G-${String(i + 1).padStart(2, "0")}`,
    costOfDelay: ((i * 37) % 100) + 1,
  }));

describe("buildPlan", () => {
  it("distribui os itens nos quatro trimestres", () => {
    const plan = buildPlan(gaps(8), []);
    expect(plan).toHaveLength(8);
    expect(new Set(plan.map((p) => p.quarter))).toEqual(new Set([1, 2, 3, 4]));
  });

  it("numera seq de 1 a n, sem buraco", () => {
    const plan = buildPlan(gaps(6), []);
    expect(plan.map((p) => p.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("nunca põe um gap em trimestre anterior ao de um pré-requisito", () => {
    const list = gaps(8);
    const edges = [
      { from: "G-02", to: "G-01" },
      { from: "G-06", to: "G-01" },
      { from: "G-05", to: "G-03" },
      { from: "G-08", to: "G-06" },
    ];
    const plan = buildPlan(list, edges);
    const byCode = new Map(plan.map((p) => [p.gapCode, p]));
    for (const e of edges) {
      const dependent = byCode.get(e.from);
      const prereq = byCode.get(e.to);
      expect(dependent?.quarter).toBeGreaterThanOrEqual(
        prereq?.quarter as number
      );
      expect(dependent?.seq).toBeGreaterThan(prereq?.seq as number);
    }
  });

  it("mantém a invariante em cadeia longa que atravessa os quatro trimestres", () => {
    const list = gaps(12);
    const edges = list
      .slice(1)
      .map((g, i) => ({ from: g.code, to: list[i]?.code as string }));
    const plan = buildPlan(list, edges);
    const byCode = new Map(plan.map((p) => [p.gapCode, p]));
    for (const e of edges) {
      expect(byCode.get(e.from)?.quarter).toBeGreaterThanOrEqual(
        byCode.get(e.to)?.quarter as number
      );
    }
  });

  it("sequencia componentes desconexos independentemente, sem trimestre vazio", () => {
    const list = gaps(4);
    const plan = buildPlan(list, [{ from: "G-02", to: "G-01" }]);
    const quarters = plan.map((p) => p.quarter);
    expect(Math.min(...quarters)).toBe(1);
    expect(new Set(quarters).size).toBe(4);
  });

  it("devolve plano vazio para conjunto vazio", () => {
    expect(buildPlan([], [])).toEqual([]);
  });

  it("é determinístico", () => {
    const list = gaps(9);
    const edges = [{ from: "G-04", to: "G-02" }];
    expect(buildPlan(list, edges)).toEqual(
      buildPlan([...list].reverse(), edges)
    );
  });
});
