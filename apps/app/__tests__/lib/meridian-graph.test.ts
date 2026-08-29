import { describe, expect, it } from "vitest";
import {
  detectCycle,
  type GraphGap,
  topologicalOrder,
} from "@/lib/meridian/graph";

// Um ciclo aceito na escrita só aparece meses depois, na geração do plano, e
// aparece como "não consegui ordenar". Estes testes fixam a recusa na escrita.

const gap = (code: string, costOfDelay = 50): GraphGap => ({
  code,
  costOfDelay,
});

describe("detectCycle", () => {
  it("aceita grafo acíclico", () => {
    const edges = [
      { from: "G-02", to: "G-01" },
      { from: "G-03", to: "G-01" },
    ];
    expect(detectCycle(edges)).toBeNull();
  });

  it("recusa ciclo direto e nomeia os gaps", () => {
    const edges = [
      { from: "G-01", to: "G-02" },
      { from: "G-02", to: "G-01" },
    ];
    const cycle = detectCycle(edges);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain("G-01");
    expect(cycle).toContain("G-02");
  });

  it("recusa ciclo indireto", () => {
    const edges = [
      { from: "G-01", to: "G-02" },
      { from: "G-02", to: "G-03" },
      { from: "G-03", to: "G-01" },
    ];
    const cycle = detectCycle(edges);
    expect(cycle).not.toBeNull();
    expect(cycle?.length).toBeGreaterThanOrEqual(3);
  });

  it("recusa auto-dependência", () => {
    expect(detectCycle([{ from: "G-01", to: "G-01" }])).toEqual([
      "G-01",
      "G-01",
    ]);
  });

  it("aceita grafo desconexo", () => {
    const edges = [
      { from: "G-02", to: "G-01" },
      { from: "G-09", to: "G-08" },
    ];
    expect(detectCycle(edges)).toBeNull();
  });
});

describe("topologicalOrder", () => {
  it("põe todo pré-requisito antes do dependente", () => {
    const gaps = [gap("G-01", 88), gap("G-02", 74), gap("G-03", 81)];
    const edges = [
      { from: "G-02", to: "G-01" },
      { from: "G-03", to: "G-02" },
    ];
    const order = topologicalOrder(gaps, edges);
    expect(order.indexOf("G-01")).toBeLessThan(order.indexOf("G-02"));
    expect(order.indexOf("G-02")).toBeLessThan(order.indexOf("G-03"));
  });

  it("desempata por custo de atraso decrescente", () => {
    const gaps = [gap("G-A", 30), gap("G-B", 90), gap("G-C", 60)];
    expect(topologicalOrder(gaps, [])).toEqual(["G-B", "G-C", "G-A"]);
  });

  it("desempata por código quando o custo de atraso empata", () => {
    const gaps = [gap("G-02", 50), gap("G-01", 50)];
    expect(topologicalOrder(gaps, [])).toEqual(["G-01", "G-02"]);
  });

  it("é estável: a ordem de entrada não muda o resultado", () => {
    const gaps = [gap("G-01", 88), gap("G-02", 74), gap("G-03", 81)];
    const edges = [{ from: "G-02", to: "G-01" }];
    expect(topologicalOrder(gaps, edges)).toEqual(
      topologicalOrder([...gaps].reverse(), edges)
    );
  });

  it("lança quando o grafo tem ciclo", () => {
    const gaps = [gap("G-01"), gap("G-02")];
    const edges = [
      { from: "G-01", to: "G-02" },
      { from: "G-02", to: "G-01" },
    ];
    expect(() => topologicalOrder(gaps, edges)).toThrow(/ciclo/i);
  });

  it("ignora aresta que aponta para gap fora do conjunto", () => {
    const gaps = [gap("G-01")];
    const order = topologicalOrder(gaps, [{ from: "G-01", to: "G-99" }]);
    expect(order).toEqual(["G-01"]);
  });
});
