import { describe, expect, it } from "vitest";
import {
  epicConfidence,
  ragFromDates,
  sprintsToDate,
} from "../../../lib/analytics/release-forecast";

describe("sprintsToDate", () => {
  const anchor = new Date("2026-01-01T00:00:00.000Z");

  it("adds whole sprints × cadence days to the anchor", () => {
    // 3 sprints × 14 days = 42 days after Jan 1 → Feb 12
    expect(sprintsToDate(3, 14, anchor).toISOString()).toBe(
      "2026-02-12T00:00:00.000Z"
    );
  });

  it("rounds fractional sprints up (ceil)", () => {
    // 2.1 sprints → 3 sprints × 10 days = 30 days → Jan 31
    expect(sprintsToDate(2.1, 10, anchor).toISOString()).toBe(
      "2026-01-31T00:00:00.000Z"
    );
  });
});

describe("ragFromDates", () => {
  const d = (iso: string) => new Date(iso);
  const p50 = d("2026-03-01");
  const p85 = d("2026-04-01");

  it("GREEN when p85 date is on or before the due date", () => {
    expect(ragFromDates(p50, p85, d("2026-04-01"))).toBe("GREEN");
    expect(ragFromDates(p50, p85, d("2026-05-01"))).toBe("GREEN");
  });

  it("AMBER when due date is between p50 and p85", () => {
    expect(ragFromDates(p50, p85, d("2026-03-15"))).toBe("AMBER");
  });

  it("RED when due date is before p50", () => {
    expect(ragFromDates(p50, p85, d("2026-02-01"))).toBe("RED");
  });
});

describe("epicConfidence guards", () => {
  const base = {
    historicalThroughput: [10, 10, 10],
    remainingItems: 30,
    dueDate: new Date("2027-01-01"),
    cadenceDays: 14,
    anchor: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("returns GREEN/Complete when nothing remains", () => {
    const r = epicConfidence({ ...base, remainingItems: 0 });
    expect(r.rag).toBe("GREEN");
    expect(r.confidenceLabel).toBe("Complete");
  });

  it("returns GRAY when history has fewer than 3 sprints", () => {
    const r = epicConfidence({ ...base, historicalThroughput: [10, 10] });
    expect(r.rag).toBe("GRAY");
    expect(r.reason).toMatch(/history/i);
  });

  it("returns GRAY when there is no recent delivery", () => {
    const r = epicConfidence({ ...base, historicalThroughput: [0, 0, 0] });
    expect(r.rag).toBe("GRAY");
  });

  it("returns GRAY when there is no due date", () => {
    const r = epicConfidence({ ...base, dueDate: null });
    expect(r.rag).toBe("GRAY");
  });

  it("returns GREEN for a comfortably early due date (deterministic throughput)", () => {
    // Determinism: every throughput value is identical (10), so each Monte Carlo
    // draw subtracts 10 regardless of Math.random() — remaining 30 always needs
    // exactly 3 sprints (p50=p85=p95=3). Do NOT vary these values or the test flakes.
    // 3 sprints × 14d = 42d after anchor → well before the 2027 due date.
    const r = epicConfidence(base);
    expect(r.rag).toBe("GREEN");
    expect(r.confidencePct).toBe(85);
  });
});
