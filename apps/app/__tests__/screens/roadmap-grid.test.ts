// roadmap-grid.test.ts — unit coverage for the pure Gantt-grid math behind
// the roadmap screen's multi-PI timeline: quarter-period derivation, item→
// column positioning, and ART-lane grouping. All three are exported from
// the screen module specifically so this math is testable without rendering.
// These helpers live co-located with the client component, so importing
// them transitively imports the "use server" actions/roadmap module — mock
// its runtime dependencies the same way the action-level test does, even
// though none of these tests ever call listRoadmapItems() itself.
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    roadmapItem: { findMany: vi.fn().mockResolvedValue([]) },
    aRT: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import type { RoadmapItemView } from "../../app/(cosmos)/actions/roadmap";
import {
  buildLanes,
  computePeriods,
  positionItem,
} from "../../components/cosmos/screens/roadmap";

function item(overrides: Partial<RoadmapItemView>): RoadmapItemView {
  return {
    id: "id1",
    title: "Item",
    startDate: "2026-01-15T00:00:00.000Z",
    endDate: "2026-02-15T00:00:00.000Z",
    color: "#6366f1",
    status: "PLANNED",
    milestone: false,
    artId: null,
    artName: null,
    ...overrides,
  };
}

describe("computePeriods", () => {
  it("returns no periods for an empty item list", () => {
    expect(computePeriods([])).toEqual([]);
  });

  it("returns a single quarter when every item's dates fall in the same quarter", () => {
    const periods = computePeriods([
      item({
        startDate: "2026-01-05T00:00:00.000Z",
        endDate: "2026-02-10T00:00:00.000Z",
      }),
    ]);
    expect(periods).toHaveLength(1);
    expect(periods[0].label).toBe("T1 2026");
  });

  it("spans every quarter between the earliest start and the latest end, in order", () => {
    const periods = computePeriods([
      item({
        startDate: "2026-01-05T00:00:00.000Z",
        endDate: "2026-01-10T00:00:00.000Z",
      }),
      item({
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2026-11-01T00:00:00.000Z",
      }),
    ]);
    expect(periods.map((p) => p.label)).toEqual([
      "T1 2026",
      "T2 2026",
      "T3 2026",
      "T4 2026",
    ]);
  });

  it("crosses a year boundary correctly", () => {
    const periods = computePeriods([
      item({
        startDate: "2026-11-01T00:00:00.000Z",
        endDate: "2026-11-05T00:00:00.000Z",
      }),
      item({
        startDate: "2027-02-01T00:00:00.000Z",
        endDate: "2027-02-05T00:00:00.000Z",
      }),
    ]);
    expect(periods.map((p) => p.label)).toEqual(["T4 2026", "T1 2027"]);
  });
});

describe("positionItem", () => {
  it("returns null when there are no periods", () => {
    expect(positionItem(item({}), [])).toBeNull();
  });

  it("positions a single-quarter item at colSpan 1", () => {
    const items = [
      item({
        startDate: "2026-01-05T00:00:00.000Z",
        endDate: "2026-02-10T00:00:00.000Z",
      }),
    ];
    const periods = computePeriods(items);
    expect(positionItem(items[0], periods)).toEqual({
      colStart: 1,
      colSpan: 1,
    });
  });

  it("spans multiple columns for a multi-quarter item", () => {
    const items = [
      item({
        startDate: "2026-01-05T00:00:00.000Z",
        endDate: "2026-08-10T00:00:00.000Z",
      }),
    ];
    const periods = computePeriods(items);
    expect(periods).toHaveLength(3); // T1, T2, T3 2026
    expect(positionItem(items[0], periods)).toEqual({
      colStart: 1,
      colSpan: 3,
    });
  });

  it("still positions a zero-duration item (startDate === endDate)", () => {
    const same = "2026-03-15T00:00:00.000Z";
    const items = [item({ startDate: same, endDate: same })];
    const periods = computePeriods(items);
    const pos = positionItem(items[0], periods);
    expect(pos).not.toBeNull();
    expect(pos?.colSpan).toBe(1);
  });

  it("clamps an out-of-range item to the nearest edge column instead of dropping it", () => {
    const periods = computePeriods([
      item({
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-04-10T00:00:00.000Z",
      }),
    ]);
    const before = positionItem(
      item({
        startDate: "2020-01-01T00:00:00.000Z",
        endDate: "2020-01-10T00:00:00.000Z",
      }),
      periods
    );
    expect(before).toEqual({ colStart: 1, colSpan: 1 });
  });
});

describe("buildLanes", () => {
  it("groups items by artId and sorts lanes alphabetically by ART name", () => {
    const items = [
      item({ id: "a", artId: "art-z", artName: "ART Zulu" }),
      item({ id: "b", artId: "art-a", artName: "ART Alpha" }),
      item({ id: "c", artId: "art-a", artName: "ART Alpha" }),
    ];
    const lanes = buildLanes(items);
    expect(lanes.map((l) => l.label)).toEqual(["ART Alpha", "ART Zulu"]);
    expect(lanes.find((l) => l.label === "ART Alpha")?.items).toHaveLength(2);
  });

  it("puts items with no artId in an unassigned lane, sorted last", () => {
    const items = [
      item({ id: "a", artId: null, artName: null }),
      item({ id: "b", artId: "art-a", artName: "ART Alpha" }),
    ];
    const lanes = buildLanes(items);
    expect(lanes.map((l) => l.label)).toEqual([
      "ART Alpha",
      "Sem ART atribuído",
    ]);
  });
});
