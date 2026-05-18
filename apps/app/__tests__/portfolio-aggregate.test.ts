import { describe, expect, it } from "vitest";
import {
  aggregateEpicRow,
  effectiveFeatureWsjf,
} from "../lib/portfolio-aggregate";

describe("effectiveFeatureWsjf", () => {
  it("uses persisted score when > 0", () => {
    expect(
      effectiveFeatureWsjf({ bv: 1, tc: 1, rr: 1, js: 1, wsjfScore: 9.5 })
    ).toBe(9.5);
  });

  it("recalculates when wsjfScore is 0", () => {
    // (8+5+2)/3 = 5
    expect(
      effectiveFeatureWsjf({ bv: 8, tc: 5, rr: 2, js: 3, wsjfScore: 0 })
    ).toBe(5);
  });
});

describe("aggregateEpicRow", () => {
  it("averages effective WSJF across features", () => {
    const row = aggregateEpicRow({
      id: "e1",
      title: "Epic A",
      statusId: "BACKLOG",
      order: 0,
      featureCount: 2,
      features: [
        { bv: 8, tc: 5, rr: 2, js: 3, wsjfScore: 0 },
        { bv: 3, tc: 3, rr: 3, js: 3, wsjfScore: 3 },
      ],
    });

    expect(row.wsjfScore).toBe(4);
    expect(row.bv).toBe(11);
    expect(row.tc).toBe(8);
    expect(row.rr).toBe(5);
    expect(row.js).toBe(6);
    expect(row.featureCount).toBe(2);
  });

  it("returns zero WSJF and js=1 when epic has no features", () => {
    const row = aggregateEpicRow({
      id: "e2",
      title: "Empty",
      statusId: "DONE",
      order: 1,
      featureCount: 0,
      features: [],
    });

    expect(row.wsjfScore).toBe(0);
    expect(row.js).toBe(1);
    expect(row.bv).toBe(0);
  });
});
