import { describe, expect, it } from "vitest";
import { sprintsToDate } from "../../../lib/analytics/release-forecast";

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
