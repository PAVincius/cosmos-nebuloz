import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    supplierDeliverable: {
      findMany: dbMocks.findMany,
      updateMany: dbMocks.updateMany,
    },
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn() },
}));

import { aggregateSolutionConfidence } from "../../lib/solution-train/confidence";
import { detectCycleDfs } from "../../lib/solution-train/dependency-dfs";
import {
  detectSupplierDelays,
  markDelayedDeliverables,
} from "../../lib/solution-train/supplier-delay";

// ─── Supplier delay detection (AC-004) ───────────────────────────────────────

describe("detectSupplierDelays (AC-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns alerts for overdue deliverables", async () => {
    const past = new Date("2026-01-01");
    const now = new Date("2026-06-01");

    dbMocks.findMany.mockResolvedValue([
      {
        id: "d-1",
        supplierId: "s-1",
        featureId: "f-1",
        expectedDate: past,
      },
    ]);

    const alerts = await detectSupplierDelays("t-1", now);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].daysOverdue).toBeGreaterThan(0);
    expect(alerts[0].deliverableId).toBe("d-1");
  });

  it("returns empty array when no overdue deliverables (AC-004)", async () => {
    dbMocks.findMany.mockResolvedValue([]);

    const alerts = await detectSupplierDelays("t-1", new Date());

    expect(alerts).toHaveLength(0);
  });

  it("queries with correct filter: past expectedDate AND non-DELIVERED status", async () => {
    dbMocks.findMany.mockResolvedValue([]);
    const now = new Date("2026-06-01");

    await detectSupplierDelays("t-1", now);

    expect(dbMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expectedDate: { lt: now },
          status: { in: ["PENDING", "IN_PROGRESS"] },
        }),
      })
    );
  });

  it("markDelayedDeliverables updates overdue records to DELAYED", async () => {
    dbMocks.updateMany.mockResolvedValue({ count: 3 });
    const now = new Date("2026-06-01");

    const count = await markDelayedDeliverables("t-1", now);

    expect(count).toBe(3);
    expect(dbMocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "DELAYED" },
      })
    );
  });
});

// ─── Solution confidence aggregation (AC-005) ────────────────────────────────

describe("aggregateSolutionConfidence (AC-005)", () => {
  it("computes weighted average across ARTs", () => {
    const tallies = [
      { artId: "art-1", teamCount: 4, averageScore: 3.5 },
      { artId: "art-2", teamCount: 2, averageScore: 4.0 },
    ];

    const result = aggregateSolutionConfidence(tallies);

    // (3.5*4 + 4.0*2) / 6 = (14 + 8) / 6 = 22/6 ≈ 3.667
    expect(result).toBeCloseTo(22 / 6, 3);
  });

  it("returns 0 for empty tallies", () => {
    expect(aggregateSolutionConfidence([])).toBe(0);
  });

  it("returns 0 when total team count is 0", () => {
    const tallies = [{ artId: "art-1", teamCount: 0, averageScore: 4.0 }];
    expect(aggregateSolutionConfidence(tallies)).toBe(0);
  });

  it("single ART returns its own average score", () => {
    const tallies = [{ artId: "art-1", teamCount: 5, averageScore: 3.8 }];
    expect(aggregateSolutionConfidence(tallies)).toBeCloseTo(3.8, 5);
  });
});

// ─── Cross-ART dependency DFS (AC-007) ───────────────────────────────────────

describe("detectCycleDfs (AC-007)", () => {
  it("detects a simple cycle A→B→A", () => {
    const nodes = ["A", "B"];
    const edges = [
      { from: "A", to: "B" },
      { from: "B", to: "A" },
    ];

    const result = detectCycleDfs(nodes, edges);

    expect(result.hasCycle).toBe(true);
    if (result.hasCycle) {
      expect(result.cycle).toContain("A");
      expect(result.cycle).toContain("B");
    }
  });

  it("detects a longer cycle A→B→C→A", () => {
    const nodes = ["A", "B", "C"];
    const edges = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "A" },
    ];

    const result = detectCycleDfs(nodes, edges);

    expect(result.hasCycle).toBe(true);
  });

  it("returns no cycle for a valid DAG", () => {
    const nodes = ["F1", "F2", "F3"];
    const edges = [
      { from: "F1", to: "F2" },
      { from: "F2", to: "F3" },
    ];

    const result = detectCycleDfs(nodes, edges);

    expect(result.hasCycle).toBe(false);
  });

  it("returns no cycle for empty graph", () => {
    expect(detectCycleDfs([], []).hasCycle).toBe(false);
  });

  it("handles disconnected nodes without false positive", () => {
    const nodes = ["F1", "F2", "F3", "F4"];
    const edges = [
      { from: "F1", to: "F2" },
      { from: "F3", to: "F4" },
    ];

    expect(detectCycleDfs(nodes, edges).hasCycle).toBe(false);
  });
});

// ─── STE role guard (AC-006) ──────────────────────────────────────────────────

describe("STE role guard (AC-006)", () => {
  it("MEMBER lacks art:manage; RTE and ADMIN have it", async () => {
    const { hasPermission } = await import(
      "../../../../packages/rbac/src/matrix"
    );
    expect(hasPermission("MEMBER", "art:manage")).toBe(false);
    expect(hasPermission("RTE", "art:manage")).toBe(true);
    expect(hasPermission("ADMIN", "art:manage")).toBe(true);
  });
});
