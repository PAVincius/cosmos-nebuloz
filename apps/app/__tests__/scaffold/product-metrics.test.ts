import { describe, expect, it } from "vitest";
import { computeProductMetrics } from "@/lib/scaffold/product-metrics";

// SC-PM-04: métricas de produto do Scaffold em leitura simples. Quatro números,
// com a definição escrita: o que se mede precisa estar dito, senão o número vira
// opinião.

const H = 3_600_000;
const t0 = Date.parse("2026-09-10T12:00:00Z");
const at = (hours: number) => new Date(t0 + hours * H);

const base = {
  startedDeliverables: 0,
  deliverablesWithSummary: 0,
  events: [],
  tracksTotal: 0,
  tracksFromCatalog: 0,
};

describe("resumo dos entregáveis", () => {
  it("percentual sobre os já iniciados, arredondado", () => {
    const m = computeProductMetrics({
      ...base,
      startedDeliverables: 8,
      deliverablesWithSummary: 3,
    });
    expect(m.summaryCoverage).toEqual({
      withSummary: 3,
      started: 8,
      percent: 38,
    });
  });

  it("nada iniciado: sem percentual, e não zero", () => {
    expect(computeProductMetrics(base).summaryCoverage.percent).toBeNull();
  });

  it("todos com resumo: 100", () => {
    const m = computeProductMetrics({
      ...base,
      startedDeliverables: 4,
      deliverablesWithSummary: 4,
    });
    expect(m.summaryCoverage.percent).toBe(100);
  });
});

describe("tempo em revisão", () => {
  it("média em horas entre enviar e a decisão", () => {
    const m = computeProductMetrics({
      ...base,
      events: [
        { deliverableId: "a", action: "SUBMIT", at: at(0) },
        { deliverableId: "a", action: "APPROVE", at: at(10) },
        { deliverableId: "b", action: "SUBMIT", at: at(0) },
        { deliverableId: "b", action: "REQUEST_ADJUSTMENT", at: at(30) },
      ],
    });
    expect(m.reviewTime).toEqual({ reviews: 2, averageHours: 20 });
  });

  it("envio sem decisão ainda não conta (está em revisão agora)", () => {
    const m = computeProductMetrics({
      ...base,
      events: [{ deliverableId: "a", action: "SUBMIT", at: at(0) }],
    });
    expect(m.reviewTime).toEqual({ reviews: 0, averageHours: null });
  });

  it("ciclos repetidos do mesmo entregável contam cada um", () => {
    const m = computeProductMetrics({
      ...base,
      events: [
        { deliverableId: "a", action: "SUBMIT", at: at(0) },
        { deliverableId: "a", action: "REQUEST_ADJUSTMENT", at: at(4) },
        { deliverableId: "a", action: "SUBMIT", at: at(10) },
        { deliverableId: "a", action: "APPROVE", at: at(12) },
      ],
    });
    expect(m.reviewTime).toEqual({ reviews: 2, averageHours: 3 });
  });

  it("não depende da ordem em que os eventos chegam", () => {
    const m = computeProductMetrics({
      ...base,
      events: [
        { deliverableId: "a", action: "APPROVE", at: at(6) },
        { deliverableId: "a", action: "SUBMIT", at: at(0) },
      ],
    });
    expect(m.reviewTime.averageHours).toBe(6);
  });

  it("entregáveis diferentes não se misturam", () => {
    const m = computeProductMetrics({
      ...base,
      events: [
        { deliverableId: "a", action: "SUBMIT", at: at(0) },
        { deliverableId: "b", action: "APPROVE", at: at(5) },
      ],
    });
    expect(m.reviewTime.reviews).toBe(0);
  });

  it("uma casa decimal", () => {
    const m = computeProductMetrics({
      ...base,
      events: [
        { deliverableId: "a", action: "SUBMIT", at: at(0) },
        { deliverableId: "a", action: "APPROVE", at: at(1) },
        { deliverableId: "b", action: "SUBMIT", at: at(0) },
        { deliverableId: "b", action: "APPROVE", at: at(2) },
        { deliverableId: "c", action: "SUBMIT", at: at(0) },
        { deliverableId: "c", action: "APPROVE", at: at(2) },
      ],
    });
    expect(m.reviewTime.averageHours).toBe(1.7);
  });
});

describe("taxa de ajuste", () => {
  it("pedidos de ajuste sobre as decisões de revisão", () => {
    const e = (a: string, i: number) => ({
      deliverableId: `d${i}`,
      action: a as never,
      at: at(i),
    });
    const m = computeProductMetrics({
      ...base,
      events: [
        e("APPROVE", 1),
        e("APPROVE", 2),
        e("APPROVE", 3),
        e("REQUEST_ADJUSTMENT", 4),
      ],
    });
    expect(m.adjustmentRate).toEqual({
      adjustments: 1,
      decisions: 4,
      percent: 25,
    });
  });

  it("nenhuma decisão: sem percentual", () => {
    expect(computeProductMetrics(base).adjustmentRate).toEqual({
      adjustments: 0,
      decisions: 0,
      percent: null,
    });
  });

  it("envio não é decisão", () => {
    const m = computeProductMetrics({
      ...base,
      events: [{ deliverableId: "a", action: "SUBMIT", at: at(0) }],
    });
    expect(m.adjustmentRate.decisions).toBe(0);
  });
});

describe("trilhas iniciadas pelo catálogo", () => {
  it("as sem lacuna do Meridian sobre o total", () => {
    const m = computeProductMetrics({
      ...base,
      tracksTotal: 8,
      tracksFromCatalog: 6,
    });
    expect(m.catalogStarts).toEqual({ fromCatalog: 6, total: 8, percent: 75 });
  });

  it("sem trilha: sem percentual", () => {
    expect(computeProductMetrics(base).catalogStarts.percent).toBeNull();
  });
});
